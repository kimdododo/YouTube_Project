import { useState, useEffect } from 'react'
import { getAllVideos, getDiversifiedVideos } from '../api/videos'

/**
 * 테마별 비디오 데이터를 가져오는 커스텀 훅
 * 현재는 mock 데이터를 사용하지만, 나중에 실제 API로 교체 가능하도록 구조화
 */
function useThemeVideos() {
  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchThemeVideos = async () => {
      try {
        setLoading(true)
        setError(null)

        // 실제 API가 있으면 여기서 호출
        // 현재는 mock 데이터 사용
        const mockThemes = [
          {
            id: 'budget',
            name: '가성비여행',
            hashtag: '#가성비여행',
            description: '실속 있게 즐기는 알짜배기 여행이에요.',
            route: '/theme/budget',
            videos: [] // 나중에 API로 채워짐
          },
          {
            id: 'solo',
            name: '혼자여행',
            hashtag: '#혼자여행',
            description: '혼자만의 여유를 사랑하는 분들을 위한 추천이에요.',
            route: '/theme/solo',
            videos: []
          },
          {
            id: 'aesthetic',
            name: '감성여행',
            hashtag: '#감성여행',
            description: '마음을 쉬게 하는 감성 가득한 여행이에요.',
            route: '/theme/aesthetic',
            videos: []
          }
        ]

        // 실제 비디오 데이터 가져오기 (임시로 전체 비디오에서 필터링)
        try {
          const allVideos = await getDiversifiedVideos(300, 1) // 더 많은 영상 가져오기 (가로 스크롤용)
          
          // 키워드 기반으로 테마별 비디오 필터링
          mockThemes.forEach((theme) => {
            const themeKeywords = {
              budget: ['가성비', '저렴', '알뜰', '실속'],
              solo: ['혼자', '솔로', '혼여', '1인'],
              aesthetic: ['감성', '힐링', '휴양', '여유']
            }

            const keywords = themeKeywords[theme.id] || []
            theme.videos = allVideos
              .filter((video) => {
                const title = (video.title || '').toLowerCase()
                const description = (video.description || '').toLowerCase()
                const keyword = (video.keyword || '').toLowerCase()
                return keywords.some((kw) => 
                  title.includes(kw) || description.includes(kw) || keyword.includes(kw)
                )
              })
              // 각 테마당 최대 30개로 증가 (가로 스크롤에 많은 영상 표시)
              .slice(0, 30)
          })

          setThemes(mockThemes)
        } catch (apiError) {
          console.warn('[useThemeVideos] API 호출 실패, mock 데이터 사용:', apiError)
          // API 실패 시 빈 배열로 설정
          setThemes(mockThemes)
        }
      } catch (err) {
        console.error('[useThemeVideos] Error:', err)
        setError(err.message || '테마별 영상을 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchThemeVideos()
  }, [])

  return { themes, loading, error }
}

export default useThemeVideos

