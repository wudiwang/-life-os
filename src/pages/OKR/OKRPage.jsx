import { useMemo, useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, FOCUS_TRACKS, OKR_LEVELS, OKR_STATUS, trackOf } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextArea, TextInput, Select, Row } from '../../components/common/FormField'
import { Badge } from '../../components/common/Badge'
import { TableMissing } from '../../components/common/TableMissing'
import { currentQuarter, currentYear, thisWeekDays, todayStr } from '../../lib/date'

const WD = [
  { key: '1', label: '一' }, { key: '2', label: '二' }, { key: '3', label: '三' },
  { key: '4', label: '四' }, { key: '5', label: '五' }, { key: '6', label: '六' },
  { key: '7', label: '日' },
]

const emptyObjective = level => ({
  level, period: level === 'year' ? currentYear() : currentQuarter(),
  title: '', track: 'work', why: '', metric: '', metric_target: '', metric_current: '',
  status: 'active', sort_order: 99,
})

const emptyAction = objective_id => ({
  title: '', detail: '', track: 'work', objective_id,
  per_week: 1, weekdays: '', active: true, sort_order: 99,
})

export function OKRPage() {
  const isMobile = useIsMobile()
  const { rows: objectives, missing, add: addObj, patch: patchObj, del: delObj } =
    useTable('okr_objectives', { orderBy: 'sort_order', ascending: true, optional: true })
  const { rows: actions, add: addAct, patch: patchAct, del: delAct } =
    useTable('weekly_actions', { orderBy: 'sort_order', ascending: true, optional: true })
  const { rows: logs } = useTable('weekly_action_logs', {
    orderBy: 'log_date', ascending: false, limit: 400, optional: true,
  })

  const [editObj, setEditObj] = useState(null)
  const [editAct, setEditAct] = useState(null)

  const week = useMemo(() => thisWeekDays(), [])
  const doneThisWeek = id => week.filter(d => logs.some(l => l.action_id === id && l.log_date === d)).length

  const thisYear = currentYear()
  const thisQ = currentQuarter()
  const live = objectives.filter(o => o.status === 'active')

  const saveObj = async () => {
    const { id, ...body } = editObj
    if (id) await patchObj(id, { ...body, updated_at: new Date().toISOString() })
    else await addObj(body)
    setEditObj(null)
  }

  const saveAct = async () => {
    const { id, ...body } = editAct
    const payload = { ...body, per_week: Number(body.per_week) || 1 }
    if (id) await patchAct(id, { ...payload, updated_at: new Date().toISOString() })
    else await addAct(payload)
    setEditAct(null)
  }

  if (missing) return <TableMissing sql="v8_okr_commitments.sql" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 为什么这么设计——每次打开都要看见，防止自己又滑向结果指标 */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12,
        padding: '14px 18px', fontSize: 13, lineHeight: 1.8, color: COLORS.text,
      }}>
        <b>这一页的规则：结果指标只在回顾时看，永远不做每日考核。</b><br />
        个人给自己定 KPI，裁判和运动员是同一个人，用结果指标每天自评必然走向两种结局——标准悄悄放水，
        或者定得太狠崩一次之后全面弃疗。<br />
        所以往下只拆到<b>「每周做几次的动作」</b>：做没做是二元的，无法自欺。
        <span style={{ color: COLORS.textLight }}>动作数量和执行率成反比——能压成一条就别写四条。</span>
      </div>

      {OKR_LEVELS.map(lv => {
        const list = live.filter(o => o.level === lv.key)
        const nowPeriod = lv.key === 'year' ? thisYear : thisQ
        return (
          <Card
            key={lv.key}
            title={`${lv.icon} ${lv.label}目标 · ${nowPeriod}`}
            extra={
              <button onClick={() => setEditObj(emptyObjective(lv.key))} style={{
                border: 'none', background: 'none', color: COLORS.primary, fontSize: 13,
              }}>+ 新增</button>
            }
          >
            {list.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textLight }}>{lv.hint}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {list.map(o => {
                  const t = trackOf(o.track)
                  const mine = actions.filter(a => a.objective_id === o.id && a.active !== false)
                  const stale = o.period !== nowPeriod
                  return (
                    <div key={o.id} style={{
                      border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${t.color}`,
                      borderRadius: 10, padding: 14,
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <Badge color={t.color}>{t.icon} {t.short || t.label}</Badge>
                        {stale && <Badge color={COLORS.orange}>{o.period}（非本期）</Badge>}
                        <span style={{ flex: 1, minWidth: isMobile ? '100%' : 0, fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
                          {o.title}
                        </span>
                        <button onClick={() => setEditObj(o)} style={{
                          border: 'none', background: 'none', color: COLORS.textLight, fontSize: 12,
                        }}>编辑</button>
                      </div>

                      {o.why && (
                        <div style={{
                          fontSize: 13, color: COLORS.textLight, lineHeight: 1.8,
                          whiteSpace: 'pre-wrap', marginTop: 8,
                        }}>{o.why}</div>
                      )}

                      {o.metric && (
                        <div style={{
                          fontSize: 12, color: COLORS.textLight, marginTop: 8,
                          background: COLORS.bg, borderRadius: 8, padding: '8px 10px', lineHeight: 1.7,
                        }}>
                          📊 衡量口径（回顾时看）：{o.metric}
                          {o.metric_target && <> · 目标 <b>{o.metric_target}</b></>}
                          {o.metric_current && <> · 当前 <b>{o.metric_current}</b></>}
                        </div>
                      )}

                      {/* 挂在这条 O 下的行为契约 */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{
                          fontSize: 12, color: COLORS.textLight, marginBottom: 6,
                          display: 'flex', alignItems: 'center',
                        }}>
                          <span style={{ flex: 1 }}>拆成的每周动作</span>
                          <button onClick={() => setEditAct({ ...emptyAction(o.id), track: o.track })} style={{
                            border: 'none', background: 'none', color: COLORS.primary, fontSize: 12,
                          }}>+ 加动作</button>
                        </div>
                        {mine.length === 0 ? (
                          <div style={{ fontSize: 12, color: COLORS.textLight }}>
                            还没拆到动作——只有 O 没有动作，等于没定。
                          </div>
                        ) : mine.map(a => {
                          const n = doneThisWeek(a.id)
                          const hit = n >= (a.per_week || 1)
                          return (
                            <div key={a.id} onClick={() => setEditAct(a)} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                              fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}`,
                            }}>
                              <span style={{ flex: 1, minWidth: 0 }}>{a.title}</span>
                              {a.weekdays && (
                                <span style={{ fontSize: 11, color: COLORS.textLight }}>
                                  周{a.weekdays.split(',').map(k => WD.find(w => w.key === k.trim())?.label).join('')}
                                </span>
                              )}
                              <span style={{
                                fontSize: 12, color: hit ? COLORS.green : COLORS.textLight,
                                fontWeight: hit ? 600 : 400, whiteSpace: 'nowrap',
                              }}>本周 {n}/{a.per_week || 1}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}

      {/* 没挂到任何 O 上的动作 */}
      {actions.some(a => a.active !== false && !a.objective_id) && (
        <Card title="📎 未挂到目标上的动作">
          {actions.filter(a => a.active !== false && !a.objective_id).map(a => (
            <div key={a.id} onClick={() => setEditAct(a)} style={{
              display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer',
              borderBottom: `1px solid ${COLORS.border}`,
            }}>
              <span style={{ flex: 1 }}>{a.title}</span>
              <span style={{ fontSize: 12, color: COLORS.textLight }}>本周 {doneThisWeek(a.id)}/{a.per_week || 1}</span>
            </div>
          ))}
        </Card>
      )}

      {/* 已归档 */}
      {objectives.some(o => o.status !== 'active') && (
        <Card title="🗄 已完成 / 已放弃">
          {objectives.filter(o => o.status !== 'active').map(o => {
            const st = OKR_STATUS.find(s => s.key === o.status)
            return (
              <div key={o.id} onClick={() => setEditObj(o)} style={{
                display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0',
                fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <Badge color={st?.color}>{st?.label}</Badge>
                <span style={{ color: COLORS.textLight }}>{o.period}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{o.title}</span>
              </div>
            )
          })}
        </Card>
      )}

      {editObj && (
        <Modal title={editObj.id ? '编辑目标' : '新增目标'} onClose={() => setEditObj(null)}>
          <Row cols={isMobile ? '1fr' : '1fr 1fr'}>
            <FormField label="层级">
              <Select value={editObj.level} onChange={v => setEditObj(d => ({ ...d, level: v }))}
                options={OKR_LEVELS.map(l => ({ key: l.key, label: l.label }))} />
            </FormField>
            <FormField label="周期" hint="年度填 2026，季度填 2026Q3">
              <TextInput value={editObj.period} onChange={v => setEditObj(d => ({ ...d, period: v }))} />
            </FormField>
          </Row>
          <FormField label="Objective" required hint="一句话说清方向，不要写成指标">
            <TextArea value={editObj.title} onChange={v => setEditObj(d => ({ ...d, title: v }))} rows={2} />
          </FormField>
          <Row cols={isMobile ? '1fr' : '1fr 1fr'}>
            <FormField label="方向">
              <Select value={editObj.track} onChange={v => setEditObj(d => ({ ...d, track: v }))}
                options={FOCUS_TRACKS.map(t => ({ key: t.key, label: `${t.icon} ${t.label}` }))} />
            </FormField>
            <FormField label="状态">
              <Select value={editObj.status} onChange={v => setEditObj(d => ({ ...d, status: v }))}
                options={OKR_STATUS.map(s => ({ key: s.key, label: s.label }))} />
            </FormField>
          </Row>
          <FormField label="为什么这条重要" hint="回顾时用它判断该继续还是该放弃">
            <TextArea value={editObj.why} onChange={v => setEditObj(d => ({ ...d, why: v }))} rows={3} />
          </FormField>
          <FormField label="衡量口径" hint="只在回顾时看。绝不拿它做每日考核">
            <TextInput value={editObj.metric} onChange={v => setEditObj(d => ({ ...d, metric: v }))}
              placeholder="如：每周五周报连续未断的周数" />
          </FormField>
          <Row cols="1fr 1fr">
            <FormField label="目标值">
              <TextInput value={editObj.metric_target} onChange={v => setEditObj(d => ({ ...d, metric_target: v }))} />
            </FormField>
            <FormField label="当前值">
              <TextInput value={editObj.metric_current} onChange={v => setEditObj(d => ({ ...d, metric_current: v }))} />
            </FormField>
          </Row>
          <ModalActions
            onCancel={() => setEditObj(null)} onSubmit={saveObj} disabled={!editObj.title.trim()}
          />
          {editObj.id && (
            <button onClick={async () => { await delObj(editObj.id); setEditObj(null) }} style={{
              marginTop: 12, border: 'none', background: 'none', color: COLORS.red, fontSize: 13,
            }}>删除这条目标</button>
          )}
        </Modal>
      )}

      {editAct && (
        <Modal title={editAct.id ? '编辑动作' : '新增每周动作'} onClose={() => setEditAct(null)}>
          <FormField label="动作" required hint="必须是动作，不是目标。「周五发 5 行周报」✓、「提升可见性」✗">
            <TextInput value={editAct.title} onChange={v => setEditAct(d => ({ ...d, title: v }))} />
          </FormField>
          <FormField label="具体怎么做" hint="物化成 1234。写得越具体，做的时候越不用重新决策">
            <TextArea value={editAct.detail} onChange={v => setEditAct(d => ({ ...d, detail: v }))} rows={5} />
          </FormField>
          <Row cols={isMobile ? '1fr' : '1fr 1fr'}>
            <FormField label="方向">
              <Select value={editAct.track} onChange={v => setEditAct(d => ({ ...d, track: v }))}
                options={FOCUS_TRACKS.map(t => ({ key: t.key, label: `${t.icon} ${t.label}` }))} />
            </FormField>
            <FormField label="每周几次">
              <TextInput type="number" value={editAct.per_week}
                onChange={v => setEditAct(d => ({ ...d, per_week: v }))} />
            </FormField>
          </Row>
          <FormField label="固定星期（可选）" hint="选了就只在这几天提醒；不选则按每周次数提醒">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WD.map(w => {
                const cur = (editAct.weekdays || '').split(',').map(s => s.trim()).filter(Boolean)
                const on = cur.includes(w.key)
                return (
                  <button key={w.key} onClick={() => {
                    const next = on ? cur.filter(k => k !== w.key) : [...cur, w.key].sort()
                    setEditAct(d => ({ ...d, weekdays: next.join(',') }))
                  }} style={{
                    width: 36, height: 32, borderRadius: 8, fontSize: 13,
                    border: `1px solid ${on ? COLORS.primary : COLORS.border}`,
                    background: on ? COLORS.primary : '#fff',
                    color: on ? '#fff' : COLORS.text, cursor: 'pointer',
                  }}>{w.label}</button>
                )
              })}
            </div>
          </FormField>
          <ModalActions
            onCancel={() => setEditAct(null)} onSubmit={saveAct} disabled={!editAct.title.trim()}
          />
          {editAct.id && (
            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
              <button onClick={async () => {
                await patchAct(editAct.id, { active: false }); setEditAct(null)
              }} style={{ border: 'none', background: 'none', color: COLORS.textLight, fontSize: 13 }}>
                停用（保留历史打卡）
              </button>
              <button onClick={async () => { await delAct(editAct.id); setEditAct(null) }} style={{
                border: 'none', background: 'none', color: COLORS.red, fontSize: 13,
              }}>彻底删除</button>
            </div>
          )}
        </Modal>
      )}

      <div style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', padding: '8px 0' }}>
        今天是 {todayStr()} · 本周动作完成情况见人生看板
      </div>
    </div>
  )
}
