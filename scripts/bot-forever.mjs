// 大仙守护进程：tg-bot.mjs 崩溃/退出后自动重启（网络抖动、底层崩溃都能自愈）
// 用法：npm run bot   （Ctrl+C 彻底停止）
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let stopping = false

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
