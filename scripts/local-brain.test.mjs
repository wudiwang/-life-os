import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  buildLocalBrainInvocation,
  parseLocalBrainResponse,
  runLocalBrainSync,
} from './local-brain.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('builds a shell-free invocation to the shared Python provider', () => {
  const got = buildLocalBrainInvocation({
    PYTHON_CMD: 'C:\\Python312\\python.exe',
    LOCAL_BRAIN_SCRIPT: 'C:\\work bench\\scripts\\local_brain.py',
  })
  assert.deepEqual(got, {
    command: 'C:\\Python312\\python.exe',
    args: ['C:\\work bench\\scripts\\local_brain.py'],
  })
})

test('parses provider-qualified sessions', () => {
  const got = parseLocalBrainResponse(JSON.stringify({
    ok: true,
    text: 'answer',
    provider: 'codex',
    session_id: 'codex:abc',
  }))
  assert.equal(got.text, 'answer')
  assert.equal(got.provider, 'codex')
  assert.equal(got.sessionId, 'codex:abc')
})

test('sync client passes JSON over stdin and never uses a shell', () => {
  let captured
  const spawnSyncImpl = (command, args, options) => {
    captured = { command, args, options }
    return {
      status: 0,
      stdout: JSON.stringify({ ok: true, text: 'done', provider: 'codex', session_id: '' }),
      stderr: '',
    }
  }
  const got = runLocalBrainSync(
    { mode: 'text', prompt: 'private prompt', timeout: 30 },
    {
      spawnSyncImpl,
      env: { PYTHON_CMD: 'python', LOCAL_BRAIN_SCRIPT: 'brain.py' },
      timeoutMs: 31000,
    },
  )
  assert.equal(got.text, 'done')
  assert.equal(captured.options.shell, false)
  assert.equal(captured.options.env.PYTHONUTF8, '1')
  assert.equal(captured.options.env.PYTHONIOENCODING, 'utf-8')
  assert.equal(captured.options.input, JSON.stringify({ mode: 'text', prompt: 'private prompt', timeout: 30 }))
  assert.ok(!captured.args.includes('private prompt'))
})

test('rejects failed or malformed provider envelopes', () => {
  assert.throws(
    () => parseLocalBrainResponse('{"ok":false,"error":"all local brain providers failed: codex=quota"}'),
    /codex=quota/,
  )
  assert.throws(() => parseLocalBrainResponse('not json'), /本机大脑响应无效/)
})

test('daily sync and Telegram worker no longer spawn Claude directly', () => {
  const sync = readFileSync(join(root, 'scripts', 'sync-project-progress.mjs'), 'utf8')
  const bot = readFileSync(join(root, 'scripts', 'tg-bot.mjs'), 'utf8')
  assert.match(sync, /runLocalBrain\(/)
  assert.match(sync, /mode: 'text'/)
  assert.doesNotMatch(sync, /mode: 'agent_readonly'/)
  assert.doesNotMatch(sync, /spawn\(`claude/)
  assert.match(bot, /runLocalBrainSync\(/)
  assert.match(bot, /mode: 'agent_workspace'/)
  assert.match(bot, /runLocalBrain\(/)
  assert.match(bot, /mode: 'text'/)
  assert.match(bot, /sid && !sid\.includes\(':'\)/)
  assert.doesNotMatch(bot, /spawnSync\(`claude/)
  assert.doesNotMatch(bot, /spawn\('claude -p'/)
})
