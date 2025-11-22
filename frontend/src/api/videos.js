/**
 * 비디오 관련 API 호출 함수
 * 실제 API 엔드포인트와 연동
 */
import { optimizeThumbnailUrl } from '../utils/imageUtils'

// NEW: 개인화 추천 API 클라이언트 함수
/**
 * SimCSE 임베딩 기반 개인화 추천 영상 조회
 * @param {number} userId - 사용자 ID
 * @returns {Promise<Object>} 개인화 추천 결과
 */
export const fetchPersonalizedRecommendations = async (userId) => {
  try {
    console.log('[videos.js] Fetching personalized recommendations for user:', userId)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    
    // JWT 토큰이 있으면 헤더에 포함
    const token = localStorage.getItem('access_token') || localStorage.getItem('token')
    const headers = {
      'Content-Type': 'application/json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(`${API_BASE_URL}/recommendations/personalized?user_id=${userId}`, {
      signal: controller.signal,
      headers: headers
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      console.error('[videos.js] Personalized recommendations API error:', response.status, errorData)
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch personalized recommendations`)
    }
    
    const result = await response.json()
    console.log('[videos.js] Received personalized recommendations:', result.count || 0)
    
    // 백엔드 응답 형식을 프론트엔드 형식으로 변환
    if (result.success && result.items) {
      return result.items.map(item => ({
        id: item.video_id,
        video_id: item.video_id,
        thumbnail_url: item.thumbnail_url,
        title: item.title,
        channel_title: item.channel_title,
        channel_id: item.channel_id || null,
        similarity_score: item.similarity_score,
        reason: item.reason,
        // 기존 형식과 호환성을 위한 필드
        description: item.description || '',
        // view_count를 보존하고 views도 포맷팅하여 제공
        view_count: item.view_count || item.views || 0,
        views: formatViews(item.view_count || item.views || 0),
        like_count: item.like_count || item.likes || 0,
        likes: formatViews(item.like_count || item.likes || 0),
        rating: item.rating || 5,
        showRating: item.rating != null,
        type: 'personalized',
        youtube_url: createYouTubeUrl(item.video_id),
        is_shorts: item.is_shorts || false,
        // 추가 필드 보존
        keyword: item.keyword,
        region: item.region,
        category: item.keyword || item.region || '기타'
      }))
    }
    
    return []
  } catch (error) {
    console.error('[videos.js] Error fetching personalized recommendations:', error)
    throw error
  }
}

// Vite 환경 변수 우선 사용, 없으면 '/api' 프록시 사용
// FIX: 404 에러 방지를 위해 base URL이 /api로 끝나지 않으면 자동 추가
let API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'
// base URL이 /api로 끝나지 않으면 /api를 추가
if (!API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`
}

/**
 * YouTube 비디오 ID 유효성 검사
 * @param {string} videoId - YouTube 비디오 ID
 * @returns {boolean} 유효한 비디오 ID인지 여부
 */
const isValidYouTubeVideoId = (videoId) => {
  if (!videoId || typeof videoId !== 'string') return false
  // YouTube 비디오 ID는 일반적으로 11자리 문자열 (10-12자리 허용)
  if (videoId.length < 10 || videoId.length > 12) return false
  // YouTube 비디오 ID는 영숫자와 -, _ 만 포함 (하지만 실제로는 대부분 영숫자만 사용)
  // 특수문자가 너무 많으면 유효하지 않을 가능성이 높음
  const specialCharCount = (videoId.match(/[-_]/g) || []).length
  if (specialCharCount > 2) return false // 특수문자가 2개 이상이면 의심스러움
  return true
}

/**
 * YouTube 비디오 ID 유효성 검사 및 URL 생성
 * @param {string} videoId - YouTube 비디오 ID
 * @returns {string|null} 유효한 YouTube URL 또는 null
 */
const createYouTubeUrl = (videoId) => {
  if (!isValidYouTubeVideoId(videoId)) {
    console.warn('[videos.js] Invalid YouTube video ID:', videoId)
    return null
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

/**
 * Fetch a single video with AI analysis payload.
 * @param {string} videoId
 * @returns {Promise<{video: Object, analysis: Object | null}>}
 */
export const fetchVideoDetail = async (videoId) => {
  if (!videoId) {
    throw new Error('videoId is required')
  }

  // JWT 토큰이 있으면 헤더에 포함
  const token = localStorage.getItem('access_token') || localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/videos/${videoId}`, {
    headers
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(errorData.detail || 'Failed to fetch video detail')
  }

  const data = await response.json()
  const detail = data?.video ? data : { video: data, analysis: data?.analysis }
  return {
    video: detail.video || null,
    analysis: detail.analysis || null,
  }
}

/**
 * 가장 많은 좋아요를 받은 영상 목록 조회
 * @returns {Promise<Array>} 좋아요가 많은 영상 목록
 */
export const getMostLikedVideos = async (limit = 10) => {
  try {
    console.log('[videos.js] Fetching most liked videos from:', `${API_BASE_URL}/videos/most-liked?limit=${limit}`)
    
    // 타임아웃 추가 (60초 - 백엔드 응답 지연 대응)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    
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
        youtube_url: createYouTubeUrl(videoId),
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
        youtube_url: createYouTubeUrl(videoId),
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
        youtube_url: createYouTubeUrl(vidId),
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
    
    // 타임아웃 추가 (60초 - 백엔드 응답 지연 대응)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    
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
      const viewCount = video.view_count || video.views || 0
      // YouTube 비디오 ID 유효성 검사 (일반적으로 11자리 문자열)
      const isValidVideoId = videoId && typeof videoId === 'string' && videoId.length >= 10 && videoId.length <= 12
      return {
        id: videoId,
        video_id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts), // 고화질 썸네일로 최적화
        title: video.title,
        channel_title: video.channel_title,
        channel_id: video.channel_id,
        description: video.description,
        category: video.keyword || video.region || '기타',
        keyword: video.keyword,
        region: video.region,
        views: formatViews(viewCount),
        view_count: typeof viewCount === 'number' ? viewCount : (typeof viewCount === 'string' ? parseInt(viewCount.replace(/[^0-9]/g, '')) || 0 : 0), // view_count 보존
        like_count: video.like_count || video.likes || 0, // like_count 보존
        rating: video.rating || 5, // 기본값
        showRating: true,
        type: determineVideoType(video), // 'simple' or 'featured'
        youtube_url: createYouTubeUrl(videoId), // YouTube URL 생성 (유효성 검사 포함)
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
 * @param {number} limit - 반환할 비디오 수 (기본값: 100)
 * @param {number} skip - 페이지네이션 오프셋 (기본값: 0)
 * @returns {Promise<Array>} 트렌드 영상 목록
 */
export const getTrendVideos = async (limit = 100, skip = 0) => {
  try {
    const url = `${API_BASE_URL}/videos/trends?limit=${limit}&skip=${skip}`
    console.log('[videos.js] Fetching trend videos from:', url)
    
    // 타임아웃 추가 (60초 - 백엔드 응답 지연 대응)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    
    const response = await fetch(url, {
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
      const publishedAt =
        video.published_at ||
        video.publishedAt ||
        video.created_at ||
        video.createdAt ||
        null
      const viewCount =
        video.view_count ??
        video.viewCount ??
        video.views ??
        video.statistics?.viewCount ??
        0
      const likeCount =
        video.like_count ??
        video.likeCount ??
        video.statistics?.likeCount ??
        0
      return {
        id: videoId,
        video_id: video.video_id || videoId,
        channel_id: video.channel_id || video.channelId || null,
        channel_name: video.channel_name || video.channelName || video.channel_title || video.channel || null,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts), // 고화질 썸네일로 최적화
        title: video.title,
        description: video.description,
        keyword: video.keyword,
        region: video.region,
        category: video.category || video.keyword || video.region || null,
        view_count: viewCount,
        like_count: likeCount,
        published_at: publishedAt, // period 필터링을 위해 추가
        rating: video.rating || 5, // 기본값
        showRating: true,
        youtube_url: createYouTubeUrl(videoId), // YouTube URL 생성
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
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60초로 증가
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch diversified videos`)
    }
    const result = await response.json()
    const videos = result.videos || result
    // 디버깅: 첫 번째 비디오의 조회수 확인
    if (videos.length > 0) {
      console.log('[videos.js] getDiversifiedVideos - Sample video from API:', {
        id: videos[0].id || videos[0].video_id,
        view_count: videos[0].view_count,
        views: videos[0].views,
        title: videos[0].title
      })
    }
    return videos.map(video => {
      const videoId = video.id || video.video_id
      const isShorts = video.is_shorts || false
      const viewCount = video.view_count || video.views || 0
      return {
        id: videoId,
        video_id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts),
        title: video.title,
        channel_title: video.channel_title,
        channel_id: video.channel_id,
        description: video.description,
        category: video.keyword || video.region || '기타',
        keyword: video.keyword,
        region: video.region,
        views: formatViews(viewCount),
        view_count: typeof viewCount === 'number' ? viewCount : (typeof viewCount === 'string' ? parseInt(viewCount.replace(/[^0-9]/g, '')) || 0 : 0), // view_count 보존
        like_count: video.like_count || video.likes || 0, // like_count 보존
        rating: video.rating || 5,
        showRating: true,
        youtube_url: createYouTubeUrl(videoId),
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
      const viewCount = video.view_count || video.views || 0
      return {
        id: videoId,
        video_id: videoId,
        thumbnail_url: optimizeThumbnailUrl(video.thumbnail_url, videoId, isShorts), // 고화질 썸네일로 최적화
        title: video.title,
        channel_title: video.channel_title,
        channel_id: video.channel_id,
        description: video.description,
        channel: video.keyword || video.region || '기타',
        category: video.keyword || video.region || '기타',
        keyword: video.keyword,
        region: video.region,
        views: formatViews(viewCount),
        view_count: typeof viewCount === 'number' ? viewCount : (typeof viewCount === 'string' ? parseInt(viewCount.replace(/[^0-9]/g, '')) || 0 : 0), // view_count 보존
        like_count: video.like_count || video.likes || 0, // like_count 보존
        rating: 5, // 기본값 (실제 평점 데이터가 있다면 사용)
        showRating: true,
        youtube_url: createYouTubeUrl(videoId), // YouTube URL 생성
        is_shorts: isShorts // Shorts 여부 전달
      }
    })
  } catch (error) {
    console.error('[videos.js] Error fetching all videos:', error?.message || error)
    throw error
  }
}

/**
 * 영상의 키워드 분석 결과 조회
 * 영상의 텍스트(title/description)를 기반으로 임베딩을 생성하고,
 * keyword_pool과 코사인 유사도로 상위 Top-K 키워드를 계산하여 반환
 * 
 * @param {string} videoId - YouTube 비디오 ID
 * @param {number} topK - 반환할 상위 키워드 개수 (기본값: 7, 최대: 20)
 * @returns {Promise<Array<{keyword: string, score: number}>>} 키워드 리스트
 * @example
 * const keywords = await fetchVideoKeywords('dQw4w9WgXcQ', 7)
 * // Returns: [{ keyword: "힐링", score: 0.91 }, { keyword: "바다", score: 0.87 }, ...]
 */
export const fetchVideoKeywords = async (videoId, topK = 7) => {
  try {
    if (!videoId || typeof videoId !== 'string') {
      throw new Error('Invalid video ID')
    }
    
    console.log(`[videos.js] Fetching keywords for video: ${videoId}`)
    
    // 타임아웃 추가 (60초 - 임베딩 계산에 시간이 걸릴 수 있음)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    
    const response = await fetch(
      `${API_BASE_URL}/videos/${encodeURIComponent(videoId)}/keywords?top_k=${topK}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
    }
    
    const keywords = await response.json()
    console.log(`[videos.js] Fetched ${keywords.length} keywords for video ${videoId}`)
    
    return keywords
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[videos.js] Request timeout while fetching keywords')
      throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
    }
    console.error('[videos.js] Error fetching video keywords:', error?.message || error)
    throw error
  }
}

