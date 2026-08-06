import { useState, useMemo, useRef, useEffect } from 'react'
import { useTable } from '../../hooks/useTable'
import { db, isDemo } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, MOODS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea } from '../../components/common/FormField'
import { EmptyState, IconBtn } from '../../components/common/EmptyState'
import { TrendChart } from '../../components/common/TrendChart'
import { Badge } from '../../components/common/Badge'
import { todayStr, addDays } from '../../lib/date'

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' }
const PRIORITY_COLOR = { high: COLORS.red, mid: COLORS.orange, low: COLORS.gray }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stampNow = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const dayOf = iso => new Date(iso).toLocaleDateString('sv-SE')
const hhmm = iso => new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

function dayLabel(d) {
  const t = todayStr()
  if (d === t) return '今天'
  if (d === addDays(t, -1)) return '昨天'
  if (d === addDays(t, -2)) return '前天'
  return ''
}

// 随内容自适应高度的输入框——说了多少字自己看得见
function AutoTextArea({ value, onChange, placeholder, minHeight = 84, maxHeight = 280 }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, minHeight, maxHeight])
  return (
    <textarea ref={ref} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8,
        border: `1px solid ${COLORS.border}`, fontSize: 15, lineHeight: 1.65, outline: 'none',
        resize: 'none', minHeight, fontFamily: 'inherit', color: COLORS.text, background: '#fff',
      }} />
  )
}

