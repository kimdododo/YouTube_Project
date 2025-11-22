import { Star, Play, Bookmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useBookmark } from '../contexts/BookmarkContext'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'
import { trackEvent } from '../utils/analytics-core'

function VideoCard({ video, simple = false, featured = false, hideBookmark = false, active = false, themeColors = null, cardWidth = null, cardHeight = null, analyticsContext = null }) {
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmark()
  const thumbnailRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  
  const videoId = video.id || video.video_id
  const bookmarked = isBookmarked(videoId)
  const eventContext = analyticsContext || (typeof window !== 'undefined' ? window.location.pathname : 'unknown')

  // 반응형 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleBookmarkClick = (e) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    toggleBookmark(video)
    trackEvent('bookmark_toggle', {
      video_id: videoId,
      context: eventContext,
      bookmarked: !bookmarked
    })
  }
  
  // 썸네일 URL 최적화 (videoId가 있으면 항상 고화질 URL 사용)
  const rawThumbnailUrl = video.thumbnail_url || video.thumbnail || null
  const videoIdForThumbnail = video.id || video.video_id
  const thumbnailUrl = videoIdForThumbnail
    ? optimizeThumbnailUrl(rawThumbnailUrl, videoIdForThumbnail, video.is_shorts || false)
    : rawThumbnailUrl
  
  // 디버깅: simple 모드에서 썸네일 URL 확인
  if (simple) {
    console.log('[VideoCard] Simple mode thumbnail:', {
      videoId: videoIdForThumbnail,
      rawThumbnailUrl,
      thumbnailUrl,
      hasThumbnail: !!thumbnailUrl,
      cardWidth,
      cardHeight
    })
  }
  const shouldShowRating = video.showRating !== false && video.rating != null
  const categoryLabel = video.category ? String(video.category).replace(/^channel:\s*/i, '') : null
  const optimizedStyles = getOptimizedImageStyles()

  // 키워드별 색상 매핑
  const getKeywordColor = (keyword) => {
    if (!keyword) return null
    const keywordLower = String(keyword).toLowerCase()
    
    // 구체적인 해시태그 먼저 체크 (ThemeRecommendationSection과 동일한 순서)
    if (keywordLower.includes('감성여행') || keywordLower.includes('#감성여행')) {
      return {
        borderColor: '#FCD34D', // 황금색/노란색
        textColor: '#FCD34D',
        glowColor: 'rgba(252, 211, 77, 0.5)'
      }
    }
    if (keywordLower.includes('국내여행') || keywordLower.includes('#국내여행') || keywordLower.includes('domestic')) {
      return {
        borderColor: '#10B981', // 초록색
        textColor: '#10B981',
        glowColor: 'rgba(16, 185, 129, 0.5)'
      }
    }
    if (keywordLower.includes('맛집투어') || keywordLower.includes('#맛집투어') || keywordLower.includes('food')) {
      return {
        borderColor: '#F97316', // 주황색
        textColor: '#F97316',
        glowColor: 'rgba(249, 115, 22, 0.5)'
      }
    }
    if (keywordLower.includes('해외여행') || keywordLower.includes('#해외여행') || keywordLower.includes('global')) {
      return {
        borderColor: '#06B6D4', // 청록색/시안색
        textColor: '#06B6D4',
        glowColor: 'rgba(6, 182, 212, 0.5)'
      }
    }
    if (keywordLower.includes('당일치기') || keywordLower.includes('#당일치기') || keywordLower.includes('oneday')) {
      return {
        borderColor: '#EC4899', // 분홍색/핑크색
        textColor: '#EC4899',
        glowColor: 'rgba(236, 72, 153, 0.5)'
      }
    }
    
    // 추가 키워드들
    if (keywordLower.includes('브이로그') || keywordLower.includes('vlog')) {
      return {
        borderColor: '#8B5CF6', // 보라색
        textColor: '#8B5CF6',
        glowColor: 'rgba(139, 92, 246, 0.5)'
      }
    }
    if (keywordLower.includes('숙소리뷰') || keywordLower.includes('stay')) {
      return {
        borderColor: '#14B8A6', // 청록색
        textColor: '#14B8A6',
        glowColor: 'rgba(20, 184, 166, 0.5)'
      }
    }
    if (keywordLower.includes('캠핑') || keywordLower.includes('camping')) {
      return {
        borderColor: '#84CC16', // 라임색
        textColor: '#84CC16',
        glowColor: 'rgba(132, 204, 22, 0.5)'
      }
    }
    if (keywordLower.includes('카페투어') || keywordLower.includes('cafe')) {
      return {
        borderColor: '#F59E0B', // 앰버색/주황노란색
        textColor: '#F59E0B',
        glowColor: 'rgba(245, 158, 11, 0.5)'
      }
    }
    
    // 기존 키워드들
    if (keywordLower.includes('가성비') || keywordLower.includes('budget')) {
      return {
        borderColor: '#60A5FA', // 밝은 파란색
        textColor: '#60A5FA',
        glowColor: 'rgba(96, 165, 250, 0.5)'
      }
    }
    if (keywordLower.includes('혼자') || keywordLower.includes('solo')) {
      return {
        borderColor: '#A78BFA', // 밝은 보라색
        textColor: '#A78BFA',
        glowColor: 'rgba(167, 139, 250, 0.5)'
      }
    }
    if (keywordLower.includes('감성') || keywordLower.includes('aesthetic')) {
      return {
        borderColor: '#FCD34D', // 황금색/노란색
        textColor: '#FCD34D',
        glowColor: 'rgba(252, 211, 77, 0.5)'
      }
    }
    return null
  }

  // 비디오 키워드 추출 (keyword 필드 또는 category에서)
  const videoKeyword = video.keyword || video.category || null
  const keywordColor = getKeywordColor(videoKeyword)

  const handleClick = () => {
    trackEvent('video_click', {
      video_id: videoId,
      context: eventContext,
      layout: featured ? 'featured' : simple ? 'simple' : 'default'
    })
    if (videoId) {
      // 비디오 상세 페이지로 이동
      navigate(`/video/${videoId}`)
    } else {
      // videoId가 없으면 YouTube로 이동
      const youtubeUrl = video.youtube_url || null
      if (youtubeUrl) {
        window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }

  if (simple) {
    return (
      <div className="group relative cursor-pointer transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/50 w-full" onClick={handleClick}>
        <div 
          className="relative rounded-lg overflow-hidden bg-gray-900 border border-black/50 group-hover:border-black/70 transition-all duration-300" 
          style={{ 
            ...(cardWidth && cardHeight ? {
              width: `${cardWidth}px`,
              height: `${cardHeight}px`
            } : {
              aspectRatio: '16/9' // 9/16에서 16/9로 변경 (일반 비디오 비율)
            })
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title || 'Video'}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
              style={optimizedStyles}
              loading="lazy"
              decoding="async"
              fetchpriority="high"
              onLoad={(e) => {
                console.log('[VideoCard] Simple mode image loaded:', thumbnailUrl)
                handleImageLoadQuality(e, videoIdForThumbnail, video.is_shorts)
              }}
              onError={(e) => {
                console.error('[VideoCard] Simple mode image error:', {
                  thumbnailUrl,
                  videoId: videoIdForThumbnail,
                  error: e
                })
                handleImageError(e, videoIdForThumbnail, video.is_shorts)
                if (e.target.style.display === 'none') {
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex'
                  }
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center">
              <Play className="w-10 h-10 text-white/40" />
            </div>
          )}
          
          {/* Rating badge (우측 상단) */}
          {shouldShowRating && (
            <div className="absolute top-2 right-2 flex items-center space-x-1 text-white text-xs font-semibold bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full z-10 group-hover:scale-110 group-hover:bg-yellow-400/20 transition-all duration-300">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
              <span className="group-hover:text-yellow-300 transition-colors duration-300">{video.rating}</span>
            </div>
          )}
          
          {/* 북마크 버튼 (좌측 상단) */}
          {!hideBookmark && (
            <button
              onClick={handleBookmarkClick}
              className={`absolute top-2 left-2 p-2 rounded-full backdrop-blur-sm transition-all z-10 group-hover:scale-110 ${
                bookmarked
                  ? 'bg-blue-600/90 text-white hover:bg-blue-500 hover:scale-110'
                  : 'bg-black/70 text-white/70 hover:bg-black/90 hover:text-white hover:scale-110'
              }`}
              title={bookmarked ? '북마크 제거' : '북마크 추가'}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
          
          {/* Play button on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-sm rounded-full p-4 group-hover:scale-110 transition-transform duration-300 shadow-2xl">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (featured) {
    // 모든 영상 카드 라인 색상을 BLACK으로 통일
    const borderColor = '#000000' // BLACK
    const glowColor = 'rgba(0, 0, 0, 0.5)' // BLACK glow
    
    // hex 색상을 rgba로 변환하는 헬퍼 함수
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    
    const defaultBorderColor = active ? borderColor : hexToRgba(borderColor, 0.5)
    const thumbnailBoxShadow = active 
      ? `0 0 20px ${glowColor}, 0 0 40px ${glowColor}80`
      : `0 0 10px ${glowColor}40`
    
    return (
      <div 
        className="group bg-[#0f1629]/40 backdrop-blur-sm rounded-xl overflow-visible transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] cursor-pointer w-full relative"
        style={{
          transform: active ? 'scale(1.02) translateY(-8px)' : 'none',
          border: 'none',
          borderColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!active) {
            const thumbnailDiv = e.currentTarget.querySelector('.thumbnail-container')
            if (thumbnailDiv) {
              thumbnailDiv.style.borderColor = borderColor
              thumbnailDiv.style.boxShadow = `0 0 15px ${glowColor}, 0 0 30px ${glowColor}80`
            }
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            const thumbnailDiv = e.currentTarget.querySelector('.thumbnail-container')
            if (thumbnailDiv) {
              thumbnailDiv.style.borderColor = hexToRgba(borderColor, 0.5)
              thumbnailDiv.style.boxShadow = `0 0 10px ${glowColor}40`
            }
          }
        }}
        onClick={handleClick}
      >
        <div 
          ref={thumbnailRef}
          className="relative overflow-hidden thumbnail-container rounded-xl border-solid" 
          style={{ 
            ...(cardWidth && cardHeight ? {
              width: `${cardWidth}px`,
              height: `${cardHeight}px`
            } : {
              aspectRatio: '16/9',
              width: '100%'
            }),
            border: `${isMobile ? '1px' : '2px'} solid ${defaultBorderColor}`,
            boxShadow: thumbnailBoxShadow
          }}
          onMouseEnter={(e) => {
            if (!isMobile) {
              e.currentTarget.style.borderWidth = '3px'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderWidth = isMobile ? '1px' : '2px'
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title || 'Video'}
              className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                active 
                  ? 'scale-105' 
                  : 'group-hover:scale-105'
              }`}
              style={optimizedStyles}
              loading="lazy"
              decoding="async"
              fetchpriority="high"
              onLoad={(e) => handleImageLoadQuality(e, video.id, video.is_shorts)}
              onError={(e) => {
                handleImageError(e, video.id, video.is_shorts)
                if (e.target.style.display === 'none') {
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex'
                  }
                }
              }}
            />
          ) : null}
          {/* Placeholder */}
          <div 
            className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center absolute inset-0"
            style={{ display: thumbnailUrl ? 'none' : 'flex' }}
          >
            <Play className="w-20 h-20 text-white/40" />
          </div>
          
          {/* Rating badge (좌측 상단) */}
          {shouldShowRating && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex items-center space-x-1 bg-black/70 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 rounded-full z-10">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-white text-xs sm:text-sm font-bold">{video.rating}</span>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          
          {/* Content overlay - 제목과 조회수만 표시 */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6 z-10">
            {video.title && (
              <h3 className="text-white font-bold text-sm sm:text-base md:text-lg leading-tight line-clamp-2 mb-1 sm:mb-2 drop-shadow-lg" style={{
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)'
              }}>
                {video.title}
              </h3>
            )}
            {(() => {
              // 조회수 포맷팅 헬퍼 함수
              const formatViews = (count) => {
                // null, undefined, 빈 문자열 체크
                if (count === null || count === undefined || count === '') return null
                // 숫자로 변환
                const num = typeof count === 'string' ? parseInt(count.replace(/[^0-9]/g, '')) || 0 : (typeof count === 'number' ? count : 0)
                // 0이거나 NaN이면 null 반환 (표시하지 않음)
                if (num === 0 || isNaN(num)) return null
                if (num >= 1000000) {
                  return `${(num / 1000000).toFixed(1)}M회`
                }
                if (num >= 10000) {
                  return `${(num / 10000).toFixed(1)}만회`
                }
                return `${num.toLocaleString()}회`
              }
              
              // 여러 필드에서 조회수 찾기 (우선순위: view_count > views > viewCount)
              const viewCount = video.view_count ?? video.views ?? video.viewCount ?? 0
              
              // 디버깅: 조회수 정보 로그 출력 (조회수가 0이거나 없을 때만)
              if ((!viewCount || viewCount === 0) && video.id) {
                console.warn('[VideoCard] View count is 0 or missing for video:', {
                  id: video.id,
                  video_id: video.video_id,
                  view_count: video.view_count,
                  views: video.views,
                  viewCount: video.viewCount,
                  finalViewCount: viewCount,
                  title: video.title,
                  featured
                })
              }
              
              const formattedViews = formatViews(viewCount)
              
              return formattedViews ? (
                <div className="flex items-center justify-end mt-1 sm:mt-2">
                  <span className="text-white text-xs sm:text-sm font-medium drop-shadow-lg" style={{
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
                  }}>
                    {formattedViews}
                  </span>
                </div>
              ) : null
            })()}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default VideoCard
