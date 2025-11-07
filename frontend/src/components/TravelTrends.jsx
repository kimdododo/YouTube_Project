import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, BarChart3, TrendingUp, Grid, Eye, Waves, MapPin, Clock, Globe, Leaf, Building2, Palette } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import Logo from './Logo'
import TrendRankingCard from './TrendRankingCard'
import TrendCard from './TrendCard'
import VideoCard from './VideoCard'
import { getTrendVideos, getDiversifiedVideos } from '../api/videos'

function TravelTrends() {
  const [activeTab, setActiveTab] = useState('category')
  const [activePeriod, setActivePeriod] = useState('daily')
  const [activeCategory, setActiveCategory] = useState('all')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [trendVideos, setTrendVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // 로그인 상태 체크
  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
    }
    checkLoginStatus()
    window.addEventListener('storage', checkLoginStatus)
    const interval = setInterval(checkLoginStatus, 500)
    return () => {
      window.removeEventListener('storage', checkLoginStatus)
      clearInterval(interval)
    }
  }, [])

  const categories = [
    { id: 'all', name: '전체', icon: null },
    { id: 'europe', name: '유럽', icon: Globe },
    { id: 'asia', name: '아시아', icon: Globe },
    { id: 'america', name: '아메리카', icon: Globe },
    { id: 'oceania', name: '오세아니아', icon: Globe },
    { id: 'nature', name: '자연', icon: Leaf },
    { id: 'city', name: '도시', icon: Building2 },
    { id: 'culture', name: '문화', icon: Palette }
  ]

  // 실시간 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // 트렌드 비디오 데이터 가져오기
  useEffect(() => {
    fetchTrendVideos()
  }, [])

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

  // 순위 변동 데이터 (예시)
  const rankChanges = [2, -1, 1, 0, 3, -2, 'NEW', -1]

  // 실시간 조회수 추이 데이터
  const viewsData = [
    { time: '14:00', views: 2000 },
    { time: '15:00', views: 3500 },
    { time: '16:00', views: 4200 },
    { time: '17:00', views: 5800 },
    { time: '18:00', views: 7200 },
    { time: '19:00', views: 8500 },
    { time: '20:00', views: 9200 },
    { time: currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }), views: 10000 }
  ]

  // 지역별 관심도 데이터
  const regionData = [
    { name: '유럽', value: 35, color: '#FCD34D' },
    { name: '아시아', value: 28, color: '#EF4444' },
    { name: '아메리카', value: 22, color: '#60A5FA' },
    { name: '오세아니아', value: 10, color: '#34D399' },
    { name: '아프리카', value: 5, color: '#A78BFA' }
  ]

  // 급상승 여행지 데이터
  const trendingData = [
    { name: '아이슬란드', value: 8500 },
    { name: '뉴욕', value: 7200 },
    { name: '스위스', value: 9500 },
    { name: '베네치아', value: 6800 }
  ]

  const formatTime = (date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden">
      {/* 밤하늘 별 배경 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
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

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <header className="relative z-10 bg-[#0a0e27]/80 backdrop-blur-sm border-b border-blue-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Logo size="w-10 h-10" />
              <span 
                className="text-white font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: '#FFFFFF',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                여유
              </span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              <Link 
                to="/recommendedVideos" 
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                개인 맞춤 영상 추천
              </Link>
              <Link 
                to="/find-channel" 
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                채널 찾기
              </Link>
              <Link 
                to="/travel-trends" 
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: '#FFFFFF',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                여행 트렌드
              </Link>
              <Link 
                // travel-plan link removed
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                
              </Link>
{isLoggedIn ? (
                <Link 
                  to="/mypage" 
                  className="font-bold leading-6 flex items-center" 
                  style={{ 
                    fontSize: '16px',
                    lineHeight: '24px',
                    color: 'rgba(147, 197, 253, 1)',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  <User className="w-4 h-4 mr-1" />
                  마이페이지
                </Link>
              ) : (
                <Link 
                  to="/login" 
                  className="font-bold leading-6 flex items-center" 
                  style={{ 
                    fontSize: '16px',
                    lineHeight: '24px',
                    color: 'rgba(147, 197, 253, 1)',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  로그인하기
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            여행 트렌드
          </h1>
          <p className="text-lg text-white/90">
            지금 전 세계에서 가장 인기 있는 여행지와 트렌드를 확인하세요.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('realtime')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'realtime'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>실시간 분석</span>
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'ranking'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>트랜드 순위</span>
          </button>
          <button
            onClick={() => setActiveTab('category')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'category'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
            }`}
          >
            <Grid className="w-5 h-5" />
            <span>카테고리별</span>
          </button>
        </div>

        {/* Period Tabs (트랜드 순위 탭일 때만 표시) */}
        {activeTab === 'ranking' && (
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

        {/* Category Filter Buttons (카테고리별 탭일 때만 표시) */}
        {activeTab === 'category' && (
          <div className="flex flex-wrap gap-3 mb-6">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800/50 text-white hover:bg-gray-700/50'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{category.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Real-time Update Status (실시간 분석 탭일 때만 표시) */}
        {activeTab === 'realtime' && (
          <div className="flex items-center space-x-2 mb-8">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-white/80">
              실시간 업데이트 중 {formatTime(currentTime)}
            </span>
          </div>
        )}

        {/* Summary Cards (실시간 분석 탭일 때만 표시) */}
        {activeTab === 'realtime' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* 실시간 조회수 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm">실시간 조회수</span>
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">47,238</div>
            <div className="text-sm text-green-400">+12.5%</div>
          </div>

          {/* 시간당 증가율 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm">시간당 증가율</span>
              <Waves className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">+1,234</div>
            <div className="text-sm text-white/60">지난 1시간</div>
          </div>

          {/* 인기 지역 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm">인기 지역</span>
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">유럽</div>
            <div className="text-sm text-white/60">35% 점유율</div>
          </div>

          {/* 평균 시청 시간 */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm">평균 시청 시간</span>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">4분 32초</div>
            <div className="text-sm text-green-400">+8%</div>
          </div>
        </div>
        )}

        {/* 트랜드 순위 목록 */}
        {activeTab === 'ranking' && (
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
                  key={video.id}
                  rank={index + 1}
                  video={video}
                  change={rankChanges[index]}
                />
              ))
            )}
          </div>
        )}

        {/* 요약 정보 (트랜드 순위 탭일 때만 표시) */}
        {activeTab === 'ranking' && !loading && trendVideos.length > 0 && (
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-white/70 text-sm mb-1">전체 조회수</div>
                <div className="text-2xl font-bold text-white">58.8만회</div>
              </div>
              <div>
                <div className="text-white/70 text-sm mb-1">평균 평점</div>
                <div className="text-2xl font-bold text-white">4.96/5.0</div>
              </div>
              <div>
                <div className="text-white/70 text-sm mb-1">순위 변동</div>
                <div className="text-2xl font-bold text-white">5개 콘텐츠</div>
              </div>
            </div>
          </div>
        )}

        {/* 카테고리별 콘텐츠 그리드 */}
        {activeTab === 'category' && (
          <div className="mb-8">
            {/* 콘텐츠 개수 표시 */}
            <div className="text-white mb-6">
              {trendVideos.length > 0 ? `${trendVideos.length}개의 콘텐츠` : '0개의 콘텐츠'}
            </div>

            {/* 그리드 (개인맞춤영상추천과 동일: 2열, Featured 카드) */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-blue-300">데이터를 불러오는 중...</div>
              </div>
            ) : trendVideos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-blue-300">콘텐츠가 없습니다.</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {trendVideos.slice(0, 8).map((video) => (
                  <VideoCard key={video.id} video={video} featured />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Charts Section (실시간 분석 탭일 때만 표시) */}
        {activeTab === 'realtime' && (
          <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Real-time Views Chart */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
            <h3 className="text-xl font-bold text-white mb-6">실시간 조회수 추이</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={viewsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  domain={[0, 10000]}
                  ticks={[0, 2500, 5000, 7500, 10000]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1f3a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke="#FCD34D" 
                  strokeWidth={3}
                  dot={{ fill: '#FCD34D', r: 4 }}
                  activeDot={{ r: 6, fill: '#EC4899' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Region Interest Chart */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30">
            <h3 className="text-xl font-bold text-white mb-6">지역별 관심도</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={regionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {regionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1f3a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trending Destinations */}
        <div className="bg-[#1a1f3a]/80 backdrop-blur-sm rounded-lg p-6 border border-blue-900/30 mb-8">
          <h3 className="text-xl font-bold text-white mb-6">급상승 여행지</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="name" 
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1f3a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="value" fill="#FCD34D" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </>
        )}
      </main>
    </div>
  )
}

export default TravelTrends
