import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'

const travelPreferences = [
  { id: 1, name: '자연 힐링형', en: 'Nature & Healing' },
  { id: 2, name: '도시 탐방형', en: 'Urban Explorer' },
  { id: 3, name: '액티비티형', en: 'Adventure & Sports' },
  { id: 4, name: '문화 체험형', en: 'Culture & Heritage' },
  { id: 5, name: '럭셔리 휴양형', en: 'Luxury Relaxation' },
  { id: 6, name: '미식 여행형', en: 'Foodie Trip' },
  { id: 7, name: '로맨틱 감성형', en: 'Romantic & Scenic' },
  { id: 8, name: '사진 명소형', en: 'Photogenic Spot' },
  { id: 9, name: '자기계발형', en: 'Self-Development' },
  { id: 10, name: '가족 친구 중심형', en: 'Family & Friends' },
  { id: 11, name: '에코 지속가능형', en: 'Eco & Sustainable' }
]

function TravelPreference() {
  const navigate = useNavigate()
  const [selectedPreferences, setSelectedPreferences] = useState([])
  const userName = localStorage.getItem('userName') || '김도현'

  const togglePreference = (id) => {
    setSelectedPreferences(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const handleNext = () => {
    if (selectedPreferences.length === 0) {
      alert('최소 하나 이상의 취향을 선택해주세요.')
      return
    }
    // 선택된 취향 저장
    localStorage.setItem('travelPreferences', JSON.stringify(selectedPreferences))
    // 다음 단계로 이동 (2 추천 채널)
    navigate('/recommend-channels')
  }

  const handlePrevious = () => {
    navigate('/signup')
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
          {/* 1단계 - 활성 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">1</span>
            </div>
            <span className="ml-2 text-white text-sm font-medium">관심사 선택</span>
          </div>
          
          {/* 구분선 */}
          <div className="w-16 h-0.5 bg-gray-600"></div>
          
          {/* 2단계 */}
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-gray-400 font-bold">2</span>
            </div>
            <span className="ml-2 text-gray-400 text-sm">추천 채널</span>
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
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
          {/* 좌측 카드 섹션 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl p-8 flex items-center justify-center">
            <div className="text-center w-full">
              {/* 그라데이션 원형 아이콘 */}
              <div className="inline-flex items-center justify-center mb-8">
                <Logo size="w-24 h-24" />
              </div>
              
              {/* 3줄 텍스트 */}
              <h1 className="text-2xl font-bold text-white mb-2">여행 취향 선택</h1>
              <p className="text-blue-200 text-base mb-1">
                맞춤형 컨텐츠 추천을 위해
              </p>
              <p className="text-blue-200 text-base">
                선호하는 여행 스타일을 선택해주세요
              </p>
            </div>
          </div>

          {/* 우측 섹션 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-8">
              휴가를 계획 중이에요. {userName}님의 여행 취향은?
            </h2>

            {/* 취향 목록 */}
            <div className="space-y-3 mb-8">
              {travelPreferences.map((pref) => {
                const isSelected = selectedPreferences.includes(pref.id)
                return (
                  <button
                    key={pref.id}
                    onClick={() => togglePreference(pref.id)}
                    className={`w-full flex items-center space-x-4 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500'
                        : 'bg-gray-800/50 border-gray-600 hover:border-purple-400'
                    }`}
                  >
                    {/* 체크박스 */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? 'bg-purple-600 border-purple-600'
                        : 'bg-transparent border-gray-400'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    {/* 텍스트 */}
                    <div className="flex-1 text-left">
                      <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {pref.name}
                      </span>
                      <span className={`ml-2 text-sm ${isSelected ? 'text-purple-200' : 'text-gray-500'}`}>
                        ({pref.en})
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 하단 버튼 */}
            <div className="flex justify-between mt-8">
              <button
                onClick={handlePrevious}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
    </div>
  )
}

export default TravelPreference

