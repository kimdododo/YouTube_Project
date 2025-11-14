import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import VideoCard from './VideoCard'

/**
 * VideoCard 슬라이더 컴포넌트
 * 마우스 드래그 및 화살표 버튼으로 좌우 이동 가능
 */
function VideoCardSlider({ videos, cardWidth = 320, gap = 24, hideBookmark = false }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const containerRef = useRef(null)
  const sliderRef = useRef(null)
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0, currentIndex: 0 })

  const cardStep = cardWidth + gap

  const slideNext = () => {
    if (isTransitioning || videos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      const nextIndex = prev + 1
      return nextIndex >= videos.length ? 0 : nextIndex
    })
    setTimeout(() => setIsTransitioning(false), 500)
  }

  const slidePrev = () => {
    if (isTransitioning || videos.length === 0) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => {
      const prevIndex = prev - 1
      return prevIndex < 0 ? videos.length - 1 : prevIndex
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
      const newIndex = Math.max(0, Math.min(videos.length - 1, Math.round((dragStateRef.current.scrollLeft - walk) / cardStep)))
      
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
  }, [isDragging, videos.length, cardStep])

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
    const newIndex = Math.max(0, Math.min(videos.length - 1, Math.round((dragStateRef.current.scrollLeft - walk) / cardStep)))
    
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

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* 왼쪽 화살표 */}
      <button
        onClick={slidePrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* 슬라이더 컨테이너 */}
      <div 
        ref={sliderRef}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ height: '280px', userSelect: 'none' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex gap-6 absolute top-0"
          style={{
            left: '50%',
            transform: `translateX(calc(-50% - ${currentIndex * cardStep}px))`,
            transition: isTransitioning && !isDragging 
              ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
              : 'none',
            willChange: 'transform'
          }}
        >
          {/* 무한루프를 위한 카드 복제 */}
          {[...videos, ...videos, ...videos].map((video, index) => {
            const actualIndex = index % videos.length
            const isActive = actualIndex === currentIndex && 
              index >= videos.length && 
              index < videos.length * 2
            
            return (
              <div 
                key={`${video.id || video.video_id}-${index}`}
                className="flex-shrink-0 transition-all duration-300 hover:z-10"
                style={{ width: `${cardWidth}px` }}
              >
                <VideoCard video={video} featured hideBookmark={hideBookmark} active={isActive} />
              </div>
            )
          })}
        </div>
      </div>

      {/* 오른쪽 화살표 */}
      <button
        onClick={slideNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 hover:bg-black/90 rounded-full p-2 text-white transition-all"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  )
}

export default VideoCardSlider

