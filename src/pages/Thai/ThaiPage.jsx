import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS } from '../../lib/constants'
import { db, isDemo } from '../../lib/dataStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TableMissing } from '../../components/common/TableMissing'
import { THAI_COURSE_VERSION } from './thaiLessons'
import { nextLessonDay, parseLessonDay, parseThaiTab, practiceRow, validProgress } from './thaiProgress'
import { masteredSet, masteryPatch, resultPatch } from './thaiStudy'
import { createThaiAudioPlayer } from './thaiAudio'
import { ThaiHome } from './ThaiHome'
import { ThaiLesson } from './ThaiLesson'
import { THAI_TOPICS, parseTopicKey } from './thaiTopics'
import { ThaiTopicView } from './ThaiTopicView'
import { ui } from './ThaiParts'

const ITEM_TABLE = 'thai_item_progress'
const QUIZ_TABLE = 'thai_quiz_results'
const ITEM_CONFLICT = ['course_version', 'item_key']

const readRoute = hash => ({ day: parseLessonDay(hash), tab: parseThaiTab(hash), topic: parseTopicKey(hash) })

const isMissingTable = e => /does not exist|PGRST205|42P01|schema cache/i.test(`${e?.code ?? ''} ${e?.message ?? ''}`)

function mergeRows(old, saved) {
  const byKey = new Map(old.map(r => [r.item_key, r]))
  for (const r of saved) byKey.set(r.item_key, { ...byKey.get(r.item_key), ...r })
  return [...byKey.values()]
}