function PickRow({ picked, onToggle, children }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', marginBottom: 8,
      borderRadius: 8, cursor: 'pointer',
      border: `1px solid ${picked ? COLORS.primary : COLORS.border}`,
      background: picked ? '#EFF6FF' : '#fff',
    }}>
      <span style={{ fontSize: 15, lineHeight: 1.4, color: picked ? COLORS.primary : COLORS.textLight }}>
        {picked ? '☑' : '☐'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// 一笔已提炼的记录：呈现提炼后的正文与归类结果，原话折叠在下面
function NoteCard({ job, onConfirm }) {
  const r = job.result || {}
  const pending = job.status === 'done'
  return (
    <div style={{
      border: `1px solid ${pending ? COLORS.orange : COLORS.border}`,
      background: pending ? '#FFFBEB' : '#fff',
      borderRadius: 10, padding: '12px 14px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: COLORS.textLight, fontVariantNumeric: 'tabular-nums' }}>
          {hhmm(job.created_at)}
        </span>
        {pending
          ? <Badge color={COLORS.orange}>待确认</Badge>
          : <Badge color={COLORS.green}>已归档</Badge>}
        {r.knowledge?.map((k, i) => k.category && <Badge key={i} color={COLORS.purple}>{k.category}</Badge>)}
      </div>

      <div style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
        {r.journal?.content || job.input}
      </div>

      {r.knowledge?.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLORS.border}` }}>
          {r.knowledge.map((k, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: COLORS.purple }}>🧠 </span>
              <span style={{ fontWeight: 600 }}>{k.title}</span>
              <div style={{ color: COLORS.textLight, lineHeight: 1.6, marginTop: 2 }}>{k.content}</div>
            </div>
          ))}
        </div>
      )}

      {r.todos?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {r.todos.map((t, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>✅ {t.title}</span>
              <Badge color={PRIORITY_COLOR[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
              {t.due_date && <span style={{ color: COLORS.textLight, fontSize: 12 }}>{t.due_date}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <details style={{ fontSize: 12, color: COLORS.textLight, flex: 1, minWidth: 0 }}>
          <summary style={{ cursor: 'pointer' }}>看原话</summary>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.7 }}>{job.input}</div>
        </details>
        {pending && (
          <button onClick={() => onConfirm(job)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', whiteSpace: 'nowrap',
            background: COLORS.orange, color: '#fff', fontSize: 13, fontWeight: 600,
          }}>去确认</button>
        )}
      </div>
    </div>
  )
}

// 没有走提炼的记录（手写日记、迁移过来的老数据）
function PlainCard({ at, text }) {
  return (
    <div style={{
      border: `1px solid ${COLORS.border}`, borderRadius: 10,
      padding: '12px 14px', marginBottom: 10, background: '#fff',
    }}>
      {at && <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 6 }}>{at}</div>}
      <div style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}

export function JournalPage() {
  const { rows, add, patch, del } = useTable('journal_entries', { orderBy: 'entry_date', ascending: false })
  const { rows: jobs, reload: reloadJobs } = useTable('ai_jobs', { orderBy: 'created_at', ascending: false })
  const [modal, setModal] = useState(null)
  const [quick, setQuick] = useState('')
  const [busy, setBusy] = useState('')
  const [draft, setDraft] = useState(null)
  const isMobile = useIsMobile()
  const showToast = useUIStore(s => s.showToast)
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  const todayEntry = rows.find(r => r.entry_date === todayStr())
  const noteJobs = useMemo(
    () => jobs.filter(j => (j.kind || 'refine_note') === 'refine_note'),
    [jobs],
  )
  const pendingJobs = noteJobs.filter(j => j.status === 'done')

  // 按天分组的笔记流：每一笔单独成块，提炼过的走 NoteCard，其余走 PlainCard
  const days = useMemo(() => {
    const map = {}
    const touch = d => (map[d] ??= { date: d, entry: null, items: [] })

    for (const j of noteJobs) {
      if (j.status === 'dropped' || j.status === 'error') continue
      touch(dayOf(j.created_at)).items.push({ key: j.id, at: hhmm(j.created_at), job: j })
    }

    for (const e of rows) {
      const g = touch(e.entry_date)
      g.entry = e
      // 已被某条 job 的提炼正文覆盖的行不再重复展示（取前 15 字比对足够区分）
      const covered = noteJobs
        .filter(j => dayOf(j.created_at) === e.entry_date && j.result?.journal?.content)
        .map(j => j.result.journal.content.trim().slice(0, 15))
      for (const raw of String(e.content || '').split('\n')) {
        const line = raw.trim()
        if (!line) continue
        const m = line.match(/^\[(\d{2}:\d{2})\]\s*(.*)$/)
        const text = m ? m[2] : line
        if (!text || covered.some(c => text.startsWith(c))) continue
        g.items.push({ key: `${e.id}-${line.slice(0, 12)}`, at: m ? m[1] : null, text })
      }
    }

    return Object.values(map)
      .map(g => ({ ...g, items: g.items.sort((a, b) => (a.at || '00:00').localeCompare(b.at || '00:00')) }))
      .filter(g => g.items.length > 0 || g.entry?.gratitude)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [rows, noteJobs])

  const moodData = useMemo(
    () => [...rows].reverse().slice(-30).filter(r => r.mood).map(r => ({ x: r.entry_date, y: r.mood })),
    [rows],
  )

  const openEditor = entry => {
    setModal(entry ? { ...entry } : { entry_date: todayStr(), mood: 3, content: '', gratitude: '' })
  }

  // 往指定日期的日记里追加一段正文（没有该天记录就新建）
  const appendToDay = async (date, line, extra = {}) => {
    const entry = rows.find(r => r.entry_date === date)
    if (entry) {
      await patch(entry.id, { content: (entry.content ? entry.content + '\n' : '') + line, ...extra })
    } else {
      await add({ entry_date: date, mood: null, gratitude: '', content: line, ...extra })
    }
  }

  const openDraft = job => setDraft({
    jobId: job.id,
    date: dayOf(job.created_at),
    raw: job.input,
    ...job.result,
    pickK: (job.result.knowledge || []).map(() => true),
    pickT: (job.result.todos || []).map(() => true),
  })

  const waitForJob = async id => {
    for (let i = 0; i < 45; i++) {
      await sleep(2000)
      const [job] = await db.list('ai_jobs', { filters: { id } })
      if (!job) return null
      if (job.status === 'done' || job.status === 'error') return job
    }
    return null
  }

  // 快记：原文先落库保底 → 交给本机 Claude 提炼 → 回来让你确认
  const quickSubmit = async () => {
    const text = quick.trim()
    if (!text || busy) return
    const rawLine = `[${stampNow()}] ${text}`

    if (isDemo) {
      setBusy('saving')
      await appendToDay(todayStr(), rawLine)
      setQuick('')
      setBusy('')
      showToast('已记下（演示模式无 AI 提炼）')
      return
    }

    setBusy('saving')
    try {
      // 原话先进 raw_input，后面 AI 出任何岔子都不会丢
      if (todayEntry) {
        await patch(todayEntry.id, { raw_input: (todayEntry.raw_input ? todayEntry.raw_input + '\n' : '') + rawLine })
      } else {
        await add({ entry_date: todayStr(), mood: null, content: '', gratitude: '', raw_input: rawLine })
      }

      const job = await db.insert('ai_jobs', {
        kind: 'refine_note',
        input: text,
        context: todayEntry?.content || '',
        source: isMobile ? 'mobile' : 'web',
      })

      setBusy('refining')
      const done = await waitForJob(job.id)
      setQuick('')
      await reloadJobs()

      if (done?.status === 'done' && done.result) {
        openDraft(done)
      } else {
        showToast(done?.status === 'error'
          ? '提炼失败，原话已存，可在下面「看原话」找到'
          : '大仙没在线，原话已存，提炼排队中——回头刷新页面点「去确认」', 'error')
      }
    } catch (e) {
      showToast(`保存失败：${e.message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  // 确认提炼结果：整理后的正文进日记，勾选的知识/待办各自落库
  const applyDraft = async () => {
    if (busy) return
    setBusy('saving')
    try {
      const entry = rows.find(r => r.entry_date === draft.date)
      const extra = {}
      if (draft.journal.mood && !entry?.mood) extra.mood = draft.journal.mood
      if (draft.journal.gratitude && !entry?.gratitude) extra.gratitude = draft.journal.gratitude
      await appendToDay(draft.date, `[${stampNow()}] ${draft.journal.content.trim()}`, extra)

      let nk = 0
      let nt = 0
      for (const [i, k] of (draft.knowledge || []).entries()) {
        if (!draft.pickK[i]) continue
        await db.insert('knowledge_notes', {
          title: k.title, category: k.category, tags: k.tags, content: k.content, source: '快记提炼',
        })
        nk++
      }
      for (const [i, t] of (draft.todos || []).entries()) {
        if (!draft.pickT[i]) continue
        await db.insert('work_todos', {
          title: t.title, priority: t.priority, due_date: t.due_date || null, status: 'open',
        })
        nt++
      }

      await db.update('ai_jobs', draft.jobId, { status: 'applied' })
      await reloadJobs()
      setDraft(null)
      showToast(`已存：日记 1 条${nk ? ` · 笔记 ${nk} 条` : ''}${nt ? ` · 待办 ${nt} 条` : ''}`)
    } catch (e) {
      showToast(`保存失败：${e.message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  // 只留日记、丢掉提炼出的知识与待办
  const dropDraft = async () => {
    setBusy('saving')
    try {
      await appendToDay(draft.date, `[${stampNow()}] ${draft.raw}`)
      await db.update('ai_jobs', draft.jobId, { status: 'dropped' })
      await reloadJobs()
      setDraft(null)
      showToast('已按原话记下，提炼结果丢弃')
    } catch (e) {
      showToast(`保存失败：${e.message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 快记 / 确认卡片 */}
      {draft ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <div style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>
              {draft.comment || '提炼好了，看看要存哪些'}
            </div>
            {draft.date !== todayStr() && <Badge color={COLORS.orange}>{draft.date}</Badge>}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 6 }}>整理后的记录（可改）</div>
          <AutoTextArea value={draft.journal.content}
            onChange={v => setDraft(d => ({ ...d, journal: { ...d.journal, content: v } }))} />

          <details style={{ marginTop: 8, fontSize: 12, color: COLORS.textLight }}>
            <summary style={{ cursor: 'pointer' }}>看我原话</summary>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.6 }}>{draft.raw}</div>
          </details>

          {draft.journal.gratitude && (
            <div style={{ marginTop: 8, fontSize: 13, color: COLORS.orange }}>✨ {draft.journal.gratitude}</div>
          )}

          {draft.knowledge?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 8 }}>
                🧠 值得沉淀进第二大脑
              </div>
              {draft.knowledge.map((k, i) => (
                <PickRow key={i} picked={draft.pickK[i]}
                  onToggle={() => setDraft(d => ({ ...d, pickK: d.pickK.map((v, j) => (j === i ? !v : v)) }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{k.title}</span>
                    {k.category && <Badge color={COLORS.purple}>{k.category}</Badge>}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.6 }}>{k.content}</div>
                </PickRow>
              ))}
            </div>
          )}

          {draft.todos?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 8 }}>✅ 要你跟进的事</div>
              {draft.todos.map((t, i) => (
                <PickRow key={i} picked={draft.pickT[i]}
                  onToggle={() => setDraft(d => ({ ...d, pickT: d.pickT.map((v, j) => (j === i ? !v : v)) }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14 }}>{t.title}</span>
                    <Badge color={PRIORITY_COLOR[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                    {t.due_date && <span style={{ fontSize: 12, color: COLORS.textLight }}>{t.due_date}</span>}
                  </div>
                </PickRow>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexDirection: isMobile ? 'column' : 'row' }}>
            <button onClick={applyDraft} disabled={!!busy} style={{
              flex: 1, padding: '11px 18px', borderRadius: 8, border: 'none',
              background: busy ? COLORS.gray : COLORS.primary, color: '#fff', fontSize: 15, fontWeight: 600,
            }}>{busy ? '存入中…' : '存下来'}</button>
            <button onClick={dropDraft} disabled={!!busy} style={{
              padding: '11px 18px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: '#fff', color: COLORS.text, fontSize: 15,
            }}>只记原话</button>
            <button onClick={() => setDraft(null)} disabled={!!busy} style={{
              padding: '11px 18px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: '#fff', color: COLORS.textLight, fontSize: 15,
            }}>稍后</button>
          </div>
        </Card>
      ) : (
        <Card>
          <AutoTextArea value={quick} onChange={setQuick}
            placeholder="✍️ 想到什么说什么，越随意越好——大仙会帮你提炼成记录、笔记和待办" />
          <div style={{
            display: 'flex', gap: 10, marginTop: 10,
            alignItems: isMobile ? 'stretch' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div style={{ flex: 1, fontSize: 12, color: COLORS.textLight, lineHeight: 1.5 }}>
              {busy === 'refining'
                ? '🤖 本机 Claude 提炼中，稍等几十秒…'
                : isDemo
                  ? '演示模式：原样记录，无 AI 提炼'
                  : '原话会先存下来，提炼由本机 Claude 订阅完成（需电脑开着 npm run bot）'}
            </div>
            <button onClick={quickSubmit} disabled={!!busy || !quick.trim()} style={{
              padding: '11px 22px', borderRadius: 8, border: 'none',
              background: busy || !quick.trim() ? COLORS.gray : COLORS.primary,
              color: '#fff', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
            }}>{busy === 'saving' ? '保存中…' : busy === 'refining' ? '提炼中…' : '记录'}</button>
          </div>
        </Card>
      )}

      {/* 有提炼完但没确认的，顶上提醒——别再让它悄悄消失 */}
      {!draft && pendingJobs.length > 0 && (
        <div onClick={() => openDraft(pendingJobs[0])} style={{
          background: '#FFFBEB', border: `1px solid ${COLORS.orange}`, borderRadius: 12,
          padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
            有 <b>{pendingJobs.length}</b> 笔提炼好了还没确认，点这里处理
          </div>
          <span style={{ color: COLORS.orange, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>去确认 ›</span>
        </div>
      )}

      {/* 今日概览 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>
            {MOODS.find(m => m.value === todayEntry?.mood)?.icon || '📔'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {days[0]?.date === todayStr()
                ? `今天已记 ${days[0].items.length} 笔`
                : '今天还没记'}
            </div>
            <div style={{ fontSize: 13, color: COLORS.textLight }}>
              {todayEntry?.mood ? '心情已打分' : '一分钟：心情 + 几句话 + 一件美好的小事'}
            </div>
          </div>
          <button onClick={() => openEditor(todayEntry || null)} style={{
            padding: '9px 18px', borderRadius: 8, whiteSpace: 'nowrap',
            border: todayEntry ? `1px solid ${COLORS.border}` : 'none',
            background: todayEntry ? '#fff' : COLORS.primary,
            color: todayEntry ? COLORS.text : '#fff', fontSize: 14, fontWeight: 600,
          }}>{todayEntry ? '心情/整理' : '写今天'}</button>
        </div>
      </Card>

      {moodData.length >= 2 && (
        <Card title="心情曲线（近 30 天）">
          <TrendChart data={moodData} color={COLORS.pink} height={120} />
        </Card>
      )}

      {/* 笔记流：按天分组，每一笔单独成块 */}
      {days.length === 0 ? (
        <Card><EmptyState icon="🕊️" text="每天一分钟，一年后你会感谢现在开始记录的自己" /></Card>
      ) : days.slice(0, 30).map(g => {
        const label = dayLabel(g.date)
        return (
          <Card key={g.date}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}`, flexWrap: 'wrap',
            }}>
              {label && <Badge color={COLORS.primary}>{label}</Badge>}
              <span style={{ fontSize: 15, fontWeight: 600 }}>{g.date}</span>
              <span style={{ fontSize: 13, color: COLORS.textLight }}>{g.items.length} 笔</span>
              {g.entry?.mood && (
                <span style={{ fontSize: 16 }}>{MOODS.find(m => m.value === g.entry.mood)?.icon}</span>
              )}
              <div style={{ flex: 1 }} />
              {g.entry && (
                <>
                  <IconBtn onClick={() => openEditor(g.entry)} color={COLORS.primary}>编辑</IconBtn>
                  <IconBtn onClick={() => del(g.entry.id)} color={COLORS.red}>删</IconBtn>
                </>
              )}
            </div>

            {g.items.map(it => (
              it.job
                ? <NoteCard key={it.key} job={it.job} onConfirm={openDraft} />
                : <PlainCard key={it.key} at={it.at} text={it.text} />
            ))}

            {g.entry?.gratitude && (
              <div style={{ fontSize: 13, color: COLORS.orange, marginTop: 4 }}>✨ {g.entry.gratitude}</div>
            )}
          </Card>
        )
      })}

      {modal && (
        <Modal title={`📔 ${modal.entry_date}`} onClose={() => setModal(null)}>
          <FormField label="日期">
            <TextInput type="date" value={modal.entry_date} onChange={v => set('entry_date', v)} />
          </FormField>
          <FormField label="今日心情">
            <div style={{ display: 'flex', gap: 8 }}>
              {MOODS.map(m => (
                <button key={m.value} onClick={() => set('mood', m.value)} title={m.label} style={{
                  width: 46, height: 46, borderRadius: 10, fontSize: 22,
                  border: `2px solid ${modal.mood === m.value ? COLORS.primary : COLORS.border}`,
                  background: modal.mood === m.value ? '#EFF6FF' : '#fff',
                }}>{m.icon}</button>
              ))}
            </div>
          </FormField>
          <FormField label="今天的记录" hint="每行一笔；[HH:MM] 开头的行会在流里单独成块">
            <TextArea value={modal.content} onChange={v => set('content', v)} rows={6}
              placeholder="发生了什么？有什么感悟？" />
          </FormField>
          <FormField label="感恩 / 美好瞬间">
            <TextInput value={modal.gratitude} onChange={v => set('gratitude', v)}
              placeholder="今天有什么值得感谢或让你微笑的小事？" />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.content && !modal.gratitude}
            onSubmit={async () => {
              const { id, created_at: _ca, raw_input: _ri, ...data } = modal
              if (id) await patch(id, data)
              else await add(data)
              setModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
