import { Star, TrendingUp, Bookmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBookmark } from '../contexts/BookmarkContext'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'

function TrendCard({ video, hideTitle = false, hideTrendingBadge = false }) {
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmark()
  
  const videoId = video.id || video.video_id
  const bookmarked = isBookmarked(videoId)

  const handleBookmarkClick = (e) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    toggleBookmark(video)
  }

  // 썸네일 URL 최적화
  const rawThumbnailUrl = video.thumbnail_url || video.thumbnail || null
  const thumbnailUrl = video.id 
    ? optimizeThumbnailUrl(rawThumbnailUrl, video.id, video.is_shorts || false)
    : rawThumbnailUrl
  const shouldShowRating = video.showRating !== false && video.rating != null
  const optimizedStyles = getOptimizedImageStyles()

  const handleClick = () => {
    const videoId = video.id || video.video_id
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

  return (
    <div className="group relative cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-2" onClick={handleClick}>
      <div className="relative rounded-lg overflow-hidden bg-gray-900" style={{ aspectRatio: '9/16' }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.title || 'Video'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        {/* Placeholder */}
        <div 
          className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center absolute inset-0"
          style={{ display: thumbnailUrl ? 'none' : 'flex' }}
        >
          <TrendingUp className="w-10 h-10 text-white/40" />
        </div>
        
        {/* Gradient overlay */}
        {!hideTitle && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent" />}
        
        {/* 북마크 버튼 (좌측 상단) */}
        <button
          onClick={handleBookmarkClick}
          className={`absolute top-3 left-3 p-2 rounded-full backdrop-blur-sm transition-all z-10 ${
            bookmarked
              ? 'bg-blue-600/90 text-white'
              : 'bg-black/70 text-white/70 hover:bg-black/90 hover:text-white'
          }`}
          title={bookmarked ? '북마크 제거' : '북마크 추가'}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
        </button>

        {/* Trending Badge (우측 상단, hideTrendingBadge가 false일 때만) */}
        {!hideTrendingBadge && (
          <div className="absolute top-3 right-3 bg-red-500/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center space-x-1.5 z-10">
            <TrendingUp className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-semibold">트렌딩</span>
          </div>
        )}

        {/* Rating (우측 상단, 카테고리별 탭용 또는 일반) */}
        {shouldShowRating && (
          <div className="absolute top-3 right-3 flex items-center space-x-1 bg-black/80 backdrop-blur-sm px-2.5 py-1.5 rounded-full z-10">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-white text-sm font-bold">{video.rating}</span>
          </div>
        )}

        {/* Title (하단, hideTitle이 false일 때만) */}
        {!hideTitle && video.title && (
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-white text-base font-semibold leading-snug line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {video.title}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrendCard
