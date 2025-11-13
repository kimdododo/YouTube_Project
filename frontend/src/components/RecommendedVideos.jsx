import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Settings, Camera, Edit3, X, Eye, EyeOff } from 'lucide-react'
import VideoCard from './VideoCard'
import Logo from './Logo'
import { getPersonalizedRecommendations, getRecommendedVideos, getTrendVideos, getMostLikedVideos, getAllVideos, getDiversifiedVideos } from '../api/videos'
import { getCurrentUser, changePassword, saveTravelPreferences, fetchTravelPreferences, getMyKeywords } from '../api/auth'

const TRAVEL_PREFERENCE_LABELS = {
  1: '자연힐링형',
  2: '도시탐험형',
  3: '액티비티형',
  4: '문화체험형',
  5: '럭셔리휴양형',
  6: '맛집탐방형',
  7: '로맨틱감성형',
  8: '사진명소형',
  9: '자기계발형',
  10: '가족친구형',
  11: '에코지속가능형'
}

const TRAVEL_KEYWORD_LABELS = {
  solo: '혼자여행',
  budget: '가성비여행',
  vlog: '브이로그',
  aesthetic: '감성여행',
  domestic: '국내여행',
  global: '해외여행',
  oneday: '당일치기',
  food: '맛집투어',
  stay: '숙소리뷰',
  camping: '캠핑',
  cafe: '카페투어'
}

