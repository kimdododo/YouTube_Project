/**
 * 검색 기록 API
 * 백엔드 API를 사용하여 검색 기록을 저장하고 조회합니다.
 * 로그인하지 않은 경우 localStorage를 사용합니다.
 */
import { getToken } from './auth'

const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'
const LOCAL_STORAGE_KEY = 'searchHistory_local'
const MAX_LOCAL_HISTORY = 20

/**
 * 검색 기록 저장 (localStorage 폴백)
 * @param {string} query - 검색어
 */
const saveToLocalStorage = (query) => {
  try {
    const historyJson = localStorage.getItem(LOCAL_STORAGE_KEY)
    const history = historyJson ? JSON.parse(historyJson) : []
    
    // 중복 제거
    const filtered = history.filter(item => item.query !== query)
    
    // 새 항목 추가
    const newItem = {
      query: query.trim(),
      searched_at: new Date().toISOString()
    }
    
    const updated = [newItem, ...filtered].slice(0, MAX_LOCAL_HISTORY)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('[searchHistory] Failed to save to localStorage:', error)
  }
}

/**
 * 검색 기록 저장
 * @param {string} query - 검색어
 */
export const saveSearchHistory = async (query) => {
  try {
    if (!query || !query.trim()) {
      return
    }

    const token = getToken()
    
    // 로그인한 경우 백엔드 API 사용
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/search-history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ query: query.trim() })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('[searchHistory] Saved to backend:', query)
          return result
        } else if (response.status === 401) {
          console.warn('[searchHistory] Unauthorized, falling back to localStorage')
          saveToLocalStorage(query)
          return
        } else {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }))
          throw new Error(errorData.detail || '검색 기록 저장에 실패했습니다.')
        }
      } catch (error) {
        console.warn('[searchHistory] Backend save failed, using localStorage:', error)
        saveToLocalStorage(query)
      }
    } else {
      // 로그인하지 않은 경우 localStorage 사용
      saveToLocalStorage(query)
    }
  } catch (error) {
    console.error('[searchHistory] Failed to save search history:', error)
    // 에러가 발생해도 검색은 계속 진행되도록 함
  }
}

/**
 * 검색 기록 조회 (localStorage 폴백)
 * @param {number} limit - 반환할 최대 개수
 * @returns {Array} 검색 기록 배열
 */
const getFromLocalStorage = (limit) => {
  try {
    const historyJson = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!historyJson) {
      return []
    }
    
    const history = JSON.parse(historyJson)
    // 최신순 정렬
    const sorted = history.sort((a, b) => {
      const dateA = new Date(a.searched_at || 0)
      const dateB = new Date(b.searched_at || 0)
      return dateB - dateA
    })
    
    return sorted.slice(0, limit)
  } catch (error) {
    console.error('[searchHistory] Failed to get from localStorage:', error)
    return []
  }
}

/**
 * 검색 기록 조회
 * @param {number} limit - 반환할 최대 개수 (기본값: 20)
 * @returns {Promise<Array>} 검색 기록 배열
 */
export const getSearchHistory = async (limit = 20) => {
  try {
    const token = getToken()
    
    // 로그인한 경우 백엔드 API 사용
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/search-history?limit=${limit}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const result = await response.json()
          return result.history || []
        } else if (response.status === 401) {
          console.warn('[searchHistory] Unauthorized, falling back to localStorage')
          return getFromLocalStorage(limit)
        } else {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }))
          throw new Error(errorData.detail || '검색 기록 조회에 실패했습니다.')
        }
      } catch (error) {
        console.warn('[searchHistory] Backend fetch failed, using localStorage:', error)
        return getFromLocalStorage(limit)
      }
    } else {
      // 로그인하지 않은 경우 localStorage 사용
      return getFromLocalStorage(limit)
    }
  } catch (error) {
    console.error('[searchHistory] Failed to get search history:', error)
    return getFromLocalStorage(limit)
  }
}

/**
 * 검색 기록에서 특정 검색어 제거 (localStorage 폴백)
 * @param {string} query - 제거할 검색어
 */
const deleteFromLocalStorage = (query) => {
  try {
    const historyJson = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!historyJson) {
      return
    }
    
    const history = JSON.parse(historyJson)
    const filtered = history.filter(item => item.query !== query)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('[searchHistory] Failed to delete from localStorage:', error)
  }
}

/**
 * 검색 기록에서 특정 검색어 제거
 * @param {string} query - 제거할 검색어
 */
export const deleteSearchHistory = async (query) => {
  try {
    if (!query || !query.trim()) {
      return
    }

    const token = getToken()
    
    // 로그인한 경우 백엔드 API 사용
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/search-history?query=${encodeURIComponent(query.trim())}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const result = await response.json()
          console.log('[searchHistory] Deleted from backend:', query)
          return result
        } else if (response.status === 401) {
          console.warn('[searchHistory] Unauthorized, falling back to localStorage')
          deleteFromLocalStorage(query)
          return
        } else if (response.status === 404) {
          console.log('[searchHistory] Search history not found:', query)
          return
        } else {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }))
          throw new Error(errorData.detail || '검색 기록 삭제에 실패했습니다.')
        }
      } catch (error) {
        console.warn('[searchHistory] Backend delete failed, using localStorage:', error)
        deleteFromLocalStorage(query)
      }
    } else {
      // 로그인하지 않은 경우 localStorage 사용
      deleteFromLocalStorage(query)
    }
  } catch (error) {
    console.error('[searchHistory] Failed to delete search history:', error)
  }
}

/**
 * 검색 기록 전체 삭제
 */
export const clearAllSearchHistory = async () => {
  try {
    const token = getToken()
    if (!token) {
      console.warn('[searchHistory] No token, skipping clear')
      return
    }

    const response = await fetch(`${API_BASE_URL}/auth/search-history/all`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('[searchHistory] Unauthorized, token may be expired')
        return
      }
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || '검색 기록 삭제에 실패했습니다.')
    }

    const result = await response.json()
    console.log('[searchHistory] Cleared all search history')
    return result
  } catch (error) {
    console.error('[searchHistory] Failed to clear search history:', error)
  }
}

