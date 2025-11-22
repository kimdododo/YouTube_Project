import { useState, useEffect, useCallback } from 'react'
import AppLayout from './layouts/AppLayout'
import MainRecommendationSection from './recommend/MainRecommendationSection'
import ThemeRecommendationSection from './recommend/ThemeRecommendationSection'
import useThemeVideos from '../hooks/useThemeVideos'
import { getPersonalizedRecommendations, getRecommendedVideos, getTrendVideos, getMostLikedVideos, getAllVideos, getDiversifiedVideos, fetchPersonalizedRecommendations } from '../api/videos'
import { usePageTracking, trackEvent } from '../utils/analytics'
import { getCurrentUser } from '../api/auth'

function RecommendedVideos() {
  const [loading, setLoading] = useState(true)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [usePersonalized, setUsePersonalized] = useState(true)
  const [error, setError] = useState(null)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState(null)
  const [coldStart, setColdStart] = useState(false)
  usePageTracking('RecommendedVideos')
  
  // 테마별 비디오 데이터 가져오기
  const { themes, loading: themesLoading } = useThemeVideos()

  // NEW: 사용자 ID 가져오기 (getCurrentUser 사용 - 401 오류 자동 처리)
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        // getCurrentUser는 401 오류를 자동으로 처리하고 null을 반환합니다
        const userInfo = await getCurrentUser()
        if (userInfo && userInfo.id) {
          setUserId(userInfo.id)
          console.log('[RecommendedVideos] User ID from getCurrentUser:', userInfo.id)
        }
      } catch (err) {
        // getCurrentUser는 이미 401 오류를 처리하므로 여기서는 조용히 무시
        console.warn('[RecommendedVideos] Failed to get user ID:', err)
      }
    }
    
    fetchUserId()
  }, [])

  // NEW: SimCSE 기반 개인화 추천 API 호출
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[RecommendedVideos] Starting to fetch videos...')
      let usedColdStart = false
      let recommendationSource = userId ? 'personalized' : 'general'
      let recommended = []
      
      // NEW: SimCSE 기반 개인화 추천 시도 (user_id가 있는 경우)
      if (userId) {
        try {
          console.log('[RecommendedVideos] Fetching SimCSE-based personalized recommendations for user:', userId)
          const personalizedResult = await fetchPersonalizedRecommendations(userId)
          
          if (personalizedResult && personalizedResult.length > 0) {
            recommended = personalizedResult
            setColdStart(false)
            console.log('[RecommendedVideos] Using SimCSE personalized recommendations:', recommended.length)
          } else {
            throw new Error('No personalized recommendations returned')
          }
        } catch (personalizedError) {
          console.error('[RecommendedVideos] SimCSE personalized recommendation failed:', personalizedError)
          // Fallback to general recommendations
          usedColdStart = true
          setColdStart(true)
          recommendationSource = 'personalized_fallback'
          try {
            recommended = await getDiversifiedVideos(200, 1)
            console.log('[RecommendedVideos] Fallback to diversified videos:', recommended?.length || 0)
          } catch (diversifiedError) {
            console.warn('[RecommendedVideos] Diversified endpoint failed, trying general:', diversifiedError)
            recommended = await getRecommendedVideos(null, false, 100)
            console.log('[RecommendedVideos] Using general recommendation:', recommended?.length || 0)
          }
        }
      } else {
        // user_id가 없으면 기존 로직 사용 (cold-start 안내는 표시하지 않음)
        setColdStart(false)
        const travelPreferences = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
        const hasPreferences = travelPreferences.length > 0
        
        if (usePersonalized && hasPreferences) {
          try {
            recommended = await getPersonalizedRecommendations({}, 20)
            console.log('[RecommendedVideos] Using old personalized recommendations:', recommended?.length || 0)
          } catch (personalizedError) {
            console.warn('[RecommendedVideos] Old personalized recommendation failed, falling back:', personalizedError)
            try {
              recommended = await getDiversifiedVideos(200, 1)
              console.log('[RecommendedVideos] Fallback diversified endpoint:', recommended?.length || 0)
            } catch (diversifiedError) {
              console.warn('[RecommendedVideos] Diversified endpoint failed, trying general:', diversifiedError)
              recommended = await getRecommendedVideos(null, false, 100)
              console.log('[RecommendedVideos] Using general recommendation:', recommended?.length || 0)
            }
          }
        } else {
          try {
            recommended = await getDiversifiedVideos(200, 1)
            console.log('[RecommendedVideos] Using diversified endpoint for RANDOM:', recommended?.length || 0)
          } catch (diversifiedError) {
            console.warn('[RecommendedVideos] Diversified endpoint failed, trying all videos:', diversifiedError)
            try {
              const all = await getAllVideos(0, 300)
              recommended = all || []
              console.log('[RecommendedVideos] Using RANDOM from full pool (fallback):', recommended?.length || 0)
            } catch (allError) {
              console.warn('[RecommendedVideos] All videos failed, trying general recommendation:', allError)
              recommended = await getRecommendedVideos(null, false, 100)
              console.log('[RecommendedVideos] Using general recommendation as last resort:', recommended?.length || 0)
            }
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
          // 객체를 스프레드 연산자로 복사하여 모든 필드 보존
          out.push({ ...it })
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
              // 객체를 스프레드 연산자로 복사하여 모든 필드 보존
              out.push({ ...it })
              seen.set(chId, cnt + 1)
              if (out.length >= targetCount) break
            }
          }
          return out
        }
        let result = pick(maxPerChannel)
        if (result.length < targetCount) {
          result = pick(maxPerChannel + 1)
        }
        if (result.length < targetCount) {
          const ids = new Set(result.map(v => v.id))
          for (const it of items) {
            if (!ids.has(it.id)) {
              // 객체를 스프레드 연산자로 복사하여 모든 필드 보존
              result.push({ ...it })
              ids.add(it.id)
              if (result.length >= targetCount) break
            }
          }
        }
        return result
      }

      const unique = dedupeById(recommended)
      console.log('[RecommendedVideos] After deduplication:', unique.length)
      
      for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[unique[i], unique[j]] = [unique[j], unique[i]]
      }
      
      const diversified = diversifyWithFallback(unique, 48, 1)
      console.log('[RecommendedVideos] Final diversified videos:', diversified.length)
      
      if (diversified.length === 0) {
        console.warn('[RecommendedVideos] No videos after diversification, checking source data...')
        console.warn('[RecommendedVideos] Source recommended array length:', recommended.length)
        if (recommended.length === 0) {
          setError('영상을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.')
        }
      }
      
      setRecommendedVideos(diversified)
      trackEvent('recommendations_rendered', {
        page: 'RecommendedVideos',
        source: recommendationSource,
        count: diversified.length,
        cold_start: usedColdStart,
        user_id_present: Boolean(userId)
      })
      console.log('[RecommendedVideos] Set recommendedVideos state:', diversified.length)
    } catch (error) {
      console.error('[RecommendedVideos] Failed to fetch recommended videos:', error)
      setError(error.message || '영상을 불러오는데 실패했습니다.')
      setRecommendedVideos([])
    } finally {
      setLoading(false)
    }
  }, [usePersonalized, userId])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  // 사용자 이름 가져오기
  useEffect(() => {
    const storedName = localStorage.getItem('userName')
    if (storedName) {
      setUserName(storedName)
    }
  }, [])

  return (
    <AppLayout>
      {/* 툴팁 fade-in 애니메이션 */}
      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        .tooltip-fade-in {
          animation: tooltipFadeIn 200ms ease-in-out;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
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
          {/* NEW: Cold-start 안내 메시지 */}
          {coldStart && !loading && (
            <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
              <p className="text-blue-200 text-sm">
                아직 시청 기록이 적어서, 우선 인기 여행 영상을 추천해드릴게요.
              </p>
            </div>
          )}
        </div>

        {/* 메인 추천 섹션 */}
        <MainRecommendationSection 
          videos={recommendedVideos}
          loading={loading}
          error={error}
          onRetry={fetchVideos}
        />

        {/* 테마별 추천 섹션 */}
        {!loading && !error && recommendedVideos.length > 0 && (
          <ThemeRecommendationSection 
            themes={themes}
            userName={userName}
          />
        )}
      </div>
    </AppLayout>
  )
}

export default RecommendedVideos
