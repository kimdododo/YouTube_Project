import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import VideoCard from './VideoCard'
import TrendCard from './TrendCard'
import DetailedVideoCard from './DetailedVideoCard'
import Logo from './Logo'
import { getRecommendedVideos, getTrendVideos, getMostLikedVideos } from '../api/videos'
import { getAllChannels } from '../api/channels'
import { optimizeThumbnailUrl, getOptimizedImageStyles, handleImageLoadQuality } from '../utils/imageUtils'

// 스크롤 애니메이션 훅
function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [])

  return [ref, isVisible]
}

// 애니메이션 래퍼 컴포넌트
function AnimatedSection({ children, delay = 0, animationType = 'fadeUp' }) {
  const [ref, isVisible] = useScrollAnimation()

  const animationStyles = {
    fadeUp: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
      transition: `all 0.8s ease-out ${delay}s`
    },
    fadeIn: {
      opacity: isVisible ? 1 : 0,
      transition: `opacity 0.8s ease-out ${delay}s`
    },
    slideLeft: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateX(0)' : 'translateX(-50px)',
      transition: `all 0.8s ease-out ${delay}s`
    },
    slideRight: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateX(0)' : 'translateX(50px)',
      transition: `all 0.8s ease-out ${delay}s`
    },
    scale: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'scale(1)' : 'scale(0.9)',
      transition: `all 0.8s ease-out ${delay}s`
    }
  }

  return (
    <div ref={ref} style={animationStyles[animationType]}>
      {children}
    </div>
  )
}

// 반응형 별 필드 컴포넌트
function StarField() {
  const [stars, setStars] = useState([])
  const containerRef = useRef(null)

  useEffect(() => {
    const generateStars = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const starCount = Math.floor((width * height) / 15000) // 화면 크기에 비례한 별 개수
      
      const newStars = []
      for (let i = 0; i < starCount; i++) {
        newStars.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.3,
          twinkleDelay: Math.random() * 5,
          twinkleDuration: Math.random() * 3 + 2
        })
      }
      setStars(newStars)
    }

    generateStars()

    const handleResize = () => {
      generateStars()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite`,
            boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, ${star.opacity})`
          }}
        />
      ))}
    </div>
  )
}

