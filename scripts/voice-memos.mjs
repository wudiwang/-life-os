// 大仙整理手表录音：Apple Watch「语音备忘录」录一段 → iCloud 同步到 Mac → 本机 whisper 转文字（录音不出本机）
// → 本机 Claude（订阅）总结 → 摘要一行进「每日一记」，全文存 Mac 本地 → TG 推一条。
//
// 链路：
//   语音备忘录文件夹（系统保护，只有拿到「完全磁盘访问权限」的 /usr/bin/rsync 能读）
//     → launchd com.lifeos.voice-copy 用 rsync 镜像到 ~/Projects/life-os-voice/.mirror/
//     → launchd com.lifeos.voice 发现镜像有新文件 → 跑本脚本
//   安装：bash scripts/install-launchd.sh --no-brief --no-sync（默认带录音整理，--no-voice 不装）
//
// 用法：
//   node scripts/voice-memos.mjs                 处理镜像里还没整理过的录音（launchd 就是这么调的）
//   node scripts/voice-memos.mjs 某个.m4a ...    直接整理指定的音频文件（不管日期，AirDrop 过来的也行）
//   node scripts/voice-memos.mjs --dry 某个.m4a  只转写 + 总结并打印，不写日记、不推送、不记进度
//   node scripts/voice-memos.mjs --since 2026-11-01   把起始日期往前挪，补整理更早的录音
//   node scripts/voice-memos.mjs --status        看配置、待整理的录音
//
// 首次运行只整理当天（曼谷时间）及以后的录音，旧录音不动。
// 隐私：数据库是公开可读的，所以只有「标题 + 摘要 + 要点 + 待办」进每日一记；
//       转写全文只存在 ~/Projects/life-os-voice/<年-月>/ 下的 .md（项目外，不进 git）。
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAIN_MODEL, runLocalBrain } from './local-brain.mjs'
import {
  AUDIO_EXT, MIN_SECONDS, bangkokParts, buildSummaryPrompt, cleanSegments, fallbackSummary,
  journalLine, markdownFile, parseSummary, recordingTime, safeName, tgMessage, transcriptText,
} from './voice-memos-core.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env }
const envFile = join(root, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && env[m[1]] == null) env[m[1]] = m[2].trim()
  }
}

// 和 install-launchd.sh 里的路径保持一致
const VOICE_DIR = join(homedir(), 'Projects', 'life-os-voice')
const MIRROR = join(VOICE_DIR, '.mirror')
const STATE_FILE = join(VOICE_DIR, '.state.json')
const LOCK_FILE = join(VOICE_DIR, '.lock')
const MODEL_DIR = join(homedir(), '.cache', 'life-os-whisper')
const MODEL = env.WHISPER_MODEL || join(MODEL_DIR, 'ggml-large-v3-turbo-q5_0.bin')
const VAD_MODEL = env.WHISPER_VAD_MODEL || join(MODEL_DIR, 'ggml-silero-v5.1.2.bin')
const WHISPER = env.WHISPER_CLI || 'whisper-cli'
const MAX_FAILS = 3

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const STATUS = argv.includes('--status')
const sinceIdx = argv.indexOf('--since')
const SINCE = sinceIdx >= 0 ? argv[sinceIdx + 1] : null
const FILES = argv.filter((a, i) => !a.startsWith('--') && !(sinceIdx >= 0 && i === sinceIdx + 1))

const log = msg => console.log(`[${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })}] ${msg}`)

// ── 进度：起始时间 + 已整理 + 失败次数 ──
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { /* 第一次运行 */ }
  const { day } = bangkokParts(new Date())
  return { cutoff: `${day}T00:00:00+07:00`, done: {}, fails: {} }
}
function saveState(state) {
  mkdirSync(VOICE_DIR, { recursive: true })
  writeFileSync(`${STATE_FILE}.tmp`, JSON.stringify(state, null, 2))
  renameSync(`${STATE_FILE}.tmp`, STATE_FILE)
}

// 同一时间只跑一个（launchd 本身不会重叠，防的是手动跑撞上自动跑）
function takeLock() {
  mkdirSync(VOICE_DIR, { recursive: true })
  if (existsSync(LOCK_FILE)) {
    const pid = Number(readFileSync(LOCK_FILE, 'utf8'))
    try { if (pid) { process.kill(pid, 0); return false } } catch { /* 进程已不在，锁是残留的 */ }
  }
  writeFileSync(LOCK_FILE, String(process.pid))
  process.on('exit', () => { try { if (readFileSync(LOCK_FILE, 'utf8') === String(process.pid)) rmSync(LOCK_FILE) } catch { /* 已删 */ } })
  return true
}

