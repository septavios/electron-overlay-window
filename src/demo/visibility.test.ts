import { test, describe, it } from 'node:test'
import * as assert from 'node:assert'

function nextHiddenState(isInteractive: boolean, isUIHiddenManual: boolean) {
  // Mirrors renderer logic: auto-hide only when not overridden
  if (isUIHiddenManual) return true
  return !isInteractive
}

describe('Visibility toggle logic', () => {
  it('auto-hides UI in passthrough when not manually overridden', () => {
    assert.strictEqual(nextHiddenState(false, false), true)
    assert.strictEqual(nextHiddenState(true, false), false)
  })

  it('respects manual override regardless of interactive state', () => {
    assert.strictEqual(nextHiddenState(true, true), true)
    assert.strictEqual(nextHiddenState(false, true), true)
  })
})