function RecommendedVideos() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [usePersonalized, setUsePersonalized] = useState(true)
  const [visibleCount, setVisibleCount] = useState(8)
  const [sentinelRef, setSentinelRef] = useState(null)
  const [error, setError] = useState(null)
  
  // 사용자 정보
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '')
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '')
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(false)
  const [travelPreferenceSummary, setTravelPreferenceSummary] = useState('')
  const [travelKeywordSummary, setTravelKeywordSummary] = useState('')
  
  // 비밀번호 변경 모달
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false,
    error: ''
  })
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  
  // 여행 성향/키워드 변경 모달
  const [isPreferenceModalOpen, setIsPreferenceModalOpen] = useState(false)
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false)
  const [selectedPreferences, setSelectedPreferences] = useState([])
  const [selectedKeywords, setSelectedKeywords] = useState([])
  const [preferenceDraft, setPreferenceDraft] = useState([])
  const [keywordDraft, setKeywordDraft] = useState([])
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)

  // 로그인 상태 체크 및 사용자 정보 로드
  useEffect(() => {
    const checkLoginStatus = async () => {
      const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true' || localStorage.getItem('isLoggedIn') === 'true'
      setIsLoggedIn(loggedIn)
      
      if (loggedIn) {
        setIsLoadingUserInfo(true)
        try {
          const userInfo = await getCurrentUser()
          if (userInfo) {
            setUserName(userInfo.username || localStorage.getItem('userName') || '')
            setUserEmail(userInfo.email || localStorage.getItem('userEmail') || '')
            localStorage.setItem('userName', userInfo.username || '')
            localStorage.setItem('userEmail', userInfo.email || '')
          }
          
          // 여행 성향 및 키워드 로드
          const preferences = await fetchTravelPreferences()
          if (preferences && preferences.travel_preferences) {
            const prefLabels = preferences.travel_preferences
              .map(id => TRAVEL_PREFERENCE_LABELS[id])
              .filter(Boolean)
            setTravelPreferenceSummary(prefLabels.join(', '))
            setSelectedPreferences(preferences.travel_preferences || [])
          }
          
          const keywords = await getMyKeywords()
          if (keywords && keywords.length > 0) {
            const keywordLabels = keywords
              .map(k => TRAVEL_KEYWORD_LABELS[k] || k)
              .filter(Boolean)
            setTravelKeywordSummary(keywordLabels.join(', '))
            setSelectedKeywords(keywords || [])
          }
        } catch (error) {
          console.error('[RecommendedVideos] Error loading user info:', error)
        } finally {
          setIsLoadingUserInfo(false)
        }
      }
    }
    
    checkLoginStatus()
    window.addEventListener('storage', checkLoginStatus)
    const interval = setInterval(checkLoginStatus, 500)
    return () => {
      window.removeEventListener('storage', checkLoginStatus)
      clearInterval(interval)
    }
  }, [])

  // API에서 실제 데이터 가져오기
  useEffect(() => {
    fetchVideos()
  }, [usePersonalized])

  // 스크롤 하단 도달 시 자동으로 더 불러오기
  useEffect(() => {
    if (!sentinelRef) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleCount((c) => c + 4)
        }
      })
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef)
    return () => observer.disconnect()
  }, [sentinelRef])

  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const travelPreferences = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
      const hasPreferences = travelPreferences.length > 0
      
      let recommended = []
      
      if (usePersonalized && hasPreferences) {
        try {
          recommended = await getPersonalizedRecommendations({}, 20)
        } catch (personalizedError) {
          try {
            recommended = await getDiversifiedVideos(200, 1)
          } catch (diversifiedError) {
            recommended = await getRecommendedVideos(null, false, 100)
          }
        }
      } else {
        try {
          recommended = await getDiversifiedVideos(200, 1)
        } catch (diversifiedError) {
          try {
            const all = await getAllVideos(0, 300)
            recommended = all || []
          } catch (allError) {
            recommended = await getRecommendedVideos(null, false, 100)
          }
        }
      }
      
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

      const diversifyWithFallback = (items, targetCount = 9, maxPerChannel = 1) => {
        if (!items || items.length === 0) return []
        const pick = (limitPerChannel) => {
          const seen = new Map()
          const out = []
          for (const it of items) {
            const chId = it.channel_id || it.channelId || it.channel || `unknown-${it.id || Math.random()}`
            const cnt = seen.get(chId) || 0
            if (cnt < limitPerChannel) {
              out.push(it)
              seen.set(chId, cnt + 1)
              if (out.length >= targetCount) break
            }
          }
          return out
        }
        let result = pick(maxPerChannel)
        if (result.length < targetCount) {
          result = pick(maxPerChannel + 1)
        }
        if (result.length < targetCount) {
          const ids = new Set(result.map(v => v.id))
          for (const it of items) {
            if (!ids.has(it.id)) {
              result.push(it)
              ids.add(it.id)
              if (result.length >= targetCount) break
            }
          }
        }
        return result
      }

      const unique = dedupeById(recommended)
      
      for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[unique[i], unique[j]] = [unique[j], unique[i]]
      }
      
      const diversified = diversifyWithFallback(unique, 48, 1)
      
      if (diversified.length === 0 && recommended.length === 0) {
        setError('영상을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.')
      }
      
      setRecommendedVideos(diversified)
    } catch (error) {
      console.error('[RecommendedVideos] Failed to fetch recommended videos:', error)
      setError(error.message || '영상을 불러오는데 실패했습니다.')
      setRecommendedVideos([])
    } finally {
      setLoading(false)
    }
  }

  // 비밀번호 변경 핸들러
  const openPasswordModal = () => {
    setIsPasswordModalOpen(true)
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      showCurrent: false,
      showNew: false,
      showConfirm: false,
      error: ''
    })
  }

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false)
  }

  const togglePasswordVisibility = (field) => {
    setPasswordForm(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handlePasswordInputChange = (field, value) => {
    setPasswordForm(prev => ({ ...prev, [field]: value, error: '' }))
  }

  const submitPasswordChange = async (e) => {
    e.preventDefault()
    
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 10) {
      setPasswordForm(prev => ({ ...prev, error: '비밀번호는 10자 이상이어야 합니다.' }))
      return
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordForm(prev => ({ ...prev, error: '새 비밀번호가 일치하지 않습니다.' }))
      return
    }
    
    setIsSavingPassword(true)
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      closePasswordModal()
      alert('비밀번호가 변경되었습니다.')
    } catch (error) {
      setPasswordForm(prev => ({ ...prev, error: error.message || '비밀번호 변경에 실패했습니다.' }))
    } finally {
      setIsSavingPassword(false)
    }
  }

  // 여행 성향 변경 핸들러
  const openPreferenceModal = () => {
    setPreferenceDraft([...selectedPreferences])
    setIsPreferenceModalOpen(true)
  }

  const closePreferenceModal = () => {
    setIsPreferenceModalOpen(false)
  }

  const togglePreferenceSelection = (id) => {
    setPreferenceDraft(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id)
      } else if (prev.length < 5) {
        return [...prev, id]
      }
      return prev
    })
  }

  const submitPreferenceChanges = async () => {
    if (!preferenceDraft.length) {
      return
    }
    setIsSavingPreferences(true)
    try {
      await saveTravelPreferences(preferenceDraft, selectedKeywords)
      setSelectedPreferences(preferenceDraft)
      const prefLabels = preferenceDraft
        .map(id => TRAVEL_PREFERENCE_LABELS[id])
        .filter(Boolean)
      setTravelPreferenceSummary(prefLabels.join(', '))
      closePreferenceModal()
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setIsSavingPreferences(false)
    }
  }

  // 키워드 변경 핸들러
  const openKeywordModal = () => {
    setKeywordDraft([...selectedKeywords])
    setIsKeywordModalOpen(true)
  }

  const closeKeywordModal = () => {
    setIsKeywordModalOpen(false)
  }

  const toggleKeywordSelection = (keyword) => {
    setKeywordDraft(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword)
      }
      return [...prev, keyword]
    })
  }

  const submitKeywordChanges = async () => {
    if (!keywordDraft.length) {
      return
    }
    setIsSavingPreferences(true)
    try {
      await saveTravelPreferences(selectedPreferences, keywordDraft)
      setSelectedKeywords(keywordDraft)
      const keywordLabels = keywordDraft
        .map(k => TRAVEL_KEYWORD_LABELS[k] || k)
        .filter(Boolean)
      setTravelKeywordSummary(keywordLabels.join(', '))
      closeKeywordModal()
    } catch (error) {
      console.error('Failed to save keywords:', error)
    } finally {
      setIsSavingPreferences(false)
    }
  }

  const preferenceOptions = Object.entries(TRAVEL_PREFERENCE_LABELS).map(([id, label]) => ({ id: Number(id), label }))
  const keywordOptions = Object.entries(TRAVEL_KEYWORD_LABELS).map(([key, label]) => ({ key, label }))

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #090E29 0%, #0E1435 50%, #090E29 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <header className="relative z-10" style={{
        background: 'rgba(9, 14, 41, 0.8)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          width: '990px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '40px',
          padding: '0 16px'
        }}>
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
          <nav className="flex items-center gap-6" style={{ height: '24px', fontFamily: 'Arial, sans-serif' }}>
            <Link 
              to="/recommendedVideos" 
              className="font-bold leading-6" 
              style={{ 
                fontSize: '16px',
                lineHeight: '24px',
                color: '#FFFFFF',
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
                color: 'rgba(147, 197, 253, 1)',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              여행 트렌드
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
      </header>

      {/* Main Content */}
      <main className="relative z-10" style={{
        width: '990px',
        margin: '0 auto',
        paddingTop: '32px',
        paddingBottom: '64px'
      }}>
        {/* User Profile Card */}
        {isLoggedIn && (
          <div
            className="relative rounded-3xl mb-6"
            style={{
              background: '#39489A',
              border: '2px solid #39489A'
            }}
          >
            <div
              className="rounded-3xl bg-[#060d2c] flex items-center justify-between px-6 py-4"
              style={{
                minHeight: '140px'
              }}
            >
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #9333EA 0%, #3B82F6 100%)',
                      fontSize: '32px'
                    }}
                  >
                    {userName.charAt(0) || 'U'}
                  </div>
                </div>
                <div>
                  <h2
                    className="text-white font-bold"
                    style={{
                      fontSize: '28px',
                      lineHeight: '36px'
                    }}
                  >
                    {isLoadingUserInfo ? '로딩 중...' : userName || '사용자'}
                  </h2>
                  <p
                    className="text-blue-200"
                    style={{
                      fontSize: '16px',
                      lineHeight: '24px'
                    }}
                  >
                    {userEmail || '이메일 없음'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 취향 분석 섹션 */}
        {isLoggedIn && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold" style={{ fontSize: '20px', lineHeight: '28px' }}>
                취향 분석
              </h2>
              <button
                onClick={() => navigate('/mypage')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                설정
              </button>
            </div>
            {travelPreferenceSummary && (
              <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4 mb-4" style={{ border: '2px solid #39489A' }}>
                <p className="text-white/70" style={{ fontSize: '14px', lineHeight: '20px' }}>
                  {travelPreferenceSummary.split(', ').slice(0, 3).join(', ')}을(를) 선호하는 여행자
                </p>
              </div>
            )}
          </div>
        )}

        {/* 내 설정 섹션 */}
        {isLoggedIn && (
          <div className="bg-[#0f1629]/80 rounded-2xl p-4 mb-6" style={{ border: '2px solid #39489A' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg">내 설정</h3>
            </div>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-white font-medium text-sm">이메일</p>
                  <p className="text-white/60 text-sm mt-1">{userEmail || '이메일 없음'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-white font-medium text-sm">비밀번호 변경</p>
                </div>
                <button onClick={openPasswordModal} className="text-blue-300 hover:text-blue-200 text-sm">
                  변경하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 서비스 설정 섹션 */}
        {isLoggedIn && (
          <div className="bg-[#0f1629]/80 rounded-2xl p-4 mb-6" style={{ border: '2px solid #39489A' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg">서비스 설정</h3>
            </div>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-white font-medium text-sm">여행 성향 변경</p>
                  {travelPreferenceSummary && (
                    <p className="text-white/60 text-sm mt-1">{travelPreferenceSummary}</p>
                  )}
                </div>
                <button onClick={openPreferenceModal} className="text-blue-300 hover:text-blue-200 text-sm">
                  변경하기
                </button>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-white font-medium text-sm">키워드 변경</p>
                  {travelKeywordSummary && (
                    <p className="text-white/60 text-sm mt-1">{travelKeywordSummary}</p>
                  )}
                </div>
                <button onClick={openKeywordModal} className="text-blue-300 hover:text-blue-200 text-sm">
                  변경하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 영상 그리드 */}
        <div className="mb-12">
          <h1 
            className="font-bold text-white mb-4" 
            style={{
              fontSize: '36px',
              lineHeight: '44px',
              fontFamily: 'Arial, sans-serif',
              color: '#FFFFFF'
            }}
          >
            개인 맞춤 영상 추천
          </h1>
          <p 
            className="text-white mb-8"
            style={{
              fontSize: '18px',
              lineHeight: '26px',
              fontFamily: 'Arial, sans-serif',
              color: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            AI가 당신의 취향을 분석하여 선별한 맞춤 여행 영상을 확인하세요.
          </p>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-blue-300 animate-pulse">데이터를 불러오는 중...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 mb-4">{error}</div>
              <button 
                onClick={fetchVideos}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                다시 시도
              </button>
            </div>
          ) : recommendedVideos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-blue-300 text-lg mb-2">추천 영상이 없습니다.</div>
              <button 
                onClick={fetchVideos}
                className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                {recommendedVideos.slice(0, visibleCount).map((video) => (
                  <VideoCard key={video.id} video={video} featured />
                ))}
              </div>
              <div ref={setSentinelRef} style={{ height: '1px' }} />
            </>
          )}
        </div>
      </main>

      {/* 비밀번호 변경 모달 */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#10173a] border border-blue-900/40 rounded-3xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">비밀번호 변경</h3>
              <button onClick={closePasswordModal} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={submitPasswordChange}>
              <div>
                <label className="text-white text-sm">현재 비밀번호</label>
                <div className="relative mt-2">
                  <input
                    type={passwordForm.showCurrent ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                    className="w-full bg-[#0f1629]/60 border border-blue-900/40 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('showCurrent')}
                    className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white transition-colors"
                  >
                    {passwordForm.showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-white text-sm">새 비밀번호</label>
                <div className="relative mt-2">
                  <input
                    type={passwordForm.showNew ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                    className="w-full bg-[#0f1629]/60 border border-blue-900/40 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('showNew')}
                    className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white transition-colors"
                  >
                    {passwordForm.showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-white text-sm">새 비밀번호 확인</label>
                <div className="relative mt-2">
                  <input
                    type={passwordForm.showConfirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                    className="w-full bg-[#0f1629]/60 border border-blue-900/40 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('showConfirm')}
                    className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white transition-colors"
                  >
                    {passwordForm.showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {passwordForm.error && (
                <p className="text-red-400 text-sm">{passwordForm.error}</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingPassword ? '변경 중...' : '변경하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 여행 성향 변경 모달 */}
      {isPreferenceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#10173a] border border-blue-900/40 rounded-3xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">여행 성향</h3>
              <button onClick={closePreferenceModal} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 text-sm mb-4">최대 5개 / 복수선택가능</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {preferenceOptions.map((option) => {
                const isSelected = preferenceDraft.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => togglePreferenceSelection(option.id)}
                    className={`px-4 py-2 rounded-full border transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-transparent'
                        : 'bg-[#0f1629]/60 text-white/70 border-blue-900/40 hover:border-blue-500/60'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closePreferenceModal}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={submitPreferenceChanges}
                disabled={isSavingPreferences}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {isSavingPreferences ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 키워드 변경 모달 */}
      {isKeywordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#10173a] border border-blue-900/40 rounded-3xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">키워드</h3>
              <button onClick={closeKeywordModal} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {keywordOptions.map((option) => {
                const isSelected = keywordDraft.includes(option.key)
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleKeywordSelection(option.key)}
                    className={`px-4 py-2 rounded-full border transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-transparent'
                        : 'bg-[#0f1629]/60 text-white/70 border-blue-900/40 hover:border-blue-500/60'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeKeywordModal}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={submitKeywordChanges}
                disabled={isSavingPreferences}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {isSavingPreferences ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecommendedVideos
