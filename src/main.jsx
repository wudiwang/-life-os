import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTelegram } from './lib/telegram'

// 必须在 render 前跑：expand() 晚了会先闪一下半屏
initTelegram()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
