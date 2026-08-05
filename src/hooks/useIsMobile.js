import { useState, useEffect } from 'react'

const QUERY = '(max-width: 768px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const sync = () => setIsMobile(window.matchMedia(QUERY).matches)
    // matchMedia change 为主，window resize 兜底（部分内嵌/模拟环境不派发前者）
    mql.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      mql.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return isMobile
}
