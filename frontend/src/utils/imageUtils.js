/**
 * 이미지 관련 유틸리티 함수
 */

/**
 * YouTube 썸네일 URL을 고화질 버전으로 변환
 * @param {string} thumbnailUrl - 원본 썸네일 URL
 * @param {string} videoId - YouTube 비디오 ID
 * @param {boolean} isShorts - YouTube Shorts 여부
 * @returns {string} 고화질 썸네일 URL
 */
export const getHighQualityThumbnail = (thumbnailUrl, videoId, isShorts = false) => {
  if (!videoId) return thumbnailUrl

  // YouTube 썸네일 URL 패턴 확인
  // 기본 패턴: https://i.ytimg.com/vi/{VIDEO_ID}/{QUALITY}.jpg
  // 또는: https://img.youtube.com/vi/{VIDEO_ID}/{QUALITY}.jpg
  
  // 원본 URL이 유효한 YouTube URL인 경우 우선 사용
  if (thumbnailUrl && (thumbnailUrl.includes('ytimg.com') || thumbnailUrl.includes('youtube.com'))) {
    // 이미 고화질 URL인 경우 그대로 반환
    if (thumbnailUrl.includes('maxresdefault') || thumbnailUrl.includes('sddefault') || thumbnailUrl.includes('hqdefault')) {
      return thumbnailUrl
    }
    // 원본 URL이 유효한 YouTube URL이면 그대로 사용 (백엔드에서 제공한 URL 신뢰)
    // 단, 기본 화질(default.jpg)인 경우에만 업그레이드
    if (!thumbnailUrl.includes('/default.jpg') && !thumbnailUrl.includes('/mqdefault.jpg')) {
      return thumbnailUrl
    }
  }

  // YouTube 썸네일 URL 생성 (최고 화질)
  // maxresdefault: 1280x720 (가장 높은 화질, 일반 동영상용) - 모든 비디오에서 지원되지 않음
  // sddefault: 640x480 (표준 화질, Shorts에도 제공됨) - 더 안정적
  // hqdefault: 480x360 (높은 화질)
  // mqdefault: 320x180 (중간 화질)
  // default: 120x90 (기본 화질)
  
  // videoId 추출 (URL에서 또는 직접 전달)
  let extractedVideoId = videoId
  
  if (thumbnailUrl && thumbnailUrl.includes('ytimg.com')) {
    // URL에서 videoId 추출
    const match = thumbnailUrl.match(/vi\/([^\/]+)/)
    if (match) {
      extractedVideoId = match[1]
    }
  }

  // YouTube Shorts의 경우 sddefault 사용 (maxresdefault가 없을 수 있음)
  if (isShorts) {
    return `https://i.ytimg.com/vi/${extractedVideoId}/sddefault.jpg`
  }

  // 일반 동영상의 경우 sddefault를 기본값으로 사용 (maxresdefault보다 안정적)
  // maxresdefault는 모든 비디오에서 지원되지 않아 404 오류가 발생할 수 있음
  return `https://i.ytimg.com/vi/${extractedVideoId}/sddefault.jpg`
}

/**
 * 로드된 이미지 품질을 확인하고 필요 시 더 적합한 썸네일로 폴백
 * - maxresdefault가 회색/저해상(보통 120x90~320x180)으로 반환되는 경우가 있어 onLoad에서 교체
 * @param {Event} event - 이미지 onLoad 이벤트
 * @param {string} videoId - YouTube 비디오 ID
 * @param {boolean} isShorts - Shorts 여부
 */
export const handleImageLoadQuality = (event, videoId, isShorts = false) => {
  try {
    if (!videoId) return
    const img = event.target
    const width = img.naturalWidth || 0
    const src = img.currentSrc || img.src || ''

    // Shorts는 sddefault가 최선인 경우가 많음
    if (isShorts) {
      if (!src.includes('sddefault')) {
        img.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
      }
      return
    }

    // maxres가 불가하여 아주 작은 해상도로 올 경우 sddefault로 다운그레이드
    if (src.includes('maxresdefault') && width < 600) {
      img.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
      return
    }

    // sddefault도 충분치 않은 경우 hqdefault로 한 번 더 시도 (일부 환경에서 더 선명)
    if (src.includes('sddefault') && width < 400) {
      img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      return
    }

    // 여전히 저해상도면 0.jpg로 최종 폴백 (항상 제공됨)
    if ((src.includes('hqdefault') || src.includes('maxresdefault') || src.includes('sddefault')) && width < 200) {
      img.src = `https://i.ytimg.com/vi/${videoId}/0.jpg`
      return
    }
  } catch (_) { /* no-op */ }
}

