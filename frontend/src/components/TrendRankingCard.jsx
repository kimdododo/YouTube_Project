import { Star, ArrowUp, ArrowDown, Minus, Bookmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBookmark } from '../contexts/BookmarkContext'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'
import { trackEvent } from '../utils/analytics-core'

function TrendRankingCard({ rank, video, change }) {
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmark()
  
  const videoId = video.id || video.video_id
  const bookmarked = isBookmarked(videoId)
  const eventContext = typeof window !== 'undefined' ? `${window.location.pathname}#trend` : 'trend'

  const handleBookmarkClick = (e) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    toggleBookmark(video)
    trackEvent('bookmark_toggle', {
      video_id: videoId,
      context: eventContext,
      bookmarked: !bookmarked,
      rank
    })
  }

  // 썸네일 URL 최적화
  const rawThumbnailUrl = video.thumbnail_url || video.thumbnail || null
  const thumbnailUrl = video.id 
    ? optimizeThumbnailUrl(rawThumbnailUrl, video.id, video.is_shorts || false)
    : rawThumbnailUrl
  const shouldShowRating = video.showRating !== false && video.rating != null
  const optimizedStyles = getOptimizedImageStyles()

  const handleClick = () => {
    trackEvent('video_click', {
      video_id: videoId,
      context: eventContext,
      rank
    })
    if (videoId) {
      // 비디오 상세 페이지로 이동
      navigate(`/video/${videoId}`)
    } else {
      // videoId가 없으면 YouTube로 이동
      const youtubeUrl = video.youtube_url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null)
      if (youtubeUrl) {
        window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
      }
    }
  }

  // 조회수 포맷팅
  const formatViews = (count) => {
    if (!count) return '0회'
    const num = typeof count === 'string' ? parseInt(count.replace(/[^0-9]/g, '')) : count
    if (num >= 10000) {
      return `${(num / 10000).toFixed(0)}만회`
    }
    return `${num.toLocaleString()}회`
  }

  // 순위 변동 표시
  const renderChange = () => {
    if (change === 'NEW') {
      return (
        <span className="text-red-500 text-xs font-medium">NEW</span>
      )
    }
    if (change > 0) {
      return (
        <div className="flex items-center space-x-0.5 text-red-500">
          <ArrowUp className="w-3 h-3" />
          <span className="text-xs font-medium">{Math.abs(change)}</span>
        </div>
      )
    }
    if (change < 0) {
      return (
        <div className="flex items-center space-x-0.5 text-red-500">
          <ArrowDown className="w-3 h-3" />
          <span className="text-xs font-medium">{Math.abs(change)}</span>
        </div>
      )
    }
    return (
      <span className="text-gray-400 text-xs font-medium">-</span>
    )
  }

  const rawChannelName =
    video.channel_name ||
    video.channelTitle ||
    video.channel_title ||
    video.channel ||
    video.keyword ||
    video.region ||
    ''
  const isYoutubeChannelId = (value) => {
    if (!value || typeof value !== 'string') return false
    return /^UC[a-zA-Z0-9_-]{22}$/.test(value)
  }
  const channelName = rawChannelName
    ? rawChannelName.replace(/^channel:\s*/i, '')
    : !isYoutubeChannelId(video.channel_id)
      ? video.channel_id
      : '여행러버'

  const viewCount =
    video.view_count ??
    video.views ??
    video.viewCount ??
    video.statistics?.viewCount ??
    0

  return (
    <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-4 border border-blue-900/30 hover:border-blue-600/50 transition-all duration-300 ease-out hover:-translate-y-2 cursor-pointer hover:shadow-xl" onClick={handleClick}>
      <div className="flex gap-4 items-center">
        {/* 왼쪽: 순위 */}
        <div className="flex-shrink-0">
          <div className={`flex items-center justify-center text-4xl font-bold ${
            rank === 1 ? 'text-yellow-500' : 'text-white'
          }`} style={{ width: '60px' }}>
            {rank}
          </div>
        </div>

        {/* 중간: 썸네일 */}
        <div className="flex-shrink-0">
          <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-900">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={video.title || 'Video'}
                className="w-full h-full object-cover"
                style={optimizedStyles}
                loading="lazy"
                onLoad={(e) => handleImageLoadQuality(e, video.id, video.is_shorts)}
                decoding="async"
                fetchpriority="high"
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
            <div 
              className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center absolute inset-0"
              style={{ display: thumbnailUrl ? 'none' : 'flex' }}
            >
              <div className="w-8 h-8 rounded bg-blue-600"></div>
            </div>
            
            {/* 평점 배지 */}
            {shouldShowRating && (
              <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-full z-10">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-white text-sm font-bold">{video.rating}</span>
              </div>
            )}
            
          </div>
        </div>

        {/* 오른쪽: 텍스트 정보 */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            {/* 제목 */}
            <h3 className="text-white font-semibold text-base leading-snug line-clamp-2 mb-2">
              {video.title || '제목 없음'}
            </h3>

            {/* 크리에이터 및 조회수 */}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="text-white/70 text-sm">{channelName}</span>
              <span className="text-white/50 text-sm">·</span>
              <span className="text-white/70 text-sm">조회수 {formatViews(viewCount)}</span>
            </div>
          </div>
        </div>

        {/* 순위 변동 */}
        <div className="flex-shrink-0 flex items-center">
          {renderChange()}
        </div>
      </div>
    </div>
  )
}

export default TrendRankingCard

