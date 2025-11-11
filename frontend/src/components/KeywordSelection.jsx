import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'

const travelKeywords = [
  { id: 'solo', name: '혼자여행', en: 'Solo Travel' },
  { id: 'budget', name: '가성비여행', en: 'Budget Trip' },
  { id: 'vlog', name: '브이로그', en: 'Travel Vlog' },
  { id: 'aesthetic', name: '감성여행', en: 'Aesthetic Mood' },
  { id: 'domestic', name: '국내여행', en: 'Domestic Trip' },
  { id: 'global', name: '해외여행', en: 'Global Trip' },
  { id: 'oneday', name: '당일치기', en: 'One-day Trip' },
  { id: 'food', name: '맛집투어', en: 'Food Tour' },
  { id: 'stay', name: '숙소리뷰', en: 'Stay Review' },
  { id: 'camping', name: '캠핑', en: 'Camping' },
  { id: 'cafe', name: '카페투어', en: 'Cafe Tour' }
]

const MIN_SELECTION = 5

function KeywordSelection() {
  const navigate = useNavigate()
  const [selectedKeywords, setSelectedKeywords] = useState(() => {
    try {
      const saved = localStorage.getItem('travelKeywords')
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch (_) {
      return []
    }
  })
  const userName = localStorage.getItem('userName') || '김도현'

  const selectedCountText = useMemo(() => {
    return `${selectedKeywords.length}개 선택 중 · 최소 ${MIN_SELECTION}개 이상 선택해주세요`
  }, [selectedKeywords.length])

  const toggleKeyword = (id) => {
    setSelectedKeywords((prev) => {
      if (prev.includes(id)) {
        return prev.filter((keyword) => keyword !== id)
      }
      return [...prev, id]
    })
  }

  const handlePrevious = () => {
    navigate('/travel-preference')
  }

  const handleNext = () => {
    if (selectedKeywords.length < MIN_SELECTION) {
      alert(`최소 ${MIN_SELECTION}개 이상의 여행 키워드를 선택해주세요.`)
      return
    }
    localStorage.setItem('travelKeywords', JSON.stringify(selectedKeywords))
    navigate('/signup-complete')
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden flex items-center justify-center">
      {/* 밤하늘 별 배경 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* 작은 별들 */}
        <div
          className="absolute inset-0"
          style={{
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
          }}
        ></div>
        {/* 더 큰 별들 */}
        <div
          className="absolute inset-0"
          style={{
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
          }}
        ></div>
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
          {/* 1단계 - 완료 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">1</span>
            </div>
            <span className="ml-2 text-white text-sm font-medium">관심사 선택</span>
          </div>

          <div className="w-16 h-0.5 bg-purple-600"></div>

          {/* 2단계 - 활성 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              <span className="text-purple-600 font-bold">2</span>
            </div>
            <span className="ml-2 text-white text-sm font-medium">키워드 선택</span>
          </div>

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
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
          {/* 좌측 카드 섹션 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl p-8 flex items-center justify-center">
            <div className="text-center w-full">
              <div className="inline-flex items-center justify-center mb-6">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                  <Logo size="w-16 h-16" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">여행 키워드 선택</h1>
              <p className="text-blue-200 text-base">맞춤형 컨텐츠 추천을 위해</p>
              <p className="text-blue-200 text-base">여행 키워드를 선택해주세요</p>
            </div>
          </div>

          {/* 우측 섹션 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl p-8 flex flex-col">
            <div className="mb-8">
              <p className="text-white text-lg font-semibold mb-2">
                요즘 {userName}님이 찾는 여행 키워드는?
              </p>
              <p className="text-blue-200 text-sm">{selectedCountText}</p>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {travelKeywords.map((keyword) => {
                const isSelected = selectedKeywords.includes(keyword.id)
                return (
                  <button
                    type="button"
                    key={keyword.id}
                    onClick={() => toggleKeyword(keyword.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-900/30'
                        : 'bg-gray-800/40 border-gray-600 hover:border-purple-400 hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                          isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-500'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {keyword.name}
                        </p>
                        <p className={`text-sm ${isSelected ? 'text-purple-200' : 'text-gray-500'}`}>
                          ({keyword.en})
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 하단 버튼 */}
            <div className="flex justify-between mt-10">
              <button
                type="button"
                onClick={handlePrevious}
                className="px-6 py-3 bg-transparent text-white rounded-lg border border-gray-600 hover:bg-gray-700/60 transition-colors"
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={selectedKeywords.length < MIN_SELECTION}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KeywordSelection


