import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken } from '../api/auth'

const BookmarkContext = createContext()

export const useBookmark = () => {
  const context = useContext(BookmarkContext)
  if (!context) {
    throw new Error('useBookmark must be used within a BookmarkProvider')
  }
  return context
}

export const BookmarkProvider = ({ children }) => {
  const [bookmarks, setBookmarks] = useState([])

  // localStorage에서 북마크 로드
  useEffect(() => {
    const loadBookmarks = () => {
      try {
        const savedBookmarks = localStorage.getItem('bookmarks')
        if (savedBookmarks) {
          const parsed = JSON.parse(savedBookmarks)
          setBookmarks(Array.isArray(parsed) ? parsed : [])
        }
      } catch (error) {
        console.error('[BookmarkContext] Failed to load bookmarks:', error)
        setBookmarks([])
      }
    }
    loadBookmarks()
  }, [])

  // 북마크 저장
  useEffect(() => {
    try {
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks))
    } catch (error) {
      console.error('[BookmarkContext] Failed to save bookmarks:', error)
    }
  }, [bookmarks])

  // 북마크 확인
  const isBookmarked = useCallback((videoId) => {
    if (!videoId) return false
    return bookmarks.some(
      (bookmark) => (bookmark.id || bookmark.video_id) === videoId
    )
  }, [bookmarks])

  // 로그인 상태 확인
  const checkLogin = useCallback(() => {
    const token = getToken()
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true' || 
                      localStorage.getItem('isLoggedIn') === 'true'
    return !!(token || isLoggedIn)
  }, [])

  // 북마크 토글
  const toggleBookmark = useCallback((video) => {
    if (!video) return

    const videoId = video.id || video.video_id
    if (!videoId) {
      console.warn('[BookmarkContext] Cannot bookmark: video ID is missing')
      return
    }

    // 로그인 체크
    const isLoggedIn = checkLogin()
    if (!isLoggedIn) {
      alert('북마크 기능을 사용하려면 로그인이 필요합니다.')
      // 로그인 페이지로 리다이렉트
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return
    }

    setBookmarks((prev) => {
      const exists = prev.some(
        (item) => (item.id || item.video_id) === videoId
      )

      if (exists) {
        // 북마크 제거
        const updated = prev.filter(
          (item) => (item.id || item.video_id) !== videoId
        )
        console.log('[BookmarkContext] Bookmark removed:', videoId)
        return updated
      } else {
        // 북마크 추가
        const newBookmark = {
          id: videoId,
          video_id: videoId,
          title: video.title || '',
          description: video.description || '',
          thumbnail_url: video.thumbnail_url || video.thumbnail || '',
          youtube_url: video.youtube_url || `https://www.youtube.com/watch?v=${videoId}`,
          views: video.views || video.view_count || '',
          channel: video.channel || video.channel_name || '',
          category: video.category || '',
          rating: video.rating || null,
          is_shorts: video.is_shorts || false
        }
        console.log('[BookmarkContext] Bookmark added:', videoId)
        return [...prev, newBookmark]
      }
    })
  }, [checkLogin])

  // 북마크 추가
  const addBookmark = useCallback((video) => {
    if (!video) return
    const videoId = video.id || video.video_id
    if (!videoId) return

    // 로그인 체크
    const isLoggedIn = checkLogin()
    if (!isLoggedIn) {
      alert('북마크 기능을 사용하려면 로그인이 필요합니다.')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return
    }

    setBookmarks((prev) => {
      const exists = prev.some(
        (item) => (item.id || item.video_id) === videoId
      )
      if (exists) return prev

      const newBookmark = {
        id: videoId,
        video_id: videoId,
        title: video.title || '',
        description: video.description || '',
        thumbnail_url: video.thumbnail_url || video.thumbnail || '',
        youtube_url: video.youtube_url || `https://www.youtube.com/watch?v=${videoId}`,
        views: video.views || video.view_count || '',
        channel: video.channel || video.channel_name || '',
        category: video.category || '',
        rating: video.rating || null,
        is_shorts: video.is_shorts || false
      }
      return [...prev, newBookmark]
    })
  }, [checkLogin])

  // 북마크 제거
  const removeBookmark = useCallback((videoId) => {
    if (!videoId) return

    setBookmarks((prev) => {
      return prev.filter(
        (item) => (item.id || item.video_id) !== videoId
      )
    })
  }, [])

  const value = {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    addBookmark,
    removeBookmark,
    setBookmarks // MyPage에서 직접 사용할 수 있도록
  }

  return (
    <BookmarkContext.Provider value={value}>
      {children}
    </BookmarkContext.Provider>
  )
}

