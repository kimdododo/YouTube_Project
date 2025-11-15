/**
 * 검색 기록 관리 유틸리티
 * localStorage를 사용하여 사용자별 검색 기록을 저장하고 조회합니다.
 */

const SEARCH_HISTORY_KEY_PREFIX = 'searchHistory_'
const MAX_HISTORY_SIZE = 20 // 최대 20개의 검색 기록 저장

/**
 * 현재 사용자 ID 가져오기
 * @returns {string|null} 사용자 ID 또는 null
 */
const getUserId = () => {
  try {
    // localStorage에서 사용자 정보 확인
    const userName = localStorage.getItem('userName')
    const userEmail = localStorage.getItem('userEmail')
    
    // 사용자 ID가 있으면 반환, 없으면 'guest' 사용
    return userName || userEmail || 'guest'
  } catch (error) {
    console.error('[searchHistory] Failed to get user ID:', error)
    return 'guest'
  }
}

/**
 * 검색 기록 키 생성
 * @param {string} userId - 사용자 ID
 * @returns {string} 검색 기록 키
 */
const getSearchHistoryKey = (userId = null) => {
  const uid = userId || getUserId()
  return `${SEARCH_HISTORY_KEY_PREFIX}${uid}`
}

/**
 * 검색 기록에 검색어 추가
 * @param {string} query - 검색어
 */
export const addToSearchHistory = (query) => {
  try {
    if (!query || !query.trim()) {
      return
    }

    const trimmedQuery = query.trim()
    const userId = getUserId()
    const historyKey = getSearchHistoryKey(userId)
    
    // 기존 검색 기록 가져오기
    const existingHistory = getSearchHistory(userId)
    
    // 중복 제거: 같은 검색어가 이미 있으면 제거
    const filteredHistory = existingHistory.filter(item => item.query !== trimmedQuery)
    
    // 새로운 검색 기록 항목 생성
    const historyItem = {
      query: trimmedQuery,
      searchedAt: new Date().toISOString() // 검색 시간
    }
    
    // 최신 항목을 맨 앞에 추가
    const newHistory = [historyItem, ...filteredHistory]
    
    // 최대 개수 제한
    const limitedHistory = newHistory.slice(0, MAX_HISTORY_SIZE)
    
    // localStorage에 저장
    localStorage.setItem(historyKey, JSON.stringify(limitedHistory))
    
    console.log('[searchHistory] Added to search history:', {
      query: trimmedQuery,
      userId,
      totalHistory: limitedHistory.length
    })
  } catch (error) {
    console.error('[searchHistory] Failed to add to search history:', error)
  }
}

/**
 * 검색 기록 조회
 * @param {string} userId - 사용자 ID (선택사항)
 * @param {number} limit - 반환할 최대 개수 (기본값: 전체)
 * @returns {Array} 검색 기록 배열
 */
export const getSearchHistory = (userId = null, limit = null) => {
  try {
    const uid = userId || getUserId()
    const historyKey = getSearchHistoryKey(uid)
    const historyJson = localStorage.getItem(historyKey)
    
    if (!historyJson) {
      return []
    }
    
    const history = JSON.parse(historyJson)
    
    // 최신순으로 정렬 (searchedAt 기준)
    const sortedHistory = history.sort((a, b) => {
      const dateA = new Date(a.searchedAt || 0)
      const dateB = new Date(b.searchedAt || 0)
      return dateB - dateA
    })
    
    // limit이 지정된 경우 제한
    if (limit && limit > 0) {
      return sortedHistory.slice(0, limit)
    }
    
    return sortedHistory
  } catch (error) {
    console.error('[searchHistory] Failed to get search history:', error)
    return []
  }
}

/**
 * 검색 기록에서 특정 검색어 제거
 * @param {string} query - 제거할 검색어
 */
export const removeFromSearchHistory = (query) => {
  try {
    const userId = getUserId()
    const historyKey = getSearchHistoryKey(userId)
    const history = getSearchHistory(userId)
    const filteredHistory = history.filter(item => item.query !== query)
    localStorage.setItem(historyKey, JSON.stringify(filteredHistory))
    console.log('[searchHistory] Removed from search history:', query)
  } catch (error) {
    console.error('[searchHistory] Failed to remove from search history:', error)
  }
}

/**
 * 검색 기록 전체 삭제
 */
export const clearSearchHistory = () => {
  try {
    const userId = getUserId()
    const historyKey = getSearchHistoryKey(userId)
    localStorage.removeItem(historyKey)
    console.log('[searchHistory] Cleared search history')
  } catch (error) {
    console.error('[searchHistory] Failed to clear search history:', error)
  }
}

