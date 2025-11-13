import React from 'react'
import { Link } from 'react-router-dom'
import VideoCard from '../VideoCard'

/**
 * 테마별 추천 영상 섹션 컴포넌트
 * 각 테마별로 수평 스크롤 가능한 카드 리스트 제공
 */
function ThemeRecommendationSection({ themes, userName = '' }) {
  if (!themes || themes.length === 0) {
    return null
  }

  return (
    <div className="mb-16">
      {/* 섹션 헤더 */}
      <div className="mb-8">
        <h2 
          className="font-bold text-white mb-3"
          style={{
            fontSize: '28px',
            lineHeight: '36px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
          }}
        >
          테마별로 보는 나의 여행 취향
        </h2>
        <p 
          className="text-white/90"
          style={{
            fontSize: '16px',
            lineHeight: '24px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          {userName ? `${userName}님` : '당신'}의 취향을 분석한 여행 영상을 모아보았어요.
        </p>
      </div>

      {/* 테마별 카테고리 섹션 */}
      <div className="space-y-12">
        {themes.map((theme) => (
          <div key={theme.id || theme.name} className="space-y-4">
            {/* 카테고리 헤더 */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 
                  className="font-bold text-white mb-2"
                  style={{
                    fontSize: '20px',
                    lineHeight: '28px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#FFFFFF'
                  }}
                >
                  {theme.hashtag || `#${theme.name}`}
                </h3>
                <p 
                  className="text-white/70"
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  {theme.description}
                </p>
              </div>
              {/* 더보기 버튼 */}
              {theme.route ? (
                <Link
                  to={theme.route}
                  className="flex items-center text-blue-400 hover:text-blue-300 transition-colors font-medium whitespace-nowrap"
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  더보기 <span className="ml-1">&gt;</span>
                </Link>
              ) : (
                <button
                  onClick={theme.onMoreClick}
                  className="flex items-center text-blue-400 hover:text-blue-300 transition-colors font-medium whitespace-nowrap"
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  더보기 <span className="ml-1">&gt;</span>
                </button>
              )}
            </div>

            {/* 수평 스크롤 카드 리스트 */}
            {theme.videos && theme.videos.length > 0 ? (
              <div 
                className="overflow-x-auto pb-4 -mx-4 px-4 theme-scroll-container"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(59, 130, 246, 0.5) transparent'
                }}
              >
                <style>{`
                  .theme-scroll-container::-webkit-scrollbar {
                    height: 6px;
                  }
                  .theme-scroll-container::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .theme-scroll-container::-webkit-scrollbar-thumb {
                    background-color: rgba(59, 130, 246, 0.5);
                    border-radius: 3px;
                  }
                  .theme-scroll-container::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(59, 130, 246, 0.7);
                  }
                `}</style>
                <div className="flex gap-4 min-w-max">
                  {theme.videos.map((video) => (
                    <div key={video.id || video.video_id} className="flex-shrink-0 w-[280px] sm:w-[320px]">
                      <VideoCard video={video} featured />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                <p style={{ fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
                  이 테마에 해당하는 영상이 없습니다.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThemeRecommendationSection

