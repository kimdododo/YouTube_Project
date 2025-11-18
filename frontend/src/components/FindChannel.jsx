import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Star, Clock, X } from 'lucide-react'
import AppLayout from './layouts/AppLayout'
import { getAllVideos, getDiversifiedVideos, getTrendVideos, getRecommendedVideos, getMostLikedVideos } from '../api/videos'
import { searchChannels } from '../api/channels'
import { handleImageError } from '../utils/imageUtils'
import { saveSearchHistory, getSearchHistory, deleteSearchHistory } from '../api/searchHistory'

function FindChannel() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [channelCards, setChannelCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const searchInputRef = useRef(null)
  const searchContainerRef = useRef(null)

  // 로그인 상태 체크는 AppLayout에서 처리

  // 검색 기록 로드
  useEffect(() => {
    const loadHistory = async () => {
      const history = await getSearchHistory(10) // 최근 10개만
      setSearchHistory(history)
    }
    loadHistory()
  }, [])

  // 검색 기록 표시/숨김 제어
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 실제 데이터 가져오기
  useEffect(() => {
    if (searchQuery.trim()) {
      // 검색어가 있으면 검색 API 호출
      fetchSearchResults()
      // 검색 기록에 추가 (비동기, 에러가 발생해도 검색은 계속 진행)
      const query = searchQuery.trim()
      saveSearchHistory(query)
        .then(() => {
          console.log('[FindChannel] Search history saved:', query)
          // 검색 기록 목록 업데이트
          return getSearchHistory(10)
        })
        .then(history => {
          console.log('[FindChannel] Search history loaded:', history)
          setSearchHistory(history)
        })
        .catch(error => {
          console.error('[FindChannel] Failed to save/load search history:', error)
          // 에러가 발생해도 localStorage에서 다시 시도
          getSearchHistory(10).then(history => {
            setSearchHistory(history)
          }).catch(() => {
            console.error('[FindChannel] Failed to load search history from localStorage')
          })
        })
      setShowHistory(false)
    } else {
      // 검색어가 없으면 기본 목록 조회
      fetchVideos()
    }
  }, [searchQuery])

  // 검색 결과 가져오기 (비디오 제목/키워드 검색 + 채널 검색)
  const fetchSearchResults = async () => {
    try {
      setLoading(true)
      const apiBase = '/api'
      const query = searchQuery.trim()
      
      // 1. 비디오 검색 (제목, 키워드, 설명으로 검색)
      let videoSearchResults = []
      try {
        const videoSearchResponse = await fetch(`${apiBase}/v1/search/videos?q=${encodeURIComponent(query)}&limit=50&page=1`)
        if (videoSearchResponse.ok) {
          const videoSearchData = await videoSearchResponse.json()
          const items = videoSearchData.items || videoSearchData.data?.items || []
          videoSearchResults = items.map(video => {
            const videoId = video.id || video.video_id
            const isShorts = video.is_shorts || false
            return {
              id: videoId,
              thumbnail_url: video.thumbnail_url,
              title: video.title,
              description: video.description,
              channel: video.channel_id || video.keyword || video.region || 'Unknown',
              channel_id: video.channel_id,
              views: video.view_count || 0,
              youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
              is_shorts: isShorts,
              rating: video.rating || 5
            }
          })
        }
      } catch (err) {
        console.warn('[FindChannel] Video search failed:', err)
      }
      
      // 2. 채널 검색 (채널명으로 검색)
      let channelVideoResults = []
      try {
        const channels = await searchChannels(query, 20, true)
        
        if (channels.length > 0) {
          // 검색된 채널들의 비디오 가져오기 (각 채널당 최대 3개)
          const videoPromises = channels.slice(0, 10).map(async (channel) => {
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
          videoResults.forEach(result => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
              channelVideoResults.push(...result.value)
            }
          })
        }
      } catch (err) {
        console.warn('[FindChannel] Channel search failed:', err)
      }
      
      // 3. 두 결과 합치기 (중복 제거)
      const allVideos = [...videoSearchResults, ...channelVideoResults]
      const uniqueVideos = []
      const seenIds = new Set()
      
      for (const video of allVideos) {
        const videoId = video.id || video.video_id
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId)
          uniqueVideos.push(video)
        }
      }
      
      // 4. 비디오 형식 변환
      const formattedVideos = uniqueVideos.map(video => {
        const videoId = video.id || video.video_id
        const isShorts = video.is_shorts || false
        return {
          id: videoId,
          thumbnail_url: video.thumbnail_url,
          title: video.title,
          description: video.description,
          channel: (video.channel || 'Unknown').toString().replace(/^channel:\s*/i, ''),
          channel_id: video.channel_id,
          views: video.view_count || video.views || 0,
          youtube_url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
          is_shorts: isShorts,
          rating: video.rating || 5
        }
      })
      
      // 5. 채널 다양화 적용
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
      // 주기적 업데이트 제거 - 사용자가 수동으로 새로고침할 수 있도록
      // const interval = setInterval(fetchVideos, 30000)
      // return () => clearInterval(interval)
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
    // 비디오 ID가 있으면 VideoDetail 페이지로 이동
    const videoId = card.id || card.video_id
    if (videoId) {
      navigate(`/video/${videoId}`)
    } else {
      console.warn('[FindChannel] Video ID not found for card:', card)
    }
  }

  const handleSearchHistoryClick = (query) => {
    setSearchQuery(query)
    setShowHistory(false)
    searchInputRef.current?.focus()
  }

  const handleDeleteHistory = async (e, query) => {
    e.stopPropagation()
    await deleteSearchHistory(query)
    const history = await getSearchHistory(10)
    setSearchHistory(history)
  }

  const handleSearchFocus = () => {
    if (searchHistory.length > 0) {
      setShowHistory(true)
    }
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    if (e.target.value.trim() === '' && searchHistory.length > 0) {
      setShowHistory(true)
    } else if (e.target.value.trim() !== '') {
      setShowHistory(false)
    }
  }

  return (
    <AppLayout>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 채널 찾기 섹션 */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              여행 찾기
            </h2>
            <p className="text-blue-200">
              여행 관련 영상을 검색하고 찾아보세요.
            </p>
          </div>

          {/* 검색 바 */}
          <div className="mb-8" ref={searchContainerRef}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                placeholder="채널명, 여행지, 키워드로 검색하세요."
                className="w-full pl-12 pr-4 py-3 bg-[#1a1f3a]/80 border border-blue-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              
              {/* 검색 기록 드롭다운 */}
              {showHistory && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1f3a]/95 backdrop-blur-lg border border-blue-900/30 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                  {searchHistory.map((item, index) => (
                    <div
                      key={`${item.query}-${index}`}
                      onClick={() => handleSearchHistoryClick(item.query)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-blue-900/20 cursor-pointer transition-colors border-b border-blue-900/10 last:border-b-0"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-white text-sm truncate">{item.query}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteHistory(e, item.query)}
                        className="ml-2 p-1 hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                        title="삭제"
                      >
                        <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-lg border border-black/50 shadow-xl overflow-hidden hover:border-black/70 hover:-translate-y-3 hover:shadow-2xl transition-all duration-300 ease-in-out cursor-pointer"
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
      </div>
    </AppLayout>
  )
}

export default FindChannel
