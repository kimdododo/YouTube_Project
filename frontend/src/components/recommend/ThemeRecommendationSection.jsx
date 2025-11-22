import React from 'react'
import { Link } from 'react-router-dom'
import VideoCardSlider from '../VideoCardSlider'

/**
 * 테마별 추천 영상 섹션 컴포넌트
 * 각 테마별로 좌우 가로 슬라이더 형태의 카드 리스트 제공
 */
function ThemeRecommendationSection({ themes, userName = '' }) {
  // 디버깅: themes 상태 확인
  console.log('[ThemeRecommendationSection] Received themes:', {
    themesCount: themes?.length || 0,
    themes: themes?.map(t => ({
      name: t.name,
      videosCount: t.videos?.length || 0,
      hasVideos: !!(t.videos && t.videos.length > 0)
    }))
  })
  
  if (!themes || themes.length === 0) {
    console.warn('[ThemeRecommendationSection] No themes provided')
    return null
  }


  // 키워드별 색상 매핑
  const getKeywordColor = (keyword) => {
    const keywordLower = (keyword || '').toLowerCase()
    
    // 구체적인 해시태그 먼저 체크
    if (keywordLower.includes('감성여행') || keywordLower.includes('#감성여행')) {
      return {
        borderColor: '#FCD34D', // 황금색/노란색
        textColor: '#FCD34D',
        glowColor: 'rgba(252, 211, 77, 0.5)'
      }
    }
    if (keywordLower.includes('국내여행') || keywordLower.includes('#국내여행')) {
      return {
        borderColor: '#10B981', // 초록색
        textColor: '#10B981',
        glowColor: 'rgba(16, 185, 129, 0.5)'
      }
    }
    if (keywordLower.includes('맛집투어') || keywordLower.includes('#맛집투어')) {
      return {
        borderColor: '#F97316', // 주황색
        textColor: '#F97316',
        glowColor: 'rgba(249, 115, 22, 0.5)'
      }
    }
    if (keywordLower.includes('해외여행') || keywordLower.includes('#해외여행')) {
      return {
        borderColor: '#06B6D4', // 청록색/시안색
        textColor: '#06B6D4',
        glowColor: 'rgba(6, 182, 212, 0.5)'
      }
    }
    if (keywordLower.includes('당일치기') || keywordLower.includes('#당일치기')) {
      return {
        borderColor: '#EC4899', // 분홍색/핑크색
        textColor: '#EC4899',
        glowColor: 'rgba(236, 72, 153, 0.5)'
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
                        border: 'none',
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

            {/* 가로 슬라이더 카드 리스트 */}
            {theme.videos && theme.videos.length > 0 ? (
              <VideoCardSlider 
                videos={theme.videos} 
                cardWidth={317.5}
                cardHeight={175.5}
                gap={24}
                hideBookmark={true}
                themeColors={{
                  borderColor: '#000000',
                  textColor: '#000000',
                  glowColor: 'rgba(0, 0, 0, 0.5)'
                }}
              />
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

