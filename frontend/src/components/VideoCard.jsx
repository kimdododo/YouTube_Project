import { Star, Play } from 'lucide-react'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'

function VideoCard({ video, simple = false, featured = false }) {
  // 썸네일 URL 최적화 (videoId가 있으면 항상 고화질 URL 사용)
  const rawThumbnailUrl = video.thumbnail_url || video.thumbnail || null
  const thumbnailUrl = video.id 
    ? optimizeThumbnailUrl(rawThumbnailUrl, video.id, video.is_shorts || false)
    : rawThumbnailUrl
  const shouldShowRating = video.showRating !== false && video.rating != null
  const categoryLabel = video.category ? String(video.category).replace(/^channel:\s*/i, '') : null
  const optimizedStyles = getOptimizedImageStyles()

  const handleClick = () => {
    const youtubeUrl = video.youtube_url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null)
    if (youtubeUrl) {
      window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (simple) {
    return (
      <div className="group relative cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-2" onClick={handleClick}>
        <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-white/20" style={{ aspectRatio: '9/16' }}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title || 'Video'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
            <Play className="w-10 h-10 text-white/40" />
          </div>
          
          {/* Rating badge (우측 상단) */}
          {shouldShowRating && (
            <div className="absolute top-2 right-2 flex items-center space-x-1 text-white text-xs font-semibold bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{video.rating}</span>
            </div>
          )}
          
          {/* Play button on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/70 backdrop-blur-sm rounded-full p-4">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (featured) {
    return (
      <div className="group bg-[#0f1629]/40 backdrop-blur-sm rounded-xl overflow-hidden border border-blue-800/30 hover:border-blue-600/50 transition-all duration-300 ease-out hover:-translate-y-2 cursor-pointer shadow-lg hover:shadow-2xl" onClick={handleClick}>
        <div className="relative" style={{ aspectRatio: '16/9' }}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={video.title || 'Video'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          
          {/* Rating badge (우측 상단) */}
          {shouldShowRating && (
            <div className="absolute top-4 right-4 flex items-center space-x-1.5 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full z-10">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-white text-sm font-bold">{video.rating}</span>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
            <div className="flex items-center justify-between mb-3">
                          {categoryLabel && (
                <span className="px-3 py-1.5 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-semibold rounded">
                              {categoryLabel}
                </span>
              )}
              {video.views && (
                <span className="text-white/90 text-xs font-medium">{video.views}</span>
              )}
            </div>
            {video.title && (
              <h3 className="text-white font-bold mb-2 text-xl leading-tight line-clamp-2">
                {video.title}
              </h3>
            )}
            {video.description && (
              <p className="text-blue-200 text-sm leading-relaxed line-clamp-2">
                {video.description}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default VideoCard
