import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { throttle } from 'throttle-debounce'
import { screen } from 'electron'
import { BrowserWindow, Rectangle, BrowserWindowConstructorOptions } from 'electron'
const lib: AddonExports = require('node-gyp-build')(join(__dirname, '..'))

interface AddonExports {
  start(
    overlayWindowId: Buffer | undefined,
    targetWindowTitle: string,
    cb: (e: any) => void
  ): void

  activateOverlay(): void
  focusTarget(): void
  screenshot(): Buffer
}

enum EventType {
  EVENT_ATTACH = 1,
  EVENT_FOCUS = 2,
  EVENT_BLUR = 3,
  EVENT_DETACH = 4,
  EVENT_FULLSCREEN = 5,
  EVENT_MOVERESIZE = 6,
}

export interface AttachEvent {
  hasAccess: boolean | undefined
  isFullscreen: boolean | undefined
  x: number
  y: number
  width: number
  height: number
}

export interface FullscreenEvent {
  isFullscreen: boolean
}

export interface MoveresizeEvent {
  x: number
  y: number
  width: number
  height: number
}

export interface AttachOptions {
  // Whether the Window has a title bar. We adjust the overlay to not cover it
  hasTitleBarOnMac?: boolean
}

const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

export const OVERLAY_WINDOW_OPTS: BrowserWindowConstructorOptions = {
  fullscreenable: true,
  skipTaskbar: !isLinux,
  frame: false,
  show: false,
  transparent: true,
  // let Chromium to accept any size changes from OS
  resizable: !isLinux,
  // disable shadow for Mac OS
  hasShadow: !isMac,
  // float above all windows on Mac OS
  alwaysOnTop: isMac
}

