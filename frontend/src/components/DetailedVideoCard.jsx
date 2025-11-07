import { Star } from 'lucide-react'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'

function DetailedVideoCard({ video }) {
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

  // 국가별 플래그 색상
  const getFlagColor = () => {
    if (video.title?.includes('발리') || video.category?.includes('동남아')) return 'bg-red-500'
    if (video.title?.includes('오사카') || video.title?.includes('일본') || video.category?.includes('일본')) return 'bg-red-500'
    if (video.title?.includes('프랑스') || video.category?.includes('유럽')) return 'bg-blue-500'
    if (video.title?.includes('다낭') || video.title?.includes('베트남') || video.category?.includes('베트남')) return 'bg-red-500'
    return 'bg-purple-500'
  }

  const sanitizedCategory = (video.category || '').replace(/^channel:\s*/i, '')

  return (
    <div className="bg-[#0f1629]/40 backdrop-blur-sm rounded-lg overflow-hidden border border-blue-800/30 hover:border-blue-600/50 transition-all duration-300 ease-out hover:-translate-y-2 cursor-pointer shadow-lg hover:shadow-2xl" onClick={handleClick}>
      <div className="flex p-1">
        {/* 왼쪽: 큰 이미지 썸네일 */}
        <div className="relative flex-shrink-0 w-48 h-40 bg-gray-900">
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
            <div className="w-10 h-10 rounded bg-blue-600"></div>
          </div>
          {/* 별점 */}
          {shouldShowRating && (
            <div className="absolute top-2 right-2 flex items-center space-x-0.5 bg-black/80 backdrop-blur-sm px-2 py-1 rounded">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-white text-sm font-bold">{video.rating}</span>
            </div>
          )}
        </div>

        {/* 오른쪽: 텍스트 정보 */}
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start space-x-1.5 mb-2">
              <div className={`w-3.5 h-3.5 rounded mt-0.5 flex-shrink-0 ${getFlagColor()}`}></div>
              <h3 className="text-white text-lg font-semibold line-clamp-1 leading-snug">
                {video.title}
              </h3>
            </div>
            {video.description && (
              <p className="text-blue-200 text-base mb-4 line-clamp-1 ml-6">
                {video.description.startsWith('※') || video.description.startsWith('#') 
                  ? video.description 
                  : `※${video.description}`}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between ml-6 gap-2">
            {sanitizedCategory && (
              <span className="text-gray-300 text-base whitespace-nowrap">{sanitizedCategory}</span>
            )}
            {video.views && (
              <span className="text-gray-300 text-base whitespace-nowrap">◎ {video.views}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DetailedVideoCard

