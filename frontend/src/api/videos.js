/**
 * 비디오 관련 API 호출 함수
 * 실제 API 엔드포인트와 연동
 */
import { optimizeThumbnailUrl } from '../utils/imageUtils'

// Vite 환경 변수 우선 사용, 없으면 '/api' 프록시 사용
const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'

/**
 * 가장 많은 좋아요를 받은 영상 목록 조회
 * @returns {Promise<Array>} 좋아요가 많은 영상 목록
 */
export const getMostLikedVideos = async (limit = 10) => {
  try {
    console.log('[videos.js] Fetching most liked videos from:', `${API_BASE_URL}/videos/most-liked?limit=${limit}`)
    
    // 타임아웃 추가 (10초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`${API_BASE_URL}/videos/most-liked?limit=${limit}`, {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      console.error('[videos.js] Most liked videos API error:', response.status, errorData)
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch most liked videos`)
    }
    const result = await response.json()
    console.log('[videos.js] Received most liked videos:', result.videos?.length || 0)

    // 백엔드 응답 형식: { videos: [...], total: number }
    const videos = result.videos || result

    // 데이터 형식 변환 및 썸네일 최적화
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      
      // 썸네일 URL 최적화 (고화질)
      let optimizedThumbnail = null
      if (videoId) {
        // videoId가 있으면 항상 고화질 URL 생성
        optimizedThumbnail = optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts)
      } else if (video.thumbnail_url) {
        // videoId가 없어도 thumbnail_url이 있으면 사용
        optimizedThumbnail = video.thumbnail_url
      }
      
      return {
        id: videoId,
        thumbnail_url: optimizedThumbnail,
        title: video.title,
        description: video.description,
        category: video.keyword || video.region || '기타',
        views: formatViews(video.view_count || video.views),
        likes: formatViews(video.like_count || 0),
        rating: video.rating || 5,
        showRating: true,
        type: 'featured', // 좋아요가 많은 영상은 featured로 표시
        youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        is_shorts: isShorts
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching most liked videos:', error?.message || error)
    if (error.name === 'AbortError') {
      console.error('[videos.js] Request timeout for most liked videos')
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
    }
    throw error
  }
}

/**
 * 개인 맞춤 영상 추천 (콘텐츠 기반)
 * @param {Object} preferences - 사용자 선호도 정보
 * @param {Array<string>} preferences.preferred_tags - 선호 태그 목록
 * @param {Array<string>} preferences.preferred_keywords - 선호 키워드 목록
 * @param {Array<string>} preferences.preferred_regions - 선호 지역 목록
 * @param {Array<number>} preferences.travel_preferences - 여행 취향 ID 목록
 * @param {Array<string>} preferences.viewed_video_ids - 시청한 영상 ID 목록
 * @param {Array<string>} preferences.bookmarked_video_ids - 북마크한 영상 ID 목록
 * @param {number} limit - 추천할 영상 수
 * @returns {Promise<Array>} 추천 영상 목록
 */
export const getPersonalizedRecommendations = async (preferences = {}, limit = 20) => {
  try {
    // localStorage에서 사용자 선호도 가져오기
    const travelPreferences = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]')
    
    // 북마크에서 비디오 ID 추출
    const bookmarkedVideoIds = bookmarks.map(bookmark => bookmark.id || bookmark.video_id).filter(Boolean)
    
    // 요청 데이터 구성
    const requestData = {
      travel_preferences: preferences.travel_preferences || travelPreferences,
      preferred_tags: preferences.preferred_tags || [],
      preferred_keywords: preferences.preferred_keywords || [],
      preferred_regions: preferences.preferred_regions || [],
      viewed_video_ids: preferences.viewed_video_ids || [],
      bookmarked_video_ids: preferences.bookmarked_video_ids || bookmarkedVideoIds
    }
    
    const response = await fetch(`${API_BASE_URL}/videos/personalized?limit=${limit}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch personalized recommendations`)
    }
    
    const result = await response.json()
    
    // 백엔드 응답 형식: { videos: [...], total: number, message: string }
    const videos = result.videos || []
    
    // 데이터 형식 변환
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      return {
        id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts),
        title: video.title,
        description: video.description,
        category: video.keyword || video.region || '기타',
        views: formatViews(video.view_count || video.views),
        rating: video.rating || 5,
        showRating: true,
        type: determineVideoType(video),
        youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        is_shorts: isShorts
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching personalized recommendations:', error?.message || error)
    throw error
  }
}

/**
 * 특정 영상과 유사한 영상 추천
 * @param {string} videoId - 기준 영상 ID
 * @param {number} limit - 추천할 영상 수
 * @returns {Promise<Array>} 유사 영상 목록
 */
export const getSimilarVideos = async (videoId, limit = 10) => {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/similar?limit=${limit}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch similar videos`)
    }
    
    const result = await response.json()
    const videos = result.videos || result
    
    return videos.map(video => {
      const vidId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      return {
        id: vidId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, vidId, isShorts),
        title: video.title,
        description: video.description,
        category: video.keyword || video.region || '기타',
        views: formatViews(video.view_count || video.views),
        rating: video.rating || 5,
        showRating: true,
        youtube_url: vidId ? `https://www.youtube.com/watch?v=${vidId}` : null,
        is_shorts: isShorts
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching similar videos:', error?.message || error)
    throw error
  }
}

