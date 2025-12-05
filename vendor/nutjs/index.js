const libnut = require('./libnut-core')

const Key = {
  LeftShift: 'shift',
  LeftCmd: process.platform === 'darwin' ? 'command' : 'control',
  B: 'b',
  Right: 'right',
  Left: 'left',
  A: 'a',
  C: 'c',
  V: 'v'
}

function normalizeModifier(mod) {
  const m = String(mod).toLowerCase()
  if (m === 'command' || m === 'cmd') return 'command'
  if (m === 'option') return 'alt'
  if (m === 'control' || m === 'ctrl') return 'control'
  if (m === 'shift') return 'shift'
  if (m === 'meta') return 'command'
  return m
}

const keyboard = {
  config: { autoDelayMs: 10 },
  _mods: new Set(),
  async type(input) {
    if (typeof input === 'string') {
      await libnut.typeString(String(input))
    } else {
      const key = String(input).toLowerCase()
      const mods = Array.from(this._mods)
      if (mods.length > 0) {
        await libnut.keyTap(key, mods)
      } else {
        await libnut.keyTap(key)
      }
    }
  },
  async pressKey(key) {
    const k = String(key).toLowerCase()
    const mod = normalizeModifier(k)
    if (['command','control','shift','alt'].includes(mod)) {
      this._mods.add(mod)
      return
    }
    await libnut.keyToggle(k, 'down')
  },
  async releaseKey(key) {
    const k = String(key).toLowerCase()
    const mod = normalizeModifier(k)
    if (['command','control','shift','alt'].includes(mod)) {
      this._mods.delete(mod)
      return
    }
    await libnut.keyToggle(k, 'up')
  }
}

const mouse = {
  async moveRelative(dx, dy) {
    const pos = libnut.getMousePos()
    const x = Math.max(0, Math.round((pos && pos.x) ? pos.x + dx : dx))
    const y = Math.max(0, Math.round((pos && pos.y) ? pos.y + dy : dy))
    await libnut.moveMouse(x, y)
  },
  async click(button = 'left') {
    await libnut.mouseClick(String(button))
  },
  async scroll(dx, dy) {
    await libnut.scrollMouse(Math.round(dx || 0), Math.round(dy || 0))
  }
}

const screen = {
  async highlightActiveWindow(ms = 600) {
    try {
      const w = libnut.getActiveWindow()
      const rect = libnut.getWindowRect(w)
      if (rect && typeof rect.x === 'number') {
        await libnut.highlight(rect.x, rect.y, rect.width, rect.height, Math.max(100, ms))
      }
    } catch {}
  },
  getActiveWindowInfo() {
    try {
      const w = libnut.getActiveWindow()
      const title = libnut.getWindowTitle(w)
      const rect = libnut.getWindowRect(w)
      return { title, rect }
    } catch (e) {
      return { error: e && e.message }
    }
  }
}

module.exports = { keyboard, Key, mouse, screen }
