/**
 * VideoKeywordCard 컴포넌트
 * 영상의 키워드를 다이아몬드 형태로 시각화하는 컴포넌트
 * score에 따라 opacity와 font-size가 변경됨
 */
import React from 'react'

/**
 * 다이아몬드 형태의 키워드 카드 컴포넌트
 * @param {Object} props
 * @param {string} props.keyword - 키워드 텍스트
 * @param {number} props.score - 키워드 유사도 점수 (0.0 ~ 1.0)
 * @param {number} props.index - 키워드 인덱스 (배치 위치 계산용)
 * @param {number} props.total - 전체 키워드 개수
 */
function VideoKeywordCard({ keyword, score, index, total }) {
  // score에 따른 opacity 계산 (0.5 ~ 1.0)
  const opacity = 0.5 + (score * 0.5)
  
  // score에 따른 font-size 계산 (0.75rem ~ 1.25rem)
  const fontSize = 0.75 + (score * 0.5)
  
  // score에 따른 배경색 강도 계산 (밝은 파란색 계열)
  const bgIntensity = Math.floor(score * 100)
  const backgroundColor = `rgba(59, 130, 246, ${0.1 + score * 0.3})` // blue-500 계열
  
  // 다이아몬드 배치를 위한 각도 계산 (원형 배치)
  // 중앙에 배치하고, 원형으로 퍼지도록 함
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2 // -90도부터 시작
  const radius = 120 // 중앙으로부터의 거리 (px)
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  
  // 다이아몬드 크기 (score에 따라 조정)
  const size = 80 + (score * 40) // 80px ~ 120px
  
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: 'translate(-50%, -50%)',
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {/* 다이아몬드 형태의 컨테이너 */}
      <div
        className="flex items-center justify-center text-center font-semibold text-blue-700 transition-all duration-300 hover:scale-110"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: 'rotate(45deg)',
          backgroundColor: backgroundColor,
          border: `2px solid rgba(59, 130, 246, ${opacity})`,
          borderRadius: '8px',
          opacity: opacity,
          boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`,
        }}
      >
        {/* 내부 텍스트 (다이아몬드를 -45도 회전하여 원래 방향으로) */}
        <div
          className="w-full px-2"
          style={{
            transform: 'rotate(-45deg)',
            fontSize: `${fontSize}rem`,
            lineHeight: '1.2',
            wordBreak: 'keep-all',
          }}
        >
          {keyword}
        </div>
      </div>
      
      {/* 점수 표시 (선택적, 작은 텍스트로) */}
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500"
        style={{
          opacity: opacity * 0.7,
        }}
      >
        {(score * 100).toFixed(0)}%
      </div>
    </div>
  )
}

/**
 * VideoKeywordVisualization 컴포넌트
 * 여러 키워드를 다이아몬드 형태로 배치하여 시각화
 * @param {Object} props
 * @param {Array<{keyword: string, score: number}>} props.keywords - 키워드 리스트
 * @param {string} props.videoTitle - 영상 제목 (선택적)
 */
function VideoKeywordVisualization({ keywords = [], videoTitle = '' }) {
  if (!keywords || keywords.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <p className="text-gray-500">키워드 데이터가 없습니다.</p>
      </div>
    )
  }
  
  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* 제목 영역 */}
      {videoTitle && (
        <div className="mb-4 text-center">
          <h3 className="text-lg font-semibold text-gray-800">{videoTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">키워드 분석 결과</p>
        </div>
      )}
      
      {/* 다이아몬드 키워드 시각화 영역 */}
      <div className="relative mx-auto" style={{ width: '400px', height: '400px' }}>
        {/* 중앙 점 (참고용, 선택적) */}
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 opacity-30" />
        
        {/* 키워드 카드들 */}
        {keywords.map((item, index) => (
          <VideoKeywordCard
            key={`${item.keyword}-${index}`}
            keyword={item.keyword}
            score={item.score}
            index={index}
            total={keywords.length}
          />
        ))}
      </div>
      
      {/* 키워드 리스트 (하단에 텍스트로 표시) */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {keywords.map((item, index) => (
          <span
            key={`${item.keyword}-${index}`}
            className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
            style={{
              opacity: 0.5 + (item.score * 0.5),
            }}
          >
            {item.keyword} ({(item.score * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  )
}

export default VideoKeywordVisualization

