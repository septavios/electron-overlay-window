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

module.exports = { keyboard, Key }
