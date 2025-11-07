import { useState } from 'react'
import { X, HelpCircle, Sparkles, ThumbsUp, ThumbsDown, Info, Wrench } from 'lucide-react'

function AIReviewModal({ isOpen, onClose, video }) {
  const [showSpoilers, setShowSpoilers] = useState(false)

  if (!isOpen) return null

  // 더미 데이터 (실제로는 video prop에서 받아올 수 있음)
  const reviewData = {
    positivePercentage: 85,
    positiveComment: '남부 프랑스의 낭만적인 분위기를 잘 전달한다',
    summary: {
      positive: '작은 마을들의 숨은 매력을 발견할 수 있다',
      negative: '각 마을의 체류 시간이 짧아 아쉽다',
      tip: '여름 성수기를 피하면 더 여유로운 여행이 가능하다'
    },
    keywords: ['남부프랑스', '칸느', '니스', '마을', '지중해'],
    keywordDescription: '지중해의 푸른 바다와 프로방스 마을의 조화가 아름답다'
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 모달 컨텐츠 */}
      <div 
        className="relative bg-[#1a1f3a] rounded-2xl border border-purple-500/30 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
              AI 리뷰 요약
            </h2>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded" style={{ fontFamily: 'Arial, sans-serif' }}>
              Beta
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gray-400" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-4">
          {/* 스포일러 토글 박스 */}
          <div className="bg-[#2a2f4a]/60 rounded-lg p-4 border border-purple-500/20">
            <div className="flex space-x-2">
              <button
                onClick={() => setShowSpoilers(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !showSpoilers
                    ? 'bg-gray-700 text-white'
                    : 'bg-transparent text-gray-300 hover:bg-gray-700/50'
                }`}
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                스포일러 없음
              </button>
              <button
                onClick={() => setShowSpoilers(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showSpoilers
                    ? 'bg-gray-700 text-white'
                    : 'bg-transparent text-gray-300 hover:bg-gray-700/50'
                }`}
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                스포일러 보기
              </button>
            </div>
          </div>

          {/* 긍정적 피드백 박스 */}
          <div className="bg-[#2a2f4a]/60 rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-xl">😊</span>
              </div>
              <h3 className="text-white font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                긍정적 {reviewData.positivePercentage}%
              </h3>
            </div>
            <p className="text-gray-300 text-sm ml-10" style={{ fontFamily: 'Arial, sans-serif' }}>
              {reviewData.positiveComment}
            </p>
          </div>

          {/* 세 줄 요약 박스 */}
          <div className="bg-[#2a2f4a]/60 rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-white font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                세 줄 요약
              </h3>
            </div>
            <div className="space-y-3">
              {/* 긍정 포인트 */}
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  <ThumbsUp className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-gray-300 text-sm flex-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                  {reviewData.summary.positive}
                </p>
              </div>
              {/* 부정 포인트 */}
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  <ThumbsDown className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-gray-300 text-sm flex-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                  {reviewData.summary.negative}
                </p>
              </div>
              {/* 팁 */}
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  <Info className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-gray-300 text-sm flex-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                  {reviewData.summary.tip}
                </p>
              </div>
            </div>
          </div>

          {/* 주요 키워드 박스 */}
          <div className="bg-[#2a2f4a]/60 rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-white font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                주요 키워드
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {reviewData.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-gray-600/50 text-gray-300 rounded-lg text-sm font-medium"
                  style={{ fontFamily: 'Arial, sans-serif' }}
                >
                  {keyword}
                </span>
              ))}
            </div>
            <p className="text-gray-400 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
              {reviewData.keywordDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIReviewModal

