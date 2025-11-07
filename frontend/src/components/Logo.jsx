function Logo({ size = 'w-10 h-10' }) {
  // 크기에 따라 아이콘 크기 조정
  const isLarge = size.includes('24') || size.includes('16')
  const iconSize = isLarge ? 'w-14 h-14' : 'w-6 h-6'
  const dotSize = isLarge ? 'w-2 h-2 bottom-1 left-1' : 'w-1.5 h-1.5 bottom-0.5 left-0.5'
  const plusSize = isLarge ? 'w-3 h-3 top-1 right-1' : 'w-2 h-2 top-0.5 right-0.5'
  const plusTextSize = isLarge ? 'text-[10px]' : 'text-[8px]'
  
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center relative`}>
      {/* 중앙 별 아이콘 */}
      <svg className={`${iconSize} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
      {/* 왼쪽 아래 작은 원 */}
      <div className={`absolute ${dotSize} rounded-full bg-white`}></div>
      {/* 오른쪽 위 작은 플러스 */}
      <div className={`absolute ${plusSize} rounded-full bg-white flex items-center justify-center`}>
        <span className={`text-purple-600 ${plusTextSize} font-bold leading-none`}>+</span>
      </div>
    </div>
  )
}

export default Logo

