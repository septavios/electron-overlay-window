import { test, describe, it } from 'node:test'
import * as assert from 'node:assert'
import { getAlwaysOnTopLevel } from '../'

describe('Stacking helpers', () => {
  it('returns expected level for current platform', () => {
    const level = getAlwaysOnTopLevel()
    if (process.platform === 'darwin') {
      assert.strictEqual(level, 'screen-saver')
    } else {
      assert.strictEqual(level, undefined)
    }
  })
})

