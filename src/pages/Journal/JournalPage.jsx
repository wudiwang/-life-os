import { useState, useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, MOODS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea } from '../../components/common/FormField'
import { EmptyState, IconBtn } from '../../components/common/EmptyState'
import { TrendChart } from '../../components/common/TrendChart'
import { todayStr } from '../../lib/date'

export function JournalPage() {
  const { rows, add, patch, del } = useTable('journal_entries', { orderBy: 'entry_date', ascending: false })
  const [modal, setModal] = useState(null)
  const [quick, setQuick] = useState('')
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  const todayEntry = rows.find(r => r.entry_date === todayStr())

  // 随手记：带时间戳追加到今天的记录，一天可记多笔
  const quickAdd = async () => {
    const text = quick.trim()
    if (!text) return
    const stamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const line = `[${stamp}] ${text}`
    if (todayEntry) {
      await patch(todayEntry.id, { content: (todayEntry.content ? todayEntry.content + '\n' : '') + line })
    } else {
      await add({ entry_date: todayStr(), mood: null, content: line, gratitude: '' })
    }
    setQuick('')
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
      {/* 随手记：常驻快速入口 */}
      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={quick} onChange={e => setQuick(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && quickAdd()}
            placeholder="✍️ 随手记一笔（自动带时间戳追加到今天），回车提交"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none' }} />
          <button onClick={quickAdd} style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: COLORS.primary, color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
          }}>记下</button>
        </div>
      </Card>

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
