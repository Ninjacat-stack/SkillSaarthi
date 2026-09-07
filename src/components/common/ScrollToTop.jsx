import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function scrollToTopSmooth() {
  const container = document.querySelector('[data-scroll-container]')
  const isScrollable = container && container.scrollHeight > container.clientHeight
  if (isScrollable) container.scrollTo({ top: 0, behavior: 'smooth' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
