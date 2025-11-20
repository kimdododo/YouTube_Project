import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

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

export const usePageTracking = (pageTitle) => {
  const location = useLocation()

  useEffect(() => {
    const startTime = Date.now()
    trackPageView(pageTitle, location.pathname + location.search)

    return () => {
      const duration = Date.now() - startTime
      trackEvent('page_engagement', {
        page_title: pageTitle || document.title,
        page_path: location.pathname + location.search,
        engagement_time_msec: duration
      })
    }
  }, [location.pathname, location.search, pageTitle])
}

