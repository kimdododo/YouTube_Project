import { useState, useEffect } from 'react'
import AppLayout from './layouts/AppLayout'
import TrendRankingCard from './TrendRankingCard'
import VideoCard from './VideoCard'
import { getTrendVideos, getDiversifiedVideos } from '../api/videos'

function TravelTrends() {
  const [activeTab, setActiveTab] = useState('trending')
  const [activePeriod, setActivePeriod] = useState('daily')
  const [activeThemeCategory, setActiveThemeCategory] = useState('all') // 테마별 서브 탭
  const [trendVideos, setTrendVideos] = useState([])
  const [themeVideos, setThemeVideos] = useState([]) // 테마별 여행지 비디오
  const [loading, setLoading] = useState(true)

  // 테마별 카테고리 목록
  const themeCategories = [
    { id: 'all', name: '전체' },
    { id: 'food', name: '맛집' },
    { id: 'sightseeing', name: '관광' },
    { id: 'relaxation', name: '휴양' },
    { id: 'activity', name: '액티비티' }
  ]

  // 테마별 카테고리 키워드 매핑
  const themeCategoryKeywords = {
    all: [],
    food: ['맛집', '음식', '식당', '카페', '디저트', '브런치', '로컬맛집', 'food', 'restaurant', 'cafe'],
    sightseeing: ['관광', '명소', '여행지', '명승지', '유적', '박물관', 'sightseeing', 'tourist', 'attraction', 'landmark'],
    relaxation: ['휴양', '힐링', '스파', '리조트', '해변', '온천', 'relaxation', 'healing', 'spa', 'resort', 'beach'],
    activity: ['액티비티', '스포츠', '레저', '등산', '스키', '다이빙', 'activity', 'sports', 'adventure', 'hiking']
  }

  // 트렌드 비디오 데이터 가져오기
  useEffect(() => {
    fetchTrendVideos()
  }, [])

  // 테마별 여행지 비디오 가져오기 (카테고리 변경 시)
  useEffect(() => {
    if (activeTab === 'theme') {
      fetchThemeCategoryVideos()
    }
  }, [activeThemeCategory, activeTab])

  const diversifyByChannel = (items, target = 8, maxPerChannel = 1) => {
    if (!items || items.length === 0) return []
    const out = []
    const per = new Map()
    for (const it of items) {
      const ch = it.channel_id || it.channelId || it.channel || `unknown-${it.id || Math.random()}`
      const cnt = per.get(ch) || 0
      if (cnt < maxPerChannel) {
        out.push(it)
        per.set(ch, cnt + 1)
        if (out.length >= target) break
      }
    }
    if (out.length < target) {
      const ids = new Set(out.map(v => v.id))
      for (const it of items) {
        if (!ids.has(it.id)) {
          out.push(it)
          ids.add(it.id)
          if (out.length >= target) break
        }
      }
    }
    return out
  }

  const fetchTrendVideos = async () => {
    try {
      setLoading(true)
      // 1순위: 채널 다양화 엔드포인트 (카테고리 섹션 용도로 사용)
      try {
        const diversifiedServer = await getDiversifiedVideos(90, 1)
        const diversified = diversifyByChannel(diversifiedServer || [], 8, 1)
        setTrendVideos(diversified)
      } catch (_) {
        // 2순위: 기존 트렌드 API + 프론트 다양화
        const trends = await getTrendVideos()
        const diversified = diversifyByChannel(trends || [], 8, 1)
        setTrendVideos(diversified)
      }
    } catch (error) {
      console.error('Failed to fetch trend videos:', error)
      // API 실패 시 빈 배열 (더미 데이터 사용 안 함)
      setTrendVideos([])
    } finally {
      setLoading(false)
    }
  }

  const fetchThemeCategoryVideos = async () => {
    try {
      setLoading(true)
      
      // 전체 카테고리인 경우
      if (activeThemeCategory === 'all') {
        try {
          const diversifiedServer = await getDiversifiedVideos(100, 1)
          const diversified = diversifyByChannel(diversifiedServer || [], 8, 1)
          setThemeVideos(diversified)
        } catch (_) {
          const trends = await getTrendVideos()
          const diversified = diversifyByChannel(trends || [], 8, 1)
          setThemeVideos(diversified)
        }
        return
      }

      // 특정 카테고리인 경우 키워드로 필터링
      const keywords = themeCategoryKeywords[activeThemeCategory] || []
      if (keywords.length === 0) {
        setThemeVideos([])
        return
      }

      // 더 많은 비디오를 가져와서 필터링
      const allVideos = await getDiversifiedVideos(200, 1)
      
      const filteredVideos = allVideos.filter((video) => {
        const title = (video.title || '').toLowerCase()
        const description = (video.description || '').toLowerCase()
        const keyword = (video.keyword || '').toLowerCase()
        const category = (video.category || '').toLowerCase()
        
        return keywords.some((kw) => 
          title.includes(kw.toLowerCase()) || 
          description.includes(kw.toLowerCase()) || 
          keyword.includes(kw.toLowerCase()) ||
          category.includes(kw.toLowerCase())
        )
      })

      // 중복 제거 및 채널 다양화
      const uniqueVideos = []
      const seenIds = new Set()
      for (const video of filteredVideos) {
        const videoId = video.id || video.video_id
        if (!seenIds.has(videoId)) {
          uniqueVideos.push(video)
          seenIds.add(videoId)
        }
      }

      const diversified = diversifyByChannel(uniqueVideos, 8, 1)
      setThemeVideos(diversified)
    } catch (error) {
      console.error('Failed to fetch theme category videos:', error)
      setThemeVideos([])
    } finally {
      setLoading(false)
    }
  }

  // 순위 변동 데이터 (예시)
  const rankChanges = [2, -1, 0, 'NEW', 0, 0, 0, 0]

  return (
    <AppLayout>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            여행 트렌드
          </h1>
          <p className="text-lg text-white/90">
            지금 전세계에서 가장 인기 있는 여행지와 트렌드를 확인해보세요.
          </p>
        </div>

        {/* Main Tabs */}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'trending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
            }`}
          >
            지금 뜨는 여행
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'theme'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
            }`}
          >
            테마별 여행지
          </button>
        </div>

        {/* Period Tabs (지금 뜨는 여행 탭일 때만 표시) */}
        {activeTab === 'trending' && (
          <div className="flex space-x-3 mb-6">
            <button
              onClick={() => setActivePeriod('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePeriod === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
              }`}
            >
              일간
            </button>
            <button
              onClick={() => setActivePeriod('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePeriod === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
              }`}
            >
              주간
            </button>
            <button
              onClick={() => setActivePeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
              }`}
            >
              월간
            </button>
          </div>
        )}

        {/* 테마별 서브 탭 (테마별 여행지 탭일 때만 표시) */}
        {activeTab === 'theme' && (
          <div className="flex space-x-3 mb-6">
            {themeCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveThemeCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeThemeCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}


        {/* 지금 뜨는 여행 - 트렌드 순위 목록 */}
        {activeTab === 'trending' && (
          <div className="space-y-4 mb-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="text-blue-300">데이터를 불러오는 중...</div>
              </div>
            ) : trendVideos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-blue-300">트렌드 영상이 없습니다.</div>
              </div>
            ) : (
              trendVideos.slice(0, 8).map((video, index) => (
                <TrendRankingCard
                  key={video.id || video.video_id}
                  rank={index + 1}
                  video={video}
                  change={rankChanges[index]}
                />
              ))
            )}
          </div>
        )}

        {/* 테마별 여행지 - 카테고리별 콘텐츠 그리드 */}
        {activeTab === 'theme' && (
          <div className="mb-8">
            {/* 선택된 테마 카테고리 표시 */}
            <div className="text-white mb-6">
              <span className="text-white/70">현재 선택: </span>
              <span className="font-semibold">
                {themeCategories.find(cat => cat.id === activeThemeCategory)?.name || '전체'}
              </span>
              <span className="text-white/70 ml-2">
                · {themeVideos.length > 0 ? `${themeVideos.length}개의 콘텐츠` : '0개의 콘텐츠'}
              </span>
            </div>

            {/* 그리드 (개인맞춤영상추천과 동일: 2열, Featured 카드) */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-blue-300">데이터를 불러오는 중...</div>
              </div>
            ) : themeVideos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-blue-300">콘텐츠가 없습니다.</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {themeVideos.slice(0, 8).map((video) => (
                  <VideoCard key={video.id || video.video_id} video={video} featured />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  )
}

export default TravelTrends