// 더미 데이터 제거됨 - 실제 API 데이터만 사용

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [trendVideos, setTrendVideos] = useState([])
  const [channels, setChannels] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [error, setError] = useState(null)
  const [repThumbs, setRepThumbs] = useState({}) // { [channelId]: { url, id, isShorts } }
  const scrollContainerRef = useRef(null)
  const autoScrollRef = useRef(null)
  const trendScrollContainerRef = useRef(null)
  const trendAutoScrollRef = useRef(null)

  // 로그인 상태 체크
  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
    }
    checkLoginStatus()
    window.addEventListener('storage', checkLoginStatus)
    const interval = setInterval(checkLoginStatus, 500)
    return () => {
      window.removeEventListener('storage', checkLoginStatus)
      clearInterval(interval)
    }
  }, [])

  // API에서 실제 데이터 가져오기 (컴포넌트 마운트 시 즉시 실행)
  useEffect(() => {
    fetchVideos()
    
    // 주기적 업데이트 (30초마다)
    const interval = setInterval(fetchVideos, 30000)
    return () => {
      clearInterval(interval)
      // cleanup: 자동 스크롤 정리
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current)
      }
      if (trendAutoScrollRef.current) {
        cancelAnimationFrame(trendAutoScrollRef.current)
      }
    }
  }, [])

  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[Dashboard] Starting to fetch videos...')
      
      // 실제 API 호출 - Promise.allSettled를 사용하여 일부 실패해도 나머지 처리
      const results = await Promise.allSettled([
        getRecommendedVideos().catch(err => {
          console.error('[Dashboard] Error fetching recommended videos:', err)
          return []
        }),
        getTrendVideos().catch(err => {
          console.error('[Dashboard] Error fetching trend videos:', err)
          return []
        }),
        getMostLikedVideos(10).catch(err => {
          console.error('[Dashboard] Error fetching most liked videos:', err)
          // most-liked는 실패해도 무시 (추가 기능이므로)
          return []
        }),
        getAllChannels(0, 4).catch(err => {
          console.error('[Dashboard] Error fetching channels:', err)
          return []
        })
      ])

      // 결과 추출 (성공한 것만 사용)
      const recommended = results[0].status === 'fulfilled' ? (results[0].value || []) : []
      const trends = results[1].status === 'fulfilled' ? (results[1].value || []) : []
      const mostLiked = results[2].status === 'fulfilled' ? (results[2].value || []) : []
      const channelsData = results[3].status === 'fulfilled' ? (results[3].value || []) : []

      console.log('[Dashboard] Fetched videos:', {
        recommended: recommended.length,
        trends: trends.length,
        mostLiked: mostLiked.length,
        channels: channelsData.length
      })

      // 에러 체크: 모든 API가 실패한 경우
      if (results[0].status === 'rejected' && results[1].status === 'rejected') {
        const errorMsg = results[0].reason?.message || results[1].reason?.message || '데이터를 불러오는데 실패했습니다.'
        setError(errorMsg)
        console.error('[Dashboard] All APIs failed:', errorMsg)
      }

      // 채널 다양성 확보 + 2x2 채우기 보장
      const diversifyWithFallback = (items, targetCount = 4, initialMaxPerChannel = 1) => {
        if (!items || items.length === 0) return []
        const pick = (maxPerChannel) => {
          const seen = new Map()
          const out = []
          for (const it of items) {
            const chId = it.channel_id || it.channelId || 'unknown'
            const cnt = seen.get(chId) || 0
            if (cnt < maxPerChannel) {
              out.push(it)
              seen.set(chId, cnt + 1)
              if (out.length >= targetCount) break
            }
          }
          return out
        }
        // 1) 채널별 1개 시도
        let result = pick(initialMaxPerChannel)
        // 2) 모자라면 채널별 2개로 완화
        if (result.length < targetCount) {
          result = pick(initialMaxPerChannel + 1)
        }
        // 3) 그래도 모자라면 남은 아이템으로 채우기
        if (result.length < targetCount) {
          const ids = new Set(result.map(v => v.id))
          for (const it of items) {
            if (!ids.has(it.id)) {
              result.push(it)
              ids.add(it.id)
              if (result.length >= targetCount) break
            }
          }
        }
        return result
      }

      setRecommendedVideos(diversifyWithFallback(recommended, 4, 1))
      setTrendVideos(diversifyWithFallback(trends, 4, 1))
      setChannels(channelsData)

      // 채널 대표 썸네일 비동기 프리패치 (선택적 기능 - 실패해도 앱은 정상 작동)
      // TODO: 브라우저 캐시 문제 해결 후 활성화
      // if (channelsData && channelsData.length > 0) {
      //   prefetchRepresentativeThumbnails(channelsData)
      // }
      
      // 좋아요가 많은 영상 중 상위 4개를 featuredVideos로 사용 (더 많은 좋아요 영상 우선)
      if (mostLiked && mostLiked.length > 0) {
        // recommended와 mostLiked를 합쳐 채널 다양성을 유지하면서 4개 보장
        const combined = diversifyWithFallback([...(recommended || []), ...mostLiked], 4, 1)
        combined.sort((a, b) => {
          const aLikes = parseInt(a.likes?.replace(/[^0-9]/g, '') || '0')
          const bLikes = parseInt(b.likes?.replace(/[^0-9]/g, '') || '0')
          return bLikes - aLikes
        })
        setRecommendedVideos(combined)
      }
    } catch (error) {
      console.error('[Dashboard] Unexpected error in fetchVideos:', error)
      setError(error.message || '데이터를 불러오는데 실패했습니다.')
      // API 실패 시 빈 배열 (더미 데이터 사용 안 함)
      setRecommendedVideos([])
      setTrendVideos([])
    } finally {
      setLoading(false)
      console.log('[Dashboard] Finished fetching videos, loading:', false)
    }
  }

  // 채널 대표 영상 썸네일 프리패치
  const prefetchRepresentativeThumbnails = async (channelList) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      // 브라우저에서는 항상 프록시 경로(/api) 사용
      // Docker 서비스 이름(backend:8000)은 브라우저에서 직접 사용할 수 없음
      // 환경 변수가 설정되어 있어도 무시하고 항상 상대 경로 사용
      // 현재 origin을 명시적으로 사용하여 프록시 경로 보장
      const origin = window.location.origin // http://localhost:5173
      const apiPath = '/api' // 상대 경로
      
      console.log('[Dashboard] prefetchRepresentativeThumbnails - origin:', origin, 'apiPath:', apiPath)

      const fetches = channelList.map((ch) => {
        const cid = ch.channel_id || ch.id
        if (!cid) return Promise.resolve({ cid: null, url: null })
        
        // 상대 경로를 명시적으로 생성 (절대 URL 생성 방지)
        const queryString = `?channel_id=${encodeURIComponent(cid)}&limit=1`
        const relativeUrl = `${apiPath}/videos${queryString}`
        
        // 절대 URL이 아닌지 확인
        if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
          console.error('[Dashboard] ERROR: URL is absolute when it should be relative:', relativeUrl)
          return Promise.resolve({ cid, url: null, id: null, isShorts: false })
        }
        
        // 상대 경로만 사용 (fetch는 현재 origin에 자동으로 추가됨)
        // 마지막 검증: 절대 URL이 아닌지 확인
        const finalUrl = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`
        if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
          console.error('[Dashboard] CRITICAL: finalUrl is still absolute:', finalUrl)
          return Promise.resolve({ cid, url: null, id: null, isShorts: false })
        }
        
        console.log('[Dashboard] Fetching thumbnail - finalUrl:', finalUrl, 'origin:', origin, 'full will be:', origin + finalUrl)
        return fetch(finalUrl, {
          signal: controller.signal
        })
          .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
          .then(data => {
            const v = data?.videos?.[0]
            if (!v) return { cid, url: null, id: null, isShorts: false }
            const repUrl = optimizeThumbnailUrl(v.thumbnail_url, v.id, v.is_shorts || false)
            return { cid, url: repUrl, id: v.id, isShorts: !!v.is_shorts }
          })
          .catch((err) => {
            // 네트워크 에러는 조용히 무시 (선택적 기능이므로)
            if (err.name === 'AbortError') {
              console.log('[Dashboard] Thumbnail fetch aborted for channel:', cid)
            } else if (err.message?.includes('backend:8000') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
              console.warn('[Dashboard] Thumbnail fetch failed (backend:8000 issue, likely cache):', cid)
            } else {
              console.warn('[Dashboard] Thumbnail fetch failed for channel:', cid, err.message)
            }
            return { cid, url: null, id: null, isShorts: false }
          })
      })

      const results = await Promise.allSettled(fetches)
      clearTimeout(timeoutId)

      const map = {}
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value && r.value.cid) {
          map[r.value.cid] = { url: r.value.url, id: r.value.id, isShorts: r.value.isShorts }
        }
      })
      if (Object.keys(map).length > 0) {
        setRepThumbs(prev => ({ ...prev, ...map }))
      }
    } catch (e) {
      // 전체 함수 실패도 조용히 무시 (선택적 기능)
      console.warn('[Dashboard] prefetchRepresentativeThumbnails error (ignored):', e.message)
    }
  }

  // 화면 표시용 배열 (타입에 관계없이 앞에서 4개 사용)
  const displayRecs = (recommendedVideos || []).slice(0, 4)
  const displayTrends = (trendVideos || []).slice(0, 4)

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #090E29 0%, #0E1435 50%, #090E29 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* 밤하늘 별 배경 - 반응형 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{
        background: 'linear-gradient(180deg, #090E29 0%, #0E1435 50%, #090E29 100%)',
        zIndex: 0
      }}>
        {/* 동적 별 생성 */}
        <StarField />
      </div>

      {/* 별 깜빡임 애니메이션 */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { 
            opacity: 0.3;
            transform: scale(1);
          }
          50% { 
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>

      {/* Header */}
      <header className="relative z-10" style={{
        padding: '12px 16px 1px',
        height: '65px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          width: '990px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '40px'
        }}>
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Logo size="w-10 h-10" />
            <span 
              className="text-white font-bold leading-6" 
              style={{ 
                fontSize: '16px',
                lineHeight: '24px',
                color: '#FFFFFF',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              여유
            </span>
          </Link>
          <nav className="flex items-center gap-6" style={{ height: '24px', fontFamily: 'Arial, sans-serif' }}>
            <Link 
              to="/recommendedVideos" 
              className="font-bold leading-6" 
              style={{ 
                fontSize: '16px',
                lineHeight: '24px',
                color: 'rgba(147, 197, 253, 1)',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              개인 맞춤 영상 추천
            </Link>
            <Link 
              to="/find-channel" 
              className="font-bold leading-6" 
              style={{ 
                fontSize: '16px',
                lineHeight: '24px',
                color: 'rgba(147, 197, 253, 1)',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              채널 찾기
            </Link>
            <Link 
              to="/travel-trends" 
              className="font-bold leading-6" 
              style={{ 
                fontSize: '16px',
                lineHeight: '24px',
                color: 'rgba(147, 197, 253, 1)',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              여행 트렌드
            </Link>
            {/* 여행 계획 링크 제거 */}
{isLoggedIn ? (
              <Link 
                to="/mypage" 
                className="font-bold leading-6 flex items-center" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                <User className="w-4 h-4 mr-1" />
                마이페이지
              </Link>
            ) : (
              <Link 
                to="/login" 
                className="font-bold leading-6 flex items-center" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                로그인하기
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10" style={{
        width: '1200px',
        margin: '0 auto',
        padding: '0 16px'
      }}>
        {/* Hero Section - CSS 스펙에 맞게 */}
        <AnimatedSection animationType="fadeUp" delay={0}>
          <div className="mb-24" style={{
            width: '100%',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '30px',
            marginBottom: '30px',
            padding: '60px 0'
          }}>
            <AnimatedSection animationType="scale" delay={0.3}>
              <h1 className="font-bold text-white text-center" style={{
                fontSize: '42px',
                lineHeight: '52px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontFamily: 'Arial, sans-serif',
                margin: '0 auto',
                letterSpacing: '-1px',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
              }}>
                AI가 추천하는 맞춤형 여행 영상으로<br />
                당신의 다음 여행을 계획하세요.
              </h1>
            </AnimatedSection>
          </div>
        </AnimatedSection>

        {/* Personalized Video Recommendations Section */}
        <AnimatedSection animationType="fadeUp" delay={0}>
          <section className="mb-8 py-4" style={{ 
            minHeight: '30px',
            marginTop: '30px'
          }}>
            {/* 제목/설명과 카드들을 가로로 배치 */}
            <div className="flex items-start gap-4 mb-20">
              {/* 왼쪽: 제목 및 설명 */}
              <AnimatedSection animationType="slideLeft" delay={0.2}>
                <div className="flex-shrink-0" style={{ width: '229.5px' }}>
                  <h2 className="font-bold text-white mb-4" style={{
                    fontSize: '20px',
                    lineHeight: '28px',
                    color: '#FFFFFF',
                    letterSpacing: '-0.5px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    개인 맞춤 영상 추천
                  </h2>
                  <p style={{
                    fontSize: '16px',
                    lineHeight: '24px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    AI가 분석한 당신만을 위한 맞춤 여행 영상을 만나보세요.
                  </p>
                </div>
              </AnimatedSection>

              {/* 오른쪽: 2x2 그리드 카드들 */}
              <AnimatedSection animationType="slideRight" delay={0.3}>
                <div className="flex-1 overflow-hidden">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="text-blue-300 animate-pulse">데이터를 불러오는 중...</div>
                      <div className="text-blue-200 text-sm mt-2">잠시만 기다려주세요...</div>
                    </div>
                  ) : error ? (
                    <div className="text-center py-8">
                      <div className="text-red-400 mb-2">{error}</div>
                      <button 
                        onClick={fetchVideos}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        다시 시도
                      </button>
                    </div>
                  ) : displayRecs.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-blue-300">추천 영상이 없습니다.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-8">
                      {displayRecs.slice(0, 4).map((video) => (
                        <div key={video.id} className="w-full">
                          <VideoCard video={video} featured />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AnimatedSection>
            </div>

            {/* Second Row - 추천 영상 (왼쪽 2x2 카드, 오른쪽 텍스트) */}
            <AnimatedSection animationType="fadeUp" delay={0.5}>
              <div className="mb-20" style={{ marginTop: '40px' }}>
                <div className="flex items-start gap-8">
                  {/* 왼쪽: 2x2 추천 영상 카드 그리드 */}
                  <AnimatedSection animationType="slideLeft" delay={0.2}>
                    <div className="flex-1">
                      {!loading && displayRecs.length >= 4 ? (
                        <div className="grid grid-cols-2 gap-10" style={{ minWidth: '900px' }}>
                          {displayRecs.slice(0, 4).map((video, index) => (
                            <AnimatedSection key={video.id} animationType="fadeUp" delay={0.1 * index}>
                              <DetailedVideoCard video={video} />
                            </AnimatedSection>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-blue-300">추천 영상이 없습니다.</div>
                        </div>
                      )}
                    </div>
                  </AnimatedSection>

                  {/* 오른쪽: 제목 및 설명 */}
                  <AnimatedSection animationType="slideRight" delay={0.3}>
                    <div className="flex-shrink-0" style={{ width: '229.5px' }}>
                      <h3 className="font-semibold text-white mb-4" style={{
                        fontSize: '20px',
                        lineHeight: '28px',
                        color: '#FFFFFF',
                        fontFamily: 'Arial, sans-serif'
                      }}>
                        추천 영상
                      </h3>
                      <p style={{
                        fontSize: '16px',
                        lineHeight: '24px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontFamily: 'Arial, sans-serif'
                      }}>
                        지금 인기 있고 선호에 맞는 추천 영상을 먼저 만나보세요.
                      </p>
                      {/* CTA 버튼 제거 */}
                    </div>
                  </AnimatedSection>
                </div>
              </div>
            </AnimatedSection>
          </section>
        </AnimatedSection>


        {/* Travel Trends Section - 왼쪽 텍스트, 오른쪽 이미지 */}
        <AnimatedSection animationType="fadeUp" delay={0}>
          <section className="mb-8 py-4" style={{ 
            minHeight: '30px',
            marginTop: '30px'
          }}>
            <div className="flex items-start gap-8 mb-12">
              {/* 왼쪽: 제목 및 설명 */}
              <AnimatedSection animationType="slideLeft" delay={0.2}>
                <div className="flex-shrink-0" style={{ width: '229.5px' }}>
                  <h3 className="font-semibold text-white mb-4" style={{
                    fontSize: '20px',
                    lineHeight: '28px',
                    color: '#FFFFFF',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    여행 트렌드
                  </h3>
                  <p style={{
                    fontSize: '16px',
                    lineHeight: '24px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    지금 가장 핫한 여행 트렌드와 인기 여행지를 확인하세요.
                  </p>
                </div>
              </AnimatedSection>

              {/* 오른쪽: 2x2 그리드 카드들 */}
              <AnimatedSection animationType="slideRight" delay={0.3}>
                <div className="flex-1 overflow-hidden">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="text-blue-300">데이터를 불러오는 중...</div>
                    </div>
                  ) : trendVideos.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-blue-300">트렌드 영상이 없습니다.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-8">
                      {trendVideos.slice(0, 4).map((video) => (
                        <div key={video.id} className="w-full">
                          <VideoCard video={video} featured />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AnimatedSection>
            </div>
          </section>
        </AnimatedSection>

        {/* Travel Plan Section fully removed */}

        {/* 메인 페이지에는 로그인/회원가입 섹션 제거 */}
      </main>
    </div>
  )
}

export default Dashboard
