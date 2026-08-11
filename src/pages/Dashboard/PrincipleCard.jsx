import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS } from '../../lib/constants'
import { TextArea } from '../../components/common/FormField'
import { TableMissing } from '../../components/common/TableMissing'
import { todayStr, addDays, lastNDays } from '../../lib/date'

// 核心原则 + 每日落实。
// 独立成一栏而不是塞进每日三向的第四格——原则的地位高于任何单个方向，
// 并成一排就会和其他三个一起被跳过。写下来的原则不被兑现，等于没写。
export function PrincipleCard({ principle, onEditPrinciple }) {
  const isMobile = useIsMobile()
  const { rows, missing, add, patch } = useTable('principle_logs', {
    orderBy: 'log_date', ascending: false, limit: 120, optional: true,
  })
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const today = todayStr()
  const days = lastNDays(7)
  const byDate = new Map(rows.filter(r => (r.content || '').trim() || r.skipped).map(r => [r.log_date, r]))
  const todayRow = byDate.get(today)

  // 连续天数：诚实地跳过（skipped）不算落实，所以只数真正写了内容的
  const streak = (() => {
    let n = 0
    let d = today
    const ok = x => byDate.get(x) && !byDate.get(x).skipped
    if (!ok(d)) d = addDays(d, -1) // 今天还没写不算断
    while (ok(d)) { n++; d = addDays(d, -1) }
    return n
  })()

  const save = async (content, skipped = false) => {
    setSaving(true)
    try {
      if (todayRow) await patch(todayRow.id, { content, skipped, updated_at: new Date().toISOString() })
      else await add({ log_date: today, content, skipped })
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 原则本身 */}
      <div
        onClick={onEditPrinciple}
        style={{
          background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)', color: '#fff',
          borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>⚡ 核心原则</div>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {principle?.content || '点击写下你的核心原则，让它每天第一眼提醒你'}
        </div>
      </div>

      {/* 今天它落在哪件事上 —— 每日必答 */}
      {missing ? <TableMissing sql="v8_okr_commitments.sql" /> : (
        <div style={{
          background: '#fff', border: `1px solid ${todayRow && !todayRow.skipped ? COLORS.green + '66' : COLORS.orange + '66'}`,
          borderLeft: `3px solid ${todayRow && !todayRow.skipped ? COLORS.green : COLORS.orange}`,
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              ⚙️ 今天，这条原则落在哪件具体的事上？
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: streak > 0 ? COLORS.orange : COLORS.textLight }}>
              {streak > 0 ? `🔥 连续 ${streak} 天` : '今天开始'}
            </span>
          </div>

          {todayRow && !todayRow.skipped ? (
            <div
              onClick={() => setDraft(todayRow.content || '')}
              style={{
                fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                cursor: 'pointer', color: COLORS.text,
              }}
            >
              ✅ {todayRow.content}
              <span style={{ fontSize: 12, color: COLORS.textLight, marginLeft: 8 }}>（点击修改）</span>
            </div>
          ) : null}

          {(!todayRow || todayRow.skipped || draft) && (
            <>
              <TextArea
                value={draft}
                onChange={setDraft}
                rows={2}
                placeholder="要具体到一件事——「把段总项目的排期拆成三段，重发了一版」比「今天有迭代」有用一百倍"
              />
              <div style={{
                display: 'flex', gap: 8, marginTop: 10,
                flexDirection: isMobile ? 'column' : 'row',
              }}>
                <button
                  disabled={!draft.trim() || saving}
                  onClick={() => save(draft.trim(), false)}
                  style={{
                    flex: 1, padding: '9px 16px', borderRadius: 8, border: 'none',
                    background: draft.trim() ? COLORS.primary : COLORS.border,
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: draft.trim() ? 'pointer' : 'not-allowed',
                  }}
                >{saving ? '保存中…' : '记下来'}</button>
                {!todayRow?.skipped && (
                  <button
                    disabled={saving}
                    onClick={() => save('', true)}
                    style={{
                      padding: '9px 16px', borderRadius: 8,
                      border: `1px solid ${COLORS.border}`, background: '#fff',
                      color: COLORS.textLight, fontSize: 13, cursor: 'pointer',
                    }}
                  >今天确实没落实</button>
                )}
              </div>
              {!todayRow && (
                <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 8, lineHeight: 1.6 }}>
                  诚实地记「没落实」也比空着有价值——空白无法复盘，记录可以。
                </div>
              )}
            </>
          )}

          {todayRow?.skipped && !draft && (
            <div style={{ fontSize: 13, color: COLORS.textLight }}>
              今天记为「没落实」。要改的话在上面写一句就行。
            </div>
          )}

          {/* 近 7 天 */}
          <div style={{ display: 'flex', gap: 5, marginTop: 12, alignItems: 'center' }}>
            {days.map(d => {
              const r = byDate.get(d)
              const color = !r ? COLORS.border : r.skipped ? COLORS.red + '66' : COLORS.green
              return (
                <span key={d} title={`${d}${r ? (r.skipped ? ' · 没落实' : ' · ' + (r.content || '')) : ' · 空白'}`}
                  style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
              )
            })}
            <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: 4 }}>近 7 天</span>
          </div>
        </div>
      )}
    </div>
  )
}