class OverlayControllerGlobal {
  private isInitialized = false
  private electronWindow?: BrowserWindow
  // Exposed so that apps can get the current bounds of the target
  // NOTE: stores screen physical rect on Windows
  targetBounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 }
  targetHasFocus = false
  private focusNext: 'overlay' | 'target' | undefined
  // The height of a title bar on a standard window. Only measured on Mac
  private macTitleBarHeight = 0
  private attachOptions: AttachOptions = {}
  private overlayOffset = { x: 0, y: 0 }
  private overlaySizeOverride: { width: number, height: number } | null = null

  readonly events = new EventEmitter()

  constructor () {
    this.events.on('attach', (e: AttachEvent) => {
      this.targetHasFocus = true
      if (this.electronWindow) {
        this.electronWindow.setIgnoreMouseEvents(true)
        this.electronWindow.setOpacity(0)
        this.electronWindow.showInactive()
        stackOverlayOnTop(this.electronWindow)
      }
      if (e.isFullscreen !== undefined) {
        this.handleFullscreen(e.isFullscreen)
      }
      this.targetBounds = e
      this.updateOverlayBounds()
      if (this.electronWindow) {
        this.electronWindow.setOpacity(1)
      }
    })

    this.events.on('fullscreen', (e: FullscreenEvent) => {
      this.handleFullscreen(e.isFullscreen)
    })

    this.events.on('detach', () => {
      this.targetHasFocus = false
      this.electronWindow?.hide()
    })

    const dispatchMoveresize = throttle(34 /* 30fps */, this.updateOverlayBounds.bind(this))

    this.events.on('moveresize', (e: MoveresizeEvent) => {
      this.targetBounds = e
      dispatchMoveresize()
    })

    this.events.on('blur', () => {
      this.targetHasFocus = false

      if (this.electronWindow && (isMac ||
        this.focusNext !== 'overlay' && !this.electronWindow.isFocused()
      )) {
        this.electronWindow.hide()
      }
    })

    this.events.on('focus', () => {
      const next = this.focusNext
      this.focusNext = undefined
      this.targetHasFocus = true

      if (this.electronWindow) {
        if (next !== 'overlay') {
          this.electronWindow.setIgnoreMouseEvents(true)
        }
        if (!this.electronWindow.isVisible()) {
          this.electronWindow.showInactive()
          stackOverlayOnTop(this.electronWindow)
        }
      }
    })
  }

  private async handleFullscreen(isFullscreen: boolean) {
    if (!this.electronWindow) return

    if (isMac) {
      // On Mac, only a single app can be fullscreen, so we can't go
      // fullscreen. We get around it by making it display on all workspaces,
      // based on code from:
      // https://github.com/electron/electron/issues/10078#issuecomment-754105005
      this.electronWindow.setVisibleOnAllWorkspaces(isFullscreen, { visibleOnFullScreen: true })
      if (isFullscreen) {
        const display = screen.getPrimaryDisplay()
        this.electronWindow.setBounds(display.bounds)
      } else {
        // Set it back to `lastBounds` as set before fullscreen
        this.updateOverlayBounds();
      }
    }
  }

  private updateOverlayBounds () {
    let lastBounds = this.adjustBoundsForMacTitleBar(this.targetBounds)
    if (lastBounds.width === 0 || lastBounds.height === 0) return
    if (!this.electronWindow) return

    if (process.platform === 'win32') {
      lastBounds = screen.screenToDipRect(this.electronWindow, this.targetBounds)
    }
    lastBounds = { ...lastBounds, x: lastBounds.x + this.overlayOffset.x, y: lastBounds.y + this.overlayOffset.y }
    if (this.overlaySizeOverride) {
      lastBounds = { ...lastBounds, width: this.overlaySizeOverride.width, height: this.overlaySizeOverride.height }
    }
    this.electronWindow.setBounds(lastBounds)

    // if moved to screen with different DPI, 2nd call to setBounds will correctly resize window
    // dipRect must be recalculated as well
    if (process.platform === 'win32') {
      lastBounds = screen.screenToDipRect(this.electronWindow, this.targetBounds)
      lastBounds = { ...lastBounds, x: lastBounds.x + this.overlayOffset.x, y: lastBounds.y + this.overlayOffset.y }
      if (this.overlaySizeOverride) {
        lastBounds = { ...lastBounds, width: this.overlaySizeOverride.width, height: this.overlaySizeOverride.height }
      }
      this.electronWindow.setBounds(lastBounds)
    }
  }

  private handler (e: unknown) {
    switch ((e as { type: EventType }).type) {
      case EventType.EVENT_ATTACH:
        this.events.emit('attach', e)
        break
      case EventType.EVENT_FOCUS:
        this.events.emit('focus', e)
        break
      case EventType.EVENT_BLUR:
        this.events.emit('blur', e)
        break
      case EventType.EVENT_DETACH:
        this.events.emit('detach', e)
        break
      case EventType.EVENT_FULLSCREEN:
        this.events.emit('fullscreen', e)
        break
      case EventType.EVENT_MOVERESIZE:
        this.events.emit('moveresize', e)
        break
    }
  }

  /**
   * Create a dummy window to calculate the title bar height on Mac. We use
   * the title bar height to adjust the size of the overlay to not overlap
   * the title bar. This helps Mac match the behaviour on Windows/Linux.
   */
  private calculateMacTitleBarHeight () {
    const testWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      show: false,
    })
    const fullHeight = testWindow.getSize()[1]
    const contentHeight = testWindow.getContentSize()[1]
    this.macTitleBarHeight = fullHeight - contentHeight
    testWindow.close()
  }

  /** If we're on a Mac, adjust the bounds to not overlap the title bar */
  private adjustBoundsForMacTitleBar (bounds: Rectangle) {
    if (!isMac || !this.attachOptions.hasTitleBarOnMac) {
      return bounds
    }

    const newBounds: Rectangle = {
      ...bounds,
      y: bounds.y + this.macTitleBarHeight,
      height: bounds.height - this.macTitleBarHeight
    }
    return newBounds
  }

  activateOverlay () {
    if (!this.electronWindow) {
      throw new Error('You are using the library in tracking mode')
    }
    this.focusNext = 'overlay'
    this.electronWindow.setIgnoreMouseEvents(false)
    stackOverlayOnTop(this.electronWindow)
    if (isLinux) {
      lib.activateOverlay()
    } else {
      this.electronWindow.focus()
    }
  }

  focusTarget () {
    this.focusNext = 'target'
    this.electronWindow?.setIgnoreMouseEvents(true)
    lib.focusTarget()
  }

  setOverlayOffset (x: number, y: number) {
    this.overlayOffset = { x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) }
    this.updateOverlayBounds()
  }

  clearOverlayOffset () {
    this.overlayOffset = { x: 0, y: 0 }
    this.updateOverlayBounds()
  }

  setOverlaySize (width: number, height: number) {
    const w = Math.max(50, Math.round(Number(width) || 0))
    const h = Math.max(50, Math.round(Number(height) || 0))
    this.overlaySizeOverride = { width: w, height: h }
    this.updateOverlayBounds()
  }

  clearOverlaySize () {
    this.overlaySizeOverride = null
    this.updateOverlayBounds()
  }

  attachByTitle (electronWindow: BrowserWindow | undefined, targetWindowTitle: string, options: AttachOptions = {}) {
    if (this.isInitialized) {
      throw new Error('Library can be initialized only once.')
    } else {
      this.isInitialized = true
    }
    this.electronWindow = electronWindow

    this.electronWindow?.on('blur', () => {
      if (!this.targetHasFocus && this.focusNext !== 'target') {
        this.electronWindow!.hide()
      }
    })

    this.electronWindow?.on('focus', () => {
      this.focusNext = undefined
    })

    this.attachOptions = options
    if (isMac) {
      this.calculateMacTitleBarHeight()
    }

    lib.start(
      this.electronWindow?.getNativeWindowHandle(),
      targetWindowTitle,
      this.handler.bind(this))
  }

  // buffer suitable for use in `nativeImage.createFromBitmap`
  screenshot (): Buffer {
    if (process.platform !== 'win32') {
      throw new Error('Not implemented on your platform.')
    }
    return lib.screenshot()
  }
}

export const OverlayController = new OverlayControllerGlobal()

export function getAlwaysOnTopLevel (): string | undefined {
  return isMac ? 'screen-saver' : undefined
}

export function stackOverlayOnTop (win: BrowserWindow) {
  const level = getAlwaysOnTopLevel()
  if (isMac) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setAlwaysOnTop(true, level as any)
  } else {
    win.setAlwaysOnTop(true)
  }
}
