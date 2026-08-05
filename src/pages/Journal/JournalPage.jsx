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
import { todayStr } from '../../lib/date'

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' }
const PRIORITY_COLOR = { high: COLORS.red, mid: COLORS.orange, low: COLORS.gray }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stampNow = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

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

// 可勾选的提炼条目
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

export function JournalPage() {
  const { rows, add, patch, del } = useTable('journal_entries', { orderBy: 'entry_date', ascending: false })
  const [modal, setModal] = useState(null)
  const [quick, setQuick] = useState('')
  const [busy, setBusy] = useState('')      // '' | 'saving' | 'refining'
  const [draft, setDraft] = useState(null)  // 提炼结果待确认
  const isMobile = useIsMobile()
  const showToast = useUIStore(s => s.showToast)
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  const todayEntry = rows.find(r => r.entry_date === todayStr())

  // 往今天的日记里追加一段正文（一天一行记录，多笔追加）
  const appendToToday = async (line, extra = {}) => {
    if (todayEntry) {
      await patch(todayEntry.id, {
        content: (todayEntry.content ? todayEntry.content + '\n' : '') + line,
        ...extra,
      })
    } else {
      await add({ entry_date: todayStr(), mood: null, gratitude: '', content: line, ...extra })
    }
  }

  // 轮询本机 worker 的提炼结果（本机 npm run bot 在跑才会有人干活）
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

    // 演示模式没有本机 worker，直接原样存
    if (isDemo) {
      setBusy('saving')
      await appendToToday(rawLine)
      setQuick('')
      setBusy('')
      showToast('已记下（演示模式无 AI 提炼）')
      return
    }

    setBusy('saving')
    try {
      // 1) 原话先进 raw_input，无论后面 AI 出什么岔子都不会丢
      if (todayEntry) {
        await patch(todayEntry.id, { raw_input: (todayEntry.raw_input ? todayEntry.raw_input + '\n' : '') + rawLine })
      } else {
        await add({ entry_date: todayStr(), mood: null, content: '', gratitude: '', raw_input: rawLine })
      }

      // 2) 排一个提炼任务给本机 Claude（订阅额度，不花 API 钱）
      const job = await db.insert('ai_jobs', {
        kind: 'refine_note',
        input: text,
        context: todayEntry?.content || '',
        source: isMobile ? 'mobile' : 'web',
      })

      setBusy('refining')
      const done = await waitForJob(job.id)

      if (done?.status === 'done' && done.result) {
        setDraft({ jobId: job.id, raw: text, ...done.result, pickK: done.result.knowledge.map(() => true), pickT: done.result.todos.map(() => true) })
        setQuick('')
      } else {
        // 大仙不在线 / 提炼失败：原样存进正文，任务留着，回头 TG 里还能确认
        await appendToToday(rawLine)
        setQuick('')
        showToast(done?.status === 'error' ? '提炼失败，已按原样记下' : '大仙没在线，已原样记下，提炼排队中', 'error')
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
      const extra = {}
      if (draft.journal.mood && !todayEntry?.mood) extra.mood = draft.journal.mood
      if (draft.journal.gratitude && !todayEntry?.gratitude) extra.gratitude = draft.journal.gratitude
      await appendToToday(`[${stampNow()}] ${draft.journal.content.trim()}`, extra)

      const picked = { k: 0, t: 0 }
      for (const [i, k] of draft.knowledge.entries()) {
        if (!draft.pickK[i]) continue
        await db.insert('knowledge_notes', {
          title: k.title, category: k.category, tags: k.tags, content: k.content, source: '快记提炼',
        })
        picked.k++
      }
      for (const [i, t] of draft.todos.entries()) {
        if (!draft.pickT[i]) continue
        await db.insert('work_todos', {
          title: t.title, priority: t.priority, due_date: t.due_date || null, status: 'open',
        })
        picked.t++
      }

      await db.update('ai_jobs', draft.jobId, { status: 'applied' })
      setDraft(null)
      showToast(`已存：日记 1 条${picked.k ? ` · 笔记 ${picked.k} 条` : ''}${picked.t ? ` · 待办 ${picked.t} 条` : ''}`)
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
      await appendToToday(`[${stampNow()}] ${draft.raw}`)
      await db.update('ai_jobs', draft.jobId, { status: 'dropped' })
      setDraft(null)
      showToast('已按原话记下，提炼结果丢弃')
    } catch (e) {
      showToast(`保存失败：${e.message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const moodData = useMemo(
    () => [...rows].reverse().slice(-30)
      .filter(r => r.mood)
      .map(r => ({ x: r.entry_date, y: r.mood })),
    [rows],
  )

  const openEditor = entry => {
    setModal(entry
      ? { ...entry }
      : { entry_date: todayStr(), mood: 3, content: '', gratitude: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 随手记：想到什么说什么，本机 Claude 提炼后再入库 */}
      {draft ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <div style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>
              {draft.comment || '提炼好了，看看要存哪些'}
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 6 }}>整理后的记录（可改）</div>
          <AutoTextArea value={draft.journal.content}
            onChange={v => setDraft(d => ({ ...d, journal: { ...d.journal, content: v } }))} />

          <details style={{ marginTop: 8, fontSize: 12, color: COLORS.textLight }}>
            <summary style={{ cursor: 'pointer' }}>看我原话</summary>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.6 }}>{draft.raw}</div>
          </details>

          {draft.journal.mood && !todayEntry?.mood && (
            <div style={{ marginTop: 12, fontSize: 13, color: COLORS.textLight }}>
              心情判断：{MOODS.find(m => m.value === draft.journal.mood)?.icon} {MOODS.find(m => m.value === draft.journal.mood)?.label}
            </div>
          )}
          {draft.journal.gratitude && (
            <div style={{ marginTop: 8, fontSize: 13, color: COLORS.orange }}>✨ {draft.journal.gratitude}</div>
          )}

          {draft.knowledge.length > 0 && (
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

          {draft.todos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textLight, marginBottom: 8 }}>
                ✅ 要你跟进的事
              </div>
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

      {/* 今日状态 */}
      <Card>
        {todayEntry ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{MOODS.find(m => m.value === todayEntry.mood)?.icon || '📝'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                今天已记 {String(todayEntry.content || '').split('\n').filter(Boolean).length} 笔
                {!todayEntry.mood && <span style={{ fontWeight: 400, color: COLORS.textLight, fontSize: 12 }}>（心情还没打分）</span>}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textLight, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                {todayEntry.content}
              </div>
            </div>
            <button onClick={() => openEditor(todayEntry)} style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', fontSize: 13, whiteSpace: 'nowrap',
            }}>心情/整理</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>今天过得怎么样？</div>
              <div style={{ fontSize: 13, color: COLORS.textLight }}>一分钟：心情 + 几句话 + 一件美好的小事</div>
            </div>
            <button onClick={() => openEditor(null)} style={{
              padding: '10px 20px', borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 14, fontWeight: 600,
            }}>写今天</button>
          </div>
        )}
      </Card>

      {moodData.length >= 2 && (
        <Card title="心情曲线（近 30 天）">
          <TrendChart data={moodData} color={COLORS.pink} height={120} />
        </Card>
      )}

      {rows.length === 0 ? (
        <Card><EmptyState icon="🕊️" text="每天一分钟，一年后你会感谢现在开始记录的自己" /></Card>
      ) : (
        <Card title={`历史（${rows.length} 篇）`}>
          {rows.slice(0, 60).map(r => (
            <div key={r.id} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{MOODS.find(m => m.value === r.mood)?.icon || '🙂'}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.entry_date}</span>
                <div style={{ flex: 1 }} />
                <IconBtn onClick={() => openEditor(r)} color={COLORS.primary}>编辑</IconBtn>
                <IconBtn onClick={() => del(r.id)} color={COLORS.red}>删</IconBtn>
              </div>
              {r.content && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 4 }}>{r.content}</div>}
              {r.gratitude && <div style={{ fontSize: 13, color: COLORS.orange }}>✨ {r.gratitude}</div>}
            </div>
          ))}
        </Card>
      )}

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
          <FormField label="今天的记录">
            <TextArea value={modal.content} onChange={v => set('content', v)} rows={5}
              placeholder="发生了什么？有什么感悟？" />
          </FormField>
          <FormField label="感恩 / 美好瞬间">
            <TextInput value={modal.gratitude} onChange={v => set('gratitude', v)}
              placeholder="今天有什么值得感谢或让你微笑的小事？" />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.content && !modal.gratitude}
            onSubmit={async () => {
              const { id, created_at: _ca, ...data } = modal
              if (id) await patch(id, data)
              else await add(data)
              setModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
