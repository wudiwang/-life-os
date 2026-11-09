// 录音整理 → 每日一记 + 生活泰语。
// 戴着 Apple Watch（或手机放兜里）用「语音备忘录」录一段、甚至录一整天 → iCloud 同步到 Mac
// → 本机 whisper 转文字（录音不出本机）→ 本机 Claude（订阅）整理。
//
// 链路：
//   m4a → afconvert 转 16kHz wav → 静音检测（silero）切出一段段说话
//   → whisper-server（模型只加载一次）逐段识别，每段各自判断语种（一天里中文、泰语、英语混着）
//   → Claude ①：这段录音的摘要 → 每日一记追加一行
//   → Claude ②：从泰语句子里挑最有用的「生活泰语」→ thai_life_phrases（泰语页「🎧 生活」tab）
//   → 全文存本机 .md；TG 推摘要 + 生活泰语清单 + 这些泰语句子的真人原声片段（练听力）
//
// 录音从哪来：launchd com.lifeos.voice-copy 用 /usr/bin/rsync（要开「完全磁盘访问权限」）把受保护的
// 语音备忘录文件夹镜像到 ~/Projects/life-os-voice/.mirror；com.lifeos.voice 发现新文件就跑本脚本。
// 安装：bash scripts/install-launchd.sh --no-brief --no-sync（默认带录音整理，--no-voice 不装）
//
// 用法：
//   node scripts/voice-memos.mjs                 处理镜像里还没整理过的录音（launchd 就是这么调的）
//   node scripts/voice-memos.mjs 某个.m4a ...    直接整理指定的音频文件（不管日期，AirDrop 过来的也行）
//   node scripts/voice-memos.mjs --dry 某个.m4a  只转写 + 整理并打印，不写日记、不推送、不记进度
//   node scripts/voice-memos.mjs --since 2026-11-01   把起始日期往前挪，补整理更早的录音
//   node scripts/voice-memos.mjs --status        看配置、待整理的录音
//
// 首次运行只整理当天（曼谷时间）及以后的录音，旧录音不动。
// 隐私：数据库公开可读，所以上网的只有摘要一行和学习用的泰语句子；
//       转写全文和真人原声片段只在 ~/Projects/life-os-voice/<年-月>/（项目外，不进 git）和 TG 私聊里。
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAIN_MODEL, runLocalBrain } from './local-brain.mjs'
import {
  AUDIO_EXT, MIN_SECONDS, bangkokParts, fmtDuration, buildSummaryPrompt, buildThaiPrompt, buildTimeline, fallbackSummary,
  groupSpeech, journalLine, langCode, langStats, markdownFile, parseSummary, parseThai, parseVad, recordingTime,
  safeName, tgMessage, thaiExcerpt, thaiMessage, thaiRows, transcriptText, wavHeader,
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
const CACHE = join(VOICE_DIR, '.cache')
const STATE_FILE = join(VOICE_DIR, '.state.json')
const LOCK_FILE = join(VOICE_DIR, '.lock')
const MODEL_DIR = join(homedir(), '.cache', 'life-os-whisper')
const MODEL = env.WHISPER_MODEL || join(MODEL_DIR, 'ggml-large-v3-turbo-q5_0.bin')
const VAD_MODEL = env.WHISPER_VAD_MODEL || join(MODEL_DIR, 'ggml-silero-v5.1.2.bin')
const WHISPER_SERVER = env.WHISPER_SERVER || 'whisper-server'
const VAD_CLI = env.WHISPER_VAD_CLI || 'whisper-vad-speech-segments'
const WEB_URL = (env.LIFE_OS_WEB_URL || 'https://life-os-topaz-zeta.vercel.app').replace(/\/+$/, '')
const THAI_LINK = `${WEB_URL}/?page=thai#thai-tab=life`
const MAX_FAILS = 3

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const STATUS = argv.includes('--status')
const sinceIdx = argv.indexOf('--since')
const SINCE = sinceIdx >= 0 ? argv[sinceIdx + 1] : null
const FILES = argv.filter((a, i) => !a.startsWith('--') && !(sinceIdx >= 0 && i === sinceIdx + 1))

const log = msg => console.log(`[${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })}] ${msg}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

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

// ── wav：afconvert 会多写几个块（如 FLLR 填充），要找到真正的 data 块 ──
function openWav(path) {
  const fd = openSync(path, 'r')
  const head = Buffer.alloc(65536)
  const n = readSync(fd, head, 0, head.length, 0)
  let off = 12
  while (off + 8 <= n) {
    const id = head.toString('ascii', off, off + 4), size = head.readUInt32LE(off + 4)
    if (id === 'data') return { fd, data: off + 8, bytes: Math.min(size, statSync(path).size - off - 8) }
    off += 8 + size + (size % 2)
  }
  closeSync(fd)
  throw new Error('wav 里找不到音频数据')
}
function sliceWav(wav, startMs, endMs) {
  const a = Math.max(0, Math.floor(startMs * 16) * 2), b = Math.min(wav.bytes, Math.floor(endMs * 16) * 2)
  const pcm = Buffer.alloc(Math.max(0, b - a))
  if (pcm.length) readSync(wav.fd, pcm, 0, pcm.length, wav.data + a)
  return Buffer.concat([wavHeader(pcm.length), pcm])
}

// ── 识别：whisper-server 只加载一次模型，一段段送进去，每段自动判断语种 ──
async function startServer() {
  const port = 18100 + (process.pid % 800)
  const child = spawn(WHISPER_SERVER, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(port), '-l', 'auto'], { stdio: 'ignore' })
  const url = `http://127.0.0.1:${port}`
  process.on('exit', () => { try { child.kill() } catch { /* 已退出 */ } })
  for (let i = 0; i < 120; i++) {
    if (child.exitCode != null) throw new Error(`whisper-server 没起来（退出码 ${child.exitCode}）`)
    try { await fetch(`${url}/`); return { child, url } } catch { await sleep(500) }
  }
  child.kill()
  throw new Error('whisper-server 启动超时')
}

async function recognize(url, wav) {
  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'chunk.wav')
  form.append('language', 'auto')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  const r = await fetch(`${url}/inference`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(`whisper-server ${r.status}`)
  const j = await r.json()
  const text = String(j.text || '')
  // 出了泰文就算泰语（ค่ะ 这类短词的语种置信度常常很低）
  const lang = /[฀-๿]/.test(text) ? 'th' : langCode(j.detected_language || j.language)
  return { lang, prob: j.detected_language_probability ?? null, text }
}

async function transcribe(wavPath, seconds) {
  const vad = execFileSync(VAD_CLI, ['-vm', VAD_MODEL, '-f', wavPath, '-np', '-vsd', '300', '-vp', '50'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  const chunks = groupSpeech(parseVad(vad), { total: seconds * 1000 })
  const speechSec = chunks.reduce((a, c) => a + (c.end - c.start), 0) / 1000
  log(`静音检测：${chunks.length} 段说话，合计约 ${fmtDuration(speechSec)}`)
  if (!chunks.length) return []

  const wav = openWav(wavPath)
  const { child, url } = await startServer()
  const results = []
  const t0 = Date.now()
  try {
    for (const [i, c] of chunks.entries()) {
      try {
        results.push({ ...c, ...(await recognize(url, sliceWav(wav, c.start, c.end))) })
      } catch (e) {
        log(`第 ${c.id} 段识别失败：${e.message}`)
      }
      if ((i + 1) % 200 === 0) {
        const per = (Date.now() - t0) / (i + 1)
        log(`已识别 ${i + 1}/${chunks.length}，预计还要 ${Math.round(per * (chunks.length - i - 1) / 60000)} 分钟`)
      }
    }
  } finally {
    child.kill()
    closeSync(wav.fd)
  }
  return buildTimeline(results)
}

async function brain(prompt) {
  const r = await runLocalBrain({ mode: 'text', prompt, timeout: 480, model: BRAIN_MODEL }, { timeoutMs: 500000 })
  return r.text
}

// ── 写库 / 推送 ──
const SB = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
  })
  if (!r.ok) throw new Error(`数据库 ${r.status} ${(await r.text()).slice(0, 160)}`)
  const body = await r.text()
  return body ? JSON.parse(body) : null
}

// 每日一记一天一行，content 按行追加（和网页快记的格式一致：[HH:MM] 开头）
async function appendJournal(day, line) {
  const [entry] = await sb(`journal_entries?select=id,content&entry_date=eq.${day}&limit=1`)
  if (entry) await sb(`journal_entries?id=eq.${entry.id}`, { method: 'PATCH', body: JSON.stringify({ content: entry.content ? `${entry.content}\n${line}` : line }) })
  else await sb('journal_entries', { method: 'POST', body: JSON.stringify({ entry_date: day, content: line, gratitude: '' }) })
}

// 同一天同一个读音只留一条（重跑不会重复）
async function saveThai(rows) {
  if (!rows.length) return
  await sb('thai_life_phrases?on_conflict=heard_on,kind,roman', {
    method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  })
}

const TG = env.TELEGRAM_BOT_TOKEN, CHAT = env.TG_ALLOWED_CHAT_ID
async function tg(method, body) {
  if (!TG || !CHAT) { log('未配置 TG，跳过推送'); return }
  const isForm = body instanceof FormData
  if (isForm) body.append('chat_id', CHAT)
  const r = await fetch(`https://api.telegram.org/bot${TG}/${method}`, isForm
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, ...body }) })
  const j = await r.json()
  if (!j.ok) log(`TG ${method} 失败：${JSON.stringify(j).slice(0, 200)}`)
}
const push = text => tg('sendMessage', { text: text.slice(0, 3800) })