/**
 * 이미지 렌더링을 위한 최적화된 스타일 객체 반환
 * @returns {Object} 최적화된 CSS 스타일 객체
 */
export const getOptimizedImageStyles = () => {
  return {
    imageRendering: 'crisp-edges', // 선명한 렌더링
    WebkitImageRendering: '-webkit-optimize-contrast', // WebKit 최적화
    backfaceVisibility: 'hidden', // 3D 변환 최적화
    transform: 'translateZ(0)', // GPU 가속 활성화
    WebkitFontSmoothing: 'antialiased', // 폰트 안티앨리어싱
    willChange: 'transform', // 성능 최적화 힌트
    msInterpolationMode: 'bicubic', // IE 최적화
    imageOrientation: 'from-image', // 이미지 방향 유지
    objectFit: 'cover', // 이미지 커버 모드
    objectPosition: 'center' // 이미지 중앙 정렬
  }
}

/**
 * 이미지 로드 실패 시 고화질 버전으로 재시도
 * @param {Event} event - 이미지 onError 이벤트
 * @param {string} videoId - YouTube 비디오 ID
 * @param {boolean} isShorts - YouTube Shorts 여부
 */
export const handleImageError = (event, videoId, isShorts = false) => {
  if (!videoId) return
  
  const img = event.target
  const currentSrc = img.src
  
  // 무한 루프 방지: 이미 여러 버전을 시도했으면 중단
  if (currentSrc.includes('maxresdefault')) {
    // maxresdefault 실패 시 sddefault로 폴백
    if (!currentSrc.includes('sddefault')) {
      img.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
      return
    }
  }
  
  if (currentSrc.includes('sddefault')) {
    // sddefault도 실패하면 hqdefault로 재시도
    if (!currentSrc.includes('hqdefault')) {
      img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      return
    }
  }
  
  if (currentSrc.includes('hqdefault')) {
    // hqdefault도 실패하면 0.jpg로 최종 폴백 (항상 제공됨)
    if (!currentSrc.includes('/0.jpg')) {
      img.src = `https://i.ytimg.com/vi/${videoId}/0.jpg`
      return
    }
  }
  
  // 0.jpg도 실패하면 placeholder 표시
  if (currentSrc.includes('/0.jpg')) {
    img.style.display = 'none'
    return
  }
  
  // 기타 경우: 고화질 버전으로 재시도
  const highQualityUrl = getHighQualityThumbnail(currentSrc, videoId, isShorts)
  if (highQualityUrl !== currentSrc) {
    img.src = highQualityUrl
  } else {
    // 이미 최적화된 URL인데 실패한 경우 0.jpg로 폴백
    img.src = `https://i.ytimg.com/vi/${videoId}/0.jpg`
  }
}

/**
 * 썸네일 URL 최적화 (여러 소스 확인)
 * @param {string} thumbnailUrl - 원본 썸네일 URL
 * @param {string} videoId - YouTube 비디오 ID
 * @param {boolean} isShorts - YouTube Shorts 여부
 * @returns {string} 최적화된 썸네일 URL
 */
export const optimizeThumbnailUrl = (thumbnailUrl, videoId, isShorts = false) => {
  if (!videoId) {
    // videoId가 없으면 원본 thumbnailUrl 반환 (없으면 null)
    return thumbnailUrl || null
  }
  
  // 원본 thumbnailUrl이 유효한 YouTube URL인 경우 우선 사용
  // 백엔드에서 제공한 URL을 신뢰하고, 필요할 때만 고화질 URL 생성
  if (thumbnailUrl && (thumbnailUrl.includes('ytimg.com') || thumbnailUrl.includes('youtube.com'))) {
    // 이미 고화질 URL이거나 유효한 URL이면 그대로 사용
    if (thumbnailUrl.includes('maxresdefault') || 
        thumbnailUrl.includes('sddefault') || 
        thumbnailUrl.includes('hqdefault') ||
        (!thumbnailUrl.includes('/default.jpg') && !thumbnailUrl.includes('/mqdefault.jpg'))) {
      return thumbnailUrl
    }
  }
  
  // 원본 URL이 없거나 저화질인 경우에만 고화질 URL 생성
  return getHighQualityThumbnail(thumbnailUrl, videoId, isShorts)
}

