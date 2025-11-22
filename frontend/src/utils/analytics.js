/**
 * Analytics module with hooks
 * 순환 의존성 방지를 위해 core 함수는 별도 파일에서 import
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackEvent, trackPageView } from './analytics-core'

// Re-export core functions for backward compatibility
export { trackEvent, trackPageView }

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

