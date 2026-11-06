import { existsSync, readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WINDOWS_SCRIPT = 'C:\\Users\\ADMIN\\Projects\\lh-pm-workbench\\scripts\\local_brain.py'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOTENV_KEYS = ['PYTHON_CMD', 'LOCAL_BRAIN_SCRIPT']

// 人生 OS 的 AI 统一钉死 Opus 5.5：别名 'opus' 会在新版发布时自动跳走。
export const BRAIN_MODEL = 'claude-opus-5-5'

// Windows 沿用原路径；Mac/Linux 默认 ~/Projects/lh-pm-workbench（迁移清单约定的克隆位置）
export function defaultLocalBrainScript(platform = process.platform, home = homedir()) {
  return platform === 'win32' ? WINDOWS_SCRIPT : join(home, 'Projects', 'lh-pm-workbench', 'scripts', 'local_brain.py')
}

// PYTHON_CMD / LOCAL_BRAIN_SCRIPT 可写在 .env；进程环境变量优先
export function localBrainEnv(root = ROOT, processEnv = process.env) {
  const fromFile = {}
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && DOTENV_KEYS.includes(m[1]) && m[2].trim()) fromFile[m[1]] = m[2].trim()
    }
  } catch { /* 没有 .env 就只用进程环境变量 */ }
  return { ...fromFile, ...processEnv }
}

export function buildLocalBrainInvocation(env = localBrainEnv(), platform = process.platform) {
  let command = env.PYTHON_CMD
  if (!command) {
    if (platform === 'win32') {
      const installedPython = join(env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local', 'Programs', 'Python', 'Python312', 'python.exe')
      command = existsSync(installedPython) ? installedPython : 'python'
    } else {
      command = 'python3'
    }
  }
  return {
    command,
    args: [env.LOCAL_BRAIN_SCRIPT || defaultLocalBrainScript(platform, env.HOME || homedir())],
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
  const env = options.env || localBrainEnv()
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
  const env = options.env || localBrainEnv()
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
