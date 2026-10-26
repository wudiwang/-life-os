import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

const DEFAULT_SCRIPT = 'C:\\Users\\ADMIN\\Projects\\lh-pm-workbench\\scripts\\local_brain.py'

// 人生 OS 的 AI 统一钉死 Opus 5.5：别名 'opus' 会在新版发布时自动跳走。
export const BRAIN_MODEL = 'claude-opus-5-5'

export function buildLocalBrainInvocation(env = process.env) {
  const installedPython = join(env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'Python', 'Python312', 'python.exe')
  const command = env.PYTHON_CMD || (existsSync(installedPython) ? installedPython : 'python')
  return {
    command,
    args: [env.LOCAL_BRAIN_SCRIPT || DEFAULT_SCRIPT],
  }
}

export function parseLocalBrainResponse(stdout) {
  let payload
  try {
    payload = JSON.parse(String(stdout || '').trim())
  } catch {
    throw new Error('本机大脑响应无效')
  }
  if (!payload || payload.ok !== true || typeof payload.text !== 'string' || !payload.text.trim()) {
    const detail = payload && typeof payload.error === 'string' ? `：${payload.error.slice(0, 240)}` : ''
    throw new Error(`本机大脑调用失败${detail}`)
  }
  return {
    text: payload.text.trim(),
    provider: String(payload.provider || ''),
    sessionId: String(payload.session_id || ''),
  }
}

export function runLocalBrainSync(request, options = {}) {
  const env = options.env || process.env
  const { command, args } = buildLocalBrainInvocation(env)
  const spawnSyncImpl = options.spawnSyncImpl || spawnSync
  const timeoutMs = options.timeoutMs || ((Number(request.timeout) || 300) + 10) * 1000
  const result = spawnSyncImpl(command, args, {
    input: JSON.stringify(request),
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  })
  if (result.error) throw new Error(`本机大脑进程失败：${result.error.message}`)
  if (result.status !== 0) return parseLocalBrainResponse(result.stdout)
  return parseLocalBrainResponse(result.stdout)
}

export function runLocalBrain(request, options = {}) {
  const env = options.env || process.env
  const { command, args } = buildLocalBrainInvocation(env)
  const spawnImpl = options.spawnImpl || spawn
  const timeoutMs = options.timeoutMs || ((Number(request.timeout) || 300) + 10) * 1000
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      shell: false,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    const timer = setTimeout(() => {
      child.kill()
      finish(reject, new Error('本机大脑调用超时'))
    }, timeoutMs)
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    child.on('error', error => finish(reject, new Error(`本机大脑进程失败：${error.message}`)))
    child.on('close', code => {
      if (code !== 0) {
        try {
          return finish(reject, parseLocalBrainResponse(stdout))
        } catch (error) {
          const detail = stderr.trim().slice(-500)
          return finish(reject, new Error(`${error.message}${detail ? `；进程：${detail}` : ''}`))
        }
      }
      try {
        finish(resolve, parseLocalBrainResponse(stdout))
      } catch (error) {
        finish(reject, error)
      }
    })
    child.stdin.end(JSON.stringify(request))
  })
}
