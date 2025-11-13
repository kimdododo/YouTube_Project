import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import VideoCard from './VideoCard'
import AppLayout from './layouts/AppLayout'
import { getAllVideos } from '../api/videos'

const THEME_CONFIG = {
  budget: {
    title: '#가성비 여행',
    description: '가성비 있게 즐기는 여행들을 한눈에 만나보세요.',
    keyword: '가성비'
  },
  solo: {
    title: '#혼자여행',
    description: '혼자만의 여유를 사랑하는 분들을 위한 추천이에요.',
    keyword: '혼자'
  },
  aesthetic: {
    title: '#감성여행',
    description: '마음을 쉬게 하는 감성 가득한 여행이에요.',
    keyword: '감성'
  }
}

function ThemeVideos() {
  const { theme } = useParams()
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState([])
  const [error, setError] = useState(null)

  const themeConfig = THEME_CONFIG[theme] || THEME_CONFIG.budget

  // 테마별 영상 가져오기
  useEffect(() => {
    fetchThemeVideos()
  }, [theme])

  const fetchThemeVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const allVideos = await getAllVideos(0, 200)
      
      // 테마별로 영상 필터링
      const filteredVideos = allVideos.filter(video => {
        const keyword = (video.keyword || '').toLowerCase()
        const description = (video.description || '').toLowerCase()
        const title = (video.title || '').toLowerCase()
        const themeKeyword = themeConfig.keyword.toLowerCase()
        
        if (theme === 'budget') {
          return keyword.includes('가성비') || keyword.includes('budget') || 
                 description.includes('가성비') || description.includes('budget') ||
                 title.includes('가성비') || title.includes('budget') ||
                 keyword.includes('가격') || description.includes('가격')
        } else if (theme === 'solo') {
          return keyword.includes('혼자') || keyword.includes('solo') ||
                 description.includes('혼자') || description.includes('solo') ||
                 title.includes('혼자') || title.includes('solo') ||
                 keyword.includes('1인') || description.includes('1인')
        } else if (theme === 'aesthetic') {
          return keyword.includes('감성') || keyword.includes('aesthetic') ||
                 description.includes('감성') || description.includes('aesthetic') ||
                 title.includes('감성') || title.includes('aesthetic') ||
                 keyword.includes('힐링') || description.includes('힐링') ||
                 keyword.includes('휴양') || description.includes('휴양')
        }
        return false
      })
      
      // 중복 제거
      const dedupeById = (items) => {
        const seen = new Set()
        const out = []
        for (const it of items || []) {
          const id = it.id || it.video_id
          if (!id || seen.has(id)) continue
          seen.add(id)
          out.push(it)
        }
        return out
      }
      
      setVideos(dedupeById(filteredVideos))
    } catch (error) {
      console.error('[ThemeVideos] Failed to fetch theme videos:', error)
      setError(error.message || '영상을 불러오는데 실패했습니다.')
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="mb-12 text-left">
          <h1 
            className="font-bold text-white mb-4" 
            style={{
              fontSize: '36px',
              lineHeight: '44px',
              fontFamily: 'Arial, sans-serif',
              color: '#FFFFFF'
            }}
          >
            {themeConfig.title}
          </h1>
          <p 
            className="text-white"
            style={{
              fontSize: '18px',
              lineHeight: '26px',
              fontFamily: 'Arial, sans-serif',
              color: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            {themeConfig.description}
          </p>
        </div>

        {/* Video Grid - 3열 2행으로 6개만 표시 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-blue-300 animate-pulse">데이터를 불러오는 중...</div>
            <div className="text-blue-200 text-sm mt-2">잠시만 기다려주세요...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 mb-4">{error}</div>
            <button 
              onClick={fetchThemeVideos}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-blue-300 text-lg mb-2">해당 테마의 영상이 없습니다.</div>
            <div className="text-blue-200 text-sm">데이터를 불러오는 중 문제가 발생했습니다.</div>
            <button 
              onClick={fetchThemeVideos}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {videos.slice(0, 6).map((video) => (
              <VideoCard key={video.id || video.video_id} video={video} featured />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default ThemeVideos