function duration(file) {
  const out = execFileSync('afinfo', [file], { encoding: 'utf8' })
  const m = out.match(/estimated duration:\s*([\d.]+)/)
  return m ? Number(m[1]) : 0
}

// m4a → 16kHz 单声道 wav（macOS 自带 afconvert，不用装 ffmpeg）→ whisper 本机转写
function transcribe(file, seconds) {
  const tmp = join(tmpdir(), `life-os-voice-${process.pid}-${Date.now()}`)
  try {
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', file, `${tmp}.wav`], { stdio: 'ignore' })
    const args = ['-m', MODEL, '-l', env.VOICE_LANG || 'auto', '--prompt', '以下是简体中文普通话的录音。', '-np', '-oj', '-of', tmp, `${tmp}.wav`]
    if (existsSync(VAD_MODEL)) args.splice(4, 0, '--vad', '-vm', VAD_MODEL)
    execFileSync(WHISPER, args, { stdio: 'ignore', timeout: Math.max(300, seconds * 1.5) * 1000 })
    const j = JSON.parse(readFileSync(`${tmp}.json`, 'utf8'))
    return { segments: cleanSegments(j.transcription), language: j.result?.language || '' }
  } finally {
    rmSync(`${tmp}.wav`, { force: true }); rmSync(`${tmp}.json`, { force: true })
  }
}

async function summarize(transcript, meta) {
  const r = await runLocalBrain({ mode: 'text', prompt: buildSummaryPrompt(transcript, meta), timeout: 420, model: BRAIN_MODEL }, { timeoutMs: 440000 })
  return parseSummary(r.text)
}

// ── 写库 / 推送 ──
const SB = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
  })
  if (!r.ok) throw new Error(`数据库 ${r.status} ${(await r.text()).slice(0, 160)}`)
  return r.status === 204 ? null : r.json()
}

// 每日一记一天一行，content 按行追加（和网页快记的格式一致：[HH:MM] 开头）
async function appendJournal(day, line) {
  const [entry] = await sb(`journal_entries?select=id,content&entry_date=eq.${day}&limit=1`)
  if (entry) await sb(`journal_entries?id=eq.${entry.id}`, { method: 'PATCH', body: JSON.stringify({ content: entry.content ? `${entry.content}\n${line}` : line }) })
  else await sb('journal_entries', { method: 'POST', body: JSON.stringify({ entry_date: day, content: line, gratitude: '' }) })
}

async function push(text) {
  const token = env.TELEGRAM_BOT_TOKEN, chat = env.TG_ALLOWED_CHAT_ID
  if (!token || !chat) { log('未配置 TG，跳过推送'); return }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3800) }),
  })
  const j = await r.json()
  if (!j.ok) log(`TG 推送失败：${JSON.stringify(j).slice(0, 200)}`)
}

