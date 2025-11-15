/**
 * 시청 기록 관리 유틸리티
 * localStorage를 사용하여 사용자의 시청 기록을 저장하고 조회합니다.
 */

const WATCH_HISTORY_KEY = 'watchHistory'
const MAX_HISTORY_SIZE = 100 // 최대 100개의 시청 기록 저장

/**
 * 시청 기록 조회 (내부 함수)
 * @param {number} limit - 반환할 최대 개수 (기본값: 전체)
 * @returns {Array} 시청 기록 배열
 */
const getWatchHistoryInternal = (limit = null) => {
  try {
    const historyJson = localStorage.getItem(WATCH_HISTORY_KEY)
    if (!historyJson) {
      return []
    }
    
    const history = JSON.parse(historyJson)
    
    // 최신순으로 정렬 (watchedAt 기준)
    const sortedHistory = history.sort((a, b) => {
      const dateA = new Date(a.watchedAt || 0)
      const dateB = new Date(b.watchedAt || 0)
      return dateB - dateA
    })
    
    // limit이 지정된 경우 제한
    if (limit && limit > 0) {
      return sortedHistory.slice(0, limit)
    }
    
    return sortedHistory
  } catch (error) {
    console.error('[watchHistory] Failed to get watch history:', error)
    return []
  }
}

/**
 * 시청 기록에 영상 추가
 * @param {Object} video - 영상 정보 객체
 */
export const addToWatchHistory = (video) => {
  try {
    if (!video || !video.id) {
      console.warn('[watchHistory] Invalid video data:', video)
      return
    }

    const videoId = video.id || video.video_id
    if (!videoId) {
      console.warn('[watchHistory] Video ID not found:', video)
      return
    }

    // 기존 시청 기록 가져오기
    const existingHistory = getWatchHistoryInternal()
    
    // 중복 제거: 같은 영상이 이미 있으면 제거
    const filteredHistory = existingHistory.filter(item => item.id !== videoId)
    
    // 새로운 시청 기록 항목 생성
    const historyItem = {
      id: videoId,
      video_id: videoId,
      title: video.title || '',
      description: video.description || '',
      thumbnail_url: video.thumbnail_url || video.thumbnail || '',
      views: video.views || video.view_count || '0회',
      category: video.category || video.keyword || video.region || '기타',
      youtube_url: video.youtube_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null),
      watchedAt: new Date().toISOString(), // 시청 시간
      is_shorts: video.is_shorts || false
    }
    
    // 최신 항목을 맨 앞에 추가
    const newHistory = [historyItem, ...filteredHistory]
    
    // 최대 개수 제한
    const limitedHistory = newHistory.slice(0, MAX_HISTORY_SIZE)
    
    // localStorage에 저장
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(limitedHistory))
    
    console.log('[watchHistory] Added to watch history:', {
      videoId,
      title: historyItem.title,
      totalHistory: limitedHistory.length
    })
  } catch (error) {
    console.error('[watchHistory] Failed to add to watch history:', error)
  }
}

/**
 * 시청 기록 조회
 * @param {number} limit - 반환할 최대 개수 (기본값: 전체)
 * @returns {Array} 시청 기록 배열
 */
export const getWatchHistory = (limit = null) => {
  return getWatchHistoryInternal(limit)
}

/**
 * 시청 기록에서 특정 영상 제거
 * @param {string} videoId - 제거할 영상 ID
 */
export const removeFromWatchHistory = (videoId) => {
  try {
    const history = getWatchHistoryInternal()
    const filteredHistory = history.filter(item => item.id !== videoId)
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(filteredHistory))
    console.log('[watchHistory] Removed from watch history:', videoId)
  } catch (error) {
    console.error('[watchHistory] Failed to remove from watch history:', error)
  }
}

/**
 * 시청 기록 전체 삭제
 */
export const clearWatchHistory = () => {
  try {
    localStorage.removeItem(WATCH_HISTORY_KEY)
    console.log('[watchHistory] Cleared watch history')
  } catch (error) {
    console.error('[watchHistory] Failed to clear watch history:', error)
  }
}

/**
 * 시청 시간 포맷팅 (상대 시간)
 * @param {string} watchedAt - ISO 날짜 문자열
 * @returns {string} 포맷된 시간 문자열
 */
export const formatWatchTime = (watchedAt) => {
  if (!watchedAt) return '알 수 없음'
  
  try {
    const watchedDate = new Date(watchedAt)
    const now = new Date()
    const diffMs = now - watchedDate
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) {
      return '방금 전'
    } else if (diffMins < 60) {
      return `${diffMins}분 전`
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    } else {
      // 7일 이상이면 날짜로 표시
      return watchedDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
  } catch (error) {
    console.error('[watchHistory] Failed to format watch time:', error)
    return '알 수 없음'
  }
}

