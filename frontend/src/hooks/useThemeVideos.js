import { useState, useEffect } from 'react'
import { getAllVideos, getDiversifiedVideos } from '../api/videos'
import { getMyKeywords } from '../api/auth'

/**
 * 테마별 비디오 데이터를 가져오는 커스텀 훅
 * 사용자가 회원가입 시 선택한 키워드를 기반으로 테마 생성
 */
function useThemeVideos() {
  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 한글 키워드 텍스트를 키워드 ID로 매핑
  const keywordTextToId = {
    '혼자여행': 'solo',
    '가성비여행': 'budget',
    '감성여행': 'aesthetic',
    '브이로그': 'vlog',
    '국내여행': 'domestic',
    '해외여행': 'global',
    '당일치기': 'oneday',
    '맛집투어': 'food',
    '숙소리뷰': 'stay',
    '캠핑': 'camping',
    '카페투어': 'cafe'
  }

  // 키워드 ID를 테마 정보로 매핑
  const keywordToTheme = {
    solo: {
      id: 'solo',
      name: '혼자여행',
      hashtag: '#혼자여행',
      description: '혼자만의 여유를 사랑하는 분들을 위한 추천이에요.',
      route: '/theme/solo',
      keywords: ['혼자', '솔로', '혼여', '1인', 'solo', 'alone', 'single']
    },
    budget: {
      id: 'budget',
      name: '가성비여행',
      hashtag: '#가성비여행',
      description: '실속 있게 즐기는 알짜배기 여행이에요.',
      route: '/theme/budget',
      keywords: ['가성비', '저렴', '알뜰', '실속', 'budget', 'cheap', 'affordable']
    },
    aesthetic: {
      id: 'aesthetic',
      name: '감성여행',
      hashtag: '#감성여행',
      description: '마음을 쉬게 하는 감성 가득한 여행이에요.',
      route: '/theme/aesthetic',
      keywords: ['감성', '힐링', '휴양', '여유', 'aesthetic', 'healing', 'relaxation']
    },
    vlog: {
      id: 'vlog',
      name: '브이로그',
      hashtag: '#브이로그',
      description: '일상의 여행을 담은 브이로그 영상이에요.',
      route: '/theme/vlog',
      keywords: ['브이로그', 'vlog', '일상', '여행일기']
    },
    domestic: {
      id: 'domestic',
      name: '국내여행',
      hashtag: '#국내여행',
      description: '우리나라 곳곳을 탐험하는 국내 여행이에요.',
      route: '/theme/domestic',
      keywords: ['국내', '한국', 'domestic', 'korea']
    },
    global: {
      id: 'global',
      name: '해외여행',
      hashtag: '#해외여행',
      description: '세계 각국을 여행하는 해외 여행이에요.',
      route: '/theme/global',
      keywords: ['해외', '해외여행', 'global', 'overseas', 'abroad']
    },
    oneday: {
      id: 'oneday',
      name: '당일치기',
      hashtag: '#당일치기',
      description: '짧고 알찬 당일치기 여행이에요.',
      route: '/theme/oneday',
      keywords: ['당일치기', '당일', 'oneday', 'day trip']
    },
    food: {
      id: 'food',
      name: '맛집투어',
      hashtag: '#맛집투어',
      description: '현지 맛집을 찾아 떠나는 맛집 투어예요.',
      route: '/theme/food',
      keywords: ['맛집', '음식', '식당', 'food', 'restaurant', 'cafe']
    },
    stay: {
      id: 'stay',
      name: '숙소리뷰',
      hashtag: '#숙소리뷰',
      description: '다양한 숙소를 리뷰하는 영상이에요.',
      route: '/theme/stay',
      keywords: ['숙소', '호텔', '리조트', 'stay', 'hotel', 'resort']
    },
    camping: {
      id: 'camping',
      name: '캠핑',
      hashtag: '#캠핑',
      description: '자연 속에서 즐기는 캠핑 여행이에요.',
      route: '/theme/camping',
      keywords: ['캠핑', 'camping', '야영', '텐트']
    },
    cafe: {
      id: 'cafe',
      name: '카페투어',
      hashtag: '#카페투어',
      description: '예쁜 카페를 찾아 떠나는 투어예요.',
      route: '/theme/cafe',
      keywords: ['카페', 'cafe', '커피', '디저트']
    }
  }

  useEffect(() => {
    const fetchThemeVideos = async () => {
      try {
        setLoading(true)
        setError(null)

        // 사용자가 선택한 키워드 가져오기
        let userKeywords = []
        
        // 1순위: localStorage에서 가져오기 (회원가입 시 저장된 키워드)
        try {
          const savedKeywords = JSON.parse(localStorage.getItem('travelKeywords') || '[]')
          if (Array.isArray(savedKeywords) && savedKeywords.length > 0) {
            userKeywords = savedKeywords
            console.log('[useThemeVideos] Loaded keywords from localStorage:', userKeywords)
          }
        } catch (e) {
          console.warn('[useThemeVideos] Failed to parse keywords from localStorage:', e)
        }

        // 2순위: API에서 가져오기 (로그인한 사용자의 키워드)
        if (userKeywords.length === 0) {
          try {
            const apiKeywords = await getMyKeywords(11) // 최대 11개 키워드
            if (Array.isArray(apiKeywords) && apiKeywords.length > 0) {
              // API 응답이 객체 배열인 경우 keyword 필드 추출
              const keywordTexts = apiKeywords.map(kw => kw.keyword || kw.word || kw).filter(Boolean)
              
              // 한글 키워드 텍스트를 키워드 ID로 변환
              userKeywords = keywordTexts
                .map(text => keywordTextToId[text] || text) // 매핑된 ID 또는 원본 텍스트
                .filter(id => keywordToTheme[id]) // 테마가 있는 키워드만 필터링
              
              console.log('[useThemeVideos] Loaded keywords from API:', keywordTexts, '-> converted to:', userKeywords)
            }
          } catch (e) {
            console.warn('[useThemeVideos] Failed to load keywords from API:', e)
          }
        }

        // 사용자가 선택한 키워드가 없으면 기본 테마 사용
        if (userKeywords.length === 0) {
          userKeywords = ['budget', 'solo', 'aesthetic'] // 기본값
          console.log('[useThemeVideos] Using default themes:', userKeywords)
        }

        // 사용자 키워드를 기반으로 테마 생성
        const userThemes = userKeywords
          .filter(keywordId => keywordToTheme[keywordId]) // 매핑된 키워드만 사용
          .slice(0, 6) // 최대 6개 테마만 표시
          .map(keywordId => ({
            ...keywordToTheme[keywordId],
            videos: [] // 나중에 API로 채워짐
          }))

        // 실제 비디오 데이터 가져오기 (임시로 전체 비디오에서 필터링)
        try {
          const allVideos = await getDiversifiedVideos(1000, 1) // 더 많은 영상 가져오기 (가로 스크롤용)
          
          // 이미 할당된 비디오 ID를 추적하여 중복 방지
          const assignedVideoIds = new Set()
          
          // 키워드 기반으로 테마별 비디오 필터링
          userThemes.forEach((theme) => {
            const keywords = theme.keywords || []
            
            // 아직 할당되지 않은 비디오만 필터링
            const filteredVideos = allVideos
              .filter((video) => {
                // 이미 다른 테마에 할당된 비디오는 제외
                const videoId = video.id || video.video_id
                if (assignedVideoIds.has(videoId)) {
                  return false
                }
                
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
              // 각 테마당 최대 50개로 증가 (가로 스크롤에 많은 영상 표시)
              .slice(0, 50)
            
            // 할당된 비디오 ID를 추적에 추가
            filteredVideos.forEach(video => {
              const videoId = video.id || video.video_id
              if (videoId) {
                assignedVideoIds.add(videoId)
              }
            })
            
            theme.videos = filteredVideos
          })

          setThemes(userThemes)
        } catch (apiError) {
          console.warn('[useThemeVideos] API 호출 실패, 빈 비디오로 설정:', apiError)
          // API 실패 시 사용자 테마는 유지하되 비디오는 빈 배열
          setThemes(userThemes.map(theme => ({ ...theme, videos: [] })))
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

