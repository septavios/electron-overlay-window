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

const keyboard = {
  config: { autoDelayMs: 10 },
  async type(input) {
    if (typeof input === 'string') {
      await libnut.typeString(String(input))
    } else {
      const key = String(input)
      await libnut.keyTap(key)
    }
  },
  async pressKey(key) {
    await libnut.keyToggle(String(key), 'down')
  },
  async releaseKey(key) {
    await libnut.keyToggle(String(key), 'up')
  }
}

module.exports = { keyboard, Key }
