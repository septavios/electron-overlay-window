import { test, describe, it, mock } from 'node:test'
import * as assert from 'node:assert'
import { NutJsService, NutJsStatus } from './nutjs-service'

describe('NutJsService', () => {
  it('should emit module-available when vendor nut.js is linked', async () => {
    const service = new NutJsService(null)
    const correlationId = 'test-corr-1'
    const events: NutJsStatus[] = []
    service.on('status', (status) => events.push(status))
    await service.typeText('hello', correlationId)
    assert.strictEqual(events[0].stage, 'module-available')
    assert.strictEqual(events[0].correlationId, correlationId)
  })

  it('should go through full typing lifecycle on success', async () => {
    // Mock nut.js
    const mockType = mock.fn(async () => Promise.resolve())
    const mockNut = {
      keyboard: {
        config: {},
        type: mockType
      }
    }

    const service = new NutJsService(mockNut)
    const correlationId = 'test-corr-2'
    const events: NutJsStatus[] = []
    const text = 'hello world'

    service.on('status', (status) => events.push(status))

    await service.typeText(text, correlationId)

    // Should have 3 events: module-available, typing-start, typing-success
    assert.strictEqual(events.length, 3)

    assert.strictEqual(events[0].stage, 'module-available')
    assert.strictEqual(events[0].correlationId, correlationId)

    assert.strictEqual(events[1].stage, 'typing-start')
    assert.strictEqual(events[1].correlationId, correlationId)
    assert.strictEqual(events[1].details.length, text.length)

    assert.strictEqual(events[2].stage, 'typing-success')
    assert.strictEqual(events[2].correlationId, correlationId)
    assert.strictEqual(events[2].details.confirmed, true)

    assert.strictEqual(mockType.mock.calls.length, 1)
    const callArgs = mockType.mock.calls[0].arguments as any[]
    assert.strictEqual(callArgs[0], text)
  })

  it('should emit typing-error on failure', async () => {
    // Mock nut.js failure
    const mockType = mock.fn(async () => Promise.reject(new Error('Keyboard jammed')))
    const mockNut = {
      keyboard: {
        config: {},
        type: mockType
      }
    }

    const service = new NutJsService(mockNut)
    const correlationId = 'test-corr-3'
    const events: NutJsStatus[] = []

    service.on('status', (status) => events.push(status))

    await assert.rejects(
      async () => await service.typeText('fail', correlationId),
      /Keyboard jammed/
    )

    // Should have 3 events: module-available, typing-start, typing-error
    assert.strictEqual(events.length, 3)
    assert.strictEqual(events[2].stage, 'typing-error')
    assert.strictEqual(events[2].error, 'Keyboard jammed')
    assert.strictEqual(events[2].correlationId, correlationId)
  })
  it('should perform rich text automation sequence', async () => {
    const mockType = mock.fn(async () => Promise.resolve())
    const mockPressKey = mock.fn(async () => Promise.resolve())
    const mockReleaseKey = mock.fn(async () => Promise.resolve())

    const mockNut = {
      Key: {
        Left: 'Left',
        Right: 'Right',
        LeftShift: 'LeftShift',
        LeftCmd: 'LeftCmd',
        B: 'B'
      },
      keyboard: {
        config: {},
        type: mockType,
        pressKey: mockPressKey,
        releaseKey: mockReleaseKey
      }
    }

    const service = new NutJsService(mockNut)
    const correlationId = 'test-corr-rich'

    await service.performRichTextAutomation('foo', correlationId)

    // Verify sequence
    // 1. type text
    assert.strictEqual((mockType.mock.calls[0].arguments as any[])[0], 'foo')

    // 2. Select text (Shift + Left x 3)
    assert.strictEqual((mockPressKey.mock.calls[0].arguments as any[])[0], 'LeftShift')
    assert.strictEqual((mockType.mock.calls[1].arguments as any[])[0], 'Left')
    assert.strictEqual((mockType.mock.calls[2].arguments as any[])[0], 'Left')
    assert.strictEqual((mockType.mock.calls[3].arguments as any[])[0], 'Left')
    assert.strictEqual((mockReleaseKey.mock.calls[0].arguments as any[])[0], 'LeftShift')

    // 3. Bold (Cmd + B)
    assert.strictEqual((mockPressKey.mock.calls[1].arguments as any[])[0], 'LeftCmd')
    assert.strictEqual((mockType.mock.calls[4].arguments as any[])[0], 'B')
    assert.strictEqual((mockReleaseKey.mock.calls[1].arguments as any[])[0], 'LeftCmd')

    // 4. Move Right
    assert.strictEqual((mockType.mock.calls[5].arguments as any[])[0], 'Right')
  })

  it('emitAvailability reports available when nut instance present', () => {
    const mockNut = { keyboard: { config: {} } }
    const service = new NutJsService(mockNut)
    const events: NutJsStatus[] = []
    service.on('status', (s) => events.push(s))
    service.emitAvailability('avail-1')
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].stage, 'module-available')
    assert.strictEqual(events[0].correlationId, 'avail-1')
  })

  it('emitAvailability reports missing when nut instance absent', () => {
    const service = new NutJsService(undefined as any)
    ;(service as any).nut = null
    const events: NutJsStatus[] = []
    service.on('status', (s) => events.push(s))
    service.emitAvailability('miss-1')
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].stage, 'module-missing')
    assert.strictEqual(events[0].correlationId, 'miss-1')
  })
})
