/**
 * Transcript rendering across both Harness message shapes: 0.1.x nests a tool
 * result as a `tool-result` block in a user message, 0.2.x sends a
 * `role: 'tool'` message. Built as plain objects, so no Harness is needed.
 */
import assert from 'node:assert/strict'

import type { Message } from '@deepseek-ai/dsh-llm'

import { lastUserRequest, renderMessage, renderMessages } from '../src/render.ts'

let checks = 0
function check(label: string, condition: boolean): void {
  assert.ok(condition, label)
  checks += 1
}

const message = (shape: Record<string, unknown>): Message => shape as unknown as Message

const user = message({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'fix it' }] })
const injected = message({
  role: 'user',
  source: { kind: 'dsh-jev-loop' },
  content: [{ type: 'text', text: 'ask first' }],
})

// 0.1.x: the result is a block inside a user-role message.
const legacy = message({
  role: 'user',
  source: { kind: 'tool', callId: 'c1' },
  content: [{ type: 'tool-result', toolCallId: 'c1', isError: true, content: [{ type: 'text', text: 'boom' }] }],
})
check('renders a 0.1 tool-result block', renderMessage(legacy) === 'user: [tool result error] boom')

// 0.2.x: the result is its own tool-role message, error flag on the message.
const modern = message({
  role: 'tool',
  toolCallId: 'c2',
  isError: true,
  source: { kind: 'tool', callId: 'c2' },
  content: [{ type: 'text', text: 'boom' }],
})
check('renders a 0.2 tool-role message', renderMessage(modern) === 'tool error: boom')
check(
  'renders a successful 0.2 tool message',
  renderMessage(message({ ...modern, isError: undefined })) === 'tool: boom',
)

check('unknown blocks fall through by type', renderMessage(message({ role: 'developer', content: [{ type: 'tool-addition', toolName: 'x' }] })) === 'developer: [tool-addition]')
check('the last human prompt skips plugin-sourced messages', lastUserRequest([user, injected]) === 'user: fix it')
check('renderMessages keeps the tail', renderMessages([user, legacy, modern], 2, 1000).startsWith('user: [tool result'))

console.log(`ok - ${String(checks)} render checks passed`)
