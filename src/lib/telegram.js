// Telegram Mini App 适配。
// 从 TG 的「打开人生 OS」按钮进来时：自动展开全屏、配色对齐、底部让开安全区。
// 普通浏览器里 initData 为空，下面所有函数静默跳过，不影响网页端正常使用。

const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

// SDK 脚本在普通浏览器也会注入 window.Telegram，所以必须用 initData 判断是不是真在 TG 里
export const inTelegram = Boolean(wa?.initData)

function applySafeArea() {
  // Bot API 8.0+ 才有 safeAreaInset；老客户端取不到就当 0，交给 CSS env() 兜底
  const bottom = wa?.safeAreaInset?.bottom ?? 0
  document.documentElement.style.setProperty('--tg-safe-bottom', `${bottom}px`)
}

export function initTelegram() {
  if (!wa) return false
  try {
    wa.ready()      // 告诉 TG 页面已就绪，收起 loading
    wa.expand()     // 默认只占半屏，必须手动展开
    // 顶栏/背景跟 App 配色一致，否则 TG 默认白条和深色顶栏割裂
    wa.setHeaderColor?.('#111827')
    wa.setBackgroundColor?.('#F3F4F6')
    // 7.7+：禁用下滑关闭。页面可滚动时极易误触把小程序滑没
    wa.disableVerticalSwipes?.()
    applySafeArea()
    wa.onEvent?.('viewportChanged', applySafeArea)
    wa.onEvent?.('safeAreaChanged', applySafeArea)
  } catch (e) {
    // 任何一个 API 在老客户端缺失都不该白屏
    console.warn('Telegram WebApp 初始化异常（已忽略，不影响使用）', e)
  }
  return true
}
