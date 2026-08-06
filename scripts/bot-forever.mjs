// 大仙守护进程：tg-bot.mjs 崩溃/退出后自动重启（网络抖动、底层崩溃都能自愈）
// 用法：npm run bot   （Ctrl+C 彻底停止）
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCK = join(root, 'scripts', '.bot.lock')
let stopping = false

// 单实例锁：多份 bot 同时跑会抢同一个 TG token（409 冲突、消息丢），也会抢同一批 ai_jobs。
// 锁里存 pid，进程没了就算过期锁，直接接管。
if (existsSync(LOCK)) {
  const pid = Number(readFileSync(LOCK, 'utf8').trim())
  let alive = false
  try { process.kill(pid, 0); alive = true } catch { alive = false }
  if (alive) {
    console.error(`⛔ 已经有一个大仙在跑了（pid ${pid}），本次不启动。`)
    console.error('   要重启：先结束那个进程，或运行 taskkill /PID ' + pid + ' /T /F')
    process.exit(1)
  }
  console.log(`♻️ 发现过期锁（pid ${pid} 已不在），接管。`)
}
writeFileSync(LOCK, String(process.pid))

const releaseLock = () => { try { unlinkSync(LOCK) } catch { /* 已被清掉，忽略 */ } }
process.on('exit', releaseLock)
process.on('SIGINT', () => { stopping = true; process.exit(0) })
process.on('SIGTERM', () => { stopping = true; process.exit(0) })

function start(attempt = 0) {
  const child = spawn(process.execPath, [join(root, 'scripts', 'tg-bot.mjs')], {
    cwd: root, stdio: 'inherit',
  })
  child.on('exit', code => {
    if (stopping) return
    const delay = Math.min(60, 5 * (attempt + 1))
    console.log(`⚠️ 大仙进程退出（code=${code}），${delay} 秒后自动重启...`)
    setTimeout(() => start(code === 0 ? 0 : attempt + 1), delay * 1000)
  })
}

console.log('🛡️ 守护进程启动')
start()
