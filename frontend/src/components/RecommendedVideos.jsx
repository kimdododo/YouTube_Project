import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import VideoCard from './VideoCard'
import Logo from './Logo'
import { getPersonalizedRecommendations, getRecommendedVideos, getTrendVideos, getMostLikedVideos, getAllVideos, getDiversifiedVideos } from '../api/videos'

function RecommendedVideos() {
  const [loading, setLoading] = useState(true)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [usePersonalized, setUsePersonalized] = useState(true) // 개인 맞춤 추천 사용 여부
  const [visibleCount, setVisibleCount] = useState(8) // 2x2 단위로 표시 (8부터 시작)
  const [sentinelRef, setSentinelRef] = useState(null)
  const [error, setError] = useState(null) // 에러 상태 추가

  // 로그인 상태 체크
  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
    }
    checkLoginStatus()
    // storage 이벤트 리스너 추가 (다른 탭에서 로그인/로그아웃 시)
    window.addEventListener('storage', checkLoginStatus)
    // 주기적으로 체크 (같은 탭에서 상태 변경 감지)
    const interval = setInterval(checkLoginStatus, 500)
    return () => {
      window.removeEventListener('storage', checkLoginStatus)
      clearInterval(interval)
    }
  }, [])

  // API에서 실제 데이터 가져오기
  useEffect(() => {
    fetchVideos()
    // 주기적 업데이트 (60초마다 - 개인 맞춤 추천은 자주 업데이트할 필요 없음)
    const interval = setInterval(fetchVideos, 60000)
    return () => clearInterval(interval)
  }, [usePersonalized])

  // 스크롤 하단 도달 시 자동으로 더 불러오기 (2x2 단위)
  useEffect(() => {
    if (!sentinelRef) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleCount((c) => c + 4) // 2x2 단위 증가
        }
      })
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef)
    return () => observer.disconnect()
  }, [sentinelRef])

  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[RecommendedVideos] Starting to fetch videos...')
      
      // 사용자 선호도가 있으면 개인 맞춤 추천 사용
      const travelPreferences = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
      const hasPreferences = travelPreferences.length > 0
      
      let recommended = []
      
      if (usePersonalized && hasPreferences) {
        try {
          // 개인 맞춤 추천 시도
          recommended = await getPersonalizedRecommendations({}, 20)
          console.log('[RecommendedVideos] Using personalized recommendations:', recommended?.length || 0)
        } catch (personalizedError) {
          console.warn('[RecommendedVideos] Personalized recommendation failed, falling back to general:', personalizedError)
          // 개인 맞춤 추천 실패 시 일반 추천으로 폴백
          // 1순위: 채널 다양화 엔드포인트
          try {
            recommended = await getDiversifiedVideos(200, 1)
            console.log('[RecommendedVideos] Fallback diversified endpoint:', recommended?.length || 0)
          } catch (diversifiedError) {
            console.warn('[RecommendedVideos] Diversified endpoint failed, trying general:', diversifiedError)
            // 2순위: 기존 일반 추천
            recommended = await getRecommendedVideos(null, false, 100)
            console.log('[RecommendedVideos] Using general recommendation:', recommended?.length || 0)
          }
        }
      } else {
        // 랜덤 모드: 전체 풀에서 무작위 선별
        try {
          // 1순위: 채널 다양화 엔드포인트 (넉넉히 받아서 다양성 극대화)
          recommended = await getDiversifiedVideos(200, 1)
          console.log('[RecommendedVideos] Using diversified endpoint for RANDOM:', recommended?.length || 0)
        } catch (diversifiedError) {
          console.warn('[RecommendedVideos] Diversified endpoint failed, trying all videos:', diversifiedError)
          // 2순위: 전체 풀에서 무작위
          try {
            const all = await getAllVideos(0, 300)
            recommended = all || []
            console.log('[RecommendedVideos] Using RANDOM from full pool (fallback):', recommended?.length || 0)
          } catch (allError) {
            console.warn('[RecommendedVideos] All videos failed, trying general recommendation:', allError)
            // 3순위: 일반 추천
            recommended = await getRecommendedVideos(null, false, 100)
            console.log('[RecommendedVideos] Using general recommendation as last resort:', recommended?.length || 0)
          }
        }
      }
      
      // 다양성 보장 로직
      const dedupeById = (items) => {
        const seen = new Set()
        const out = []
        for (const it of items || []) {
          const id = it.id || it.video_id
          if (!id || seen.has(id)) continue
          seen.add(id)
          out.push(it)
        }
        return out
      }

      const diversifyWithFallback = (items, targetCount = 9, maxPerChannel = 1) => {
        if (!items || items.length === 0) return []
        const pick = (limitPerChannel) => {
          const seen = new Map()
          const out = []
          for (const it of items) {
            const chId = it.channel_id || it.channelId || it.channel || `unknown-${it.id || Math.random()}`
            const cnt = seen.get(chId) || 0
            if (cnt < limitPerChannel) {
              out.push(it)
              seen.set(chId, cnt + 1)
              if (out.length >= targetCount) break
            }
          }
          return out
        }
        // 1) 채널당 1개
        let result = pick(maxPerChannel)
        // 2) 모자라면 채널당 2개로 완화
        if (result.length < targetCount) {
          result = pick(maxPerChannel + 1)
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

      // 중복 제거 후 무작위 셔플
      const unique = dedupeById(recommended)
      console.log('[RecommendedVideos] After deduplication:', unique.length)
      
      for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[unique[i], unique[j]] = [unique[j], unique[i]]
      }
      
      const diversified = diversifyWithFallback(unique, 48, 1) // 내부 데이터는 넉넉히 준비
      console.log('[RecommendedVideos] Final diversified videos:', diversified.length)
      
      if (diversified.length === 0) {
        console.warn('[RecommendedVideos] No videos after diversification, checking source data...')
        console.warn('[RecommendedVideos] Source recommended array length:', recommended.length)
        if (recommended.length === 0) {
          setError('영상을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.')
        }
      }
      
      setRecommendedVideos(diversified)
      console.log('[RecommendedVideos] Set recommendedVideos state:', diversified.length)
    } catch (error) {
      console.error('[RecommendedVideos] Failed to fetch recommended videos:', error)
      setError(error.message || '영상을 불러오는데 실패했습니다.')
      setRecommendedVideos([])
    } finally {
      setLoading(false)
      // 상태 업데이트는 비동기이므로, 이 시점의 recommendedVideos는 이전 값일 수 있음
      // 실제 값은 다음 렌더링에서 확인 가능
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden">
      {/* 밤하늘 별 배경 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* 작은 별들 */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(1px 1px at 10% 20%, white, transparent),
            radial-gradient(1px 1px at 20% 30%, white, transparent),
            radial-gradient(1px 1px at 30% 40%, white, transparent),
            radial-gradient(1px 1px at 40% 50%, white, transparent),
            radial-gradient(1px 1px at 50% 60%, white, transparent),
            radial-gradient(1px 1px at 60% 70%, white, transparent),
            radial-gradient(1px 1px at 70% 80%, white, transparent),
            radial-gradient(1px 1px at 80% 10%, white, transparent),
            radial-gradient(1px 1px at 90% 20%, white, transparent),
            radial-gradient(1px 1px at 15% 50%, white, transparent),
            radial-gradient(1px 1px at 25% 60%, white, transparent),
            radial-gradient(1px 1px at 35% 70%, white, transparent),
            radial-gradient(1px 1px at 45% 80%, white, transparent),
            radial-gradient(1px 1px at 55% 90%, white, transparent),
            radial-gradient(1px 1px at 65% 15%, white, transparent),
            radial-gradient(1px 1px at 75% 25%, white, transparent),
            radial-gradient(1px 1px at 85% 35%, white, transparent),
            radial-gradient(1px 1px at 95% 45%, white, transparent),
            radial-gradient(2px 2px at 12% 25%, white, transparent),
            radial-gradient(2px 2px at 22% 35%, white, transparent),
            radial-gradient(2px 2px at 32% 45%, white, transparent),
            radial-gradient(2px 2px at 42% 55%, white, transparent),
            radial-gradient(2px 2px at 52% 65%, white, transparent),
            radial-gradient(2px 2px at 62% 75%, white, transparent),
            radial-gradient(2px 2px at 72% 85%, white, transparent),
            radial-gradient(2px 2px at 82% 15%, white, transparent),
            radial-gradient(2px 2px at 92% 25%, white, transparent)
          `,
          backgroundSize: '100% 100%',
          opacity: 0.6,
          animation: 'twinkle 3s ease-in-out infinite'
        }}></div>
        {/* 더 큰 별들 */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(2px 2px at 18% 28%, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 38% 48%, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 58% 68%, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 78% 18%, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 28% 58%, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 68% 38%, rgba(255,255,255,0.9), transparent)
          `,
          backgroundSize: '100% 100%',
          opacity: 0.8,
          animation: 'twinkle 4s ease-in-out infinite'
        }}></div>
      </div>

      {/* 별 깜빡임 애니메이션 */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <header className="relative z-10 bg-[#0a0e27]/80 backdrop-blur-sm border-b border-blue-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
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
            <nav className="hidden md:flex items-center space-x-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              <Link 
                to="/recommendedVideos" 
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: '#FFFFFF',
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
              <Link 
                // travel-plan link removed
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                
              </Link>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section - 왼쪽 정렬 */}
        <div className="mb-12 text-left">
          <h1 
            className="font-bold text-white mb-4" 
            style={{
              fontSize: '36px',
              lineHeight: '44px',
              fontFamily: 'Arial, sans-serif',
              color: '#FFFFFF'
            }}
          >
            개인 맞춤 영상 추천
          </h1>
          <p 
            className="text-white"
            style={{
              fontSize: '18px',
              lineHeight: '26px',
              fontFamily: 'Arial, sans-serif',
              color: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            AI가 당신의 취향을 분석하여 선별한 맞춤 여행 영상을 확인하세요.
          </p>
        </div>

        {/* Video Grid - 2열 고정(2xN), 스크롤 시 자동 로드, 선명한 썸네일(Featured) */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-blue-300 animate-pulse">데이터를 불러오는 중...</div>
            <div className="text-blue-200 text-sm mt-2">잠시만 기다려주세요...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 mb-4">{error}</div>
            <button 
              onClick={fetchVideos}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : recommendedVideos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-blue-300 text-lg mb-2">추천 영상이 없습니다.</div>
            <div className="text-blue-200 text-sm">데이터를 불러오는 중 문제가 발생했습니다.</div>
            <button 
              onClick={fetchVideos}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6">
              {recommendedVideos.slice(0, visibleCount).map((video) => (
                <VideoCard key={video.id} video={video} featured />
              ))}
            </div>
            {/* 스크롤 센티널 */}
            <div ref={setSentinelRef} style={{ height: '1px' }} />
          </>
        )}
      </main>
    </div>
  )
}

export default RecommendedVideos

