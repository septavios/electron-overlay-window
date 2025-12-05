import { EventEmitter } from 'events'

export interface NutJsStatus {
  stage: 'module-available' | 'module-missing' | 'typing-start' | 'typing-success' | 'typing-error'
  correlationId: string
  timestamp: number
  details?: any
  error?: string
}

export class NutJsService extends EventEmitter {
  private nut: any = null

  constructor(nutInstance?: any) {
    super()
    if (nutInstance) {
      this.nut = nutInstance
    } else {
      try {
        // Dynamic require to avoid build errors if not present
        this.nut = require('@nut-tree/nut-js')
      } catch (err) {
        // Module not found or failed to load, try local vendor fallback unless disabled
        try {
          const disabled = process.env.DISABLE_VENDOR_NUTJS === '1'
          if (!disabled) {
            const path = require('node:path')
            const localLibnut = require(path.join(process.cwd(), 'vendor', 'nutjs', 'libnut-core'))
            this.nut = {
              keyboard: {
                config: { autoDelayMs: 10 },
                type: async (text: string) => {
                  await localLibnut.typeString(String(text))
                }
              },
              Key: {}
            }
          }
        } catch (e) {
          // Fallback unavailable
        }
      }
    }

    if (this.nut && this.nut.keyboard && this.nut.keyboard.config) {
      this.nut.keyboard.config.autoDelayMs = 10
    }
  }

  isAvailable(): boolean {
    return !!this.nut
  }

  emitAvailability(correlationId: string = 'init'): void {
    const ts = Date.now()
    if (this.nut) {
      this.emit('status', {
        stage: 'module-available',
        correlationId,
        timestamp: ts,
        details: { version: 'detected' }
      } as NutJsStatus)
    } else {
      this.emit('status', {
        stage: 'module-missing',
        correlationId,
        timestamp: ts,
        details: { message: 'Nut.js dependency is not installed or failed to load' }
      } as NutJsStatus)
    }
  }

  async typeText(text: string, correlationId: string): Promise<void> {
    // Capture start time
    const startTimestamp = Date.now()

    if (!this.nut) {
      this.emit('status', {
        stage: 'module-missing',
        correlationId,
        timestamp: startTimestamp,
        details: { message: 'Nut.js dependency is not installed or failed to load' }
      } as NutJsStatus)
      throw new Error('Nut.js module missing')
    }

    this.emit('status', {
      stage: 'module-available',
      correlationId,
      timestamp: startTimestamp,
      details: { version: 'detected' }
    } as NutJsStatus)

    try {
      // Emit start event
      this.emit('status', {
        stage: 'typing-start',
        correlationId,
        timestamp: Date.now(),
        details: {
          length: text.length,
          preview: text.substring(0, 10) + (text.length > 10 ? '...' : '')
        }
      } as NutJsStatus)

      // Initial delay to ensure focus
      await new Promise(resolve => setTimeout(resolve, 150))

      // Perform typing
      await this.nut.keyboard.type(text)

      // Emit success event
      this.emit('status', {
        stage: 'typing-success',
        correlationId,
        timestamp: Date.now(),
        details: {
          confirmed: true,
          charsSent: text.length
        }
      } as NutJsStatus)

    } catch (err: any) {
      const errorMessage = err?.message || String(err)

      // Emit error event
      this.emit('status', {
        stage: 'typing-error',
        correlationId,
        timestamp: Date.now(),
        error: errorMessage,
        details: { stack: err?.stack }
      } as NutJsStatus)

      throw err
    }
  }

  async mouseMoveDemo(dx: number, dy: number): Promise<void> {
    if (!this.nut || !this.nut.mouse) throw new Error('Nut.js module missing')
    await this.nut.mouse.moveRelative(dx, dy)
  }

  async mouseClickDemo(button: string = 'left'): Promise<void> {
    if (!this.nut || !this.nut.mouse) throw new Error('Nut.js module missing')
    await this.nut.mouse.click(button)
  }

  async highlightActiveWindow(ms: number = 700): Promise<void> {
    if (!this.nut || !this.nut.screen) throw new Error('Nut.js module missing')
    await this.nut.screen.highlightActiveWindow(ms)
  }

