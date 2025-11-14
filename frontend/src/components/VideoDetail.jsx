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
  const [commentAnalysis, setCommentAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

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
      fetchCommentSentiment()
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

  const fetchCommentSentiment = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/videos/${videoId}/comments/sentiment?limit=50`)
      if (response.ok) {
        const data = await response.json()
        setCommentAnalysis(data)
      } else {
        // API 실패 시 기본값 설정 (에러 로그 없이 조용히 처리)
        console.log('[VideoDetail] Comment sentiment API not available, using fallback')
        setCommentAnalysis(null)
      }
    } catch (err) {
      // 네트워크 에러 등은 조용히 처리
      console.log('[VideoDetail] Comment sentiment API unavailable:', err.message)
      setCommentAnalysis(null)
    }
  }

  // 댓글 분석 결과 가져오기 (백엔드 API에서 받은 데이터 또는 기본값)
  const getCommentAnalysis = () => {
    // 실제 API 데이터가 있으면 사용
    if (commentAnalysis && (commentAnalysis.positive > 0 || commentAnalysis.negative > 0)) {
      return commentAnalysis
    }
    
    // 댓글이 있지만 분석 데이터가 없는 경우 (로딩 중)
    if (comments.length > 0) {
      return {
        positive: 0,
        negative: 0,
        positivePoints: [],
        negativePoints: [],
        summary: ['댓글을 분석하는 중입니다...'],
        totalComments: comments.length,
        analyzedComments: 0
      }
    }
    
    // 댓글이 없는 경우
    return {
      positive: 0,
      negative: 0,
      positivePoints: [],
      negativePoints: [],
      summary: ['댓글이 없어 분석할 수 없습니다.'],
      totalComments: 0,
      analyzedComments: 0
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

  const cardWidth = 320
  const gap = 24
  const cardStep = cardWidth + gap
  // 한 번에 보이는 카드 수 (반응형)
  const getVisibleCards = () => {
    if (typeof window === 'undefined') return 3
    const width = window.innerWidth
    if (width >= 1280) return 4 // xl: 4개
    if (width >= 1024) return 3 // lg: 3개
    if (width >= 768) return 2  // md: 2개
    return 1 // sm: 1개
  }
  const [visibleCards, setVisibleCards] = useState(3)

  useEffect(() => {
    const updateVisibleCards = () => {
      setVisibleCards(getVisibleCards())
    }
    updateVisibleCards()
    window.addEventListener('resize', updateVisibleCards)
    return () => window.removeEventListener('resize', updateVisibleCards)
  }, [])

  const slideNext = () => {
    if (isTransitioning || similarVideos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      const nextIndex = prev + visibleCards
      // 무한루프: 마지막 카드 다음은 첫 번째로
      return nextIndex >= similarVideos.length ? 0 : nextIndex
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

  const slidePrev = () => {
    if (isTransitioning || similarVideos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      const prevIndex = prev - visibleCards
      // 무한루프: 첫 번째 카드 이전은 마지막으로
      return prevIndex < 0 ? Math.max(0, similarVideos.length - visibleCards) : prevIndex
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

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

  const analysisResult = getCommentAnalysis()
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
                <div className="text-white font-medium">
                  {(video.keyword || video.region || '여행러버').replace(/^channel:\s*/i, '')}
                </div>
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
        {comments.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">댓글 분석</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 왼쪽: 긍정/부정 바와 키워드 */}
              <div className="lg:col-span-2 space-y-4">
                {/* 긍정 댓글 바 */}
                <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
                  <button className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold text-lg py-4 px-6 rounded-lg transition-all duration-200 text-left">
                    긍정 댓글 {analysisResult.positive || 0}%
                  </button>
                  {/* 긍정 키워드 목록 */}
                  {analysisResult.positivePoints && analysisResult.positivePoints.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {analysisResult.positivePoints.map((point, idx) => (
                        <div key={idx} className="text-white text-sm">
                          {point}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 부정 댓글 바 */}
                <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-red-900/30">
                  <button className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-lg py-4 px-6 rounded-lg transition-all duration-200 text-left">
                    부정 댓글 {analysisResult.negative || 0}%
                  </button>
                  {/* 부정 키워드 목록 */}
                  {analysisResult.negativePoints && analysisResult.negativePoints.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {analysisResult.negativePoints.map((point, idx) => (
                        <div key={idx} className="text-white text-sm">
                          {point}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: 댓글 3줄 요약 */}
              <div className="lg:col-span-1">
                <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30 h-full">
                  <h3 className="text-white font-bold text-lg mb-4">댓글 3줄 요약</h3>
                  <div className="space-y-3">
                    {analysisResult.summary && analysisResult.summary.length > 0 ? (
                      analysisResult.summary.map((item, idx) => (
                        <p key={idx} className="text-white/90 text-sm leading-relaxed">
                          {item}
                        </p>
                      ))
                    ) : (
                      <p className="text-white/60 text-sm">요약 정보가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 추천 영상 섹션 - 무한루프 슬라이더 */}
        {similarVideos.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">이런 영상은 어떠세요?</h2>
            <div className="relative overflow-hidden">
              {/* 왼쪽 화살표 */}
              <button
                onClick={slidePrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-3 text-white transition-all shadow-lg"
                disabled={isTransitioning}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* 비디오 카드 컨테이너 */}
              <div className="relative overflow-hidden px-12" style={{ height: '280px' }}>
                <div
                  className="flex gap-6 absolute top-0"
                  style={{
                    left: '50%',
                    transform: `translateX(calc(-50% - ${currentIndex * cardStep}px))`,
                    transition: isTransitioning ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                    willChange: 'transform'
                  }}
                >
                  {/* 무한루프를 위한 카드 복제: 앞쪽, 중간, 뒤쪽 */}
                  {[...similarVideos, ...similarVideos, ...similarVideos].map((v, index) => {
                    const actualIndex = index % similarVideos.length
                    // 현재 보이는 범위의 카드들 활성화
                    const isInVisibleRange = actualIndex >= currentIndex && 
                      actualIndex < currentIndex + visibleCards &&
                      index >= similarVideos.length && 
                      index < similarVideos.length * 2
                    
                    return (
                      <div 
                        key={`${v.id || v.video_id}-${index}`}
                        className="flex-shrink-0 transition-all duration-300 hover:z-10"
                        style={{ width: `${cardWidth}px` }}
                      >
                        <VideoCard video={v} featured hideBookmark active={isInVisibleRange} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 오른쪽 화살표 */}
              <button
                onClick={slideNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-3 text-white transition-all shadow-lg"
                disabled={isTransitioning}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default VideoDetail