// ── 整理一个文件 ──
async function processFile(file, state) {
  const name = basename(file)
  const st = statSync(file)
  const when = recordingTime(name, st.mtimeMs)
  const { day, hhmm } = bangkokParts(when)
  const seconds = duration(file)
  const meta = { day, hhmm, duration: seconds, source: name }
  if (seconds < MIN_SECONDS) {
    log(`跳过 ${name}：只有 ${seconds.toFixed(1)} 秒`)
    if (!DRY) { state.done[name] = { at: new Date().toISOString(), skipped: 'too-short' }; saveState(state) }
    return
  }

  log(`转写 ${name}（${day} ${hhmm}，${Math.round(seconds)} 秒）…`)
  const t0 = Date.now()
  const { segments, language } = transcribe(file, seconds)
  meta.language = language
  const transcript = transcriptText(segments)
  log(`转写完成：${segments.length} 段，${transcript.length} 字，用时 ${Math.round((Date.now() - t0) / 1000)} 秒，语种 ${language}`)

  if (!transcript) {
    log('没有识别到说话')
    if (DRY) return
    state.done[name] = { at: new Date().toISOString(), skipped: 'silent' }; saveState(state)
    await push(`🎙️ ${day} ${hhmm} 那段录音（${Math.round(seconds)} 秒）没听到有人说话，跳过了。`)
    return
  }

  let summary
  try {
    summary = await summarize(transcript, meta)
  } catch (e) {
    const n = (state.fails[name] || 0) + 1
    log(`AI 整理失败（第 ${n} 次）：${e.message}`)
    if (DRY) throw e
    if (n < MAX_FAILS) { state.fails[name] = n; saveState(state); return } // 下一轮再试（本机大脑可能暂时不在）
    summary = fallbackSummary(transcript)
  }

  if (DRY) {
    console.log(`\n—— 每日一记（${day}）——\n${journalLine(meta, summary)}\n\n—— TG ——\n${tgMessage(meta, summary, '(dry)')}\n\n—— 转写 ——\n${transcript}`)
    return
  }

  // 先落本机全文（什么都不丢），再写日记，最后推送
  const monthDir = join(VOICE_DIR, day.slice(0, 7))
  mkdirSync(monthDir, { recursive: true })
  const md = join(monthDir, `${day} ${hhmm.replace(':', '')} ${safeName(summary.title)}.md`)
  writeFileSync(md, markdownFile(meta, summary, transcript))
  await appendJournal(day, journalLine(meta, summary))
  delete state.fails[name]
  state.done[name] = { at: new Date().toISOString(), title: summary.title, md }
  saveState(state)
  log(`✅ ${summary.title} → 每日一记 ${day}；全文 ${md}`)
  await push(tgMessage(meta, summary, md.replace(homedir(), '~')))
}

function pending(state) {
  if (!existsSync(MIRROR)) return []
  const cutoff = Date.parse(state.cutoff)
  return readdirSync(MIRROR)
    .filter(n => !n.startsWith('.') && AUDIO_EXT.test(n) && !state.done[n])
    .map(n => ({ n, file: join(MIRROR, n), st: statSync(join(MIRROR, n)) }))
    .filter(x => x.st.isFile() && recordingTime(x.n, x.st.mtimeMs).getTime() >= cutoff)
    .sort((a, b) => recordingTime(a.n, a.st.mtimeMs) - recordingTime(b.n, b.st.mtimeMs))
    .map(x => x.file)
}

function preflight() {
  const miss = []
  try { execFileSync(WHISPER, ['--help'], { stdio: 'ignore' }) } catch { miss.push(`找不到 ${WHISPER}：brew install whisper-cpp`) }
  if (!existsSync(MODEL)) miss.push(`缺少模型 ${MODEL}（见 CLAUDE.md「手表录音」一节的下载命令）`)
  if (!DRY && (!SB || !KEY)) miss.push('.env 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  return miss
}

// ── 入口 ──
const state = loadState()

if (STATUS) {
  const mirrored = existsSync(MIRROR) ? readdirSync(MIRROR).filter(n => AUDIO_EXT.test(n)).length : 0
  console.log(`整理目录：${VOICE_DIR}`)
  console.log(`镜像：${existsSync(MIRROR) ? `${mirrored} 个录音` : '还没有（rsync 没拿到「完全磁盘访问权限」或还没装 launchd）'}`)
  console.log(`起始时间：${state.cutoff}；已整理 ${Object.keys(state.done).length} 个`)
  const p = pending(state)
  console.log(`待整理：${p.length ? p.map(f => basename(f)).join('、') : '无'}`)
  const miss = preflight()
  console.log(miss.length ? `⚠ ${miss.join('\n⚠ ')}` : '转写工具和模型：就绪')
  process.exit(0)
}

if (SINCE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(SINCE)) { console.error('--since 要写成 YYYY-MM-DD'); process.exit(1) }
  state.cutoff = `${SINCE}T00:00:00+07:00`
  saveState(state)
  log(`起始日期改为 ${SINCE}`)
}

const miss = preflight()
if (miss.length) { console.error(`✗ ${miss.join('\n✗ ')}`); process.exit(1) }
if (!DRY && !takeLock()) { log('已经有一个整理进程在跑，这次跳过'); process.exit(0) }

const targets = FILES.length ? FILES.map(f => resolve(f)) : pending(state)
if (!targets.length) { if (FILES.length || process.stdout.isTTY) log('没有要整理的录音'); process.exit(0) }

let failed = 0
for (const file of targets) {
  try { await processFile(file, state) } catch (e) { failed++; log(`✗ ${basename(file)}：${e.message}`) }
}
process.exit(failed ? 1 : 0)
