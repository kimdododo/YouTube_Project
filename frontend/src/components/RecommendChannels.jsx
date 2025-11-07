import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecommendedChannels } from '../api/channels'
import { optimizeThumbnailUrl } from '../utils/imageUtils'

function RecommendChannels() {
  const navigate = useNavigate()
  const [subscribedChannels, setSubscribedChannels] = useState([])
  const [recommendedChannels, setRecommendedChannels] = useState([])
  const [loading, setLoading] = useState(true)

  const toggleSubscribe = (id) => {
    setSubscribedChannels(prev => {
      if (prev.includes(id)) {
        return prev.filter(c => c !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const handleNext = () => {
    // 구독한 채널 저장
    localStorage.setItem('subscribedChannels', JSON.stringify(subscribedChannels))
    // 가입 완료 페이지로 이동
    navigate('/signup-complete')
  }

  const handlePrevious = () => {
    navigate('/travel-preference')
  }

  // API에서 실제 채널 데이터 가져오기
  useEffect(() => {
    fetchChannels()
  }, [])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      // localStorage에서 여행 취향 가져오기
      const travelPreferences = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
      
      console.log('[RecommendChannels] Fetching channels with preferences:', travelPreferences)
      
      // 추천 채널 API 호출
      const channels = await getRecommendedChannels(travelPreferences, 4)
      console.log('[RecommendChannels] Received channels:', channels)

      // 썸네일 보강: 채널 썸네일이 없으면 대표 영상 1개의 썸네일로 대체
      const apiBase = '/api'
      const enhanced = await Promise.all(
        (channels || []).map(async (ch) => {
          if (ch.thumbnail_url) return ch
          try {
            const res = await fetch(`${apiBase}/videos?channel_id=${encodeURIComponent(ch.channel_id || ch.id)}&limit=1`)
            if (!res.ok) return ch
            const data = await res.json()
            const v = data?.videos?.[0]
            if (!v) return ch
            const thumb = optimizeThumbnailUrl(v.thumbnail_url, v.id, !!v.is_shorts)
            return { ...ch, thumbnail_url: thumb }
          } catch (_) {
            return ch
          }
        })
      )
      setRecommendedChannels(enhanced)
    } catch (error) {
      console.error('[RecommendChannels] Failed to fetch recommended channels:', error)
      console.error('[RecommendChannels] Error details:', error?.message, error?.stack)
      // API 실패 시 빈 배열
      setRecommendedChannels([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden flex items-center justify-center">
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

      {/* 진행 표시줄 */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="flex items-center space-x-4">
          {/* 1단계 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-gray-400 font-bold">1</span>
            </div>
            <span className="ml-2 text-gray-400 text-sm">관심사 선택</span>
          </div>
          
          {/* 구분선 */}
          <div className="w-16 h-0.5 bg-purple-600"></div>
          
          {/* 2단계 - 활성 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">2</span>
            </div>
            <span className="ml-2 text-white text-sm font-medium">추천 채널</span>
          </div>
          
          {/* 구분선 */}
          <div className="w-16 h-0.5 bg-gray-600"></div>
          
          {/* 3단계 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-gray-400 font-bold">3</span>
            </div>
            <span className="ml-2 text-gray-400 text-sm">가입 완료</span>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-20">
        <div className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl p-8">
          {/* 제목 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-3">추천 채널</h1>
            <p className="text-blue-200 text-lg">
              선택하신 취향에 맞는 여행 채널을 추천해드립니다
            </p>
          </div>

          {/* 채널 그리드 (2x2) */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-blue-300">채널을 불러오는 중...</div>
            </div>
          ) : recommendedChannels.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-blue-300">추천 채널이 없습니다.</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 mb-8">
              {recommendedChannels.map((channel) => {
                const isSubscribed = subscribedChannels.includes(channel.id || channel.channel_id)
                return (
                  <div
                    key={channel.id || channel.channel_id}
                    className="bg-gray-800/50 border border-gray-600 rounded-lg overflow-hidden hover:border-purple-500 transition-all"
                  >
                    {/* 썸네일 이미지 */}
                    <div className="relative aspect-video bg-gradient-to-b from-purple-600 to-blue-600 overflow-hidden">
                      {channel.thumbnail_url ? (
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                          style={{
                            imageRendering: '-webkit-optimize-contrast',
                            backfaceVisibility: 'hidden',
                            transform: 'translateZ(0)',
                            WebkitFontSmoothing: 'antialiased'
                          }}
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            const placeholder = e.target.parentElement.querySelector('.placeholder')
                            if (placeholder) placeholder.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div className="w-full h-full flex items-center justify-center placeholder" style={{ display: channel.thumbnail_url ? 'none' : 'flex' }}>
                        <svg className="w-16 h-16 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                    </div>

                    {/* 채널 정보 */}
                    <div className="p-4">
                      <h3 className="text-white font-medium text-lg mb-1 line-clamp-1">{channel.name}</h3>
                      <p className="text-gray-400 text-sm mb-2">구독자 {channel.subscribers}</p>
                      {channel.video_count > 0 && (
                        <p className="text-gray-500 text-xs mb-4">영상 {channel.video_count}개</p>
                      )}
                      
                      {/* 구독 버튼 */}
                      <button
                        onClick={() => toggleSubscribe(channel.id || channel.channel_id)}
                        className={`w-full py-2 rounded-lg font-medium transition-all ${
                          isSubscribed
                            ? 'bg-gray-600 text-gray-300'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                        }`}
                      >
                        {isSubscribed ? '구독 취소' : '채널 구독'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              className="px-6 py-3 text-white hover:text-gray-300 transition-colors"
            >
              이전
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecommendChannels

