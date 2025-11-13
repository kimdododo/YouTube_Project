import { useState, useEffect, useCallback } from 'react'
import VideoCard from './VideoCard'
import AppLayout from './layouts/AppLayout'
import { getPersonalizedRecommendations, getRecommendedVideos, getTrendVideos, getMostLikedVideos, getAllVideos, getDiversifiedVideos } from '../api/videos'

function RecommendedVideos() {
  const [loading, setLoading] = useState(true)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [usePersonalized, setUsePersonalized] = useState(true)
  const [error, setError] = useState(null)

  // API에서 실제 데이터 가져오기 (useCallback으로 메모이제이션)
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[RecommendedVideos] Starting to fetch videos...')
      
      const travelPreferences = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
      const hasPreferences = travelPreferences.length > 0
      
      let recommended = []
      
      if (usePersonalized && hasPreferences) {
        try {
          recommended = await getPersonalizedRecommendations({}, 20)
          console.log('[RecommendedVideos] Using personalized recommendations:', recommended?.length || 0)
        } catch (personalizedError) {
          console.warn('[RecommendedVideos] Personalized recommendation failed, falling back to general:', personalizedError)
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
        let result = pick(maxPerChannel)
        if (result.length < targetCount) {
          result = pick(maxPerChannel + 1)
        }
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
      console.log('[RecommendedVideos] Set recommendedVideos state:', diversified.length)
    } catch (error) {
      console.error('[RecommendedVideos] Failed to fetch recommended videos:', error)
      setError(error.message || '영상을 불러오는데 실패했습니다.')
      setRecommendedVideos([])
    } finally {
      setLoading(false)
    }
  }, [usePersonalized])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  return (
    <AppLayout>
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
            AI가 분석하여 선별한 맞춤 여행 영상을 확인하세요.
          </p>
        </div>

        {/* Video Grid */}
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
          <div className="grid grid-cols-3 gap-6">
            {recommendedVideos.slice(0, 6).map((video) => (
              <VideoCard key={video.id} video={video} featured />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default RecommendedVideos
