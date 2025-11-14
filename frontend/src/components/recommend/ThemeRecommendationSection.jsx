import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import VideoCard from '../VideoCard'

/**
 * 테마별 추천 영상 섹션 컴포넌트
 * 각 테마별로 슬라이더 형태의 카드 리스트 제공
 */
function ThemeRecommendationSection({ themes, userName = '' }) {
  if (!themes || themes.length === 0) {
    return null
  }

  // 각 테마별 슬라이더 인덱스 관리
  const [sliderIndices, setSliderIndices] = useState({})
  const [isTransitioning, setIsTransitioning] = useState({})

  const cardWidth = 320
  const gap = 24
  const cardStep = cardWidth + gap

  const slideNext = (themeId) => {
    const theme = themes.find(t => (t.id || t.name) === themeId)
    if (!theme || !theme.videos || theme.videos.length === 0) return
    
    if (isTransitioning[themeId]) return
    
    setIsTransitioning(prev => ({ ...prev, [themeId]: true }))
    setSliderIndices(prev => {
      const currentIndex = prev[themeId] || 0
      const nextIndex = currentIndex + 1
      return {
        ...prev,
        [themeId]: nextIndex >= theme.videos.length ? 0 : nextIndex
      }
    })
    setTimeout(() => {
      setIsTransitioning(prev => ({ ...prev, [themeId]: false }))
    }, 500)
  }

  const slidePrev = (themeId) => {
    const theme = themes.find(t => (t.id || t.name) === themeId)
    if (!theme || !theme.videos || theme.videos.length === 0) return
    
    if (isTransitioning[themeId]) return
    
    setIsTransitioning(prev => ({ ...prev, [themeId]: true }))
    setSliderIndices(prev => {
      const currentIndex = prev[themeId] || 0
      const prevIndex = currentIndex - 1
      return {
        ...prev,
        [themeId]: prevIndex < 0 ? theme.videos.length - 1 : prevIndex
      }
    })
    setTimeout(() => {
      setIsTransitioning(prev => ({ ...prev, [themeId]: false }))
    }, 500)
  }

  // 키워드별 색상 매핑
  const getKeywordColor = (keyword) => {
    const keywordLower = (keyword || '').toLowerCase()
    
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
    // 기본 색상
    return {
      borderColor: '#60A5FA',
      textColor: '#60A5FA',
      glowColor: 'rgba(96, 165, 250, 0.5)'
    }
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
                {(() => {
                  const keywordText = theme.hashtag || `#${theme.name}`
                  const colors = getKeywordColor(keywordText)
                  
                  return (
                    <div
                      className="inline-block px-4 py-2 rounded-lg mb-2"
                      style={{
                        border: `1px solid ${colors.borderColor}`,
                        boxShadow: `0 0 10px ${colors.glowColor}, inset 0 0 10px ${colors.glowColor}`,
                        background: 'transparent'
                      }}
                    >
                      <h3 
                        className="font-bold"
                        style={{
                          fontSize: '20px',
                          lineHeight: '28px',
                          fontFamily: 'Arial, sans-serif',
                          color: colors.textColor
                        }}
                      >
                        {keywordText}
                      </h3>
                    </div>
                  )
                })()}
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

            {/* 슬라이더 카드 리스트 */}
            {theme.videos && theme.videos.length > 0 ? (
              <div className="relative overflow-hidden">
                {/* 왼쪽 화살표 */}
                <button
                  onClick={() => slidePrev(theme.id || theme.name)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* 비디오 카드 컨테이너 */}
                <div className="relative overflow-hidden" style={{ height: '280px' }}>
                  <div
                    className="flex gap-6 absolute top-0"
                    style={{
                      left: '50%',
                      transform: `translateX(calc(-50% - ${(sliderIndices[theme.id || theme.name] || 0) * cardStep}px))`,
                      transition: isTransitioning[theme.id || theme.name] 
                        ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
                        : 'none',
                      willChange: 'transform'
                    }}
                  >
                    {/* 무한루프를 위한 카드 복제 */}
                    {[...theme.videos, ...theme.videos, ...theme.videos].map((video, index) => {
                      const actualIndex = index % theme.videos.length
                      const currentIndex = sliderIndices[theme.id || theme.name] || 0
                      const isActive = actualIndex === currentIndex && 
                        index >= theme.videos.length && 
                        index < theme.videos.length * 2
                      
                      return (
                        <div 
                          key={`${video.id || video.video_id}-${index}`}
                          className="flex-shrink-0 w-[280px] sm:w-[320px] transition-all duration-300 hover:z-10"
                        >
                          <VideoCard video={video} featured active={isActive} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 오른쪽 화살표 */}
                <button
                  onClick={() => slideNext(theme.id || theme.name)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
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

