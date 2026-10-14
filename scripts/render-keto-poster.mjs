// 把 src/lib/ketoPlan.js 渲染成一张整图 public/keto-week.png（一周食谱页的「下载大图」）。
// 改了食谱数据后重跑：node scripts/render-keto-poster.mjs
// 依赖 playwright（未列入项目依赖）：没有就 `npm i -g playwright` 后用 NODE_PATH 指向全局目录。
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KETO_TARGETS, KETO_MACROS, MEAL_SLOTS, KETO_WEEK, KETO_WEEK_AVG, KETO_PROFILE, KETO_EAT, KETO_TIPS, KETO_SHOPPING, itemLabel,
} from '../src/lib/ketoPlan.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'keto-week.png')

function loadPlaywright() {
  const require = createRequire(import.meta.url)
  try { return require('playwright') } catch { /* 退到全局安装 */ }
  const globalRoot = execSync('npm root -g').toString().trim()
  return createRequire(path.join(globalRoot, '_'))('playwright')
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const mealCell = m => `<td><div class="mn">${esc(m.name)}</div>${m.items.length ? `<div class="it">${m.items.map(i => esc(itemLabel(i))).join('<br>')}</div><div class="mk">${m.total.kcal} kcal · 蛋白 ${m.total.p}g</div>` : ''}</td>`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1800px; background: #F3F4F6; font-family: "WenQuanYi Zen Hei", "PingFang SC", "Microsoft YaHei", sans-serif; color: #1F2937; padding: 48px; }
.hero { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: #fff; border-radius: 24px; padding: 36px 44px; display: flex; justify-content: space-between; align-items: center; gap: 40px; }
.hero h1 { font-size: 52px; letter-spacing: 2px; }
.hero p { font-size: 20px; opacity: .85; margin-top: 10px; }
.macro { width: 520px; }
.bar { display: flex; height: 34px; border-radius: 17px; overflow: hidden; margin-bottom: 10px; }
.bar div { display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; }
.legend { font-size: 16px; opacity: .9; }
.targets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin: 24px 0; }
.t { background: #fff; border-radius: 16px; padding: 18px 20px; border: 1px solid #E5E7EB; }
.t .l { font-size: 16px; color: #6B7280; } .t .v { font-size: 28px; font-weight: 800; color: #2563EB; margin: 6px 0; } .t .n { font-size: 14px; color: #6B7280; line-height: 1.5; }
table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 8px; margin: 0 -8px; }
th { background: #1F2937; color: #fff; border-radius: 12px; padding: 14px 8px; font-size: 22px; }
th small { display: block; font-size: 14px; font-weight: 400; opacity: .75; margin-top: 4px; }
td { background: #fff; border-radius: 12px; padding: 14px; font-size: 17px; line-height: 1.55; vertical-align: top; border: 1px solid #E5E7EB; }
td.slot { background: #EFF6FF; color: #1D4ED8; font-weight: 700; text-align: center; vertical-align: middle; width: 92px; font-size: 18px; }
.mn { font-weight: 700; font-size: 17px; } .it { font-size: 14px; color: #6B7280; margin-top: 6px; line-height: 1.5; } .mk { font-size: 13px; color: #2563EB; margin-top: 6px; font-weight: 700; }
td.air { background: #FFF7ED; color: #9A3412; font-size: 14px; } td.air b { display: block; font-size: 16px; margin-bottom: 4px; }
td.tot { text-align: center; background: #ECFDF5; font-size: 15px; line-height: 1.7; } td.tot .k { font-size: 24px; font-weight: 800; color: #1F2937; } td.tot .c { color: #059669; font-weight: 800; }
td.carb { text-align: center; font-weight: 800; color: #059669; background: #ECFDF5; font-size: 20px; }
.row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 24px; }
.box { background: #fff; border-radius: 16px; padding: 22px 24px; border: 1px solid #E5E7EB; }
.box h3 { font-size: 22px; margin-bottom: 12px; }
.box li { font-size: 17px; line-height: 1.8; list-style: none; }
.tips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
.tip h4 { font-size: 19px; color: #2563EB; margin-bottom: 8px; } .tip p { font-size: 16px; line-height: 1.7; color: #374151; }
.shop { margin-top: 16px; } .shop div { font-size: 16px; line-height: 1.8; margin-top: 6px; } .shop b { color: #2563EB; margin-right: 8px; }
.foot { text-align: center; color: #9CA3AF; font-size: 15px; margin-top: 24px; }
</style></head><body>
<div class="hero">
  <div><h1>🥑 一周健康生酮食谱 · 定量版</h1><p>按 ${KETO_PROFILE.weightKg}kg 成年男性减脂设计 · 克数为可食部分生重 · 每天一道空气炸锅菜</p><p>日均 ${KETO_WEEK_AVG.kcal} kcal · 蛋白 ${KETO_WEEK_AVG.p}g · 脂肪 ${KETO_WEEK_AVG.f}g · 净碳 ${KETO_WEEK_AVG.c}g</p></div>
  <div class="macro">
    <div class="bar">${KETO_MACROS.map(m => `<div style="width:${m.pct}%;background:${m.color}">${m.pct >= 15 ? `${esc(m.label)} ${m.pct}%` : `${m.pct}%`}</div>`).join('')}</div>
    <div class="legend">一周平均供能比：${KETO_MACROS.map(m => `${esc(m.label)} ${m.pct}%`).join(' · ')}</div>
  </div>
</div>
<div class="targets">${KETO_TARGETS.map(t => `<div class="t"><div class="l">${esc(t.label)}</div><div class="v">${esc(t.value)}</div><div class="n">${esc(t.note)}</div></div>`).join('')}</div>
<table>
  <tr><th style="background:transparent;width:100px"></th>${KETO_WEEK.map(d => `<th>${esc(d.day)}<small>${esc(d.theme)}</small></th>`).join('')}</tr>
  ${MEAL_SLOTS.map(s => `<tr><td class="slot">${s.icon}<br>${esc(s.label)}</td>${KETO_WEEK.map(d => mealCell(d[s.key])).join('')}</tr>`).join('')}
  <tr><td class="slot">🔥<br>空气<br>炸锅</td>${KETO_WEEK.map(d => `<td class="air"><b>${esc(d.air.slot)} · ${esc(d.air.dish)}</b>${esc(d.air.how)}</td>`).join('')}</tr>
  <tr><td class="slot">全天<br>合计</td>${KETO_WEEK.map(d => `<td class="tot"><div class="k">${d.total.kcal}<small style="font-size:14px;font-weight:400"> kcal</small></div>蛋白 ${d.total.p}g · 脂肪 ${d.total.f}g<br><span class="c">净碳 ${d.total.c}g</span><br><small style="color:#6B7280">脂/蛋/碳 ${d.pct.f}/${d.pct.p}/${d.pct.c}%</small></td>`).join('')}</tr>
</table>
<div class="row3">${KETO_EAT.map(g => `<div class="box" style="border-top:6px solid ${g.color}"><h3 style="color:${g.color}">${esc(g.title)}</h3><ul>${g.items.map(i => `<li>· ${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>
<div class="tips">${KETO_TIPS.map(t => `<div class="box tip"><h4>${esc(t.title)}</h4><p>${esc(t.text)}</p></div>`).join('')}</div>
<div class="box shop"><h3>🛒 一周采购清单（按食谱克数汇总，可食部分）</h3>${KETO_SHOPPING.map(s => `<div><b>${esc(s.group)}</b>${esc(s.items)}</div>`).join('')}</div>
<div class="foot">人生 OS · 一周食谱 ｜ 营养按常见食物成分表计算，调味料未计；非医疗建议；有慢病或在服药请先咨询医生</div>
</body></html>`

const { chromium } = loadPlaywright()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1.5 })
await page.setContent(html, { waitUntil: 'load' })
mkdirSync(path.dirname(out), { recursive: true })
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(`✅ 已生成 ${path.relative(root, out)}`)
