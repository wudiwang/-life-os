// 食物小图：public/recipe/<key>.jpg；没登记图片的食物显示首字占位。首页建议和食谱页共用。
import { COLORS } from '../../lib/constants'
import { imageName } from './mealImages'
import { HAS_IMG } from './recipeCredits'

export function FoodImg({ k, size }) {
  const box = { width: size, height: size, borderRadius: 8, flexShrink: 0 }
  if (!HAS_IMG.has(k)) {
    return <div style={{ ...box, background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2.6, color: COLORS.textLight }}>{imageName(k).slice(0, 1) || '🍽'}</div>
  }
  return <img src={`/recipe/${k}.jpg`} alt={imageName(k)} width={size} height={size} loading="lazy" style={{ ...box, objectFit: 'cover', background: COLORS.bg }} />
}
