import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Star, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react'
import { useBookmark } from '../contexts/BookmarkContext'
import AppLayout from './layouts/AppLayout'
import { optimizeThumbnailUrl } from '../utils/imageUtils'
import { addToWatchHistory } from '../utils/watchHistory'
import { usePageTracking, trackEvent } from '../utils/analytics'
import { fetchVideoDetail as fetchVideoDetailApi } from '../api/videos'

const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'
const SIMILAR_LIMIT = 12
const SECONDARY_FETCH_DELAY = 250

function VideoDetail() {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmark()
  const [loading, setLoading] = useState(true)
  const [video, setVideo] = useState(null)
  const [similarVideos, setSimilarVideos] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSummaryError, setAiSummaryError] = useState('')
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  
  // timeout refs for cleanup
  const slideTimeoutRef = useRef(null)

  usePageTracking('VideoDetail')
  
  // 헬퍼 함수들을 useCallback으로 메모이제이션
  const getDescriptionPreview = useCallback((text) => {
    if (!text) return ''
    const hasNewLine = text.includes('\n')
    if (text.length > 200) {
      return `${text.substring(0, 200)}...`
    }
    if (hasNewLine) {
      const firstLine = text.split('\n')[0] || ''
      return firstLine.length < text.length ? `${firstLine}...` : firstLine
    }
    return text
  }, [])

  const bookmarked = video ? isBookmarked(video.id || video.video_id) : false

  const handleBookmarkClick = useCallback(() => {
    if (video) {
      toggleBookmark(video)
    }
  }, [video, toggleBookmark])

  // 조회수 포맷팅 헬퍼 함수
  const formatViews = useCallback((count) => {
    if (!count) return '0회'
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}만회`
    }
    return `${count.toLocaleString()}회`
  }, [])

  // fetch 함수들을 useCallback으로 메모이제이션
  const fetchVideoDetail = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const detail = await fetchVideoDetailApi(videoId)
      if (!detail.video) {
        throw new Error('비디오를 찾을 수 없습니다.')
      }
      setVideo(detail.video)
      setAnalysis(detail.analysis || null)
      
      // 시청 기록에 추가
      if (detail.video && detail.video.id) {
        addToWatchHistory({
          ...detail.video,
          views: detail.video.view_count ? formatViews(detail.video.view_count) : '0회',
          category: detail.video.keyword || detail.video.region || '기타'
        })
      }
    } catch (err) {
      console.error('[VideoDetail] Failed to fetch video:', err)
      setError(err.message || '비디오를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [videoId, formatViews])

  const fetchSimilarVideos = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/videos/${videoId}/similar?limit=${SIMILAR_LIMIT}`)
      if (response.ok) {
        const result = await response.json()
        const videos = result.videos || result
        setSimilarVideos(videos)
      }
    } catch (err) {
      console.error('[VideoDetail] Failed to fetch similar videos:', err)
    }
  }, [videoId])

  const fetchAiSummary = useCallback(async (targetVideoId) => {
    if (!targetVideoId) return
    setIsLoadingSummary(true)
    setAiSummaryError('')
    setAiSummary('')
    try {
      const response = await fetch(`${API_BASE_URL}/videos/${targetVideoId}/summary/one-line`)
      if (!response.ok) {
        throw new Error('AI 요약을 불러올 수 없습니다.')
      }
      const data = await response.json()
      setAiSummary(data.summary || '')
    } catch (err) {
      console.warn('[VideoDetail] Failed to fetch AI summary:', err)
      setAiSummaryError('AI 요약을 불러오지 못했습니다.')
    } finally {
      setIsLoadingSummary(false)
    }
  }, [])

  useEffect(() => {
    if (!videoId) return
    fetchVideoDetail()
    fetchSimilarVideos()
    setShowFullDescription(false)
  }, [videoId, fetchVideoDetail, fetchSimilarVideos])

  useEffect(() => {
    if (!videoId) return
    let idleId = null
    let usedIdleCallback = false

    const runSecondaryFetches = () => {
      fetchAiSummary(videoId)
    }

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        usedIdleCallback = true
        idleId = window.requestIdleCallback(runSecondaryFetches, { timeout: 1000 })
      } else {
        idleId = window.setTimeout(runSecondaryFetches, SECONDARY_FETCH_DELAY)
      }
    } else {
      runSecondaryFetches()
    }

    return () => {
      if (idleId === null) return
      if (usedIdleCallback && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      } else if (typeof window !== 'undefined') {
        window.clearTimeout(idleId)
      }
    }
  }, [videoId, fetchAiSummary])


  const formatDate = useCallback((dateString) => {
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
  }, [])

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

  const slideNext = useCallback(() => {
    if (isTransitioning || similarVideos.length === 0) return
    setIsTransitioning(true)
    trackEvent('similar_videos_carousel', {
      direction: 'next',
      video_id: video?.id || video?.video_id || videoId
    })
    setCurrentIndex((prev) => {
      const nextIndex = prev + visibleCards
      // 무한루프: 마지막 카드 다음은 첫 번째로
      return nextIndex >= similarVideos.length ? 0 : nextIndex
    })
    // 이전 timeout 정리
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current)
    }
    slideTimeoutRef.current = setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning, similarVideos.length, visibleCards])

  const slidePrev = useCallback(() => {
    if (isTransitioning || similarVideos.length === 0) return
    setIsTransitioning(true)
    trackEvent('similar_videos_carousel', {
      direction: 'prev',
      video_id: video?.id || video?.video_id || videoId
    })
    setCurrentIndex((prev) => {
      const prevIndex = prev - visibleCards
      // 무한루프: 첫 번째 카드 이전은 마지막으로
      return prevIndex < 0 ? Math.max(0, similarVideos.length - visibleCards) : prevIndex
    })
    // 이전 timeout 정리
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current)
    }
    slideTimeoutRef.current = setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning, similarVideos.length, visibleCards])

  // cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current)
      }
    }
  }, [])

  // useMemo는 모든 early return 이전에 호출되어야 함 (React 훅 규칙)
  const sliderVideos = useMemo(() => {
    if (!similarVideos || similarVideos.length === 0) return []
    if (similarVideos.length <= visibleCards) return similarVideos
    return [...similarVideos, ...similarVideos]
  }, [similarVideos, visibleCards])

  const thumbnailUrl = useMemo(() => {
    if (!video) return null
    return optimizeThumbnailUrl(video.thumbnail_url, video.id, video.is_shorts || false)
  }, [video?.thumbnail_url, video?.id, video?.is_shorts])
  
  const youtubeUrl = useMemo(() => {
    if (!video) return null
    return video.youtube_url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null)
  }, [video?.youtube_url, video?.id])

  const renderedSimilarVideos = useMemo(() => 
    sliderVideos.length > 0 ? sliderVideos : similarVideos,
    [sliderVideos, similarVideos]
  )

  const sentimentPercentages = useMemo(() => {
    if (!analysis?.sentiment_ratio) return null
    const normalize = (value = 0) => {
      if (value <= 1) {
        return Math.round(value * 100)
      }
      return Math.round(value)
    }
    return {
      positive: normalize(analysis.sentiment_ratio.pos),
      neutral: normalize(analysis.sentiment_ratio.neu),
      negative: normalize(analysis.sentiment_ratio.neg),
    }
  }, [analysis])

  const topKeywords = useMemo(
    () => (analysis?.top_keywords || []).slice(0, 12),
    [analysis]
  )

  const topComments = useMemo(
    () => (analysis?.top_comments || []).slice(0, 4),
    [analysis]
  )

  const sentimentBars = useMemo(
    () => [
      { label: '긍정', value: sentimentPercentages?.positive ?? 0, color: 'bg-emerald-500' },
      { label: '중립', value: sentimentPercentages?.neutral ?? 0, color: 'bg-slate-400' },
      { label: '부정', value: sentimentPercentages?.negative ?? 0, color: 'bg-rose-500' },
    ],
    [sentimentPercentages]
  )

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
              <div>
                <div className="text-white font-medium">
                  {(() => {
                    // 채널명 우선순위: channel_name > keyword > region > channel_id (YouTube ID가 아닌 경우만)
                    const channelId = video.channel_id || ''
                    const isYouTubeId = /^UC[a-zA-Z0-9_-]{22}$/.test(channelId)
                    
                    // YouTube ID 형식이면 절대 사용하지 않음
                    if (isYouTubeId) {
                      // channel_name, keyword, region 중 하나 사용
                      return (video.channel_name || video.keyword || video.region || '여행러버')
                        .toString()
                        .replace(/^channel:\s*/i, '')
                    } else {
                      // YouTube ID가 아니면 channel_id도 채널명으로 사용 가능
                      return (video.channel_name || video.keyword || video.region || video.channel_id || '여행러버')
                        .toString()
                        .replace(/^channel:\s*/i, '')
                    }
                  })()}
                </div>
                <div className="text-white/60 text-sm">
                  {formatDate(video.published_at)} · 조회수 {formatViews(video.view_count)}
                </div>
              </div>
            </div>

            {/* 설명 */}
            {video.description && (
              <div className="space-y-2">
                <p className="text-white/90 leading-relaxed">
                  {(() => {
                    if (!video.description) return ''
                    // 모든 description에 대해 더보기/간략히 기능 제공
                    const hasNewLine = video.description.includes('\n')
                    const shouldClip = video.description.length > 100 || hasNewLine
                    if (!shouldClip || showFullDescription) {
                      return video.description
                    }
                    return getDescriptionPreview(video.description)
                  })()}
                </p>
                {/* 모든 description에 더보기/간략히 버튼 표시 */}
                {video.description && (
                  <button
                    onClick={() => {
                      const nextState = !showFullDescription
                      setShowFullDescription(nextState)
                      trackEvent('description_toggle', {
                        video_id: video.id || video.video_id || videoId,
                        expanded: nextState,
                        page: 'VideoDetail'
                      })
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                  >
                    {showFullDescription ? '간략히' : '더보기'}
                  </button>
                )}
              </div>
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
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-400 font-semibold">AI 한줄평</div>
                <button
                  onClick={() => {
                    trackEvent('ai_summary_request', { video_id: videoId })
                    fetchAiSummary(videoId)
                  }}
                  disabled={isLoadingSummary}
                  className="text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
                >
                </button>
              </div>
              {isLoadingSummary ? (
                <p className="text-white/70 text-sm animate-pulse">AI 요약을 생성하는 중...</p>
              ) : aiSummary ? (
                <p className="text-white/90 text-sm">{aiSummary}</p>
              ) : aiSummaryError ? (
                <p className="text-red-400 text-sm">{aiSummaryError}</p>
              ) : (
                <p className="text-white/70 text-sm">
                  {video.description
                    ? `${video.description.substring(0, 100)}...`
                    : 'AI 요약을 준비 중입니다.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AI 댓글 인사이트 섹션 */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">AI 댓글 인사이트</h2>
            {analysis?.model?.sentiment_model && (
              <span className="text-xs text-white/50">
                모델: {analysis.model.sentiment_model} · {analysis.model.version || 'v1'}
              </span>
            )}
          </div>

          {analysis ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* 감정 비율 */}
              <div className="bg-[#11172b]/80 backdrop-blur border border-white/5 rounded-xl p-6 shadow-xl lg:col-span-1">
                <h3 className="text-white font-semibold mb-4">댓글 감정 비율</h3>
                <div className="space-y-4">
                  {sentimentBars.map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-sm">{label}</span>
                        <span className="text-white font-semibold text-sm">{value}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`${color} h-full rounded-full transition-all`}
                          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 상위 키워드 */}
              <div className="bg-[#11172b]/80 backdrop-blur border border-white/5 rounded-xl p-6 shadow-xl lg:col-span-1">
                <h3 className="text-white font-semibold mb-4">좋아요 높은 키워드</h3>
                {topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {topKeywords.map((keyword) => (
                      <div
                        key={keyword.keyword}
                        className="px-3 py-1.5 rounded-full bg-blue-600/20 text-blue-100 text-sm flex items-center gap-2"
                      >
                        <span>#{keyword.keyword}</span>
                        <span className="text-white/60 text-xs">{keyword.weight?.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">분석된 키워드가 없습니다.</p>
                )}
              </div>

              {/* 상위 댓글 */}
              <div className="bg-[#11172b]/80 backdrop-blur border border-white/5 rounded-xl p-6 shadow-xl lg:col-span-1">
                <h3 className="text-white font-semibold mb-4">좋아요 상위 댓글</h3>
                {topComments.length > 0 ? (
                  <div className="space-y-4">
                    {topComments.map((comment) => (
                      <div key={comment.comment_id} className="p-3 rounded-lg bg-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              comment.label === 'pos'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : comment.label === 'neg'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-500/20 text-slate-200'
                            }`}
                          >
                            {comment.label?.toUpperCase() || 'NEU'}
                          </span>
                          <span className="text-white/60 text-xs">
                            👍 {comment.like_count?.toLocaleString() || 0}
                          </span>
                        </div>
                        <p className="text-white/80 text-sm leading-relaxed">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">상위 댓글 데이터가 없습니다.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#11172b]/70 border border-dashed border-white/10 rounded-xl p-6 text-white/60 text-sm">
              분석 데이터가 아직 준비되지 않았습니다. 잠시 후 다시 확인해주세요.
            </div>
          )}
        </div>

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
              <div className="relative overflow-hidden px-12" style={{ height: '480px' }}>
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
                  {renderedSimilarVideos.map((v, index) => {
                    const actualIndex = index % similarVideos.length
                    const videoId = v.id || v.video_id
                    const thumbnailUrl = optimizeThumbnailUrl(v.thumbnail_url, videoId, v.is_shorts || false)
                    const categoryRaw = v.category || v.keyword || v.region || '여행'
                    const category = categoryRaw.toString().replace(/^channel:\s*/i, '')
                    const rating = v.rating || 5
                    const description = v.description || '여행의 감동을 잘 전달하는 영상이에요.'
                    
                    return (
                      <div 
                        key={`${videoId}-${index}`}
                        onClick={() => navigate(`/video/${videoId}`)}
                        className="flex-shrink-0 transition-all duration-300 hover:z-10 cursor-pointer group"
                        style={{ width: `${cardWidth}px` }}
                      >
                        <div className="bg-[#0f1629]/40 backdrop-blur-sm rounded-xl overflow-hidden border border-black/50 hover:border-black/70 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl h-full flex flex-col" style={{ height: '460px' }}>
                          {/* 카테고리 */}
                          <div className="px-4 pt-4 pb-2">
                            <span className="text-blue-400 text-xs font-medium">{category}</span>
                          </div>
                          
                          {/* 썸네일 */}
                          <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: '16/9' }}>
                            {thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={v.title || 'Video'}
                                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center">
                                <span className="text-white/40 text-sm">썸네일 없음</span>
                              </div>
                            )}
                            {/* 평점 배지 */}
                            <div className="absolute top-2 right-2 flex items-center space-x-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full z-10">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-white text-xs font-bold">{rating}</span>
                            </div>
                            {/* 그라데이션 오버레이 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                          </div>
                          
                          {/* 제목과 설명 */}
                          <div className="px-4 py-4 flex-1 flex flex-col">
                            <h3 className="text-white font-bold text-base leading-tight line-clamp-2 mb-3">
                              {v.title || '제목 없음'}
                            </h3>
                            <p className="text-white/70 text-sm leading-relaxed line-clamp-3">
                              {description.length > 120 ? `${description.substring(0, 120)}...` : description}
                            </p>
                          </div>
                        </div>
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