// 개발용 더미 데이터 (API 장애/프록시 미설정 시 사용)
const DUMMY_RECOMMENDED = [
  { id: 1, thumbnail_url: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=400', title: '파리 에펠탑 | 센 강의 낭만', description: '※로맨틱 파리 야경', category: '유럽이야기', views: '5.6만회', rating: 4.9, showRating: true, type: 'simple' },
  { id: 2, thumbnail_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400', title: '도쿄 골목 | 등불이 밝히는 밤거리', description: '※일본 골목 감성', category: '도시여행사', views: '3.9만회', rating: 5, showRating: true, type: 'simple' },
  { id: 3, thumbnail_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400', title: '산토리니 블루돔 | 에게해의 보석', description: '※그리스 섬들의 아름다움', category: '그리스탐험', views: '4.3만회', rating: 5, showRating: true, type: 'simple' },
  { id: 4, thumbnail_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400', title: '상하이 스카이라인 | 푸둥 야경', description: '※현대 도시의 상징', category: '차이나여행', views: '8.7만회', rating: 5, showRating: true, type: 'simple' },
  { id: 5, thumbnail_url: 'https://images.unsplash.com/photo-1556912173-0e022a7e3b40?w=400', title: '발리 우붓 자연 스파', description: '※힐링이 필요할 때', category: '동남아여행자', views: '5.6만회', rating: 5, showRating: true, type: 'featured' },
  { id: 6, thumbnail_url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0f?w=400', title: '아이슬란드 오로라', description: '※북극 빛의 춤', category: '북유럽여행', views: '7.2만회', rating: 5, showRating: true, type: 'featured' },
  { id: 7, thumbnail_url: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=400', title: '프로방스 숨은 마을', description: '#보석 같은 프랑스', category: '유럽이야기', views: '2.1만회', rating: 5, showRating: true, type: 'featured' },
  { id: 8, thumbnail_url: 'https://images.unsplash.com/photo-1556912173-0e022a7e3b40?w=400', title: '다낭 로컬 탐방', description: '#완벽 가이드', category: '베트남여행', views: '6.8만회', rating: 5, showRating: true, type: 'featured' }
]

const DUMMY_TRENDS = [
  { id: 101, thumbnail_url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0f?w=400', title: '아이슬란드 오로라', rating: 5, showRating: true },
  { id: 102, thumbnail_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400', title: '뉴욕 일몰', rating: 5, showRating: true },
  { id: 103, thumbnail_url: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=400', title: '프랑스 다리', rating: 4.9, showRating: true },
  { id: 104, thumbnail_url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0f?w=400', title: '베네치아 운하', rating: 5, showRating: true },
  { id: 105, thumbnail_url: 'https://images.unsplash.com/photo-1556912173-0e022a7e3b40?w=400', title: '발리 논밭', rating: 4.9, showRating: true },
  { id: 106, thumbnail_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400', title: '도쿄 야경', rating: 5, showRating: true }
]

/**
 * 개인 맞춤 영상 추천 목록 조회 (ML 재랭킹 지원)
 * @param {string} query - 재랭킹용 검색 쿼리 (선택사항)
 * @param {boolean} useRerank - ML 기반 재랭킹 사용 여부
 * @param {number} limit - 반환할 비디오 수
 * @returns {Promise<Array>} 추천 영상 목록
 */
export const getRecommendedVideos = async (query = null, useRerank = false, limit = 10) => {
  try {
    // 쿼리 파라미터 구성
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit)
    if (query && useRerank) {
      params.append('query', query)
      params.append('use_rerank', 'true')
    }
    
    const url = `${API_BASE_URL}/videos/recommended${params.toString() ? '?' + params.toString() : ''}`
    console.log('[videos.js] Fetching recommended videos from:', url)
    
    // 타임아웃 추가 (10초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      console.error('[videos.js] Recommended videos API error:', response.status, errorData)
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch recommended videos`)
    }
    const result = await response.json()
    console.log('[videos.js] Received recommended videos:', result.videos?.length || 0)
    
    // 백엔드 응답 형식: { videos: [...], total: number }
    const videos = result.videos || result
    
    // 데이터 형식 변환 (백엔드 데이터 구조에 맞게 조정 필요)
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      return {
        id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts), // 고화질 썸네일로 최적화
        title: video.title,
        description: video.description,
        category: video.keyword || video.region || '기타',
        views: formatViews(video.view_count || video.views),
        rating: video.rating || 5, // 기본값
        showRating: true,
        type: determineVideoType(video), // 'simple' or 'featured'
        youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null, // YouTube URL 생성
        is_shorts: isShorts // Shorts 여부 전달
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching recommended videos:', error?.message || error)
    if (error.name === 'AbortError') {
      console.error('[videos.js] Request timeout for recommended videos')
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
    }
    // 더미 데이터로 폴백하지 않고 에러를 다시 throw
    throw error
  }
}

/**
 * 여행 트렌드 영상 목록 조회
 * @returns {Promise<Array>} 트렌드 영상 목록
 */
export const getTrendVideos = async () => {
  try {
    console.log('[videos.js] Fetching trend videos from:', `${API_BASE_URL}/videos/trends`)
    
    // 타임아웃 추가 (10초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`${API_BASE_URL}/videos/trends`, {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      console.error('[videos.js] Trend videos API error:', response.status, errorData)
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch trend videos`)
    }
    const result = await response.json()
    console.log('[videos.js] Received trend videos:', result.videos?.length || 0)
    
    // 백엔드 응답 형식: { videos: [...], total: number }
    const videos = result.videos || result
    
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      return {
        id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts), // 고화질 썸네일로 최적화
        title: video.title,
        rating: video.rating || 5, // 기본값
        showRating: true,
        youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null, // YouTube URL 생성
        is_shorts: isShorts // Shorts 여부 전달
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching trend videos:', error?.message || error)
    if (error.name === 'AbortError') {
      console.error('[videos.js] Request timeout for trend videos')
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
    }
    // 더미 데이터로 폴백하지 않고 에러를 다시 throw
    throw error
  }
}

/**
 * 채널 다양화된 영상 목록 조회 (백엔드 diversified 엔드포인트)
 * @param {number} total 총 개수
 * @param {number} maxPerChannel 채널당 최대 개수
 */
export const getDiversifiedVideos = async (total = 20, maxPerChannel = 1) => {
  try {
    const url = `${API_BASE_URL}/videos/diversified?total=${total}&max_per_channel=${maxPerChannel}`
    console.log('[videos.js] Fetching diversified videos from:', url)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch diversified videos`)
    }
    const result = await response.json()
    const videos = result.videos || result
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      return {
        id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts),
        title: video.title,
        description: video.description,
        category: video.keyword || video.region || '기타',
        views: formatViews(video.view_count || video.views),
        rating: video.rating || 5,
        showRating: true,
        youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        is_shorts: isShorts
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching diversified videos:', error?.message || error)
    if (error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
    }
    throw error
  }
}

/**
 * 조회수 포맷팅
 * @param {number} count - 조회수
 * @returns {string} 포맷된 조회수 (예: "5.6만회")
 */
const formatViews = (count) => {
  if (!count) return '0회'
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}만회`
  }
  return `${count.toLocaleString()}회`
}

/**
 * 비디오 타입 결정 (simple 또는 featured)
 * 실제 로직은 백엔드 응답에 따라 조정
 */
const determineVideoType = (video) => {
  // 예: 상세 정보가 있으면 featured, 없으면 simple
  if (video.description && video.category) {
    return 'featured'
  }
  return 'simple'
}

/**
 * 전체 비디오 목록 조회 (채널 찾기용)
 * @param {number} skip - 페이지네이션 오프셋
 * @param {number} limit - 반환할 비디오 수
 * @returns {Promise<Array>} 비디오 목록
 */
export const getAllVideos = async (skip = 0, limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/?skip=${skip}&limit=${limit}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch videos`)
    }
    const result = await response.json()

    // 백엔드 응답 형식: { videos: [...], total: number }
    const videos = result.videos || result

    // 데이터 형식 변환
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      return {
        id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts), // 고화질 썸네일로 최적화
        title: video.title,
        description: video.description,
        channel: video.keyword || video.region || '기타',
        channel_id: video.channel_id,
        views: formatViews(video.view_count || video.views),
        rating: 5, // 기본값 (실제 평점 데이터가 있다면 사용)
        showRating: true,
        youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null, // YouTube URL 생성
        is_shorts: isShorts // Shorts 여부 전달
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching all videos:', error?.message || error)
    throw error
  }
}

