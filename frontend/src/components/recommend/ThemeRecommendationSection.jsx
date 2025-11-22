import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { optimizeThumbnailUrl } from '../../utils/imageUtils'

/**
 * 테마별 슬라이더 컴포넌트 (VideoDetail.jsx 구조 적용)
 */
function ThemeSlider({ theme, cardWidth = 320, gap = 24, visibleCards = 4 }) {
  const navigate = useNavigate()
  const cardStep = cardWidth + gap
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const slideTimeoutRef = useRef(null)

  // 디버깅: theme prop 확인
  console.log('[ThemeSlider] ===== Component rendered =====', new Error().stack?.split('\n').slice(0, 3).join('\n'))
  console.log('[ThemeSlider] Received theme:', {
    themeName: theme?.name,
    themeId: theme?.id,
    videosCount: theme?.videos?.length || 0,
    videosType: typeof theme?.videos,
    isArray: Array.isArray(theme?.videos),
    videos: theme?.videos ? theme.videos.map(v => ({
      id: v.id,
      video_id: v.video_id,
      title: v.title?.substring(0, 30),
      view_count: v.view_count,
      thumbnail_url: v.thumbnail_url
    })) : []
  })

  // 무한루프를 위한 비디오 복제
  const sliderVideos = useMemo(() => {
    if (!theme.videos || theme.videos.length === 0) {
      console.warn('[ThemeSlider] No videos in theme:', theme?.name)
      return []
    }
    console.log('[ThemeSlider] Creating sliderVideos:', {
      originalCount: theme.videos.length,
      visibleCards,
      willClone: theme.videos.length > visibleCards
    })
    if (theme.videos.length <= visibleCards) return theme.videos
    return [...theme.videos, ...theme.videos]
  }, [theme.videos, visibleCards])

  const renderedVideos = useMemo(() => {
    const result = sliderVideos.length > 0 ? sliderVideos : theme.videos || []
    console.log('[ThemeSlider] renderedVideos:', {
      sliderVideosCount: sliderVideos.length,
      themeVideosCount: theme.videos?.length || 0,
      finalCount: result.length,
      result: result
    })
    return result
  }, [sliderVideos, theme.videos])

  // 슬라이더 핸들러
  const slideHandler = useCallback(
    (direction) => {
      if (isTransitioning || !theme.videos || theme.videos.length === 0) return
      
      setIsTransitioning(true)
      
      setCurrentIndex((prev) => {
        if (direction === 'next') {
          const nextIndex = prev + 1
          return nextIndex >= theme.videos.length ? 0 : nextIndex
        }
        const prevIndex = prev - 1
        return prevIndex < 0 ? Math.max(0, theme.videos.length - visibleCards) : prevIndex
      })

      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current)
      }
      slideTimeoutRef.current = setTimeout(() => {
        setIsTransitioning(false)
      }, 500)
    },
    [isTransitioning, theme.videos, visibleCards]
  )

  const slideNext = useCallback(() => slideHandler('next'), [slideHandler])
  const slidePrev = useCallback(() => slideHandler('prev'), [slideHandler])

  // cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current)
      }
    }
  }, [])

  // 비디오가 없거나 renderedVideos가 비어있을 때
  if (!theme.videos || theme.videos.length === 0 || renderedVideos.length === 0) {
    console.warn('[ThemeSlider] No videos to render:', {
      themeName: theme?.name,
      themeVideosCount: theme.videos?.length || 0,
      renderedVideosCount: renderedVideos.length,
      sliderVideosCount: sliderVideos.length
    })
    return (
      <div className="text-center py-8 text-white/60">
        <p style={{ fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
          이 테마에 해당하는 영상이 없습니다.
        </p>
      </div>
    )
  }

  console.log('[ThemeSlider] Rendering videos:', {
    renderedVideosCount: renderedVideos.length,
    currentIndex,
    cardStep,
    transformValue: currentIndex * cardStep
  })

  return (
    <div className="relative overflow-hidden">
      {/* 왼쪽 화살표 */}
      <button
        onClick={slidePrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-3 text-white transition-all shadow-lg"
        disabled={isTransitioning}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* 비디오 카드 컨테이너 */}
      <div className="relative overflow-hidden px-12" style={{ height: '480px' }}>
        <div
          className="flex gap-6 absolute top-0"
          style={{
            left: '50%',
            transform: `translateX(calc(-50% - ${currentIndex * cardStep}px))`,
            transition: isTransitioning ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            willChange: 'transform'
          }}
        >
          {/* 무한루프를 위한 카드 복제 */}
          {(() => {
            console.log('[ThemeSlider] Rendering cards:', {
              renderedVideosCount: renderedVideos.length,
              renderedVideos: renderedVideos.slice(0, 3).map(v => ({
                id: v.id || v.video_id,
                title: v.title?.substring(0, 30),
                thumbnail_url: v.thumbnail_url
              }))
            })
            
            if (!renderedVideos || renderedVideos.length === 0) {
              return (
                <div className="text-center py-8 text-white/60">
                  <p style={{ fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
                    영상을 불러오는 중...
                  </p>
                </div>
              )
            }
            
            return renderedVideos.map((v, index) => {
              const actualIndex = index % (theme.videos?.length || 1)
              const videoId = v.id || v.video_id
              const thumbnailUrl = optimizeThumbnailUrl(v.thumbnail_url, videoId, v.is_shorts || false)
              const categoryRaw = v.category || v.keyword || v.region || '여행'
              const category = categoryRaw.toString().replace(/^channel:\s*/i, '')
              const rating = v.rating || 5
              const description = v.description || '여행의 감동을 잘 전달하는 영상이에요.'
              
              // 디버깅: 첫 번째 카드 정보
              if (index === 0) {
                console.log('[ThemeSlider] First card rendering:', {
                  videoId,
                  thumbnailUrl,
                  hasThumbnail: !!thumbnailUrl,
                  title: v.title
                })
              }
              
              return (
                <div 
                  key={`${videoId}-${index}`}
                  onClick={() => navigate(`/video/${videoId}`)}
                  className="flex-shrink-0 transition-all duration-300 hover:z-10 cursor-pointer group"
                  style={{ width: `${cardWidth}px` }}
                  title="" // 브라우저 기본 툴팁 방지
                >
                  <div className="bg-[#0f1629]/40 backdrop-blur-sm rounded-xl overflow-hidden border border-black/50 hover:border-black/70 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl h-full flex flex-col" style={{ height: '460px' }}>
                    {/* 카테고리 */}
                    <div className="px-4 pt-4 pb-2">
                      <span className="text-blue-400 text-xs font-medium">{category}</span>
                    </div>
                    
                    {/* 썸네일 */}
                    <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: '16/9' }}>
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          loading="lazy"
                          decoding="async"
                          alt={v.title || 'Video'}
                          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          onLoad={() => {
                            if (index === 0) {
                              console.log('[ThemeSlider] First image loaded successfully:', thumbnailUrl)
                            }
                          }}
                          onError={(e) => {
                            console.error('[ThemeSlider] Image load error:', {
                              thumbnailUrl,
                              videoId,
                              index
                            })
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-900/80 to-purple-900/80 flex items-center justify-center">
                          <span className="text-white/40 text-sm">썸네일 없음</span>
                        </div>
                      )}
                      {/* 평점 배지 */}
                      <div className="absolute top-2 right-2 flex items-center space-x-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full z-10">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-white text-xs font-bold">{rating}</span>
                      </div>
                      {/* 그라데이션 오버레이 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    </div>
                    
                    {/* 제목과 설명 */}
                    <div className="px-4 py-4 flex-1 flex flex-col">
                      <h3 className="text-white font-bold text-base leading-tight line-clamp-2 mb-3">
                        {v.title || '제목 없음'}
                      </h3>
                      <p className="text-white/70 text-sm leading-relaxed line-clamp-3">
                        {description.length > 120 ? `${description.substring(0, 120)}...` : description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* 오른쪽 화살표 */}
      <button
        onClick={slideNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-3 text-white transition-all shadow-lg"
        disabled={isTransitioning}
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  )
}

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

            {/* 가로 슬라이더 카드 리스트 - VideoDetail.jsx 구조 적용 */}
            {(() => {
              console.log('[ThemeRecommendationSection] About to render ThemeSlider for theme:', theme.name, {
                videosCount: theme.videos?.length || 0,
                hasVideos: !!(theme.videos && theme.videos.length > 0)
              })
              return <ThemeSlider theme={theme} cardWidth={320} gap={24} visibleCards={4} />
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThemeRecommendationSection
