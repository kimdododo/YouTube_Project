import React from 'react'
import VideoCard from '../VideoCard'

/**
 * 메인 추천 영상 섹션 컴포넌트
 * 반응형 그리드: PC 3열, 태블릿 2열, 모바일 1열
 */
function MainRecommendationSection({ videos, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="mb-16">
        <div className="text-center py-12">
          <div className="text-blue-300 animate-pulse">데이터를 불러오는 중...</div>
          <div className="text-blue-200 text-sm mt-2">잠시만 기다려주세요...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-16">
        <div className="text-center py-12">
          <div className="text-red-400 mb-4">{error}</div>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="mb-16">
        <div className="text-center py-12">
          <div className="text-blue-300 text-lg mb-2">추천 영상이 없습니다.</div>
          <div className="text-blue-200 text-sm">데이터를 불러오는 중 문제가 발생했습니다.</div>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-16">
      {/* 반응형 그리드: PC 3열, 태블릿 2열, 모바일 1열 */}
      {/* 
        Tailwind 그리드 클래스 설명:
        - grid-cols-1: 모바일 기본 1열
        - sm:grid-cols-2: 작은 화면(640px+) 2열
        - lg:grid-cols-3: 큰 화면(1024px+) 3열
        - gap-4 sm:gap-5 lg:gap-6: 반응형 간격 (16px → 20px → 24px)
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
        {videos.map((video) => (
          <VideoCard key={video.id || video.video_id} video={video} featured />
        ))}
      </div>
    </div>
  )
}

export default MainRecommendationSection

