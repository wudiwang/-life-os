// 探索世界计划：一张行程里按分类列清单。点卡片展开抽屉写感想、传自己的照片；勾选时自动记下北京时间。
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, PLAN_ITEM_CATEGORIES } from '../../lib/constants'
import { beijingToday } from '../../lib/date'
import { db, isDemo, uploadFile } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton } from '../../components/common/EmptyState'
import { TableMissing } from '../../components/common/TableMissing'
import { ensureDemoExplorePlans } from './explorePlanSeed'

const SQL = 'v18_explore_plans.sql'

export function ExplorePlansPage() {
  const isMobile = useIsMobile()
  const showToast = useUIStore(s => s.showToast)
  const plans = useTable('explore_plans', { optional: true, orderBy: 'sort_order', ascending: true })
  const items = useTable('explore_plan_items', { optional: true, orderBy: 'sort_order', ascending: true })
  const { missing: plansMissing, loading: plansLoading, reload: reloadPlans } = plans
  const { missing: itemsMissing, loading: itemsLoading, reload: reloadItems } = items
  const [seedReady, setSeedReady] = useState(!isDemo)
  const [planId, setPlanId] = useState(null)
  const [cat, setCat] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [planForm, setPlanForm] = useState(null)
  const [itemForm, setItemForm] = useState(null)

  useEffect(() => {
    if (plansMissing || itemsMissing) return undefined
    if (plansLoading || itemsLoading) return undefined
    let cancel = false
    ;(async () => {
      try {
        const changed = await ensureDemoExplorePlans()
        if (cancel) return
        if (changed) {
          await reloadPlans()
          await reloadItems()
        }
      } catch (err) {
        if (!cancel) showToast(`行程没有准备好：${err.message}`, 'error')
      } finally {
        if (!cancel) setSeedReady(true)
      }
    })()
    return () => { cancel = true }
  }, [plansMissing, plansLoading, reloadPlans, itemsMissing, itemsLoading, reloadItems, showToast])

  if (plansMissing || itemsMissing) return <TableMissing sql={SQL} />
  if (plansLoading || itemsLoading || !seedReady) {
    return <div style={{ color: COLORS.textLight, padding: 12 }}>加载中…</div>
  }

  const plan = plans.rows.find(p => p.id === planId) || plans.rows[0] || null
  const planItems = plan ? items.rows.filter(row => row.plan_id === plan.id) : []
  const shown = cat === 'all' ? planItems : planItems.filter(row => row.category === cat)
  const doneCount = planItems.filter(row => row.done).length
  const openItem = items.rows.find(row => row.id === openId) || null

  const selectPlan = id => {
    setPlanId(id)
    setCat('all')
    setOpenId(null)
  }

  const toggleDone = async item => {
    const patch = item.done
      ? { done: false, done_on: null }
      : { done: true, done_on: beijingToday() }
    await items.patch(item.id, touch(patch))
  }

  const openAddItem = () => {
    if (!plan) return
    setItemForm({
      title: '',
      category: cat === 'all' ? 'food' : cat,
      note: '',
      emoji: '',
      image_url: '',
    })
  }

  const savePlan = async () => {
    const title = planForm.title.trim()
    if (!title) return
    const data = touch({
      title,
      place: planForm.place.trim() || null,
      start_date: planForm.start_date || null,
      end_date: planForm.end_date || null,
      note: planForm.note.trim() || null,
      emoji: planForm.emoji.trim() || null,
    })
    try {
      if (planForm.id) {
        await plans.patch(planForm.id, data)
      } else {
        const sort = plans.rows.reduce((max, row) => Math.max(max, row.sort_order || 0), 0) + 1
        const created = await plans.add({ ...data, sort_order: sort })
        if (created?.id) setPlanId(created.id)
      }
      setPlanForm(null)
    } catch {
      // useTable 已提示
    }
  }

  const saveItem = async () => {
    const title = itemForm.title.trim()
    if (!title || !plan) return
    const data = touch({
      title,
      category: itemForm.category,
      note: itemForm.note.trim() || null,
      emoji: itemForm.emoji.trim() || null,
      image_url: itemForm.image_url.trim() || null,
    })
    try {
      if (itemForm.id) {
        await items.patch(itemForm.id, data)
        setItemForm(null)
      } else {
        const sort = planItems.reduce((max, row) => Math.max(max, row.sort_order || 0), 0) + 1
        const created = await items.add({
          ...data,
          plan_id: plan.id,
          sort_order: sort,
          done: false,
          done_on: null,
          reflection: null,
          rating: null,
          photos: [],
        })
        setItemForm(null)
        if (created?.id) setOpenId(created.id)
      }
    } catch {
      // useTable 已提示
    }
  }

  const removePlan = async current => {
    if (!window.confirm(`删除计划「${current.title}」？里面的清单会一起去掉。`)) return
    const mine = items.rows.filter(row => row.plan_id === current.id)
    try {
      for (const row of mine) await db.remove('explore_plan_items', row.id)
      await db.remove('explore_plans', current.id)
      if (openItem && mine.some(row => row.id === openItem.id)) setOpenId(null)
      setPlanId(null)
      await items.reload()
      await plans.reload()
    } catch (err) {
      showToast(`删除失败：${err.message}`, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {plans.rows.map(row => (
          <Chip key={row.id} active={plan?.id === row.id} onClick={() => selectPlan(row.id)}>
            {row.emoji || '🗺️'} {row.place || row.title}
          </Chip>
        ))}
        <Chip onClick={() => setPlanForm(emptyPlan())}>+ 计划</Chip>
      </div>

      {!plan ? (
        <div style={cardShell}>
          <EmptyState
            icon="🗺️"
            text="还没有行程。先加一个，比如 Pattaya 周末。"
            action={<AddButton onClick={() => setPlanForm(emptyPlan())}>+ 新计划</AddButton>}
          />
        </div>
      ) : (
        <>
          <div style={{ ...cardShell, padding: isMobile ? 14 : 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, lineHeight: 1.35 }}>
                  {plan.emoji || '🗺️'} {plan.title}
                </div>
                <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>
                  {[plan.place, fmtRange(plan.start_date, plan.end_date)].filter(Boolean).join(' · ')}
                </div>
                {plan.note && (
                  <div style={{ fontSize: 13, color: COLORS.text, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {plan.note}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <GhostBtn onClick={() => setPlanForm(planToForm(plan))}>编辑</GhostBtn>
                <GhostBtn color={COLORS.red} onClick={() => removePlan(plan)}>删除</GhostBtn>
              </div>
            </div>
            <Progress done={doneCount} total={planItems.length} />
            <div style={{ marginTop: 12 }}>
              <AddButton onClick={openAddItem}>+ 清单</AddButton>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip active={cat === 'all'} onClick={() => setCat('all')}>全部 {planItems.length}</Chip>
            {PLAN_ITEM_CATEGORIES.map(c => (
              <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
                {c.icon} {c.label} {planItems.filter(row => row.category === c.key).length}
              </Chip>
            ))}
          </div>

          {shown.length === 0 ? (
            <div style={cardShell}>
              <EmptyState
                icon="🗺️"
                text={cat === 'all' ? '这个计划还是空的' : `还没有${categoryOf(cat).label}`}
                action={<AddButton onClick={openAddItem}>+ 加一条</AddButton>}
              />
            </div>
          ) : (
            groupItems(shown).map(group => (
              <section key={group.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 10px' }}>
                  <span>{group.icon}</span>
                  <span style={{ fontWeight: 650, fontSize: 15 }}>{group.label}</span>
                  <span style={{ fontSize: 12, color: COLORS.textLight }}>{group.items.length}</span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 12,
                }}>
                  {group.items.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      mobile={isMobile}
                      onOpen={() => setOpenId(item.id)}
                      onToggle={() => toggleDone(item)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {openItem && (
        <ItemSheet
          key={openItem.id}
          item={openItem}
          mobile={isMobile}
          onPatch={items.patch}
          onClose={() => setOpenId(null)}
          onToggle={() => toggleDone(openItem)}
          onEdit={() => setItemForm(itemToForm(openItem))}
          onDelete={async () => {
            if (!window.confirm('删除这条清单？照片和感想会一起去掉。')) return
            setOpenId(null)
            await items.del(openItem.id)
          }}
        />
      )}

      {planForm && (
        <Modal title={planForm.id ? '编辑计划' : '新计划'} onClose={() => setPlanForm(null)}>
          <FormField label="标题" required>
            <TextInput value={planForm.title} onChange={v => setPlanForm(f => ({ ...f, title: v }))} placeholder="如：Pattaya 周末" />
          </FormField>
          <Row>
            <FormField label="地点">
              <TextInput value={planForm.place} onChange={v => setPlanForm(f => ({ ...f, place: v }))} placeholder="Pattaya" />
            </FormField>
            <FormField label="标记">
              <TextInput value={planForm.emoji} onChange={v => setPlanForm(f => ({ ...f, emoji: v }))} placeholder="🏖️" />
            </FormField>
          </Row>
          <Row>
            <FormField label="开始">
              <TextInput type="date" value={planForm.start_date} onChange={v => setPlanForm(f => ({ ...f, start_date: v }))} />
            </FormField>
            <FormField label="结束">
              <TextInput type="date" value={planForm.end_date} onChange={v => setPlanForm(f => ({ ...f, end_date: v }))} />
            </FormField>
          </Row>
          <FormField label="备注">
            <TextArea value={planForm.note} onChange={v => setPlanForm(f => ({ ...f, note: v }))} rows={3} placeholder="这一趟想怎么过" />
          </FormField>
          <ModalActions onCancel={() => setPlanForm(null)} onSubmit={savePlan} disabled={!planForm.title.trim()} />
        </Modal>
      )}

      {itemForm && (
        <Modal title={itemForm.id ? '编辑清单' : '加一条'} onClose={() => setItemForm(null)}>
          <FormField label="标题" required>
            <TextInput value={itemForm.title} onChange={v => setItemForm(f => ({ ...f, title: v }))} placeholder="想去的地方" />
          </FormField>
          <Row>
            <FormField label="分类">
              <Select
                value={itemForm.category}
                onChange={v => setItemForm(f => ({ ...f, category: v }))}
                options={PLAN_ITEM_CATEGORIES.map(c => ({ key: c.key, label: `${c.icon} ${c.label}` }))}
              />
            </FormField>
            <FormField label="标记">
              <TextInput value={itemForm.emoji} onChange={v => setItemForm(f => ({ ...f, emoji: v }))} placeholder="🍜" />
            </FormField>
          </Row>
          <FormField label="短注">
            <TextInput value={itemForm.note} onChange={v => setItemForm(f => ({ ...f, note: v }))} placeholder="营业、门票、怎么去" />
          </FormField>
          <FormField label="封面图链接" hint="留空就用色块。自由授权图片即可，别贴有版权的网页图。">
            <TextInput value={itemForm.image_url} onChange={v => setItemForm(f => ({ ...f, image_url: v }))} placeholder="https://" />
          </FormField>
          <ModalActions onCancel={() => setItemForm(null)} onSubmit={saveItem} disabled={!itemForm.title.trim()} />
        </Modal>
      )}
    </div>
  )
}

function ItemCard({ item, mobile, onOpen, onToggle }) {
  const photos = photoList(item)
  const cover = photos.at(-1) || item.image_url
  const cat = categoryOf(item.category)
  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: mobile ? 'row' : 'column',
      background: item.done ? '#F0FDF4' : '#fff',
      border: `1px solid ${item.done ? '#A7F3D0' : COLORS.border}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <button type="button" onClick={onOpen} style={{
        ...resetBtn,
        display: 'flex',
        flexDirection: mobile ? 'row' : 'column',
        gap: mobile ? 10 : 0,
        padding: mobile ? 10 : 0,
        flex: 1,
        minWidth: 0,
        alignItems: mobile ? 'center' : 'stretch',
      }}>
        <div style={{
          width: mobile ? 92 : '100%',
          height: mobile ? 92 : 148,
          flexShrink: 0,
          borderRadius: mobile ? 10 : 0,
          overflow: 'hidden',
        }}>
          <Cover url={cover} emoji={item.emoji} category={item.category} height={mobile ? 92 : 148} alt="" />
        </div>
        <div style={{
          padding: mobile ? 0 : 12,
          minWidth: mobile ? 0 : undefined,
          flex: 1,
          textAlign: 'left',
        }}>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 4 }}>{cat.icon} {cat.label}</div>
          <div style={{ fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>{item.title}</div>
          {item.note && (
            <div style={{
              fontSize: 13, color: COLORS.textLight, marginTop: 4, lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{item.note}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: COLORS.textLight }}>
            {item.done && <span style={{ color: COLORS.green }}>{fmtDay(item.done_on) || '已去过'}</span>}
            {item.rating ? <span style={{ color: '#D97706' }}>{'★'.repeat(item.rating)}</span> : null}
            {photos.length > 0 && <span>📷 {photos.length}</span>}
            {item.reflection && <span>✍️</span>}
          </div>
        </div>
      </button>
      <div style={mobile
        ? { display: 'flex', alignItems: 'center', paddingRight: 8 }
        : { position: 'absolute', top: 8, right: 8 }}>
        <DoneDot done={item.done} onToggle={onToggle} />
      </div>
    </div>
  )
}

function ItemSheet({ item, mobile, onPatch, onClose, onToggle, onEdit, onDelete }) {
  const showToast = useUIStore(s => s.showToast)
  const [text, setText] = useState(item.reflection || '')
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const textRef = useRef(item.reflection || '')
  const alive = useRef(true)
  const photos = photoList(item)
  const cat = categoryOf(item.category)

  const onPatchRef = useRef(onPatch)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onPatchRef.current = onPatch
    onCloseRef.current = onClose
  }, [onPatch, onClose])

  const close = useCallback(async () => {
    const next = textRef.current
    if ((item.reflection || '') !== next) {
      try {
        await onPatchRef.current(item.id, touch({ reflection: next }))
      } catch {
        // useTable 已提示，仍然收起，避免挡住页面
      }
    }
    onCloseRef.current()
  }, [item.reflection, item.id])
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = event => { if (event.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      alive.current = false
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if ((item.reflection || '') === text) return undefined
    const handle = setTimeout(() => {
      setStatus('保存中…')
      onPatch(item.id, touch({ reflection: text }))
        .then(() => { if (alive.current) setStatus('已保存') })
        .catch(() => { if (alive.current) setStatus('保存失败') })
    }, 600)
    return () => clearTimeout(handle)
  }, [text, item.id, item.reflection, onPatch])

  const onText = value => {
    textRef.current = value
    setText(value)
    setStatus('')
  }

  const pickRating = async n => {
    const rating = item.rating === n ? null : n
    await onPatch(item.id, touch({ rating }))
  }

  const onFiles = async event => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    setUploading(true)
    const urls = []
    try {
      for (const file of files) urls.push(await uploadFile(file))
    } catch (err) {
      showToast(err.message || '上传失败', 'error')
      setUploading(false)
      return
    }
    try {
      await onPatch(item.id, touch({ photos: [...photoList(item), ...urls] }))
    } catch {
      // useTable 已提示
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async index => {
    await onPatch(item.id, touch({ photos: photoList(item).filter((_, i) => i !== index) }))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(15,23,42,0.45)' }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={mobile ? {
          position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92vh',
          background: '#fff', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column',
        } : {
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)',
          background: '#fff', display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.16)',
        }}
      >
        {mobile && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E5E7EB' }} />
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: mobile ? '8px 14px 12px' : '12px 14px', borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0, fontWeight: 650, fontSize: 15, lineHeight: 1.35 }}>{item.title}</div>
          <button type="button" onClick={close} aria-label="收起" style={{
            border: 'none', background: '#F3F4F6', width: 36, height: 36, borderRadius: 18, fontSize: 18, color: COLORS.text,
          }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: 16, paddingBottom: 'calc(16px + var(--tg-safe-bottom, 0px))' }}>
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
            <Cover url={item.image_url} emoji={item.emoji} category={item.category} height={180} alt={item.title} />
          </div>
          {String(item.image_url || '').includes('wikimedia.org') && (
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 10 }}>封面来自 Wikimedia Commons</div>
          )}
          <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 6 }}>{cat.icon} {cat.label}</div>
          {item.note && <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 14 }}>{item.note}</div>}

          <button type="button" onClick={onToggle} aria-pressed={!!item.done} style={{
            width: '100%', minHeight: 48, borderRadius: 10, fontSize: 15, fontWeight: 650,
            border: `1px solid ${item.done ? COLORS.green : COLORS.border}`,
            background: item.done ? '#ECFDF5' : '#fff',
            color: item.done ? '#047857' : COLORS.text,
          }}>
            {item.done ? `已去过${item.done_on ? ` · ${fmtDay(item.done_on)}` : ''}` : '标记去过'}
          </button>
          <div style={{ fontSize: 12, color: COLORS.textLight, margin: '6px 0 16px' }}>
            {item.done ? '再点一下就取消。日期是勾选当天（北京时间）。' : '勾选后自动记下今天，不用选日期。'}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>我拍的</div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10, WebkitOverflowScrolling: 'touch' }}>
              {photos.map((url, index) => (
                <div key={`${index}-${url.slice(-32)}`} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={url} alt="我拍的照片" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  <button type="button" aria-label="移除这张照片" onClick={() => removePhoto(index)} style={{
                    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
                    border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
          <label style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 44, padding: '0 14px', borderRadius: 8, marginBottom: 16,
            border: `1px dashed ${COLORS.primary}`, color: COLORS.primary, fontSize: 14, background: '#fff',
          }}>
            {uploading ? '上传中…' : '＋ 加上我拍的'}
            <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={onFiles} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>感想</div>
            <div style={{ fontSize: 12, color: status === '保存失败' ? COLORS.red : COLORS.textLight }}>{status}</div>
          </div>
          <textarea
            value={text}
            rows={4}
            placeholder="一句就够：味道、人、或者下次还来不来"
            onChange={event => onText(event.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10, resize: 'vertical', lineHeight: 1.6,
              border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none', color: COLORS.text,
            }}
          />
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4, marginBottom: 14 }}>停一下就会自动保存</div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>打分（可选）</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                aria-label={`${n} 分`}
                aria-pressed={item.rating === n}
                onClick={() => pickRating(n)}
                style={{
                  width: 40, height: 40, borderRadius: 8, fontSize: 18,
                  border: `1px solid ${(item.rating || 0) >= n ? '#FCD34D' : COLORS.border}`,
                  background: (item.rating || 0) >= n ? '#FFFBEB' : '#fff',
                }}
              >{(item.rating || 0) >= n ? '★' : '☆'}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn onClick={onEdit}>编辑这条</GhostBtn>
            <GhostBtn color={COLORS.red} onClick={onDelete}>删除</GhostBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cover({ url, emoji, category, height, alt }) {
  const [bad, setBad] = useState(false)
  const cat = categoryOf(category)
  if (url && !bad) {
    return (
      <img
        src={url}
        alt={alt}
        onError={() => setBad(true)}
        style={{ width: '100%', height, objectFit: 'cover', display: 'block', background: '#E5E7EB' }}
      />
    )
  }
  return (
    <div style={{
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: height > 120 ? 48 : 32,
      background: `linear-gradient(135deg, ${cat.tint}, ${cat.tint2})`,
    }}>{emoji || cat.icon}</div>
  )
}

function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const full = total > 0 && done === total
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ fontWeight: 650, color: full ? COLORS.green : COLORS.text }}>{done}/{total} 已去过</span>
        <span style={{ color: COLORS.textLight }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 99,
          background: full ? COLORS.green : COLORS.primary,
        }} />
      </div>
    </div>
  )
}

function DoneDot({ done, onToggle }) {
  return (
    <button
      type="button"
      aria-label={done ? '标为还没去' : '标记去过'}
      aria-pressed={!!done}
      onClick={event => { event.stopPropagation(); onToggle() }}
      style={{
        width: 44, height: 44, borderRadius: 22,
        border: `2px solid ${done ? COLORS.green : COLORS.border}`,
        background: done ? COLORS.green : 'rgba(255,255,255,0.92)',
        color: '#fff', fontSize: 18, lineHeight: 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      }}
    >{done ? '✓' : ''}</button>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      flexShrink: 0, minHeight: 36, padding: '6px 12px', borderRadius: 999, fontSize: 13,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
      background: active ? '#EFF6FF' : '#fff',
      color: active ? COLORS.primary : COLORS.text,
    }}>{children}</button>
  )
}

function GhostBtn({ onClick, children, color = COLORS.text }) {
  return (
    <button type="button" onClick={onClick} style={{
      minHeight: 36, padding: '6px 12px', borderRadius: 8, fontSize: 13,
      border: `1px solid ${COLORS.border}`, background: '#fff', color,
    }}>{children}</button>
  )
}

function categoryOf(key) {
  return PLAN_ITEM_CATEGORIES.find(c => c.key === key) || {
    key: 'other', label: '其他', icon: '📌', tint: '#E5E7EB', tint2: '#9CA3AF',
  }
}

function photoList(item) {
  const photos = item?.photos
  if (Array.isArray(photos)) return photos.filter(Boolean)
  if (typeof photos === 'string') {
    try {
      const parsed = JSON.parse(photos)
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
}

function groupItems(rows) {
  const known = PLAN_ITEM_CATEGORIES.map(c => ({
    ...c,
    items: rows.filter(row => row.category === c.key).sort(byOrder),
  })).filter(group => group.items.length)
  const rest = rows.filter(row => !PLAN_ITEM_CATEGORIES.some(c => c.key === row.category)).sort(byOrder)
  if (rest.length) {
    known.push({ key: 'other', label: '其他', icon: '📌', items: rest })
  }
  return known
}

function byOrder(a, b) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
}

function fmtDay(value) {
  if (!value) return ''
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return String(value)
  return `${match[1]}.${match[2]}.${match[3]}`
}

function fmtRange(start, end) {
  const a = fmtDay(start)
  const b = fmtDay(end)
  if (a && b) return `${a} – ${b}`
  return a || b
}

function touch(patch) {
  return { ...patch, updated_at: new Date().toISOString() }
}

function emptyPlan() {
  return { title: '', place: '', start_date: '', end_date: '', note: '', emoji: '🗺️' }
}

function planToForm(plan) {
  return {
    id: plan.id,
    title: plan.title || '',
    place: plan.place || '',
    start_date: String(plan.start_date || '').slice(0, 10),
    end_date: String(plan.end_date || '').slice(0, 10),
    note: plan.note || '',
    emoji: plan.emoji || '',
  }
}

function itemToForm(item) {
  return {
    id: item.id,
    title: item.title || '',
    category: item.category || 'food',
    note: item.note || '',
    emoji: item.emoji || '',
    image_url: item.image_url || '',
  }
}

const cardShell = {
  background: '#fff',
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
}

const resetBtn = {
  border: 'none',
  background: 'transparent',
  margin: 0,
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  width: '100%',
}