  getActiveWindowInfo(): any {
    if (!this.nut || !this.nut.screen) throw new Error('Nut.js module missing')
    return this.nut.screen.getActiveWindowInfo()
  }
  async performRichTextAutomation(text: string, correlationId: string): Promise<void> {
    if (!this.nut) throw new Error('Nut.js module missing')

    const startTimestamp = Date.now()
    this.emit('status', {
      stage: 'typing-start',
      correlationId,
      timestamp: startTimestamp,
      details: { length: text.length, mode: 'rich-text' }
    } as NutJsStatus)

    try {
      const { Key } = this.nut

      // 1. Type text
      await new Promise(resolve => setTimeout(resolve, 200)) // Focus delay
      await this.nut.keyboard.type(text)

      // 2. Select text (Shift + Left x N)
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 200))
      await this.nut.keyboard.pressKey(Key.LeftShift)
      for (let i = 0; i < text.length; i++) {
        await this.nut.keyboard.type(Key.Left)
      }
      await this.nut.keyboard.releaseKey(Key.LeftShift)

      // 3. Bold (Cmd + B)
      await new Promise(resolve => setTimeout(resolve, 300))
      await this.nut.keyboard.pressKey(Key.LeftCmd)
      await this.nut.keyboard.type(Key.B)
      await this.nut.keyboard.releaseKey(Key.LeftCmd)

      // 4. Move cursor to end (Right)
      await new Promise(resolve => setTimeout(resolve, 200))
      await this.nut.keyboard.type(Key.Right)

      this.emit('status', {
        stage: 'typing-success',
        correlationId,
        timestamp: Date.now(),
        details: { confirmed: true }
      } as NutJsStatus)

    } catch (err: any) {
      this.emit('status', {
        stage: 'typing-error',
        correlationId,
        timestamp: Date.now(),
        error: err.message
      } as NutJsStatus)
      throw err
    }
  }

  async performClipboardDemo(text: string, correlationId: string): Promise<void> {
    if (!this.nut) throw new Error('Nut.js module missing')

    const startTimestamp = Date.now()
    this.emit('status', {
      stage: 'typing-start',
      correlationId,
      timestamp: startTimestamp,
      details: { length: text.length, mode: 'clipboard-demo' }
    } as NutJsStatus)

    try {
      const { Key } = this.nut

      // 1. Type text
      await new Promise(resolve => setTimeout(resolve, 200))
      await this.nut.keyboard.type(text)

      // 2. Select All (Cmd+A)
      await new Promise(resolve => setTimeout(resolve, 300))
      await this.nut.keyboard.pressKey(Key.LeftCmd)
      await this.nut.keyboard.type(Key.A)
      await this.nut.keyboard.releaseKey(Key.LeftCmd)

      // 3. Copy (Cmd+C)
      await new Promise(resolve => setTimeout(resolve, 300))
      await this.nut.keyboard.pressKey(Key.LeftCmd)
      await this.nut.keyboard.type(Key.C)
      await this.nut.keyboard.releaseKey(Key.LeftCmd)

      // 4. Move Right (deselect)
      await new Promise(resolve => setTimeout(resolve, 200))
      await this.nut.keyboard.type(Key.Right)

      // 5. Type separator
      await this.nut.keyboard.type(' -> Pasted: ')

      // 6. Paste (Cmd+V)
      await new Promise(resolve => setTimeout(resolve, 300))
      await this.nut.keyboard.pressKey(Key.LeftCmd)
      await this.nut.keyboard.type(Key.V)
      await this.nut.keyboard.releaseKey(Key.LeftCmd)

      this.emit('status', {
        stage: 'typing-success',
        correlationId,
        timestamp: Date.now(),
        details: { confirmed: true }
      } as NutJsStatus)

    } catch (err: any) {
      this.emit('status', {
        stage: 'typing-error',
        correlationId,
        timestamp: Date.now(),
        error: err.message
      } as NutJsStatus)
      throw err
    }
  }
}
