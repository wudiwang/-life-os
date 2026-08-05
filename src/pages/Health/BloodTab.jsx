import { useState, useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, BLOOD_PANEL } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { TrendChart } from '../../components/common/TrendChart'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate, todayStr } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'

const num = v => (v == null || v === '' ? null : Number(v))

// 报告单标注的区间优先于默认参考区间
export function bloodStatus(value, item, row) {
  const low = num(row?.ref_low) ?? item.low
  const high = num(row?.ref_high) ?? item.high
  if (high != null && value > high) {
    return { label: '偏高', color: item.good === 'up' ? COLORS.green : COLORS.red }
  }
  if (low != null && value < low) {
    return { label: '偏低', color: item.good === 'up' ? COLORS.red : COLORS.orange }
  }
  return { label: '正常', color: COLORS.green }
}

export function BloodTab() {
  const { rows, add, del } = useTable('blood_metrics', { orderBy: 'test_date', ascending: false })
  const [modal, setModal] = useState(null)
  const [chartKey, setChartKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const showToast = useUIStore(s => s.showToast)

  // 按抽血日期分组：一次体检一张卡
  const sessions = useMemo(() => {
    const map = {}
    for (const r of rows) {
      map[r.test_date] ??= { date: r.test_date, org: r.org, note: r.note, items: [] }
      map[r.test_date].items.push(r)
    }
    return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [rows])

  const chartData = useMemo(() => {
    if (!chartKey) return []
    return rows.filter(r => r.panel_key === chartKey)
      .map(r => ({ x: r.test_date, y: Number(r.value_num) }))
      .sort((a, b) => (a.x < b.x ? -1 : 1))
  }, [rows, chartKey])

  const chartItem = BLOOD_PANEL.find(p => p.key === chartKey)
  const testedKeys = [...new Set(rows.map(r => r.panel_key))]
  const groups = [...new Set(BLOOD_PANEL.map(p => p.group))]

  const openNew = () => setModal({
    test_date: todayStr(), org: '', note: '',
    values: Object.fromEntries(BLOOD_PANEL.map(p => [p.key, ''])),
  })

  const submit = async () => {
    const filled = BLOOD_PANEL.filter(p => String(modal.values[p.key]).trim() !== '')
    if (!filled.length) {
      showToast('至少填一项', 'error')
      return
    }
    setSaving(true)
    try {
      for (const p of filled) {
        await add({
          test_date: modal.test_date,
          panel_key: p.key,
          value_num: Number(modal.values[p.key]),
          unit: p.unit,
          org: modal.org || null,
          note: modal.note || null,
        })
      }
      setModal(null)
      showToast(`已录入 ${filled.length} 项`)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={openNew}>+ 录入一次抽血</AddButton>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <EmptyState icon="🩸" text="还没有血液检查记录" />
          <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.9, marginTop: -8 }}>
            两种录法：<br />
            1. 点右上角「录入一次抽血」，按报告单填——填了的项才存，不用填满；<br />
            2. 把报告单拍照发给大仙（TG），让他读完数值写进来。<br />
            <span style={{ color: COLORS.orange }}>
              参考区间用的是常见成年男性范围，各家实验室不同——以你报告单上标注的为准。
            </span>
          </div>
        </Card>
      ) : (
        <>
          {chartKey ? (
            <Card title={`${chartItem?.name} 趋势`} extra={<IconBtn onClick={() => setChartKey(null)}>收起</IconBtn>}>
              <TrendChart data={chartData} unit={chartItem?.unit} />
            </Card>
          ) : testedKeys.length > 0 && (
            <Card title="看某项的趋势">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BLOOD_PANEL.filter(p => testedKeys.includes(p.key)).map(p => (
                  <button key={p.key} onClick={() => setChartKey(p.key)} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 13,
                    border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.text,
                  }}>{p.name}</button>
                ))}
              </div>
            </Card>
          )}

          {sessions.map(s => (
            <Card key={s.date} title={`${fmtDate(s.date)} 抽血`}
              extra={
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {s.org && <Badge color={COLORS.teal}>{s.org}</Badge>}
                  <Badge color={COLORS.gray}>{s.items.length} 项</Badge>
                </div>
              }>
              <ScrollX>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 460 }}>
                  <thead>
                    <tr style={{ color: COLORS.textLight, fontSize: 12, textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>项目</th>
                      <th style={{ padding: '6px 8px' }}>结果</th>
                      <th style={{ padding: '6px 8px' }}>参考区间</th>
                      <th style={{ padding: '6px 8px' }}>状态</th>
                      <th style={{ padding: '6px 8px', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map(r => {
                      const item = BLOOD_PANEL.find(p => p.key === r.panel_key)
                      if (!item) return null
                      const st = bloodStatus(Number(r.value_num), item, r)
                      const low = num(r.ref_low) ?? item.low
                      const high = num(r.ref_high) ?? item.high
                      return (
                        <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.name}</td>
                          <td style={{ padding: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {r.value_num}
                            <span style={{ fontWeight: 400, color: COLORS.textLight, fontSize: 12 }}> {r.unit}</span>
                          </td>
                          <td style={{ padding: 8, color: COLORS.textLight, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {low}–{high}
                          </td>
                          <td style={{ padding: 8 }}><Badge color={st.color}>{st.label}</Badge></td>
                          <td><IconBtn onClick={() => del(r.id)} title="删除" color={COLORS.red}>删</IconBtn></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollX>
              {s.note && <div style={{ marginTop: 8, fontSize: 13, color: COLORS.textLight }}>备注：{s.note}</div>}
            </Card>
          ))}

          <div style={{ fontSize: 12, color: COLORS.textLight }}>
            参考区间为常见成年男性范围，仅作提示；一切以报告单标注为准，异常请就医。
          </div>
        </>
      )}

      {modal && (
        <Modal title="录入一次血液检查" onClose={() => setModal(null)}>
          <Row>
            <FormField label="抽血日期" required>
              <TextInput type="date" value={modal.test_date} onChange={v => setModal(d => ({ ...d, test_date: v }))} />
            </FormField>
            <FormField label="检测机构">
              <TextInput value={modal.org} onChange={v => setModal(d => ({ ...d, org: v }))} placeholder="如：美年大健康" />
            </FormField>
          </Row>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>
            只填报告单上有的项，其余留空。
          </div>
          {groups.map(g => (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: COLORS.primary }}>{g}</div>
              {BLOOD_PANEL.filter(p => p.group === g).map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    {p.name}
                    <span style={{ color: COLORS.textLight, fontSize: 11, marginLeft: 6 }}>
                      {p.low}–{p.high} {p.unit}
                    </span>
                  </div>
                  <input type="number" step="any" value={modal.values[p.key]}
                    onChange={e => setModal(d => ({ ...d, values: { ...d.values, [p.key]: e.target.value } }))}
                    style={{
                      width: 96, padding: '6px 10px', borderRadius: 6, fontSize: 14, outline: 'none',
                      border: `1px solid ${COLORS.border}`,
                    }} />
                </div>
              ))}
            </div>
          ))}
          <FormField label="备注">
            <TextInput value={modal.note} onChange={v => setModal(d => ({ ...d, note: v }))} placeholder="如：空腹 12 小时" />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} onSubmit={submit}
            disabled={saving} submitText={saving ? '保存中…' : '保存'} />
        </Modal>
      )}
    </div>
  )
}
