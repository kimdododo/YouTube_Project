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
      keywords: ['혼자', '솔로', '혼여', '1인', '혼자서', '혼행', '솔로여행', '혼자여행', 'solo', 'alone', 'single', 'solo travel', '혼자만', '혼자로', '자유여행', '혼자만의시간', '혼자만의여행', '조용한여행', '혼자걷기', '도시혼행', '자연혼행', '혼자카페투어', '혼자맛집', '솔로트립', '나홀로여행', '혼행루트']
    },
    budget: {
      id: 'budget',
      name: '가성비여행',
      hashtag: '#가성비여행',
      description: '실속 있게 즐기는 알짜배기 여행이에요.',
      route: '/theme/budget',
      keywords: ['가성비', '저렴', '알뜰', '실속', '싸게', '저렴한', '가성비', '알뜰여행', '저예산', 'budget', 'cheap', 'affordable', 'economy', 'low cost', '저렴하게', '실속있게', '알뜰하게', '저비용', '초저가', '반값여행', '10만원여행', '1박2일저렴', '할인여행', '특가여행', '여행비절약', '예산절약', '가성비식당', '가성비호텔', '무지출여행']
    },
    aesthetic: {
      id: 'aesthetic',
      name: '감성여행',
      hashtag: '#감성여행',
      description: '마음을 쉬게 하는 감성 가득한 여행이에요.',
      route: '/theme/aesthetic',
      keywords: ['감성', '힐링', '휴양', '여유', '감성적', '힐링여행', '휴양지', '여유로운', '마음쉼', 'aesthetic', 'healing', 'relaxation', 'peaceful', 'calm', 'serene', '감성여행', '힐링', '휴식', '여유', '하이엔드', '감성스팟', '분위기맛집', '감성숙소', '감성카페거리', '노을스팟', '하늘맛집', '바다감성', '감성포토존', '위로여행', '휴식여행', '리트릿여행']
    },
    vlog: {
      id: 'vlog',
      name: '브이로그',
      hashtag: '#브이로그',
      description: '일상의 여행을 담은 브이로그 영상이에요.',
      route: '/theme/vlog',
      keywords: ['브이로그', 'vlog', '일상', '여행일기', 'v로그', '브이', '일상여행', '여행브이로그', 'daily', 'daily vlog', 'travel vlog', '여행일상', '일상기록', '여행브이', '브이로그여행', 'vlog여행루트', '기록브이로그', 'POV여행', 'asmr여행', '리얼여행기록', '하루브이로그', '여행준비vlog', '짐싸기vlog']
    },
    domestic: {
      id: 'domestic',
      name: '국내여행',
      hashtag: '#국내여행',
      description: '우리나라 곳곳을 탐험하는 국내 여행이에요.',
      route: '/theme/domestic',
      keywords: ['국내', '한국', '서울', '부산', '제주', '경주', '전주', '강릉', '속초', '여수', '부산여행', '제주여행', '서울여행', 'domestic', 'korea', 'korean', 'south korea', '국내여행', '한국여행', '국내', '인천', '대구', '광주', '울산', '통영', '남해', '거제', '강원도', '충청도', '전라도', '국내핫플', '국내여행추천', '국내당일치기', '동네여행', '한옥마을', '해변산책', '시장투어']
    },
    global: {
      id: 'global',
      name: '해외여행',
      hashtag: '#해외여행',
      description: '세계 각국을 여행하는 해외 여행이에요.',
      route: '/theme/global',
      keywords: ['해외', '해외여행', '일본', '중국', '태국', '베트남', '유럽', '미국', '영국', '프랑스', '이탈리아', '스페인', '독일', 'global', 'overseas', 'abroad', 'international', 'foreign', '해외', '여행', '해외여행', '대만', '홍콩', '싱가포르', '필리핀', '발리', '하와이', 'LA', '뉴욕', '메콩', '방콕핫플', '자유여행해외', '해외핫플', '해외레스토랑', '해외로컬', '환전팁', '해외교통', '해외맛집투어']
    },
    oneday: {
      id: 'oneday',
      name: '당일치기',
      hashtag: '#당일치기',
      description: '짧고 알찬 당일치기 여행이에요.',
      route: '/theme/oneday',
      keywords: ['당일치기', '당일', '당일여행', '하루여행', '짧은여행', 'oneday', 'day trip', 'one day', 'daytrip', '당일', '하루', '짧은', '당일치기여행', '반나절여행', '딱하루', '시간절약', '근교핫플', '서울근교', '부산근교', '대구근교', '수도권당일', '빠른코스', '당일핫플', '하루코스추천', '짧은코스']
    },
    food: {
      id: 'food',
      name: '맛집투어',
      hashtag: '#맛집투어',
      description: '현지 맛집을 찾아 떠나는 맛집 투어예요.',
      route: '/theme/food',
      keywords: ['맛집', '음식', '식당', '먹방', '맛집투어', '음식여행', '먹거리', '로컬맛집', '현지음식', 'food', 'restaurant', 'cafe', 'cuisine', 'local food', 'eating', 'food tour', '맛집', '음식', '먹방', '맛집투어', '로컬맛집추천', '스트리트푸드', '전통시장', '미슐랭', '맛집지도', '혼밥가능', '푸드트립', '먹킷리스트', '먹투어', '디저트맛집', '카레맛집', '면요리맛집', '야시장음식']
    },
    stay: {
      id: 'stay',
      name: '숙소리뷰',
      hashtag: '#숙소리뷰',
      description: '다양한 숙소를 리뷰하는 영상이에요.',
      route: '/theme/stay',
      keywords: ['숙소', '호텔', '리조트', '펜션', '게스트하우스', '에어비앤비', '숙박', '호텔리뷰', '숙소리뷰', 'stay', 'hotel', 'resort', 'accommodation', 'lodging', 'airbnb', 'guesthouse', '숙소', '호텔', '리조트', '펜션', '스파호텔', '오션뷰', '한옥숙소', '프리미엄숙소', '수영장숙소', '룸투어', '룸컨디션', '숙소혜택', '조식리뷰', '가성비호텔', '특급호텔', '럭셔리리조트', '프라이빗숙소']
    },
    camping: {
      id: 'camping',
      name: '캠핑',
      hashtag: '#캠핑',
      description: '자연 속에서 즐기는 캠핑 여행이에요.',
      route: '/theme/camping',
      keywords: ['캠핑', '야영', '텐트', '캠핑장', '오토캠핑', '글램핑', '캠핑여행', 'camping', 'tent', 'outdoor', 'glamping', 'auto camping', '캠핑', '야영', '텐트', '캠핑장', '차박캠핑', '노지캠핑', '백패킹', '감성캠핑', '미니멀캠핑', '캠핑장비추천', '캠핑요리', '캠핑테이블', '텐트추천', '숲캠핑', '바닷가캠핑', '호수캠핑']
    },
    cafe: {
      id: 'cafe',
      name: '카페투어',
      hashtag: '#카페투어',
      description: '예쁜 카페를 찾아 떠나는 투어예요.',
      route: '/theme/cafe',
      keywords: ['카페', '커피', '디저트', '카페투어', '커피숍', '브런치', '카페여행', '예쁜카페', 'cafe', 'coffee', 'dessert', 'brunch', 'coffee shop', '카페', '커피', '디저트', '카페투어', '루프탑카페', '오션뷰카페', '감성카페', '브런치카페', '디저트카페', '포토존카페', '뷰맛집카페', '힐링카페', '예쁜카페추천', '서울카페', '제주카페', '부산카페', '강릉카페']
    }
  }

  useEffect(() => {
    console.log('[useThemeVideos] ===== Hook initialized, starting fetchThemeVideos =====')
    console.log('[useThemeVideos] Component mounted, useEffect triggered')
    
    const fetchThemeVideos = async () => {
      try {
        console.log('[useThemeVideos] Setting loading to true')
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

        console.log('[useThemeVideos] Creating themes from keywords:', userKeywords)
        // 사용자 키워드를 기반으로 테마 생성
        const userThemes = userKeywords
          .filter(keywordId => keywordToTheme[keywordId]) // 매핑된 키워드만 사용
          .slice(0, 6) // 최대 6개 테마만 표시
          .map(keywordId => ({
            ...keywordToTheme[keywordId],
            videos: [] // 나중에 API로 채워짐
          }))
        
        console.log('[useThemeVideos] Created themes:', userThemes.length, userThemes.map(t => t.name))

        // 실제 비디오 데이터 가져오기 (임시로 전체 비디오에서 필터링)
        try {
          console.log('[useThemeVideos] Fetching videos from API...')
          // 백엔드 API의 최대값이 500이므로 500으로 제한
          let allVideos
          try {
            allVideos = await getDiversifiedVideos(500, 1) // 최대 500개까지 가져오기 (백엔드 제한)
            console.log(`[useThemeVideos] Fetched ${allVideos?.length || 0} videos from API`)
          } catch (apiError) {
            console.error('[useThemeVideos] getDiversifiedVideos failed:', apiError)
            console.error('[useThemeVideos] Error details:', {
              message: apiError?.message,
              stack: apiError?.stack,
              name: apiError?.name
            })
            // API 실패 시 빈 배열로 설정
            allVideos = []
          }
          
          // 디버깅: 첫 번째 비디오의 구조 확인
          if (allVideos && allVideos.length > 0) {
            console.log('[useThemeVideos] Sample video structure:', {
              id: allVideos[0].id,
              video_id: allVideos[0].video_id,
              title: allVideos[0].title,
              keyword: allVideos[0].keyword,
              region: allVideos[0].region,
              category: allVideos[0].category,
              view_count: allVideos[0].view_count,
              description: allVideos[0].description
            })
            // 첫 5개 비디오의 키워드/카테고리 확인
            console.log('[useThemeVideos] First 5 videos keywords/categories:', 
              allVideos.slice(0, 5).map(v => ({
                title: v.title?.substring(0, 30),
                keyword: v.keyword,
                region: v.region,
                category: v.category
              }))
            )
          }
          
          if (!allVideos || allVideos.length === 0) {
            console.warn('[useThemeVideos] No videos returned from API, setting empty videos for themes')
            setThemes(userThemes.map(theme => ({ ...theme, videos: [] })))
            return
          }
          
          // 이미 할당된 비디오 ID를 추적하여 중복 방지
          const assignedVideoIds = new Set()
          
          // 키워드 기반으로 테마별 비디오 필터링
          // 새로운 배열을 생성하여 불변성 유지
          const updatedThemes = userThemes.map((theme) => {
            const keywords = theme.keywords || []
            console.log(`[useThemeVideos] Filtering videos for theme "${theme.name}" with keywords:`, keywords)
            
            // 아직 할당되지 않은 비디오만 필터링
            let filteredVideos = allVideos
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
                const region = (video.region || '').toLowerCase()
                
                // 키워드 매칭 (더 관대한 매칭)
                const matches = keywords.some((kw) => {
                  const kwLower = kw.toLowerCase()
                  const matched = (
                    title.includes(kwLower) || 
                    description.includes(kwLower) || 
                    keyword.includes(kwLower) ||
                    category.includes(kwLower) ||
                    region.includes(kwLower)
                  )
                  if (matched) {
                    console.log(`[useThemeVideos] Video matched for theme "${theme.name}":`, {
                      videoTitle: video.title?.substring(0, 30),
                      matchedKeyword: kw,
                      matchType: title.includes(kwLower) ? 'title' : 
                                description.includes(kwLower) ? 'description' :
                                keyword.includes(kwLower) ? 'keyword' :
                                category.includes(kwLower) ? 'category' : 'region'
                    })
                  }
                  return matched
                })
                return matches
              })
            
            // 매칭된 비디오가 부족하면 추가 비디오 할당 (fallback)
            if (filteredVideos.length < 20) {
              const remainingVideos = allVideos.filter((video) => {
                const videoId = video.id || video.video_id
                return !assignedVideoIds.has(videoId)
              })
              
              // 부족한 만큼 추가 (최대 50개까지)
              const needed = Math.min(50 - filteredVideos.length, remainingVideos.length)
              const additionalVideos = remainingVideos.slice(0, needed)
              filteredVideos = [...filteredVideos, ...additionalVideos]
              
              console.log(`[useThemeVideos] Theme "${theme.name}": Found ${filteredVideos.length - additionalVideos.length} matching videos, added ${additionalVideos.length} fallback videos`)
            }
            
            // 매칭된 비디오가 전혀 없으면 모든 비디오에서 랜덤하게 할당 (최후의 수단)
            if (filteredVideos.length === 0) {
              const unassignedVideos = allVideos.filter((video) => {
                const videoId = video.id || video.video_id
                return !assignedVideoIds.has(videoId)
              })
              
              // 최소 10개는 할당 (비디오가 충분하면)
              const minVideos = Math.min(10, unassignedVideos.length)
              if (minVideos > 0) {
                filteredVideos = unassignedVideos.slice(0, minVideos)
                console.warn(`[useThemeVideos] Theme "${theme.name}": No matching videos found, assigned ${filteredVideos.length} random videos as fallback`)
              } else {
                // 할당 가능한 비디오가 없으면 이미 할당된 비디오를 재사용 (중복 허용)
                if (allVideos.length > 0) {
                  filteredVideos = allVideos.slice(0, Math.min(10, allVideos.length))
                  console.warn(`[useThemeVideos] Theme "${theme.name}": All videos assigned, reusing first ${filteredVideos.length} videos`)
                }
              }
            }
            
            // 각 테마당 최대 50개로 제한
            filteredVideos = filteredVideos.slice(0, 50)
            
            // 할당된 비디오 ID를 추적에 추가
            filteredVideos.forEach(video => {
              const videoId = video.id || video.video_id
              if (videoId) {
                assignedVideoIds.add(videoId)
              }
            })
            
            console.log(`[useThemeVideos] Theme "${theme.name}": Assigned ${filteredVideos.length} videos`)
            
            // 디버깅: 비디오가 없는 경우 상세 로그
            if (filteredVideos.length === 0) {
              console.warn(`[useThemeVideos] Theme "${theme.name}" has no videos. Keywords:`, theme.keywords)
              console.warn(`[useThemeVideos] Sample video keywords from API:`, allVideos.slice(0, 3).map(v => ({
                title: v.title,
                keyword: v.keyword,
                region: v.region,
                category: v.category
              })))
            }
            
            // 새로운 객체를 반환하여 불변성 유지
            return {
              ...theme,
              videos: filteredVideos
            }
          })

          setThemes(updatedThemes)
          console.log('[useThemeVideos] Themes set successfully. Total themes:', updatedThemes.length)
          console.log('[useThemeVideos] Themes with videos:', updatedThemes.filter(t => t.videos && t.videos.length > 0).length)
          console.log('[useThemeVideos] Final themes structure:', updatedThemes.map(t => ({
            name: t.name,
            videosCount: t.videos?.length || 0,
            hasVideos: !!(t.videos && t.videos.length > 0)
          })))
        } catch (apiError) {
          console.error('[useThemeVideos] API 호출 실패, 빈 비디오로 설정:', apiError)
          console.error('[useThemeVideos] Error details:', {
            message: apiError?.message,
            stack: apiError?.stack,
            name: apiError?.name
          })
          // API 실패 시 사용자 테마는 유지하되 비디오는 빈 배열
          const themesWithEmptyVideos = userThemes.map(theme => ({ ...theme, videos: [] }))
          console.log('[useThemeVideos] Setting themes with empty videos:', themesWithEmptyVideos.length)
          setThemes(themesWithEmptyVideos)
        }
      } catch (err) {
        console.error('[useThemeVideos] Outer catch - Error:', err)
        console.error('[useThemeVideos] Error details:', {
          message: err?.message,
          stack: err?.stack,
          name: err?.name
        })
        setError(err?.message || '테마별 영상을 불러오는데 실패했습니다.')
        // 에러 발생 시에도 기본 테마는 설정
        const defaultThemes = ['budget', 'solo', 'aesthetic']
          .filter(keywordId => keywordToTheme[keywordId])
          .map(keywordId => ({
            ...keywordToTheme[keywordId],
            videos: []
          }))
        console.log('[useThemeVideos] Setting default themes due to error:', defaultThemes.length)
        setThemes(defaultThemes)
      } finally {
        console.log('[useThemeVideos] Setting loading to false')
        setLoading(false)
      }
    }

    fetchThemeVideos().catch(err => {
      console.error('[useThemeVideos] Unhandled error in fetchThemeVideos:', err)
      setError(err?.message || '테마별 영상을 불러오는데 실패했습니다.')
      setLoading(false)
    })
  }, [])
  
  // 디버깅: themes 상태 변경 시 로그
  useEffect(() => {
    console.log('[useThemeVideos] Themes state changed:', {
      themesCount: themes?.length || 0,
      loading,
      error,
      themes: themes?.map(t => ({
        name: t.name,
        videosCount: t.videos?.length || 0
      }))
    })
  }, [themes, loading, error])

  return { themes, loading, error }
}

export default useThemeVideos

