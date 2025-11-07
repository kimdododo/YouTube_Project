import { Star } from 'lucide-react'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'

function TrendGridCard({ video }) {
  // 썸네일 URL 최적화
  const rawThumbnailUrl = video.thumbnail_url || video.thumbnail || null
  const thumbnailUrl = video.id 
    ? optimizeThumbnailUrl(rawThumbnailUrl, video.id, video.is_shorts || false)
    : rawThumbnailUrl
  const shouldShowRating = video.showRating !== false && video.rating != null
  const optimizedStyles = getOptimizedImageStyles()

  const handleClick = () => {
    const youtubeUrl = video.youtube_url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null)
    if (youtubeUrl) {
      window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="group relative cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-2" onClick={handleClick}>
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-900 shadow-lg">
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
          className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center absolute inset-0"
          style={{ display: thumbnailUrl ? 'none' : 'flex' }}
        >
          <div className="text-white/50 text-sm">이미지 없음</div>
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        
        {/* Rating - 우측 상단 (이미지와 동일하게) */}
        {shouldShowRating && (
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center space-x-1.5 z-10">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-white text-sm font-semibold">{video.rating}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrendGridCard

