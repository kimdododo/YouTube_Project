import { Sparkles, Bot, Send } from 'lucide-react'

function TravelAssistant() {
  return (
    <>
      {/* 왼쪽 상단 - 큰 별 아이콘 버튼 */}
      <button
        className="fixed top-20 left-8 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer"
        style={{
          boxShadow: '0 8px 32px rgba(138, 43, 226, 0.4)'
        }}
        onClick={() => {
          // 추천 기능
          console.log('추천 클릭')
        }}
      >
        <Sparkles className="w-8 h-8 text-white" strokeWidth={2} style={{ transform: 'rotate(-15deg)' }} />
      </button>

      {/* 왼쪽 상단 - 작은 로봇 아이콘 버튼 (별 버튼 아래) */}
      <button
        className="fixed top-32 left-8 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer"
        style={{
          boxShadow: '0 8px 32px rgba(138, 43, 226, 0.4)'
        }}
        onClick={() => {
          // 어시스턴트 대화 기능
          console.log('어시스턴트 클릭')
        }}
      >
        <Bot className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {/* 오른쪽 하단 - 종이비행기 아이콘 버튼 */}
      <button
        className="fixed bottom-8 right-8 z-50 px-6 py-3 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform cursor-pointer"
        style={{
          boxShadow: '0 8px 32px rgba(138, 43, 226, 0.4)'
        }}
        onClick={() => {
          // 공유/전송 기능
          console.log('공유 클릭')
        }}
      >
        <Send className="w-5 h-5 text-white" strokeWidth={2} />
      </button>
    </>
  )
}

export default TravelAssistant

