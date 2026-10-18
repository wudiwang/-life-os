import { useEffect, useRef, useState } from 'react'
import { COLORS } from '../../lib/constants'
import { db, isDemo } from '../../lib/dataStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { THAI_COURSE_VERSION, THAI_LESSONS, THAI_READING_GUIDE } from './thaiLessons'
import { nextLessonDay, parseLessonDay, practiceRow, validProgress } from './thaiProgress'
import { createThaiAudioPlayer } from './thaiAudio'

const button = { minHeight: 44, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: '10px 16px', color: COLORS.text, background: '#fff', cursor: 'pointer', fontSize: 14 }
const subtle = { color: COLORS.textLight, fontSize: 13, lineHeight: 1.7 }
const groups = ['先能开口', '吃饭喝东西', '日常购物', '出门办事', '天气与求助', '扩展表达']

export function ThaiPage() {
  const mobile = useIsMobile()
  const [day, setDay] = useState(() => parseLessonDay(window.location.hash))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [hideChinese, setHideChinese] = useState(false)
  const [audio, setAudio] = useState({ status: 'idle', id: null })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const player = useRef(null)
  const savingLock = useRef(false)
  const live = useRef(false)

  useEffect(() => {
    live.current = true
    player.current = createThaiAudioPlayer({ onChange: setAudio })
    const navigate = () => setDay(parseLessonDay(window.location.hash))
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    return () => {
      live.current = false
      player.current.dispose()
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(false)
    db.list('thai_learning_progress', { filters: { course_version: THAI_COURSE_VERSION }, orderBy: 'lesson_day', ascending: true }).then(data => {
      if (!cancelled) setRows(data.filter(validProgress))
    }).catch(() => { if (!cancelled) setLoadError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [revision])

  useEffect(() => {
    player.current?.stop()
    setHideChinese(false)
    setNotice(null)
    window.scrollTo(0, 0)
  }, [day])

  const lesson = THAI_LESSONS.find(item => item.day === day)
  const practiced = rows.find(row => row.lesson_day === day)
  const resumeDay = nextLessonDay(rows)
  async function markPracticed() {
    if (savingLock.current || !lesson || loading || loadError) return
    const savedDay = lesson.day
    savingLock.current = true; setSaving(true); setNotice(null)
    try {
      const saved = await db.upsert('thai_learning_progress', practiceRow(savedDay), ['course_version', 'lesson_day'])
      if (!validProgress(saved)) throw new Error('Save was not confirmed')
      if (live.current) {
        setRows(old => [...old.filter(row => row.lesson_day !== savedDay), saved])
        setNotice({ day: savedDay, ok: true, text: '已记下，今天读到这里就好。' })
      }
    } catch {
      if (live.current) setNotice({ day: savedDay, ok: false, text: '未能保存，请再试一次。刚才读过的内容不用重学。' })
    } finally {
      savingLock.current = false
      if (live.current) setSaving(false)
    }
  }

  function phrase(item, index, isWord = false) {
    const active = audio.id === item.id && ['loading', 'playing'].includes(audio.status)
    return <div key={item.id} style={{ display: 'flex', gap: 12, padding: isWord ? '14px 0' : '20px 0', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!isWord && <div style={{ ...subtle, fontSize: 11, marginBottom: 5 }}>{item.role}</div>}
        <div style={{ fontSize: isWord ? 16 : 18, fontWeight: 600, lineHeight: 1.6, color: hideChinese ? COLORS.textLight : COLORS.text }}>
          {hideChinese ? '中文已遮住' : item.zh}
        </div>
        <div lang="th" style={{ fontSize: isWord ? 19 : 22, lineHeight: 1.7, marginTop: 3 }}>{item.th}</div>
        <div style={{ color: COLORS.primaryDark, fontSize: 15, lineHeight: 1.7, overflowWrap: 'anywhere' }}>{item.roman}</div>
      </div>
      <button type="button" aria-label={`${active ? '停止' : '播放'}${isWord ? '关键词' : '对话'}${index + 1}`} aria-pressed={active} onClick={() => player.current?.play(item.id)} style={{ ...button, padding: 0, width: 48, height: 48, flexShrink: 0, color: COLORS.primaryDark, background: active ? '#DBEAFE' : '#EFF6FF', borderColor: '#BFDBFE', fontSize: 21 }}>
        <span aria-hidden="true">{active ? '■' : '🔊'}</span>
      </button>
    </div>
  }

  const progressStatus = <>
    {isDemo && <p style={subtle}>本机演示 · 练习记录只保存在当前浏览器</p>}
    {loading && <p role="status" style={subtle}>正在读取练习记录，不影响听读。</p>}
    {loadError && <div role="alert" style={{ ...subtle, color: '#9A3412', padding: '10px 0' }}>练习记录暂时不可用，仍可以听读。 <button style={button} onClick={() => setRevision(n => n + 1)}>重试读取</button></div>}
  </>

  return <main style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32, color: COLORS.text }}>
    {!lesson ? <>
      <header style={{ padding: '12px 0 24px' }}>
        <p style={{ ...subtle, margin: 0 }}>每天一点 · 生活口语 30 天</p>
        <h1 style={{ fontSize: mobile ? 27 : 32, margin: '8px 0 10px', letterSpacing: '-0.5px' }}>泰语，开口就好</h1>
        <p style={{ ...subtle, fontSize: 15 }}>看一遍，听一句，跟读几下。每天约 3～5 分钟。</p>
        <a href={`#thai-day=${resumeDay}`} style={{ ...button, display: 'inline-flex', alignItems: 'center', color: '#fff', background: COLORS.primaryDark, borderColor: COLORS.primaryDark, textDecoration: 'none' }}>
          {rows.length ? '继续学习' : '从这里开始'} · 第 {resumeDay} 天 →
        </a>
        {progressStatus}
      </header>
      {groups.map((title, index) => <section key={title} style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 14, color: COLORS.textLight, fontWeight: 500, margin: '0 0 8px' }}>{title} · 第 {index * 5 + 1}～{index * 5 + 5} 天</h2>
        <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {THAI_LESSONS.slice(index * 5, index * 5 + 5).map(item => {
            const record = rows.find(row => row.lesson_day === item.day)
            return <a key={item.day} href={`#thai-day=${item.day}`} style={{ padding: mobile ? '15px 14px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 12, color: COLORS.text, textDecoration: 'none', borderBottom: item.day % 5 ? `1px solid ${COLORS.border}` : 'none', minHeight: 58 }}>
              <span style={{ color: COLORS.textLight, fontSize: 12, minWidth: 34 }}>{String(item.day).padStart(2, '0')}</span>
              <span style={{ flex: 1, fontSize: 15 }}>{item.title}</span>
              {record && <span style={{ ...subtle, fontSize: 11 }}>读过</span>}
              <span aria-hidden="true" style={{ color: COLORS.textLight }}>›</span>
            </a>
          })}
        </div>
      </section>)}
    </> : <>
      <a href="#thai" style={{ ...subtle, display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'none' }}>‹ 30 天目录</a>
      <header style={{ margin: '10px 0 20px' }}>
        <div style={subtle}>第 {day} / 30 天 · 约 3～5 分钟</div>
        <h1 style={{ fontSize: mobile ? 27 : 32, margin: '6px 0 10px' }}>{lesson.title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, margin: 0 }}>{lesson.goal}</p>
      </header>
      <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: mobile ? '16px 18px' : '22px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>先认这 3 个词</h2>
          <button style={{ ...button, fontSize: 12, padding: '8px 10px' }} aria-pressed={hideChinese} onClick={() => setHideChinese(value => !value)}>{hideChinese ? '显示中文' : '遮住中文'}</button>
        </div>
        {lesson.words.map((item, i) => phrase(item, i, true))}
        <h2 style={{ fontSize: 16, margin: '30px 0 4px' }}>放进对话，跟着读</h2>
        <p style={{ ...subtle, margin: 0 }}>点右边的小喇叭，再跟读一句。</p>
        {lesson.dialogue.map((item, i) => phrase(item, i))}
        {!hideChinese && <p style={{ ...subtle, margin: '16px 0 0' }}>{lesson.tip}</p>}
        <details style={{ ...subtle, marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', padding: '10px 0', minHeight: 44 }}>读音小提示</summary>
          {THAI_READING_GUIDE.map(line => <p key={line}>{line}</p>)}
          <p>发音为泰语合成语音。字母读音仅作辅助，跟着声音模仿即可。</p>
        </details>
      </div>
      <div aria-live="polite" style={{ ...subtle, margin: '12px 0', minHeight: 24, color: audio.status === 'error' ? '#B45309' : COLORS.textLight }}>
        {audio.status === 'error' ? audio.message : audio.status === 'loading' ? '声音加载中…' : audio.status === 'playing' ? '正在播放 · 再点同一个喇叭可停止' : '可以多听几次，不用一次记住。'}
      </div>
      {progressStatus}
      {practiced && <p style={subtle}>最近读过：{practiced.practiced_on} · 泰国时间</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <button style={{ ...button, background: COLORS.primaryDark, borderColor: COLORS.primaryDark, color: '#fff', opacity: saving || loading || loadError ? 0.55 : 1 }} disabled={saving || loading || loadError} onClick={markPracticed}>{saving ? '正在保存…' : '今天读过了'}</button>
        <a style={{ ...button, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={day < 30 ? `#thai-day=${day + 1}` : '#thai'}>{day < 30 ? '下一天 →' : '回到目录'}</a>
      </div>
      {notice?.day === day && <p role={notice.ok ? 'status' : 'alert'} style={{ ...subtle, color: notice.ok ? '#15803D' : '#B45309' }}>{notice.text}</p>}
      <p style={{ ...subtle, fontSize: 12, marginTop: 14 }}>只记录读过，不打分，也不要求连续打卡。</p>
    </>}
  </main>
}
