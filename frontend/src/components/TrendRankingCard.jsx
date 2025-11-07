import { Star, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { handleImageError, optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'

function TrendRankingCard({ rank, video, change }) {
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

  // 순위 변동 표시
  const renderChange = () => {
    if (change === 'NEW') {
      return (
        <span className="text-blue-400 text-xs font-medium">NEW</span>
      )
    }
    if (change > 0) {
      return (
        <div className="flex items-center space-x-0.5 text-blue-400">
          <ArrowUp className="w-3 h-3" />
          <span className="text-xs font-medium">{Math.abs(change)}</span>
        </div>
      )
    }
    if (change < 0) {
      return (
        <div className="flex items-center space-x-0.5 text-blue-400">
          <ArrowDown className="w-3 h-3" />
          <span className="text-xs font-medium">{Math.abs(change)}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center space-x-0.5 text-blue-400">
        <Minus className="w-3 h-3" />
        <span className="text-xs font-medium">0</span>
      </div>
    )
  }

  // 제목 앞 아이콘 색상 결정 (예시: 키워드 기반)
  const getTitleIcon = () => {
    const title = video.title || ''
    if (title.includes('스위스') || title.includes('아이슬란드')) {
      return 'bg-red-500' // 빨간색 별
    }
    if (title.includes('발리') || title.includes('동남아')) {
      return 'bg-green-500' // 초록색 사각형
    }
    return 'bg-blue-500' // 파란색 사각형
  }

  return (
    <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-4 border border-blue-900/30 hover:border-blue-600/50 transition-all duration-300 ease-out hover:-translate-y-2 cursor-pointer hover:shadow-xl" onClick={handleClick}>
      <div className="flex gap-4">
        {/* 왼쪽: 순위 + 썸네일 */}
        <div className="flex items-start gap-3 flex-shrink-0">
          {/* 순위 */}
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg font-bold text-white ${
            rank === 1 ? 'bg-yellow-500' : 'bg-gray-700/50'
          }`}>
            {rank}
          </div>

          {/* 썸네일 */}
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
              <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-full">
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
            <div className="flex items-start gap-2 mb-1">
              <div className={`w-2 h-2 rounded mt-1.5 flex-shrink-0 ${getTitleIcon()}`}></div>
              <h3 className="text-white font-semibold text-base leading-snug line-clamp-2 flex-1">
                {video.title || '제목 없음'}
              </h3>
            </div>

            {/* 출처 및 조회수 */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-300 text-sm">{(video.category || video.creator || '출처 없음').replace(/^channel:\s*/i, '')}</span>
              {video.views && (
                <span className="text-gray-300 text-sm">{video.views}</span>
              )}
            </div>
          </div>
        </div>

        {/* 순위 변동 */}
        <div className="flex-shrink-0 flex items-start pt-1">
          {renderChange()}
        </div>
      </div>
    </div>
  )
}

export default TrendRankingCard