export function ThaiPage() {
  const mobile = useIsMobile()
  const [route, setRoute] = useState(() => readRoute(window.location.hash))
  const [practiceRows, setPracticeRows] = useState([])
  const [itemRows, setItemRows] = useState([])
  const [quizHistory, setQuizHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [missing, setMissing] = useState(false)
  const [revision, setRevision] = useState(0)
  const [audio, setAudio] = useState({ status: 'idle', id: null })
  const [notice, setNotice] = useState(null)
  const player = useRef(null)
  // 事件处理里读最新的掌握记录（答题结束、连续点标记时不会拿到旧值）。
  const itemRowsRef = useRef(itemRows)
  useEffect(() => { itemRowsRef.current = itemRows }, [itemRows])

  useEffect(() => {
    player.current = createThaiAudioPlayer({ onChange: setAudio })
    const navigate = () => setRoute(readRoute(window.location.hash))
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    return () => {
      player.current.dispose()
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(false)
    const filters = { course_version: THAI_COURSE_VERSION }
    Promise.all([
      db.list('thai_learning_progress', { filters, orderBy: 'lesson_day', ascending: true }),
      db.list(ITEM_TABLE, { filters, orderBy: 'item_key', ascending: true }).then(rows => ({ rows }), e => ({ error: e })),
      db.list(QUIZ_TABLE, { filters, orderBy: 'taken_at', ascending: false, limit: 60 }).then(rows => ({ rows }), e => ({ error: e })),
    ]).then(([progress, items, quizzes]) => {
      if (cancelled) return
      setPracticeRows(progress.filter(validProgress))
      const lost = [items, quizzes].filter(r => r.error)
      if (lost.some(r => !isMissingTable(r.error))) throw lost[0].error
      setMissing(lost.length > 0)
      setItemRows(items.rows || [])
      setQuizHistory(quizzes.rows || [])
    }).catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [revision])

  useEffect(() => {
    player.current?.stop()
    setNotice(null)
    window.scrollTo(0, 0)
  }, [route.day, route.tab, route.topic])

  const rowsByKey = useMemo(() => new Map(itemRows.map(r => [r.item_key, r])), [itemRows])
  const mastered = useMemo(() => masteredSet(itemRows), [itemRows])
  const practicedDays = useMemo(() => new Set(practiceRows.map(r => r.lesson_day)), [practiceRows])
  const canSave = !loading && !loadError && !missing

  async function saveItems(rows) {
    const saved = await Promise.all(rows.map(row => db.upsert(ITEM_TABLE, row, ITEM_CONFLICT)))
    setItemRows(old => mergeRows(old, saved))
    return saved
  }

  // 先改界面再保存；保存失败就退回原状态并提示。
  async function saveOptimistic(rows, failText) {
    const before = itemRowsRef.current
    setItemRows(old => mergeRows(old, rows))
    try {
      await saveItems(rows)
    } catch {
      setItemRows(before)
      setNotice({ ok: false, text: failText })
    }
  }

  function toggleMastered(key) {
    if (!canSave) return
    const prev = itemRowsRef.current.find(r => r.item_key === key)
    return saveOptimistic([masteryPatch(prev, key, !prev?.mastered)], '掌握标记没保存上，请再点一次。')
  }

  function markMastered(keys) {
    if (!canSave || !keys.length) return
    const byKey = new Map(itemRowsRef.current.map(r => [r.item_key, r]))
    return saveOptimistic(keys.map(key => masteryPatch(byKey.get(key), key, true)), '掌握标记没保存上，请再试一次。')
  }

  async function finishQuiz({ scope, day, results }) {
    if (!canSave) throw new Error('暂时不能保存')
    const verdict = new Map()
    for (const r of results) verdict.set(r.key, (verdict.get(r.key) ?? true) && r.correct)
    const byKey = new Map(itemRowsRef.current.map(r => [r.item_key, r]))
    const unmarked = [...verdict].filter(([key, ok]) => !ok && byKey.get(key)?.mastered).map(([key]) => key)
    await saveItems([...verdict].map(([key, ok]) => resultPatch(byKey.get(key), key, ok)))
    const record = await db.insert(QUIZ_TABLE, {
      course_version: THAI_COURSE_VERSION, scope, lesson_day: day,
      total: results.length, correct: results.filter(r => r.correct).length,
      wrong_keys: results.filter(r => !r.correct).map(r => r.key), taken_at: new Date().toISOString(),
    })
    setQuizHistory(old => [record, ...old])
    if (scope === 'day') {
      const saved = await db.upsert('thai_learning_progress', practiceRow(day), ['course_version', 'lesson_day'])
      if (validProgress(saved)) setPracticeRows(old => [...old.filter(r => r.lesson_day !== day), saved])
    }
    return { unmarked }
  }

  const statusSlot = <div style={{ marginTop: 8 }}>
    {isDemo && <p style={ui.subtle}>本机演示 · 学习记录只保存在当前浏览器</p>}
    {loading && <p role="status" style={ui.subtle}>正在读取学习记录，不影响听读。</p>}
    {missing && <TableMissing sql="v17_thai_mastery.sql" />}
    {loadError && <div role="alert" style={{ ...ui.subtle, color: '#9A3412', padding: '8px 0' }}>
      学习记录暂时读不到，仍可以听读。 <button style={ui.button} onClick={() => setRevision(n => n + 1)}>重试读取</button>
    </div>}
    {notice && <p role="alert" style={{ ...ui.subtle, color: notice.ok ? '#15803D' : '#B45309' }}>{notice.text}</p>}
  </div>

  const shared = { mobile, mastered, rowsByKey, practicedDays, player, audio, canSave, onToggle: toggleMastered, onMarkMastered: markMastered, onQuizFinish: finishQuiz }

  const topic = !route.day && THAI_TOPICS.find(item => item.key === route.topic)
  if (topic) {
    return <main style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32, color: COLORS.text }}>
      <ThaiTopicView key={topic.key} topic={topic} mobile={mobile} />
    </main>
  }

  if (route.day) {
    const best = quizHistory.filter(r => r.scope === 'day' && r.lesson_day === route.day)
      .reduce((top, r) => (!top || r.correct / r.total > top.correct / top.total ? r : top), null)
    return <main style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32, color: COLORS.text }}>
      <ThaiLesson key={route.day} day={route.day} {...shared} practiced={practicedDays.has(route.day)}
        bestScore={best ? `${best.correct}/${best.total}` : '—'} />
      {statusSlot}
    </main>
  }

  return <main style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32, color: COLORS.text }}>
    <ThaiHome tab={route.tab} {...shared} resumeDay={nextLessonDay(practiceRows)} quizHistory={quizHistory} statusSlot={statusSlot} />
  </main>
}
