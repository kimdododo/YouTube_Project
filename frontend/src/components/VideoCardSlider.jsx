import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import VideoCard from './VideoCard'

/**
 * VideoCard 슬라이더 컴포넌트
 * 4열 1행 레이아웃, 마우스 호버 시 휠로 좌우 이동 가능
 */
function VideoCardSlider({ videos, cardWidth = 320, gap = 24, hideBookmark = false, themeColors = null }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const containerRef = useRef(null)
  const sliderRef = useRef(null)
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0, currentIndex: 0 })

  const cardStep = cardWidth + gap
  const visibleCards = 4 // 한 번에 보여줄 카드 개수

  const slideNext = () => {
    if (isTransitioning || videos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      const maxIndex = Math.max(0, videos.length - visibleCards)
      const nextIndex = prev + 1
      return nextIndex > maxIndex ? maxIndex : nextIndex
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

  const slidePrev = () => {
    if (isTransitioning || videos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      const prevIndex = prev - 1
      return prevIndex < 0 ? 0 : prevIndex
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

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
      const maxIndex = Math.max(0, videos.length - visibleCards)
      const newIndex = Math.max(0, Math.min(maxIndex, Math.round((dragStateRef.current.scrollLeft - walk) / cardStep)))
      
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
  const handleWheel = (e) => {
    if (!sliderRef.current) return
    e.preventDefault()
    
    const delta = e.deltaY || e.deltaX
    if (Math.abs(delta) < 10) return // 너무 작은 움직임은 무시
    
    if (isTransitioning) return
    
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
    const maxIndex = Math.max(0, videos.length - visibleCards)
    const newIndex = Math.max(0, Math.min(maxIndex, Math.round((dragStateRef.current.scrollLeft - walk) / cardStep)))
    
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

  if (!videos || videos.length === 0) {
    return null
  }

  const maxIndex = Math.max(0, videos.length - visibleCards)
  const totalWidth = cardWidth * visibleCards + gap * (visibleCards - 1)
  const paddingValue = `calc((100% - ${totalWidth}px) / 2)`
  
  // 테마 색상이 없으면 기본 색상 사용
  const borderColor = themeColors?.borderColor || '#60A5FA'
  const glowColor = themeColors?.glowColor || 'rgba(96, 165, 250, 0.5)'

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* 왼쪽 화살표 */}
      {currentIndex > 0 && (
        <button
          onClick={slidePrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* 슬라이더 컨테이너 */}
      <div 
        ref={sliderRef}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none rounded-lg"
        style={{ 
          height: '280px', 
          userSelect: 'none',
          paddingLeft: paddingValue,
          paddingRight: paddingValue
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
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
          {/* 카드 렌더링 (4열 1행) */}
          {videos.map((video, index) => {
            const isVisible = index >= currentIndex && index < currentIndex + visibleCards
            
            return (
              <div 
                key={`${video.id || video.video_id}-${index}`}
                className="flex-shrink-0 transition-all duration-300 hover:z-10"
                style={{ width: `${cardWidth}px` }}
              >
                <VideoCard 
                  video={video} 
                  featured 
                  hideBookmark={hideBookmark} 
                  active={isVisible}
                  themeColors={themeColors}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* 오른쪽 화살표 */}
      {currentIndex < maxIndex && (
        <button
          onClick={slideNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}

export default VideoCardSlider

