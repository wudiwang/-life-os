// 首页「今天吃了」的卡片数据：按记录文字自动配图（说「CP」配 CP 图、说「青花鱼」配青花鱼图），
// 每餐按时间编成「第一顿 / 第二顿」，配一行简短文字。纯计算，测试见 mealImages.test.mjs。
// 图片在 public/recipe/<key>.jpg，来源登记在 recipeCredits.js。
import { RECIPE_FOODS } from './shapeRecipe.js'

// 不在食谱食材表里、只用来配图的食物
const EXTRA_NAMES = { friedChicken: '炸鸡', coffee: '黑咖啡', salad: '蔬菜沙拉' }
export const imageName = k => RECIPE_FOODS[k]?.name || EXTRA_NAMES[k] || ''

// 关键词 → 图片 key。按在文字里出现的先后排序，一餐最多取 3 张
const RULES = [
  ['cp', /CP|ซีพี/i],
  ['friedChicken', /肯德基|KFC|原味鸡|炸鸡|鸡块|麦乐鸡/i],
  ['coffee', /咖啡|美式|coffee/i],
  ['salad', /沙拉/],
  ['eggWhite', /蛋清/],
  ['egg', /鸡蛋|水煮蛋|煎蛋|茶叶蛋|炒蛋|荷包蛋/],
  ['avocado', /牛油果/],
  ['mackerel', /青花鱼|鲭鱼|ซาบะ|saba/i],
  ['salmon', /三文鱼/],
  ['seabass', /鲈鱼|罗非鱼|烤鱼|蒸鱼/],
  ['shrimp', /虾/],
  ['beefLean', /牛排|牛肉|西冷|菲力/],
  ['chickenBreast', /鸡胸/],
  ['tofu', /豆腐/],
  ['greekYogurt', /酸奶/],
  ['almond', /坚果|巴旦木|杏仁|夏威夷果/],
  ['pumpkinSeed', /南瓜子/],
  ['walnut', /核桃/],
  ['broccoli', /西兰花/],
  ['cauliflower', /花菜|菜花/],
  ['choySum', /菜心|青菜|绿叶菜|上海青|芥兰|小白菜/],
  ['mushroom', /蘑菇/],
  ['lettuce', /生菜/],
  ['cucumber', /黄瓜/],
  ['tomato', /番茄|西红柿/],
  ['cabbage', /包菜|卷心菜|圆白菜/],
  ['zucchini', /西葫芦/],
  ['asparagus', /芦笋/],
  ['greenPepper', /青椒|彩椒/],
]

export function imagesFor(items, max = 3) {
  const text = String(items || '')
  const hits = RULES.map(([key, re]) => ({ key, at: text.search(re) })).filter(h => h.at >= 0)
  let keys = hits.sort((a, b) => a.at - b.at).map(h => h.key)
  if (keys.includes('cp')) keys = keys.filter(k => k !== 'chickenBreast') // 「CP 打抛嫩鸡胸」只配 CP 图
  return keys.slice(0, max)
}

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const timeFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
export const bangkokTime = iso => (iso ? timeFmt.format(new Date(iso)) : '')

// 每餐一张卡：按记录时间排序，正餐编号「第一顿…」，加餐叫「加餐」；文字去掉括号里的备注
export function mealCards(foodRows) {
  let n = 0
  return [...foodRows]
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(r => ({
      id: r.id,
      title: r.meal === 'snack' ? '加餐' : `第${CN[n++] || n}顿`,
      time: bangkokTime(r.created_at),
      imgs: imagesFor(r.items),
      kcal: Number(r.kcal) || 0,
      p: Number(r.protein_g) || 0,
      text: String(r.items || '').replace(/（[^）]*）|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
    }))
}
