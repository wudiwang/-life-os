// 交易原则标识（用户 2026-10-12）：交易系统的大框架与核心前提，置于交易模块页顶部。
// 这是「定规则」这一步本身——醒目、常驻、每次打开都看见；哪些规则有效，后续继续探索。
import { useState } from 'react'

import { useIsMobile } from '../../hooks/useIsMobile'

const IRON_LAW = '只有止盈与止损，没有中途的情绪变化'

const PRINCIPLES = [
  {
    no: '1',
    title: '核心原则 · 高一级别看趋势',
    accent: '#F59E0B',
    body: [
      '做交易本质上就是顺势、跟随趋势——赚钱必须依靠后续的涨跌趋势。',
      '形象的做法：做**中枢下沿的突破**，即**出中枢那一笔**（力量在这里盘整之后的重新上涨）。',
    ],
  },
  {
    no: '2',
    title: '交易模式与策略',
    accent: '#3B82F6',
    body: [
      '**完全分类**：针对不同环境和当下行情，明确自己愿意做的交易模式和情形。',
      '**聚焦模式**：起步阶段只盯一到两个交易模式（唯一或唯二）。',
      '**明确位置**：清楚在什么位置寻找机会，并据此制定策略。',
    ],
  },
  {
    no: '3',
    title: '止盈与止损',
    accent: '#10B981',
    body: [
      '止盈**可以分步**止盈。',
      '**必须**设立严格的止损位。',
    ],
  },
  {
    no: '4',
    title: '执行与复盘',
    accent: '#8B5CF6',
    body: [
      '每一笔交易**都必须符合策略**。',
      '每一笔实盘**都要复盘**，检查是否符合要求。',
      '生成**交易日报**，分析哪里做得好、哪里做得不对。',
    ],
  },
]

/** 把 **粗体** 标记渲染成 <strong>，避免为这点格式引入 markdown 渲染。 */
function RichText({ text, color }) {
  return (
    <>
      {text.split('**').map((part, index) => (
        index % 2
          ? <strong key={index} style={{ color, fontWeight: 700 }}>{part}</strong>
          : <span key={index}>{part}</span>
      ))}
    </>
  )
}

export function TradePrinciples() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(true)

  return (
    <section style={{
      borderRadius: 14,
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #111827 100%)',
      boxShadow: '0 10px 28px rgba(15, 23, 42, 0.28)',
      overflow: 'hidden',
      color: '#E5E7EB',
    }}>
      {/* 铁律横幅：最醒目的一行 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
        padding: isMobile ? '14px 14px' : '18px 22px',
        borderLeft: '5px solid #F59E0B',
        background: 'rgba(245, 158, 11, 0.10)',
      }}>
        <span style={{ fontSize: isMobile ? 22 : 26, lineHeight: 1 }} aria-hidden>⚖️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, letterSpacing: 2, color: '#FCD34D',
            fontWeight: 700, marginBottom: 4,
          }}>第 一 铁 律</div>
          <div style={{
            fontSize: isMobile ? 17 : 22, fontWeight: 800, lineHeight: 1.35,
            color: '#FFFFFF', letterSpacing: isMobile ? 0 : 0.5,
          }}>{IRON_LAW}</div>
        </div>
        <button onClick={() => setOpen(value => !value)} style={{
          flex: 'none', cursor: 'pointer', fontSize: 12, padding: '6px 10px',
          borderRadius: 8, color: '#FCD34D', fontWeight: 600,
          border: '1px solid rgba(252, 211, 77, 0.35)', background: 'transparent',
        }}>{open ? '收起' : '展开'}</button>
      </div>

      {open && (
        <div style={{ padding: isMobile ? '14px' : '18px 22px 20px' }}>
          <div style={{
            fontSize: 12, color: '#94A3B8', marginBottom: 14, lineHeight: 1.7,
          }}>交易系统的大框架与核心前提 —— 每一笔交易开仓前，先对一遍这四条。</div>

          <div style={{
            display: 'grid', gap: isMobile ? 10 : 12,
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          }}>
            {PRINCIPLES.map(item => (
              <article key={item.no} style={{
                background: 'rgba(255, 255, 255, 0.045)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                borderLeft: `3px solid ${item.accent}`,
                borderRadius: 10, padding: isMobile ? '12px 13px' : '14px 16px',
              }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <span style={{
                    flex: 'none', width: 22, height: 22, borderRadius: 6,
                    display: 'grid', placeItems: 'center',
                    background: item.accent, color: '#0F172A',
                    fontSize: 13, fontWeight: 800,
                  }}>{item.no}</span>
                  <h3 style={{
                    margin: 0, fontSize: isMobile ? 14 : 15, fontWeight: 700, color: '#F8FAFC',
                  }}>{item.title}</h3>
                </header>
                <ul style={{
                  margin: 0, paddingLeft: 17, display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {item.body.map((line, index) => (
                    <li key={index} style={{
                      fontSize: isMobile ? 13 : 13.5, lineHeight: 1.72, color: '#CBD5E1',
                    }}><RichText text={line} color={item.accent} /></li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div style={{
            marginTop: 14, paddingTop: 12, fontSize: 12, lineHeight: 1.75, color: '#94A3B8',
            borderTop: '1px solid rgba(148, 163, 184, 0.16)',
          }}>
            迈出交易的第一步是<strong style={{ color: '#E2E8F0' }}>定规则</strong>；
            具体哪些规则有效，后续在下面的形态库里继续探索与验证。
          </div>
        </div>
      )}
    </section>
  )
}
