import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import VideoCard from './VideoCard'

/**
 * VideoCard 슬라이더 컴포넌트
 * 4열 1행 레이아웃, 마우스 호버 시 휠로 좌우 이동 가능
 */
function VideoCardSlider({ videos, cardWidth = 320, cardHeight = null, gap = 24, hideBookmark = false, themeColors = null }) {
  // 디버깅: videos prop 확인
  console.log('[VideoCardSlider] Received videos:', {
    videosCount: videos?.length || 0,
    videos: videos?.slice(0, 2).map(v => ({
      id: v.id,
      video_id: v.video_id,
      title: v.title,
      view_count: v.view_count
    }))
  })
  
  // videos가 없거나 빈 배열인 경우 조기 반환
  if (!videos || videos.length === 0) {
    console.warn('[VideoCardSlider] No videos provided:', {
      videos,
      videosType: typeof videos,
      isArray: Array.isArray(videos),
      length: videos?.length
    })
    return (
      <div className="text-center py-8 text-white/60">
        <p style={{ fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
          영상을 불러오는 중...
        </p>
      </div>
    )
  }
  
  const cardStep = cardWidth + gap
  const visibleCards = 4 // 한 번에 보여줄 카드 개수
  
  // 무한 루프를 위한 초기 인덱스 (중간 지점으로 설정)
  const getInitialIndex = () => {
    if (!videos || videos.length === 0) return 0
    const cloneCount = Math.max(visibleCards * 2, 8)
    return Math.floor(cloneCount / 2) * videos.length
  }
  
  const [currentIndex, setCurrentIndex] = useState(getInitialIndex)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const containerRef = useRef(null)
  const sliderRef = useRef(null)
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0, currentIndex: 0 })

  // 무한 루프를 위한 실제 인덱스 계산
  const getRealIndex = (index) => {
    if (videos.length === 0) return 0
    return ((index % videos.length) + videos.length) % videos.length
  }

  const slideNext = () => {
    if (isTransitioning || videos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      // 무한 루프: 다음 인덱스로 이동
      return prev + 1
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

  const slidePrev = () => {
    if (isTransitioning || videos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      // 무한 루프: 이전 인덱스로 이동
      return prev - 1
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

  // videos가 변경되면 초기 인덱스로 리셋
  useEffect(() => {
    if (videos && videos.length > 0) {
      const initialIndex = getInitialIndex()
      setCurrentIndex(initialIndex)
      dragStateRef.current.currentIndex = initialIndex
    }
  }, [videos])

  // 현재 인덱스를 ref에 동기화
  useEffect(() => {
    dragStateRef.current.currentIndex = currentIndex
  }, [currentIndex])

  // 마우스 드래그 시작
  const handleMouseDown = (e) => {
    if (!sliderRef.current) return
    e.preventDefault()
    setIsDragging(true)
    setIsTransitioning(false)
    const rect = sliderRef.current.getBoundingClientRect()
    const startXValue = e.clientX - rect.left
    const scrollLeftValue = dragStateRef.current.currentIndex * cardStep
    setStartX(startXValue)
    setScrollLeft(scrollLeftValue)
    dragStateRef.current.startX = startXValue
    dragStateRef.current.scrollLeft = scrollLeftValue
  }

  // 전역 마우스 이벤트 리스너
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalMouseMove = (e) => {
      if (!sliderRef.current) return
      e.preventDefault()
      const rect = sliderRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const walk = (x - dragStateRef.current.startX) * 1.5
      // 무한 루프를 위해 인덱스 제한 없음
      const newIndex = Math.round((dragStateRef.current.scrollLeft - walk) / cardStep)
      
      if (newIndex !== dragStateRef.current.currentIndex) {
        setCurrentIndex(newIndex)
      }
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      setIsTransitioning(true)
      setTimeout(() => setIsTransitioning(false), 100)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false })
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, videos.length, cardStep, visibleCards])

  // 마우스 휠 이벤트 핸들러 (좌우 스크롤)
  // passive event listener 문제 해결을 위해 useEffect로 직접 등록
  useEffect(() => {
    if (!sliderRef.current || !videos || videos.length === 0) return

    const handleWheel = (e) => {
      if (!sliderRef.current) return
      
      const delta = e.deltaY || e.deltaX
      if (Math.abs(delta) < 10) return // 너무 작은 움직임은 무시
      
      if (isTransitioning) return
      
      // preventDefault는 passive: false일 때만 가능
      e.preventDefault()
      e.stopPropagation()
      
      setIsTransitioning(true)
      
      if (delta > 0) {
        // 아래로 스크롤 = 오른쪽으로 이동
        slideNext()
      } else {
        // 위로 스크롤 = 왼쪽으로 이동
        slidePrev()
      }
      
      setTimeout(() => setIsTransitioning(false), 500)
    }

    const element = sliderRef.current
    // passive: false로 등록하여 preventDefault 사용 가능
    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [isTransitioning, slideNext, slidePrev, videos])

  // 터치 이벤트 지원
  const handleTouchStart = (e) => {
    if (!sliderRef.current) return
    setIsDragging(true)
    setIsTransitioning(false)
    const rect = sliderRef.current.getBoundingClientRect()
    const startXValue = e.touches[0].clientX - rect.left
    const scrollLeftValue = dragStateRef.current.currentIndex * cardStep
    setStartX(startXValue)
    setScrollLeft(scrollLeftValue)
    dragStateRef.current.startX = startXValue
    dragStateRef.current.scrollLeft = scrollLeftValue
  }

  const handleTouchMove = (e) => {
    if (!isDragging || !sliderRef.current) return
    e.preventDefault()
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.touches[0].clientX - rect.left
    const walk = (x - dragStateRef.current.startX) * 1.5
    // 무한 루프를 위해 인덱스 제한 없음
    const newIndex = Math.round((dragStateRef.current.scrollLeft - walk) / cardStep)
    
    if (newIndex !== dragStateRef.current.currentIndex) {
      setCurrentIndex(newIndex)
    }
  }

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false)
      setIsTransitioning(true)
      setTimeout(() => setIsTransitioning(false), 100)
    }
  }

  // videos가 없거나 빈 배열인 경우 조기 반환
  if (!videos || videos.length === 0) {
    console.warn('[VideoCardSlider] No videos provided:', {
      videos,
      videosType: typeof videos,
      isArray: Array.isArray(videos),
      length: videos?.length
    })
    return (
      <div className="text-center py-8 text-white/60">
        <p style={{ fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
          영상을 불러오는 중...
        </p>
      </div>
    )
  }

  const totalWidth = cardWidth * visibleCards + gap * (visibleCards - 1)
  const paddingValue = `calc((100% - ${totalWidth}px) / 2)`
  
  // 테마 색상을 검은색으로 통일
  const borderColor = '#000000' // BLACK
  const glowColor = 'rgba(0, 0, 0, 0.5)' // BLACK glow
  
  // 화살표 버튼 표시 조건: 비디오가 4개 이상이면 항상 표시
  const showArrows = videos.length > visibleCards
  // 무한 루프이므로 항상 활성화
  const canGoPrev = true
  const canGoNext = true
  
  // 무한 루프를 위한 실제 표시 인덱스 계산
  const displayIndex = getRealIndex(currentIndex)

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* 왼쪽 화살표 - 무한 루프이므로 항상 활성화 */}
      {showArrows && (
        <button
          onClick={slidePrev}
          disabled={isTransitioning}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full p-3 text-white transition-all bg-black/80 hover:bg-black/95 cursor-pointer shadow-lg hover:shadow-xl"
          style={{
            transform: 'translateY(-50%)',
            transition: 'all 0.3s ease',
            opacity: isTransitioning ? 0.7 : 1
          }}
        >
          <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      )}

      {/* 슬라이더 컨테이너 */}
      <div 
        ref={sliderRef}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none rounded-lg"
        style={{ 
          height: cardHeight ? `${cardHeight + 20}px` : '280px', 
          userSelect: 'none',
          paddingLeft: paddingValue,
          paddingRight: paddingValue,
          border: 'none',
          boxShadow: 'none',
          marginLeft: showArrows ? '48px' : '0',
          marginRight: showArrows ? '48px' : '0'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex"
          style={{
            gap: `${gap}px`,
            transform: `translateX(-${currentIndex * cardStep}px)`,
            transition: isTransitioning && !isDragging 
              ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
              : 'none',
            willChange: 'transform'
          }}
        >
          {/* 카드 렌더링 (무한 루프를 위해 충분한 수의 카드 복제) */}
          {(() => {
            // 무한 루프를 위해 카드를 여러 번 복제
            const cloneCount = Math.max(visibleCards * 2, 8) // 최소 8개씩 복제
            const totalCards = videos.length * cloneCount
            const startOffset = Math.floor(cloneCount / 2) * videos.length
            
            return Array.from({ length: totalCards }, (_, i) => {
              const videoIndex = i % videos.length
              const video = videos[videoIndex]
              const actualIndex = i - startOffset
              const isVisible = actualIndex >= currentIndex && actualIndex < currentIndex + visibleCards
              
              return (
                <div 
                  key={`${video.id || video.video_id}-${i}`}
                  className="flex-shrink-0 transition-all duration-300 hover:z-10"
                  style={{ width: `${cardWidth}px` }}
                >
                  <VideoCard 
                    video={video} 
                    featured={false}
                    hideBookmark={hideBookmark} 
                    active={isVisible}
                    themeColors={themeColors}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                  />
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* 오른쪽 화살표 - 무한 루프이므로 항상 활성화 */}
      {showArrows && (
        <button
          onClick={slideNext}
          disabled={isTransitioning}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full p-3 text-white transition-all bg-black/80 hover:bg-black/95 cursor-pointer shadow-lg hover:shadow-xl"
          style={{
            transform: 'translateY(-50%)',
            transition: 'all 0.3s ease',
            opacity: isTransitioning ? 0.7 : 1
          }}
        >
          <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      )}
    </div>
  )
}

export default VideoCardSlider

