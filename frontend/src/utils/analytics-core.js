/**
 * Analytics core functions (순수 함수만 포함)
 * 순환 의존성 방지를 위해 useLocation을 사용하는 hook은 제외
 */

const hasGtag = () => typeof window !== 'undefined' && typeof window.gtag === 'function'

export const trackEvent = (eventName, params = {}) => {
  if (!hasGtag()) {
    if (import.meta.env?.DEV) {
      console.debug('[analytics] gtag not ready, skipped event:', eventName, params)
    }
    return
  }
  window.gtag('event', eventName, params)
}

export const trackPageView = (pageTitle, pagePath) => {
  if (!hasGtag()) return
  window.gtag('event', 'page_view', {
    page_title: pageTitle || document.title,
    page_path: pagePath || window.location.pathname
  })
}

