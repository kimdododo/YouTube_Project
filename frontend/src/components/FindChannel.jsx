import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, User } from 'lucide-react'
import Logo from './Logo'
import AIReviewModal from './AIReviewModal'
import { getAllVideos, getDiversifiedVideos, getTrendVideos, getRecommendedVideos, getMostLikedVideos } from '../api/videos'
import { searchChannels } from '../api/channels'
import { handleImageError } from '../utils/imageUtils'

function FindChannel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [channelCards, setChannelCards] = useState([])
  const [loading, setLoading] = useState(true)

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

  // 실제 데이터 가져오기
  useEffect(() => {
    if (searchQuery.trim()) {
      // 검색어가 있으면 검색 API 호출
      fetchSearchResults()
    } else {
      // 검색어가 없으면 기본 목록 조회
      fetchVideos()
    }
  }, [searchQuery])

  // 검색 결과 가져오기 (채널 검색 후 해당 채널의 비디오 가져오기)
  const fetchSearchResults = async () => {
    try {
      setLoading(true)
      // 브라우저에서는 항상 프록시 경로(/api) 사용
      // Docker 서비스 이름(backend:8000)은 브라우저에서 직접 사용할 수 없음
      const apiBase = '/api'
      
      // 1. 채널 검색
      const channels = await searchChannels(searchQuery.trim(), 50, true)
      
      if (channels.length === 0) {
        setChannelCards([])
        setLoading(false)
        return
      }
      
      // 2. 검색된 채널들의 비디오 가져오기 (각 채널당 최대 3개)
      const videoPromises = channels.slice(0, 20).map(async (channel) => {
        try {
          const response = await fetch(`${apiBase}/videos?channel_id=${encodeURIComponent(channel.channel_id)}&limit=3`)
          if (!response.ok) return []
          const data = await response.json()
          const videos = data.videos || data
          return videos.map(video => ({
            ...video,
            channel_id: channel.channel_id,
            channel: channel.name
          }))
        } catch {
          return []
        }
      })
      
      const videoResults = await Promise.allSettled(videoPromises)
      const allVideos = []
      videoResults.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allVideos.push(...result.value)
        }
      })
      
      // 3. 비디오 형식 변환
      const formattedVideos = allVideos.map(video => {
        const videoId = video.id || video.video_id
        const isShorts = video.is_shorts || false
        return {
          id: videoId,
          thumbnail_url: video.thumbnail_url,
          title: video.title,
          description: video.description,
          channel: video.channel || 'Unknown',
          channel_id: video.channel_id,
          views: video.view_count || 0,
          youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
          is_shorts: isShorts
        }
      })
      
      // 4. 채널 다양화 적용
      setChannelCards(diversifyByChannel(formattedVideos, 18, 1))
      setLoading(false)
    } catch (error) {
      console.error('[FindChannel] Search error:', error)
      // 검색 실패 시 기본 목록으로 폴백
      fetchVideos()
    }
  }

  // 기본 데이터 가져오기
  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchVideos()
      // 주기적 업데이트 (30초마다)
      const interval = setInterval(fetchVideos, 30000)
      return () => clearInterval(interval)
    }
  }, [])

  const diversifyByChannel = (items, target = 18, maxPerChannel = 1) => {
    if (!items || items.length === 0) return []
    const seen = new Map()
    const out = []
    for (const it of items) {
      const ch = it.channel_id || it.channelId || it.channel || `unknown-${it.id || Math.random()}`
      const cnt = seen.get(ch) || 0
      if (cnt < maxPerChannel) {
        out.push(it)
        seen.set(ch, cnt + 1)
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

  const fetchVideos = async () => {
    try {
      setLoading(true)
      // 1) 백엔드에서 채널 다양화된 목록 시도
      try {
        // 넉넉히 받아서(200) 화면엔 18개만 채널 중복 없이 노출
        const diversified = await getDiversifiedVideos(200, 1)
        if (diversified && diversified.length > 0) {
          setChannelCards(diversifyByChannel(diversified, 18, 1))
          return
        }
      } catch (_) { /* fallback below */ }

      // 2) 1차 폴백: 트렌드/추천/좋아요 상위를 병렬로 모아 다양화
      try {
        const [tr, rec, liked] = await Promise.allSettled([
          getTrendVideos(),
          getRecommendedVideos(),
          getMostLikedVideos(20)
        ])
        const merged = []
        const pushRes = (res) => {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) merged.push(...res.value)
        }
        pushRes(tr); pushRes(rec); pushRes(liked)
        if (merged.length > 0) {
          // 중복 제거 by id
          const seen = new Set()
          const unique = []
          for (const v of merged) {
            if (!v?.id || seen.has(v.id)) continue
            seen.add(v.id)
            unique.push(v)
          }
          const diversifiedMerge = diversifyByChannel(unique, 18, 1)
          setChannelCards(diversifiedMerge)
          return
        }
      } catch (_) { /* fall through */ }

      // 3) 최종 폴백: 전체에서 가져와 프론트에서 다양화
      const videos = await getAllVideos(0, 500)
      const diversifiedLocal = diversifyByChannel(videos || [], 18, 1)
      setChannelCards(diversifiedLocal)
    } catch (error) {
      console.error('Failed to fetch videos:', error)
      // API 실패 시 빈 배열 (더미 데이터 사용 안 함)
      setChannelCards([])
    } finally {
      setLoading(false)
    }
  }

  // 검색어가 있으면 백엔드 검색 결과 사용, 없으면 전체 목록 사용
  const filteredCards = channelCards

  const handleVideoClick = (card) => {
    // YouTube URL이 있으면 새 탭에서 열기
    if (card.youtube_url || card.id) {
      const youtubeUrl = card.youtube_url || `https://www.youtube.com/watch?v=${card.id}`
      window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
    } else {
      // 모달은 선택적으로 사용 (필요시)
      setSelectedVideo(card)
      setIsModalOpen(true)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedVideo(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden">
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
              <a 
                href="/find-channel" 
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: '#FFFFFF',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                채널 찾기
              </a>
              <a 
                href="/travel-trends" 
                className="font-bold leading-6" 
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  color: 'rgba(147, 197, 253, 1)',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                여행 트렌드
              </a>
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
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 채널 찾기 섹션 */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              채널 찾기 (AI 한줄평)
            </h2>
            <p className="text-blue-200">
              AI가 분석한 각 채널의 특징과 추천 포인트를 한눈에 확인하세요.
            </p>
          </div>

          {/* 검색 바 */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Q 채널명, 여행지, 키워드로 검색하세요...."
                className="w-full pl-12 pr-4 py-3 bg-[#1a1f3a]/80 border border-blue-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 채널 카드 그리드 (2x3) */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-blue-300">데이터를 불러오는 중...</div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-blue-300">
                {searchQuery ? '검색 결과가 없습니다.' : '채널이 없습니다.'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCards.map((card) => (
              <div
                key={card.id}
                onClick={() => handleVideoClick(card)}
                className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-lg border border-blue-900/30 shadow-xl overflow-hidden hover:border-purple-500/50 hover:-translate-y-3 hover:shadow-2xl transition-all duration-300 ease-in-out cursor-pointer"
              >
                {/* 이미지 */}
                <div className="relative aspect-video overflow-hidden">
                  {card.thumbnail_url ? (
                    <img
                      src={card.thumbnail_url}
                      alt={card.title}
                      className="w-full h-full object-cover"
                      style={{
                        imageRendering: '-webkit-optimize-contrast',
                        backfaceVisibility: 'hidden',
                        transform: 'translateZ(0)',
                        WebkitFontSmoothing: 'antialiased'
                      }}
                      loading="lazy"
                      onError={(e) => {
                        handleImageError(e, card.id, card.is_shorts)
                        if (e.target.style.display === 'none') {
                          const placeholder = e.target.parentElement.querySelector('.placeholder')
                          if (placeholder) placeholder.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center placeholder" style={{ display: card.thumbnail_url ? 'none' : 'flex' }}>
                    <Search className="w-12 h-12 text-white/50" />
                  </div>
                  {/* 별점 */}
                  <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-white text-xs font-medium">{card.rating}</span>
                  </div>
                </div>

                {/* 내용 */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                    {card.title}
                  </h3>
                  {/* 설명 제거 */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">{(card.channel || '').replace(/^channel[:\s]*/i, '')}</span>
                    <span className="text-gray-400 text-xs">◎ {card.views}</span>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* AI 리뷰 요약 모달 */}
      <AIReviewModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        video={selectedVideo}
      />
    </div>
  )
}

export default FindChannel