// 泰语句子的真人原声：TG 按 10 条一组发成音频（只有 1 条就单发）
async function sendClips(clips) {
  for (let k = 0; k < clips.length; k += 10) {
    const group = clips.slice(k, k + 10)
    const form = new FormData()
    const info = c => ({ title: c.zh.slice(0, 60), performer: c.roman.slice(0, 60), caption: `${c.n}. ${c.roman}\n${c.zh}`.slice(0, 1000) })
    if (group.length === 1) {
      const c = group[0], { title, performer, caption } = info(c)
      form.append('title', title); form.append('performer', performer); form.append('caption', caption)
      form.append('audio', new Blob([readFileSync(c.path)], { type: 'audio/mp4' }), `${c.n}.m4a`)
      await tg('sendAudio', form)
    } else {
      group.forEach((c, j) => form.append(`f${j}`, new Blob([readFileSync(c.path)], { type: 'audio/mp4' }), `${c.n}.m4a`))
      form.append('media', JSON.stringify(group.map((c, j) => ({ type: 'audio', media: `attach://f${j}`, ...info(c) }))))
      await tg('sendMediaGroup', form)
    }
  }
}

// 从原录音里切出挑中的泰语句子（前后各多留 0.4 秒），存成 m4a 放在全文旁边。
// 同一段原声里有好几句（比如店员连着说了两句）只切一次，说明里把这几句都列上
function cutClips(wavPath, timeline, thai, dir) {
  const byId = new Map(timeline.map(s => [s.id, s]))
  const groups = new Map()
  thai.phrases.forEach((p, i) => {
    if (!byId.has(p.clip)) return
    if (!groups.has(p.clip)) groups.set(p.clip, [])
    groups.get(p.clip).push({ ...p, n: i + 1 })
  })
  const wav = openWav(wavPath)
  const out = []
  try {
    for (const [clip, list] of groups) {
      const seg = byId.get(clip)
      const n = list.map(p => p.n).join('、')
      mkdirSync(dir, { recursive: true })
      const tmp = join(dir, `.${clip}.wav`)
      const path = join(dir, `${String(list[0].n).padStart(2, '0')} ${safeName(list[0].zh)}.m4a`)
      writeFileSync(tmp, sliceWav(wav, seg.start - 400, seg.end + 400))
      try { execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', tmp, path], { stdio: 'ignore' }) } finally { rmSync(tmp, { force: true }) }
      out.push({ n, path, roman: list.map(p => p.roman).join(' / '), zh: list.map(p => p.zh).join(' / ') })
    }
  } finally {
    closeSync(wav.fd)
  }
  return out
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

  const work = mkdtempSync(join(tmpdir(), 'life-os-voice-'))
  const wavPath = join(work, 'all.wav')
  try {
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', file, wavPath], { stdio: 'ignore' })

    // 转写最慢（全天录音要几十分钟），做完先缓存：后面 AI 失败重试时不用再转一遍
    mkdirSync(CACHE, { recursive: true })
    const cacheFile = join(CACHE, `${name}.json`)
    let timeline
    if (existsSync(cacheFile)) {
      timeline = JSON.parse(readFileSync(cacheFile, 'utf8'))
      log(`${name}：用缓存的转写（${timeline.length} 句）`)
    } else {
      log(`转写 ${name}（${day} ${hhmm}，${Math.round(seconds / 60)} 分钟）…`)
      const t0 = Date.now()
      timeline = await transcribe(wavPath, seconds)
      writeFileSync(cacheFile, JSON.stringify(timeline))
      log(`转写完成：${timeline.length} 句，用时 ${Math.round((Date.now() - t0) / 1000)} 秒`)
    }
    const stats = langStats(timeline)
    meta.stats = stats
    const transcript = transcriptText(timeline, when)
    log(`说话时长：中文 ${fmtDuration(stats.zh)} · 泰语 ${fmtDuration(stats.th)} · 英语 ${fmtDuration(stats.en)}`)

    if (!transcript) {
      log('没有识别到说话')
      if (DRY) return
      state.done[name] = { at: new Date().toISOString(), skipped: 'silent' }; saveState(state)
      await push(`🎙️ ${day} ${hhmm} 那段录音（${Math.round(seconds)} 秒）没听到有人说话，跳过了。`)
      return
    }

    // 两件事同时问 AI：摘要 + 生活泰语
    const wantThai = stats.thaiLines > 0
    const [sumR, thaiR] = await Promise.allSettled([
      brain(buildSummaryPrompt(transcript, meta)).then(parseSummary),
      wantThai ? brain(buildThaiPrompt(thaiExcerpt(timeline, when), meta)).then(parseThai) : Promise.resolve(null),
    ])
    let summary = sumR.status === 'fulfilled' ? sumR.value : null
    const thai = thaiR.status === 'fulfilled' ? thaiR.value : null
    const failed = [sumR, thaiR].filter(r => r.status === 'rejected')
    if (failed.length) {
      const n = (state.fails[name] || 0) + 1
      log(`AI 整理失败（第 ${n} 次）：${failed.map(r => r.reason?.message).join('；')}`)
      if (DRY) throw failed[0].reason
      if (n < MAX_FAILS) { state.fails[name] = n; saveState(state); return } // 下一轮再试（本机大脑可能暂时不在）
      summary ||= fallbackSummary(transcript)
    }
    const thaiCount = thai ? thai.phrases.length + thai.wish.length : 0

    if (DRY) {
      console.log(`\n—— 每日一记（${day}）——\n${journalLine(meta, summary, thaiCount)}\n\n—— TG ——\n${tgMessage(meta, summary, '(dry)')}`)
      if (thai) console.log(`\n—— 生活泰语 ——\n${thaiMessage(meta, thai, stats, THAI_LINK)}\n\n${JSON.stringify(thai, null, 1)}`)
      console.log(`\n—— 转写 ——\n${transcript.slice(0, 4000)}`)
      return
    }

    // 先落本机全文（什么都不丢），再写日记 / 泰语，记进度，最后推送
    const monthDir = join(VOICE_DIR, day.slice(0, 7))
    mkdirSync(monthDir, { recursive: true })
    const base = `${day} ${hhmm.replace(':', '')} ${safeName(summary.title)}`
    const md = join(monthDir, `${base}.md`)
    writeFileSync(md, markdownFile(meta, summary, transcript, thai))
    await appendJournal(day, journalLine(meta, summary, thaiCount))
    if (thai) {
      try { await saveThai(thaiRows(day, thai, name)) } catch (e) { log(`生活泰语没存上：${e.message}（v20_thai_life.sql 执行了吗？）`) }
    }
    delete state.fails[name]
    state.done[name] = { at: new Date().toISOString(), title: summary.title, md, thai: thaiCount }
    saveState(state)
    log(`✅ ${summary.title} → 每日一记 ${day}；生活泰语 ${thaiCount} 句；全文 ${md}`)

    await push(tgMessage(meta, summary, md.replace(homedir(), '~')))
    if (thai && thaiCount) {
      await push(thaiMessage(meta, thai, stats, THAI_LINK))
      try {
        const clips = cutClips(wavPath, timeline, thai, join(monthDir, `${base} 泰语原声`))
        if (clips.length) await sendClips(clips)
      } catch (e) { log(`原声片段切取/发送失败：${e.message}`) }
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
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
  for (const bin of [WHISPER_SERVER, VAD_CLI]) {
    try { execFileSync(bin, ['--help'], { stdio: 'ignore' }) } catch (e) { if (e.code === 'ENOENT') miss.push(`找不到 ${bin}：brew install whisper-cpp`) }
  }
  if (!existsSync(MODEL)) miss.push(`缺少模型 ${MODEL}（下载命令见 CLAUDE.md「录音整理」一节）`)
  if (!existsSync(VAD_MODEL)) miss.push(`缺少静音检测模型 ${VAD_MODEL}`)
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

let failedCount = 0
for (const file of targets) {
  try { await processFile(file, state) } catch (e) { failedCount++; log(`✗ ${basename(file)}：${e.message}`) }
}
process.exit(failedCount ? 1 : 0)
