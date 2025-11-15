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

  // 트렌드 비디오 데이터 가져오기 (period 변경 시에도 재호출)
  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendVideos()
    }
  }, [activePeriod, activeTab])

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
      
      // period에 따라 다른 limit 값 사용 (더 많은 데이터를 가져와서 필터링)
      let limit = 100
      if (activePeriod === 'daily') {
        limit = 100 // 일간: 최근 100개에서 필터링
      } else if (activePeriod === 'weekly') {
        limit = 200 // 주간: 최근 200개에서 필터링
      } else if (activePeriod === 'monthly') {
        limit = 500 // 월간: 최근 500개에서 필터링 (백엔드 최대값 500)
      }
      
      // 1순위: 트렌드 API 호출 (period는 백엔드에서 지원하지 않으므로 클라이언트에서 필터링)
      try {
        const trends = await getTrendVideos(limit)
        
        if (!trends || trends.length === 0) {
          setTrendVideos([])
          return
        }
        
        // period에 따라 필터링 (published_at 기준)
        const now = new Date()
        let filteredTrends = []
        
        if (activePeriod === 'daily') {
          // 최근 24시간
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          filteredTrends = trends.filter(video => {
            if (!video.published_at) {
              // published_at이 없으면 최신 영상으로 간주 (배열 앞부분)
              return trends.indexOf(video) < 20 // 상위 20개만 포함
            }
            try {
              const publishedDate = new Date(video.published_at)
              return publishedDate >= oneDayAgo
            } catch (e) {
              return false
            }
          })
        } else if (activePeriod === 'weekly') {
          // 최근 7일
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          filteredTrends = trends.filter(video => {
            if (!video.published_at) {
              // published_at이 없으면 최신 영상으로 간주
              return trends.indexOf(video) < 50 // 상위 50개만 포함
            }
            try {
              const publishedDate = new Date(video.published_at)
              return publishedDate >= oneWeekAgo
            } catch (e) {
              return false
            }
          })
        } else if (activePeriod === 'monthly') {
          // 최근 30일
          const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          filteredTrends = trends.filter(video => {
            if (!video.published_at) {
              // published_at이 없으면 최신 영상으로 간주
              return trends.indexOf(video) < 100 // 상위 100개만 포함
            }
            try {
              const publishedDate = new Date(video.published_at)
              return publishedDate >= oneMonthAgo
            } catch (e) {
              return false
            }
          })
        }
        
        // 필터링된 결과가 부족하면 period에 따라 다른 fallback 전략 사용
        if (filteredTrends.length < 8) {
          // period에 따라 다른 개수만큼만 사용 (항상 같은 결과 방지)
          if (activePeriod === 'daily') {
            filteredTrends = trends.slice(0, 20) // 일간: 최신 20개
          } else if (activePeriod === 'weekly') {
            filteredTrends = trends.slice(0, 50) // 주간: 최신 50개
          } else {
            filteredTrends = trends.slice(0, 100) // 월간: 최신 100개
          }
        }
        
        // 채널 다양화 적용
        const diversified = diversifyByChannel(filteredTrends || [], 8, 1)
        setTrendVideos(diversified)
        
        console.log(`[TravelTrends] ${activePeriod} period: filtered ${filteredTrends.length} videos from ${trends.length} total`)
      } catch (error) {
        console.error('Failed to fetch trend videos:', error)
        // 2순위: 채널 다양화 엔드포인트로 폴백
        try {
          const diversifiedServer = await getDiversifiedVideos(90, 1)
          const diversified = diversifyByChannel(diversifiedServer || [], 8, 1)
          setTrendVideos(diversified)
        } catch (_) {
          setTrendVideos([])
        }
      }
    } catch (error) {
      console.error('Failed to fetch trend videos:', error)
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
