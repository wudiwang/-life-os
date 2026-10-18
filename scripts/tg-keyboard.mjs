// Pure builder: importing this module never reads credentials or starts the bot.
export function buildQuickKeyboard(webURL) {
  let base
  try {
    base = new URL(webURL)
  } catch {
    throw new TypeError('Telegram Web App URL must be a valid HTTPS URL')
  }
  if (base.protocol !== 'https:') {
    throw new TypeError('Telegram Web App URL must be a valid HTTPS URL')
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`
  base.hash = ''

  const page = key => {
    const url = new URL(base)
    url.searchParams.set('page', key)
    return { url: url.href }
  }

  return {
    keyboard: [
      [{ text: '🏠 看板', web_app: page('dashboard') }, { text: '📔 随笔', web_app: page('journal') }],
      [{ text: '❤️ 健康', web_app: page('health') }, { text: '🧠 第二大脑', web_app: page('knowledge') }],
      [{ text: '🇹🇭 泰语学习', web_app: page('thai') }, { text: '打卡' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  }
}
