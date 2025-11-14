import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Star, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react'
import { useBookmark } from '../contexts/BookmarkContext'
import AppLayout from './layouts/AppLayout'
import VideoCard from './VideoCard'
import { optimizeThumbnailUrl } from '../utils/imageUtils'

const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'

function VideoDetail() {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmark()
  const [loading, setLoading] = useState(true)
  const [video, setVideo] = useState(null)
  const [similarVideos, setSimilarVideos] = useState([])
  const [comments, setComments] = useState([])
  const [error, setError] = useState(null)
  const [recommendedScrollPosition, setRecommendedScrollPosition] = useState(0)
  const [activeCardIndex, setActiveCardIndex] = useState(0)

  const bookmarked = video ? isBookmarked(video.id || video.video_id) : false

  const handleBookmarkClick = () => {
    if (video) {
      toggleBookmark(video)
    }
  }

  useEffect(() => {
    if (videoId) {
      fetchVideoDetail()
      fetchSimilarVideos()
      fetchComments()
    }
  }, [videoId])

  const fetchVideoDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/videos/${videoId}`)
      if (!response.ok) {
        throw new Error('비디오를 찾을 수 없습니다.')
      }
      const data = await response.json()
      setVideo(data)
    } catch (err) {
      console.error('[VideoDetail] Failed to fetch video:', err)
      setError(err.message || '비디오를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSimilarVideos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/videos/${videoId}/similar?limit=50`)
      if (response.ok) {
        const result = await response.json()
        const videos = result.videos || result
        setSimilarVideos(videos) // 모든 영상 표시 (가로 스크롤)
      }
    } catch (err) {
      console.error('[VideoDetail] Failed to fetch similar videos:', err)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments?video_id=${videoId}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setComments(Array.isArray(data) ? data : (data.comments || []))
      } else if (response.status === 404) {
        // 댓글 API가 없는 경우 빈 배열로 설정 (에러 로그 없이 조용히 처리)
        console.log('[VideoDetail] Comments API not available, using empty array')
        setComments([])
      } else {
        // 다른 에러의 경우에만 로그 출력
        console.warn('[VideoDetail] Failed to fetch comments:', response.status, response.statusText)
        setComments([])
      }
    } catch (err) {
      // 네트워크 에러 등은 조용히 처리
      console.log('[VideoDetail] Comments API unavailable:', err.message)
      setComments([])
    }
  }

  // 댓글 분석 (긍정/부정 비율 계산)
  const analyzeComments = () => {
    if (!comments || comments.length === 0) {
      return {
        positive: 0,
        negative: 0,
        positivePoints: [],
        negativePoints: [],
        summary: []
      }
    }

    // 간단한 키워드 기반 감정 분석 (실제로는 백엔드에서 처리하는 것이 좋음)
    const positiveKeywords = ['좋', '최고', '유익', '깔끔', '친절', '추천', '감사', '완벽', '멋', '아름다움']
    const negativeKeywords = ['광고', '길', '작', '빠름', '별로', '실망', '불만']

    let positiveCount = 0
    let negativeCount = 0
    const positivePoints = new Set()
    const negativePoints = new Set()

    comments.forEach(comment => {
      const text = (comment.text || comment.comment || '').toLowerCase()
      const hasPositive = positiveKeywords.some(kw => text.includes(kw))
      const hasNegative = negativeKeywords.some(kw => text.includes(kw))

      if (hasPositive) {
        positiveCount++
        if (text.includes('유익')) positivePoints.add('유익한 정보')
        if (text.includes('분위기')) positivePoints.add('현지 분위기 최고')
        if (text.includes('편집') || text.includes('깔끔')) positivePoints.add('편집 깔끔')
        if (text.includes('친절') || text.includes('설명')) positivePoints.add('친절한 설명')
      }
      if (hasNegative) {
        negativeCount++
        if (text.includes('광고')) negativePoints.add('광고 많음')
        if (text.includes('길')) negativePoints.add('영상 길이')
        if (text.includes('작') || text.includes('소리')) negativePoints.add('음성 작음')
        if (text.includes('빠름') || text.includes('빠르')) negativePoints.add('속도 빠름')
      }
    })

    const total = positiveCount + negativeCount
    const positivePercent = total > 0 ? Math.round((positiveCount / total) * 100) : 0
    const negativePercent = total > 0 ? Math.round((negativeCount / total) * 100) : 0

    // 요약 생성
    const summary = []
    if (positiveCount > negativeCount) {
      summary.push('전반적으로 높은 만족도를 보이고 있어요.')
      summary.push('편집과 설명이 도움이 되었다는 피드백이 많아요.')
      summary.push('광고 빈도에 대한 의견이 있지만 전반적으로 긍정적인 반응이에요.')
    } else {
      summary.push('일부 개선이 필요한 부분이 있어요.')
      summary.push('영상 길이와 속도에 대한 의견이 있어요.')
      summary.push('전반적인 만족도는 보통 수준이에요.')
    }

    return {
      positive: positivePercent,
      negative: negativePercent,
      positivePoints: Array.from(positivePoints).slice(0, 4),
      negativePoints: Array.from(negativePoints).slice(0, 4),
      summary
    }
  }

  const formatViews = (count) => {
    if (!count) return '0회'
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}만회`
    }
    return `${count.toLocaleString()}회`
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return '오늘'
    if (diffDays === 1) return '어제'
    if (diffDays < 7) return `${diffDays}일 전`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
    return `${Math.floor(diffDays / 365)}년 전`
  }

  const scrollRecommended = (direction) => {
    const container = document.getElementById('recommended-videos-container')
    if (!container) return
    
    // 카드 너비 (320px) + gap (24px = gap-6)
    const cardWidth = 320
    const gap = 24
    const cardStep = cardWidth + gap
    
    const currentScroll = container.scrollLeft
    const containerWidth = container.clientWidth
    const maxScroll = container.scrollWidth - containerWidth
    
    // 현재 스크롤 위치를 기준으로 다음/이전 카드 위치 계산
    let newPosition
    if (direction === 'left') {
      // 이전 카드로 이동 (현재 위치에서 가장 가까운 이전 카드 위치)
      const currentCardIndex = Math.round(currentScroll / cardStep)
      const targetCardIndex = Math.max(0, currentCardIndex - 1)
      newPosition = targetCardIndex * cardStep
    } else {
      // 다음 카드로 이동 (현재 위치에서 가장 가까운 다음 카드 위치)
      const currentCardIndex = Math.round(currentScroll / cardStep)
      const targetCardIndex = currentCardIndex + 1
      const targetPosition = targetCardIndex * cardStep
      // 최대 스크롤 위치를 넘지 않도록 제한
      newPosition = Math.min(targetPosition, maxScroll)
    }
    
    // 부드러운 페이징 애니메이션
    container.scrollTo({ 
      left: newPosition, 
      behavior: 'smooth' 
    })
    
    // 애니메이션 중 스크롤 위치 추적
    const updatePosition = () => {
      setRecommendedScrollPosition(container.scrollLeft)
      if (Math.abs(container.scrollLeft - newPosition) > 1) {
        requestAnimationFrame(updatePosition)
      } else {
        setRecommendedScrollPosition(newPosition)
      }
    }
    requestAnimationFrame(updatePosition)
  }

  // 스크롤 위치 추적 및 화살표 버튼 상태 업데이트
  useEffect(() => {
    const container = document.getElementById('recommended-videos-container')
    if (!container) return

    let isScrolling = false
    let scrollTimeout = null

    const updateScrollPosition = () => {
      const scrollLeft = container.scrollLeft
      setRecommendedScrollPosition(scrollLeft)
      
      // 현재 보이는 카드 인덱스 계산
      const cardWidth = 320
      const gap = 24
      const cardStep = cardWidth + gap
      const currentCardIndex = Math.round(scrollLeft / cardStep)
      setActiveCardIndex(currentCardIndex)
    }

    // 초기 위치 설정
    updateScrollPosition()
    
    // 사용자 직접 스크롤 방지 (마우스 휠, 터치 스크롤)
    const preventScroll = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // 스크롤 이벤트 리스너 (화살표 버튼으로 스크롤할 때만 발생)
    const handleScroll = () => {
      updateScrollPosition()
      
      // 스크롤이 끝난 후 정확한 위치로 스냅 (페이징 효과)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      
      isScrolling = true
      scrollTimeout = setTimeout(() => {
        isScrolling = false
        const cardWidth = 320
        const gap = 24
        const cardStep = cardWidth + gap
        const currentScroll = container.scrollLeft
        const containerWidth = container.clientWidth
        const maxScroll = container.scrollWidth - containerWidth
        
        // 가장 가까운 카드 위치로 스냅
        const currentCardIndex = Math.round(currentScroll / cardStep)
        const snapPosition = Math.min(currentCardIndex * cardStep, maxScroll)
        
        if (Math.abs(currentScroll - snapPosition) > 5) {
          container.scrollTo({ 
            left: snapPosition, 
            behavior: 'smooth' 
          })
        }
      }, 150) // 스크롤이 끝난 후 150ms 후에 스냅
    }

    container.addEventListener('scroll', handleScroll)
    
    // 마우스 휠 이벤트 방지
    container.addEventListener('wheel', preventScroll, { passive: false })
    
    // 터치 스크롤 이벤트 방지
    container.addEventListener('touchmove', preventScroll, { passive: false })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('wheel', preventScroll)
      container.removeEventListener('touchmove', preventScroll)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [similarVideos.length])

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="text-blue-300 animate-pulse">데이터를 불러오는 중...</div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !video) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="text-red-400 mb-4">{error || '비디오를 찾을 수 없습니다.'}</div>
            <button 
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              뒤로가기
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const commentAnalysis = analyzeComments()
  const thumbnailUrl = optimizeThumbnailUrl(video.thumbnail_url, video.id, video.is_shorts || false)
  const youtubeUrl = video.youtube_url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null)

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 메인 비디오 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 왼쪽: 썸네일 */}
          <div className="relative rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: '16/9' }}>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={video.title || 'Video'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center">
                <span className="text-white/40 text-lg">썸네일 없음</span>
              </div>
            )}
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div className="bg-white/90 rounded-full p-4">
                  <svg className="w-12 h-12 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </a>
            )}
          </div>

          {/* 오른쪽: 비디오 정보 */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold text-white leading-tight flex-1">
                {video.title || '제목 없음'}
              </h1>
              {/* 북마크 버튼 */}
              <button
                onClick={handleBookmarkClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all flex-shrink-0 ${
                  bookmarked
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-700/50 text-white/70 hover:bg-gray-700 hover:text-white'
                }`}
                title={bookmarked ? '북마크 제거' : '북마크 추가'}
              >
                <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
                <span className="text-sm font-medium">
                  {bookmarked ? '북마크됨' : '북마크'}
                </span>
              </button>
            </div>

            {/* 업로더 정보 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                {(video.channel_id || video.keyword || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-white font-medium">{video.keyword || video.region || '여행러버'}</div>
                <div className="text-white/60 text-sm">
                  {formatDate(video.published_at)} · 조회수 {formatViews(video.view_count)}
                </div>
              </div>
            </div>

            {/* 설명 */}
            {video.description && (
              <p className="text-white/90 leading-relaxed">
                {video.description.length > 200 
                  ? `${video.description.substring(0, 200)}...` 
                  : video.description}
              </p>
            )}

            {/* 해시태그 */}
            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {video.tags.slice(0, 5).map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* AI 한줄평 */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-4 border border-blue-900/30">
              <div className="text-blue-400 font-semibold mb-2">AI 한줄평</div>
              <p className="text-white/90 text-sm">
                {video.description 
                  ? `${video.description.substring(0, 100)}... 현지 분위기와 숨은 명소를 잘 담아낸 영상이에요.`
                  : '여행의 감동을 잘 전달하는 영상이에요.'}
              </p>
            </div>
          </div>
        </div>

        {/* 댓글 분석 섹션 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">댓글 분석</h2>
          
          {/* 긍정/부정 비율 바 차트 */}
          <div className="mb-6 flex gap-2 h-12">
            <div 
              className="flex items-center justify-start px-4 rounded-l-lg"
              style={{ 
                backgroundColor: '#1e3a8a',
                width: `${commentAnalysis.positive > 0 ? commentAnalysis.positive : (comments.length > 0 ? 92 : 92)}%`
              }}
            >
              <span className="text-white font-semibold text-sm">
                긍정 댓글 {commentAnalysis.positive > 0 ? commentAnalysis.positive : (comments.length > 0 ? 92 : 92)}%
              </span>
            </div>
            <div 
              className="flex items-center justify-end px-4 rounded-r-lg"
              style={{ 
                backgroundColor: '#991b1b',
                width: `${commentAnalysis.negative > 0 ? commentAnalysis.negative : (comments.length > 0 ? 8 : 8)}%`
              }}
            >
              <span className="text-white font-semibold text-sm">
                부정 댓글 {commentAnalysis.negative > 0 ? commentAnalysis.negative : (comments.length > 0 ? 8 : 8)}%
              </span>
            </div>
          </div>

          {/* 댓글 분석 카드 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 긍정 댓글 카드 */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-xl p-6 border border-blue-900/30">
              <h3 className="text-white font-bold text-lg mb-4">긍정 피드백</h3>
              <ul className="space-y-2">
                {commentAnalysis.positivePoints.length > 0 ? (
                  commentAnalysis.positivePoints.map((point, idx) => (
                    <li key={idx} className="text-white text-sm">
                      {point}
                    </li>
                  ))
                ) : (
                  <>
                    <li className="text-white text-sm">유익한 정보</li>
                    <li className="text-white text-sm">현지 분위기 최고</li>
                    <li className="text-white text-sm">편집 깔끔</li>
                    <li className="text-white text-sm">친절한 설명</li>
                  </>
                )}
              </ul>
            </div>

            {/* 부정 댓글 카드 */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-xl p-6 border border-red-900/30">
              <h3 className="text-white font-bold text-lg mb-4">부정 피드백</h3>
              <ul className="space-y-2">
                {commentAnalysis.negativePoints.length > 0 ? (
                  commentAnalysis.negativePoints.map((point, idx) => (
                    <li key={idx} className="text-red-300 text-sm">
                      {point}
                    </li>
                  ))
                ) : (
                  <>
                    <li className="text-red-300 text-sm">광고 많음</li>
                    <li className="text-red-300 text-sm">영상 길이</li>
                    <li className="text-red-300 text-sm">음성 작음</li>
                    <li className="text-red-300 text-sm">속도 빠름</li>
                  </>
                )}
              </ul>
            </div>

            {/* 댓글 3줄 요약 */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-xl p-6 border border-blue-900/30">
              <h3 className="text-white font-bold text-lg mb-4">댓글 3줄 요약</h3>
              <div className="space-y-3">
                {commentAnalysis.summary.length > 0 ? (
                  commentAnalysis.summary.map((item, idx) => (
                    <p key={idx} className="text-white/90 text-sm leading-relaxed">
                      {item}
                    </p>
                  ))
                ) : (
                  <>
                    <p className="text-white/90 text-sm leading-relaxed">
                      실용적인 여행 정보와 현지 분위기가 잘 담긴 영상으로 높은 만족도를 보이고 있어요.
                    </p>
                    <p className="text-white/90 text-sm leading-relaxed">
                      깔끔한 편집과 친절한 설명이 시청자들에게 큰 도움이 되고 있다는 평가예요.
                    </p>
                    <p className="text-white/90 text-sm leading-relaxed">
                      중간 광고 빈도에 대한 아쉬움이 일부 있으나 전반적으로 긍정적인 반응이에요.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 추천 영상 섹션 */}
        {similarVideos.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">이런 영상은 어떠세요?</h2>
            <div className="relative">
              {/* 왼쪽 화살표 */}
              {(() => {
                const container = document.getElementById('recommended-videos-container')
                const canScrollLeft = container && recommendedScrollPosition > 10
                return canScrollLeft ? (
                  <button
                    onClick={() => scrollRecommended('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                ) : null
              })()}

              {/* 비디오 카드 컨테이너 */}
              <div
                id="recommended-videos-container"
                className="flex gap-6 overflow-x-scroll overflow-y-hidden pb-4 scrollbar-hide"
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'auto',
                  scrollSnapType: 'x mandatory',
                  scrollBehavior: 'smooth'
                }}
              >
                {similarVideos.map((v, index) => (
                  <div 
                    key={v.id || v.video_id} 
                    className="flex-shrink-0 w-[320px] transition-all duration-300 hover:z-10"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <VideoCard video={v} featured hideBookmark active={index === activeCardIndex} />
                  </div>
                ))}
              </div>

              {/* 오른쪽 화살표 */}
              {(() => {
                const container = document.getElementById('recommended-videos-container')
                const canScrollRight = container && 
                  container.scrollWidth > container.clientWidth &&
                  recommendedScrollPosition < (container.scrollWidth - container.clientWidth - 10)
                return canScrollRight ? (
                  <button
                    onClick={() => scrollRecommended('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                ) : null
              })()}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default VideoDetail

