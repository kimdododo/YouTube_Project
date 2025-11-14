import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, Settings, X, LogOut, Bookmark, Bell, Lock, Eye, EyeOff, Clock } from 'lucide-react'
import MyPageLayout from './layouts/MyPageLayout'
import { getRecommendedVideos, fetchVideoKeywords } from '../api/videos'
import { changePassword, saveTravelPreferences, fetchTravelPreferences, getToken, logout as clearAuth, getCurrentUser, getMyKeywords } from '../api/auth'
import VideoKeywordVisualization from './VideoKeywordCard'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Pie } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const DEFAULT_PREFERENCE_SUMMARY = ''
const DEFAULT_KEYWORD_SUMMARY = ''

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

function MyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('insight')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const hasCheckedAuth = useRef(false)
  
  // 사용자 정보 상태
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '')
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  
  // 사용자 정보 로드 (한 번만 실행)
  const hasLoadedUserInfo = useRef(false)
  useEffect(() => {
    if (hasLoadedUserInfo.current) return
    
    const loadUserInfo = async () => {
      const token = getToken()
      if (!token) {
        hasLoadedUserInfo.current = true
        return
      }
      
      try {
        const userInfo = await getCurrentUser()
        if (userInfo) {
          const newUserName = userInfo.username || localStorage.getItem('userName') || ''
          const newUserEmail = userInfo.email || localStorage.getItem('userEmail') || ''
          setUserName(newUserName)
          setUserEmail(newUserEmail)
          if (userInfo.username) {
            localStorage.setItem('userName', userInfo.username)
          }
          if (userInfo.email) {
            localStorage.setItem('userEmail', userInfo.email)
          }
        }
      } catch (error) {
        console.error('[MyPage] Failed to load user info:', error)
      } finally {
        hasLoadedUserInfo.current = true
      }
    }
    
    loadUserInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 마운트 시에만 실행
  
  // 로그인 체크 및 리다이렉트 (마운트 시에만 실행)
  useEffect(() => {
    // 이미 체크를 완료했으면 실행하지 않음
    if (hasCheckedAuth.current) return
    
    hasCheckedAuth.current = true
    
    const token = getToken()
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true' || 
                      localStorage.getItem('isLoggedIn') === 'true'
    
    setIsCheckingAuth(false)
    
    if (!token && !isLoggedIn) {
      // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
      navigate('/login', { 
        state: { from: location.pathname },
        replace: false // 히스토리 스택 유지
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 빈 배열로 마운트 시에만 실행 (navigate와 location은 안정적이므로 의존성 제외)
  
  // 사용자 정보는 MyPageLayout에서 관리
  const [bookmarks, setBookmarks] = useState([])
  const [preferenceScores, setPreferenceScores] = useState([])
  const [watchHistory, setWatchHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [travelPreferenceSummary, setTravelPreferenceSummary] = useState(DEFAULT_PREFERENCE_SUMMARY)
  const [travelKeywordSummary, setTravelKeywordSummary] = useState(DEFAULT_KEYWORD_SUMMARY)
  const [selectedPreferences, setSelectedPreferences] = useState([])
  const [selectedKeywords, setSelectedKeywords] = useState([])
  const [preferenceDraft, setPreferenceDraft] = useState([])
  const [keywordDraft, setKeywordDraft] = useState([])
  const [preferenceModalError, setPreferenceModalError] = useState('')
  const [keywordModalError, setKeywordModalError] = useState('')
  const [isPreferenceModalOpen, setIsPreferenceModalOpen] = useState(false)
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isPasswordSuccessModalOpen, setIsPasswordSuccessModalOpen] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false,
    error: ''
  })

  const [keywordCloud, setKeywordCloud] = useState([])
  const [isLoadingKeywordEmbeddings, setIsLoadingKeywordEmbeddings] = useState(false)
  
  // 키워드 분석 관련 상태
  const [selectedVideoForKeywords, setSelectedVideoForKeywords] = useState(null)
  const [videoKeywords, setVideoKeywords] = useState([])
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [keywordsError, setKeywordsError] = useState('')
  const [isVideoKeywordModalOpen, setIsVideoKeywordModalOpen] = useState(false)
  const preferenceOptions = useMemo(
    () => Object.entries(TRAVEL_PREFERENCE_LABELS).map(([id, label]) => ({ id: Number(id), label })),
    []
  )
  const keywordOptions = useMemo(
    () => Object.entries(TRAVEL_KEYWORD_LABELS).map(([id, label]) => ({ id, label })),
    []
  )
  const passwordFieldConfig = useMemo(
    () => [
      { id: 'currentPassword', label: '기존 비밀번호', toggle: 'showCurrent', autoComplete: 'current-password' },
      { id: 'newPassword', label: '새 비밀번호', toggle: 'showNew', autoComplete: 'new-password' },
      { id: 'confirmPassword', label: '새 비밀번호 재입력', toggle: 'showConfirm', autoComplete: 'new-password' }
    ],
    []
  )
  const [contentPreferenceData, setContentPreferenceData] = useState([])
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(false)
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false)
  const [userInfoError, setUserInfoError] = useState('')
  const [preferencesError, setPreferencesError] = useState('')

  // 여행 취향 기반 콘텐츠 선호도 데이터 계산
  useEffect(() => {
    if (selectedPreferences.length === 0) {
      setContentPreferenceData([])
      return
    }

    const colors = [
      '#9333EA', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ]

    const preferenceData = selectedPreferences.map((prefId, idx) => {
      const label = TRAVEL_PREFERENCE_LABELS[prefId] || `취향 ${prefId}`
      const baseValue = 100 / selectedPreferences.length
      const adjustedValue = Math.max(10, Math.min(50, baseValue + (idx * 2)))
      
      return {
        label,
        value: Math.round(adjustedValue),
        color: colors[idx % colors.length]
      }
    })

    // 총합이 100%가 되도록 정규화
    const total = preferenceData.reduce((sum, item) => sum + item.value, 0)
    if (total !== 100) {
      const factor = 100 / total
      preferenceData.forEach(item => {
        item.value = Math.round(item.value * factor)
      })
      // 반올림 오차 보정
      const finalTotal = preferenceData.reduce((sum, item) => sum + item.value, 0)
      if (finalTotal !== 100) {
        preferenceData[0].value += (100 - finalTotal)
      }
    }

    setContentPreferenceData(preferenceData)
  }, [selectedPreferences])

  const pieChartData = useMemo(() => ({
    labels: contentPreferenceData.map(item => item.label),
    datasets: [
      {
        label: '내가 좋아한 콘텐츠',
        data: contentPreferenceData.map(item => item.value),
        backgroundColor: contentPreferenceData.map(item => item.color),
        borderColor: '#FFFFFF',
        borderWidth: 2
      }
    ]
  }), [contentPreferenceData])

  const pieChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.parsed}%`
          }
        }
      }
    },
    layout: {
      padding: {
        top: 10,
        bottom: 10
      }
    }
  }), [])

  const computePreferenceScores = (preferenceIds = []) => {
    if (!preferenceIds || preferenceIds.length === 0) {
      return []
    }
    
    // 실제 preference_ids를 기반으로 점수 계산
    const preferenceMap = {
      1: { key: '자연힐링형', baseValue: 20 },
      2: { key: '도시탐험형', baseValue: 20 },
      3: { key: '액티비티형', baseValue: 15 },
      4: { key: '문화체험형', baseValue: 15 },
      5: { key: '럭셔리형', baseValue: 10 },
      6: { key: '맛집탐방형', baseValue: 25 },
      7: { key: '로맨틱형', baseValue: 10 },
      8: { key: '사진명소형', baseValue: 15 },
      9: { key: '자기계발형', baseValue: 10 },
      10: { key: '가족친구형', baseValue: 10 },
      11: { key: '에코형', baseValue: 10 }
    }
    
    // 선택된 preference_ids에 해당하는 항목만 반환
    const scores = preferenceIds
      .map((id) => {
        const pref = preferenceMap[id]
        if (!pref) return null
        return {
          key: pref.key,
          value: Math.min(95, pref.baseValue + (preferenceIds.length * 5))
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value) // 값이 큰 순서로 정렬
    
    return scores
  }

  const formatPreferenceSummary = (preferenceIds = []) => {
    if (!preferenceIds || preferenceIds.length === 0) {
      return DEFAULT_PREFERENCE_SUMMARY
    }
    const names = preferenceIds
      .map((id) => TRAVEL_PREFERENCE_LABELS[id])
      .filter(Boolean)
    if (!names.length) {
      return DEFAULT_PREFERENCE_SUMMARY
    }
    return names.join(', ')
  }

  const formatKeywordSummary = (keywords = []) => {
    if (!keywords || keywords.length === 0) {
      return DEFAULT_KEYWORD_SUMMARY
    }
    const names = keywords
      .map((key) => TRAVEL_KEYWORD_LABELS[key] || key)
      .filter(Boolean)
    if (!names.length) {
      return DEFAULT_KEYWORD_SUMMARY
    }
    return names
      .map((name) => (name.startsWith('#') ? name : `#${name}`))
      .join(', ')
  }


  const applyPreferenceState = async (preferencesList = [], keywordsList = []) => {
    const normalizedPreferences = Array.from(
      new Set(
        (preferencesList || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id >= 1 && id <= 11)
      )
    )
    const normalizedKeywords = Array.from(
      new Set(
        (keywordsList || [])
          .map((key) => {
            const str = (key || '').toString().trim()
            // 키워드가 한글이면 ID로 변환 시도 (역변환)
            if (str && !TRAVEL_KEYWORD_LABELS[str]) {
              // 한글을 ID로 역변환
              const foundId = Object.keys(TRAVEL_KEYWORD_LABELS).find(
                id => TRAVEL_KEYWORD_LABELS[id] === str
              )
              if (foundId) {
                console.log(`[MyPage] 키워드 한글->ID 변환: ${str} -> ${foundId}`)
                return foundId
              }
            }
            return str
          })
          .filter(Boolean)
      )
    )
    
    console.log('[MyPage] 정규화된 키워드:', normalizedKeywords)
    console.log('[MyPage] 키워드 라벨 매핑 테스트:', normalizedKeywords.map(k => ({ id: k, label: TRAVEL_KEYWORD_LABELS[k] })))

    setPreferenceScores(computePreferenceScores(normalizedPreferences))
    setTravelPreferenceSummary(formatPreferenceSummary(normalizedPreferences))
    setTravelKeywordSummary(formatKeywordSummary(normalizedKeywords))
    setSelectedPreferences(normalizedPreferences)
    setSelectedKeywords(normalizedKeywords)

    // 키워드 클라우드 생성: 백엔드 API 호출 (word2vec 기반 유사 키워드 추천)
    // 백엔드에서 유사 키워드 Top-K + 점수를 받아서 UI만 렌더링
    if (normalizedKeywords.length > 0) {
      setIsLoadingKeywordEmbeddings(true)
      
      // 백엔드 API 호출: 사용자 키워드 기반 유사 키워드 추천
      getMyKeywords(10) // Top-10 키워드 요청
        .then((keywordsData) => {
          // keywordsData: [{word: "카페투어", score: 0.91}, ...]
          if (!keywordsData || keywordsData.length === 0) {
            setKeywordCloud([])
            setIsLoadingKeywordEmbeddings(false)
            return
          }
          
          // 이미지 스타일에 맞춘 색상 팔레트
          const colorPalettes = {
            yellow: ['#FBBF24', '#FCD34D', '#FDE68A', '#FEF3C7', '#FFFBEB'], // 노란색/크림 계열
            pink: ['#F9A8D4', '#FB7185', '#F87171', '#FCA5A5', '#FECACA'], // 분홍/빨강 계열
            blue: ['#60A5FA', '#3B82F6', '#38BDF8', '#67E8F9', '#A5B4FC'], // 파란색 계열
            white: ['#F9FAFB', '#F3F4F6', '#E5E7EB', '#D1D5DB', '#FFFFFF'] // 흰색/회색 계열
          }
          
          // 자연스러운 워드 클라우드 레이아웃 생성 (스파이럴)
          const createWordCloudLayout = (count, width = 100, height = 100) => {
            const positions = []
            const centerX = width / 2
            const centerY = height / 2
            
            for (let idx = 0; idx < count; idx++) {
              // 스파이럴 레이아웃으로 자연스럽게 배치
              const angle = (idx * 137.508) % 360 // 황금각 사용
              const radius = 15 + (idx * 3) + Math.random() * 10
              
              let x = centerX + radius * Math.cos((angle * Math.PI) / 180)
              let y = centerY + radius * Math.sin((angle * Math.PI) / 180)
              
              // 경계 체크 및 조정
              x = Math.max(10, Math.min(width - 10, x))
              y = Math.max(15, Math.min(height - 15, y))
              
              positions.push({ x, y })
            }
            
            return positions
          }
          
          // 점수 기준으로 정렬 (이미 정렬되어 있을 수도 있지만 확실하게)
          const sortedKeywords = [...keywordsData].sort((a, b) => b.score - a.score)
          
          // 레이아웃 생성
          const positions = createWordCloudLayout(sortedKeywords.length, 100, 100)
          
          // 키워드 클라우드 데이터 생성 (점수 기반 크기/색상 결정)
          const keywordCloudData = sortedKeywords.map((item, idx) => {
            // 점수 기반 크기 계산 (0.5 ~ 1.0 점수 범위를 16px ~ 56px로 매핑)
            const score = item.score
            const minSize = 16
            const maxSize = 56
            const fontSize = Math.round(minSize + (score - 0.5) * (maxSize - minSize) / 0.5)
            
            // 점수/인덱스 기반 색상 선택
            let color
            if (score >= 0.95 || idx < 2) {
              // 가장 높은 점수: 노란색/크림 계열
              color = colorPalettes.yellow[idx % colorPalettes.yellow.length]
            } else if (score >= 0.85 || idx < 5) {
              // 중간 점수: 분홍/빨강 계열
              color = colorPalettes.pink[(idx - 2) % colorPalettes.pink.length]
            } else if (score >= 0.75 || idx < 8) {
              // 낮은 점수: 파란색 계열
              color = colorPalettes.blue[(idx - 5) % colorPalettes.blue.length]
            } else {
              // 가장 낮은 점수: 흰색/회색 계열
              color = colorPalettes.white[(idx - 8) % colorPalettes.white.length]
            }
            
            const pos = positions[idx] || { x: 50, y: 50 }
            
            return {
              text: item.word,
              size: Math.max(minSize, Math.min(maxSize, fontSize)),
              color,
              x: pos.x,
              y: pos.y,
              score: item.score
            }
          })
          
          console.log('[MyPage] 키워드 클라우드 생성 완료 (백엔드 API):', {
            keywordsData,
            keywordCloudData: keywordCloudData.map(item => ({ text: item.text, score: item.score, size: item.size }))
          })
          
          setKeywordCloud(keywordCloudData)
          setIsLoadingKeywordEmbeddings(false)
        })
        .catch((error) => {
          console.error('[MyPage] 키워드 클라우드 API 호출 실패:', error)
          setKeywordCloud([])
          setIsLoadingKeywordEmbeddings(false)
        })
    } else {
      setKeywordCloud([])
    }

    localStorage.setItem('travelPreferences', JSON.stringify(normalizedPreferences))
    localStorage.setItem('travelKeywords', JSON.stringify(normalizedKeywords))
  }

  // 로그인 상태 및 사용자 정보는 MyPageLayout에서 관리

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true)
      setHistoryError('')
      try {
        const videos = await getRecommendedVideos(null, false, 6)
        setWatchHistory(videos)
      } catch (error) {
        console.error('[MyPage] Failed to load watch history:', error)
        setHistoryError(error?.message || '시청 기록을 가져오지 못했습니다.')
      } finally {
        setIsLoadingHistory(false)
      }
    }
    if (activeTab === 'history' && watchHistory.length === 0 && !isLoadingHistory) {
      loadHistory()
    }
  }, [activeTab, isLoadingHistory, watchHistory.length])

  // 북마크 데이터 로드
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('bookmarks')
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks))
      } catch (e) {
        console.error('Failed to parse bookmarks:', e)
        setBookmarks([])
      }
    }
  }, [])

  useEffect(() => {
    const loadFromLocalStorage = async () => {
      try {
        const storedPrefs = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
        const storedKeywords = JSON.parse(localStorage.getItem('travelKeywords') || '[]')
        if ((storedPrefs && storedPrefs.length) || (storedKeywords && storedKeywords.length)) {
          await applyPreferenceState(storedPrefs, storedKeywords)
        } else {
          await applyPreferenceState([], [])
        }
      } catch {
        await applyPreferenceState([], [])
      }
    }
    loadFromLocalStorage()
  }, [])

  useEffect(() => {
    const loadPreferences = async () => {
      const token = getToken()
      if (!token) {
        setPreferencesError('로그인이 필요합니다.')
        return
      }
      setIsLoadingPreferences(true)
      setPreferencesError('')
      
      try {
        const result = await fetchTravelPreferences()
        const preferences = result.preference_ids || result.preferences || []
        const keywords = result.keywords || []
        await applyPreferenceState(preferences, keywords)
        setPreferencesError('')
      } catch (error) {
        console.error('[MyPage] Failed to load travel preferences:', error)
        setPreferencesError(error?.message || '여행 취향을 불러오지 못했습니다.')
        // 에러가 발생해도 localStorage에서 로드 시도
        try {
          const storedPrefs = JSON.parse(localStorage.getItem('travelPreferences') || '[]')
          const storedKeywords = JSON.parse(localStorage.getItem('travelKeywords') || '[]')
          if (storedPrefs.length > 0 || storedKeywords.length > 0) {
            await applyPreferenceState(storedPrefs, storedKeywords)
          }
        } catch (e) {
          console.error('[MyPage] Failed to load from localStorage:', e)
        }
      } finally {
        setIsLoadingPreferences(false)
      }
    }
    loadPreferences()
  }, [])

  // 북마크 저장
  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])
  // 키워드 분석 핸들러
  const handleVideoKeywordAnalysis = async (video) => {
    const videoId = video.id || video.video_id
    if (!videoId) {
      setKeywordsError('비디오 ID를 찾을 수 없습니다.')
      return
    }
    
    setSelectedVideoForKeywords(video)
    setIsVideoKeywordModalOpen(true)
    setIsLoadingKeywords(true)
    setKeywordsError('')
    setVideoKeywords([])
    
    try {
      const keywords = await fetchVideoKeywords(videoId, 7)
      setVideoKeywords(keywords)
      setIsLoadingKeywords(false)
    } catch (error) {
      console.error('[MyPage] 키워드 분석 실패:', error)
      setKeywordsError(error?.message || '키워드 분석에 실패했습니다.')
      setIsLoadingKeywords(false)
    }
  }
  
  const handleCloseVideoKeywordModal = () => {
    setIsVideoKeywordModalOpen(false)
    setSelectedVideoForKeywords(null)
    setVideoKeywords([])
    setKeywordsError('')
  }
  
  const handleToggleBookmark = (video) => {
    setBookmarks((prev) => {
      const exists = prev.some((item) => (item.id || item.video_id) === (video.id || video.video_id))
      if (exists) {
        return prev.filter((item) => (item.id || item.video_id) !== (video.id || video.video_id))
      }
      return [...prev, video]
    })
  }

  const handleEditClick = () => {
    setEditName(userName)
    setEditEmail(userEmail)
    setIsEditModalOpen(true)
  }

  const handleSave = () => {
    setUserName(editName)
    setUserEmail(editEmail)
    localStorage.setItem('userName', editName)
    localStorage.setItem('userEmail', editEmail)
    setIsEditModalOpen(false)
  }

  const handleCancel = () => {
    setIsEditModalOpen(false)
  }

  const handleLogout = useCallback((redirectPath = '/') => {
    clearAuth()
    sessionStorage.removeItem('isLoggedIn')
    sessionStorage.removeItem('userName')
    localStorage.removeItem('hasAccount')
    localStorage.removeItem('userName')
    localStorage.removeItem('travelPreferences')
    localStorage.removeItem('travelKeywords')
    localStorage.removeItem('subscribedChannels')
    setIsLoggedIn(false)
    navigate(redirectPath)
  }, [navigate])

  const openPasswordModal = useCallback(() => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      showCurrent: false,
      showNew: false,
      showConfirm: false,
      error: ''
    })
    setIsPasswordModalOpen(true)
  }, [])

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false)
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

  const handlePasswordInputChange = (field, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
      error: ''
    }))
  }

  const togglePasswordVisibility = (field) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const submitPasswordChange = async (event) => {
    event.preventDefault()
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordForm((prev) => ({ ...prev, error: '모든 비밀번호를 입력해주세요.' }))
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordForm((prev) => ({ ...prev, error: '새 비밀번호가 일치하지 않습니다.' }))
      return
    }
    setIsSavingPassword(true)
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setIsPasswordModalOpen(false)
      setIsPasswordSuccessModalOpen(true)
    } catch (error) {
      setPasswordForm((prev) => ({ ...prev, error: error?.message || '비밀번호 변경에 실패했습니다.' }))
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handlePasswordSuccessConfirm = () => {
    setIsPasswordSuccessModalOpen(false)
    handleLogout('/login')
  }

  const openPreferenceModal = useCallback(() => {
    setPreferenceDraft(selectedPreferences)
    setPreferenceModalError('')
    setIsPreferenceModalOpen(true)
  }, [selectedPreferences])

  const closePreferenceModal = useCallback(() => {
    setIsPreferenceModalOpen(false)
    setPreferenceModalError('')
  }, [])

  const openKeywordModal = useCallback(() => {
    setKeywordDraft(selectedKeywords)
    setKeywordModalError('')
    setIsKeywordModalOpen(true)
  }, [selectedKeywords])

  const closeKeywordModal = () => {
    setIsKeywordModalOpen(false)
    setKeywordModalError('')
  }

  const togglePreferenceSelection = (id) => {
    setPreferenceDraft((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((pref) => pref !== id)
        setPreferenceModalError('')
        return next
      }
      if (prev.length >= 5) {
        setPreferenceModalError('여행 성향은 최대 5개까지 선택할 수 있습니다.')
        return prev
      }
      setPreferenceModalError('')
      return [...prev, id]
    })
  }

  const toggleKeywordSelection = (key) => {
    setKeywordDraft((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((item) => item !== key)
        setKeywordModalError('')
        return next
      }
      if (prev.length >= 5) {
        setKeywordModalError('키워드는 최대 5개까지 선택할 수 있습니다.')
        return prev
      }
      setKeywordModalError('')
      return [...prev, key]
    })
  }

  const persistPreferences = async (preferences, keywords, onClose, setError) => {
    setIsSavingPreferences(true)
    setError('')
    try {
      const result = await saveTravelPreferences(preferences, keywords)
      const updatedPreferences = result.preference_ids || preferences
      const updatedKeywords = result.keywords || keywords
      await applyPreferenceState(updatedPreferences, updatedKeywords)
      onClose()
    } catch (error) {
      console.error('[MyPage] Failed to save preferences:', error)
      setError(error?.message || '변경에 실패했습니다.')
    } finally {
      setIsSavingPreferences(false)
    }
  }

  const submitPreferenceChanges = async () => {
    if (!preferenceDraft.length) {
      setPreferenceModalError('최소 한 개의 여행 성향을 선택해주세요.')
      return
    }
    await persistPreferences(
      preferenceDraft,
      selectedKeywords,
      closePreferenceModal,
      setPreferenceModalError
    )
  }

  const submitKeywordChanges = async () => {
    if (!keywordDraft.length) {
      setKeywordModalError('최소 한 개의 키워드를 선택해주세요.')
      return
    }
    await persistPreferences(
      selectedPreferences,
      keywordDraft,
      closeKeywordModal,
      setKeywordModalError
    )
  }

  // 디버깅: activeTab 확인
  console.log('[MyPage] Rendering with activeTab:', activeTab)

  // settingsCards를 일반 상수 배열로 정의 (useMemo 제거)
  const settingsCards = [
    {
      id: 'profile',
      icon: <Settings className="w-5 h-5 text-white" />,
      title: '내 설정',
      items: [
        {
          label: '이메일',
          value: userEmail || ''
        },
        {
          label: '비밀번호 변경',
          action: (
            <button onClick={openPasswordModal} className="text-blue-300 hover:text-blue-200 text-sm">
              변경하기
            </button>
          )
        }
      ]
    },
    {
      id: 'interest',
      icon: <User className="w-5 h-5 text-white" />,
      title: '관심사 설정',
      items: [
        {
          label: '여행 성향 변경',
          value: travelPreferenceSummary,
          action: (
            <button onClick={openPreferenceModal} className="text-blue-300 hover:text-blue-200 text-sm">
              변경하기
            </button>
          )
        },
        {
          label: '키워드 변경',
          value: travelKeywordSummary,
          action: (
            <button onClick={openKeywordModal} className="text-blue-300 hover:text-blue-200 text-sm">
              변경하기
            </button>
          )
        },
        {
          label: '관심 국가',
          value: '오스트레일리아, 국내, 핀란드'
        }
      ]
    },
    {
      id: 'notification',
      icon: <Bell className="w-5 h-5 text-white" />,
      title: '알림 설정',
      items: [
        {
          label: '푸시 알림',
          value: '새로운 추천 여행 알림 받기',
          toggle: { defaultChecked: true }
        },
        {
          label: '이메일 업데이트',
          value: '여행 트렌드 및 소식 받기',
          toggle: { defaultChecked: false }
        }
      ]
    },
    {
      id: 'account',
      icon: <Lock className="w-5 h-5 text-white" />,
      title: '계정 관리',
      items: [
        {
          label: '로그아웃',
          action: (
            <button
              onClick={() => handleLogout()}
              className="text-red-400 hover:text-red-300 text-sm font-semibold"
            >
              로그아웃
            </button>
          )
        },
        {
          label: '탈퇴하기',
          action: (
            <button className="text-white/50 hover:text-white/80 text-sm">
              탈퇴하기
            </button>
          )
        }
      ]
    }
  ]

  // 로그인 체크 중이면 로딩 표시 (모든 훅 호출 후)
  if (isCheckingAuth) {
    return (
      <MyPageLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white/60">로딩 중...</div>
        </div>
      </MyPageLayout>
    )
  }

  return (
    <MyPageLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'insight' && (
          <div className="space-y-6">
            <h2 className="text-white font-extrabold" style={{ fontSize: '28px', lineHeight: '36px' }}>
              나의 여행 취향 분석
            </h2>

            <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4" style={{ border: '2px solid #39489A' }}>
              <h3 className="text-white font-bold mb-2" style={{ fontSize: '18px', lineHeight: '26px' }}>
                여행 성향
              </h3>
              {isLoadingPreferences && (
                <div className="text-white/60 text-sm mb-4">로딩 중...</div>
              )}
              {preferencesError && (
                <div className="text-red-400 text-sm mb-4">{preferencesError}</div>
              )}
              {travelPreferenceSummary && (
                <p className="text-white/70 mb-6" style={{ fontSize: '14px', lineHeight: '20px' }}>
                  {travelPreferenceSummary.split(', ').slice(0, 3).join(', ')}을(를) 선호하는 여행자
                </p>
              )}

              <div className="space-y-4">
                {preferenceScores.length === 0 && !isLoadingPreferences ? (
                  <div className="text-white/60 text-center py-8" style={{ fontSize: '14px' }}>
                    여행 성향 데이터가 없습니다. 설정에서 취향을 선택해주세요.
                  </div>
                ) : (
                  preferenceScores.map(({ key, value }) => (
                    <div key={key} className="flex items-center gap-4">
                      <div className="w-28 text-white/90" style={{ fontSize: '14px' }}>{key}</div>
                      <div className="flex-1 h-4 bg-[#0b1026] rounded-full border border-blue-900/40 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <div className="w-10 text-right text-white/80" style={{ fontSize: '14px' }}>{value}%</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="relative rounded-3xl"
                style={{
                  background: '#39489A',
                  border: '2px solid #39489A'
                }}
              >
                <div className="rounded-3xl bg-[#060d2c] px-6 py-4">
                  <h3 className="text-white font-bold mb-4" style={{ fontSize: '18px', lineHeight: '26px' }}>
                    나의 키워드
                  </h3>
                  <div 
                    className="relative"
                    style={{ 
                      minHeight: '400px',
                      width: '100%',
                      background: 'transparent'
                    }}
                  >
                    {keywordCloud.length === 0 && !isLoadingPreferences && !isLoadingKeywordEmbeddings ? (
                      <div className="text-white/60 text-center py-8" style={{ fontSize: '14px' }}>
                        키워드 데이터가 없습니다. 설정에서 키워드를 선택해주세요.
                      </div>
                    ) : (keywordCloud.length === 0 && (isLoadingPreferences || isLoadingKeywordEmbeddings)) ? (
                      <div className="text-white/60 text-center py-8" style={{ fontSize: '14px' }}>
                        키워드 클라우드 생성 중...
                      </div>
                    ) : (
                      keywordCloud.map(({ text, size, color, x, y }, idx) => (
                        <div
                          key={`${text}-${idx}`}
                          style={{
                            position: 'absolute',
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: 'translate(-50%, -50%)',
                            fontSize: `${size}px`,
                            color: color,
                            lineHeight: '1.2',
                            fontWeight: idx < 3 ? 800 : idx < 6 ? 700 : 600,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.3s ease',
                            cursor: 'default',
                            zIndex: keywordCloud.length - idx,
                            textShadow: idx < 3 
                              ? '0 2px 8px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 255, 255, 0.1)' 
                              : '0 2px 4px rgba(0, 0, 0, 0.5)',
                            userSelect: 'none',
                            pointerEvents: 'auto'
                          }}
                          className="hover:scale-110 hover:brightness-110 transition-transform"
                          title={text}
                        >
                          {text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div
                className="relative rounded-3xl"
                style={{
                  background: '#39489A',
                  border: '2px solid #39489A'
                }}
              >
                <div className="rounded-3xl bg-[#060d2c] px-6 py-4">
                  <h3 className="text-white font-bold mb-4" style={{ fontSize: '18px', lineHeight: '26px' }}>
                    내가 좋아한 콘텐츠
                  </h3>
                  <div className="flex flex-col items-center gap-4">
                    {contentPreferenceData.length === 0 && !isLoadingPreferences ? (
                      <div className="text-white/60 text-center py-8" style={{ fontSize: '14px' }}>
                        콘텐츠 선호도 데이터가 없습니다. 여행 성향을 설정해주세요.
                      </div>
                    ) : contentPreferenceData.length === 0 && isLoadingPreferences ? (
                      <div className="text-white/60 text-center py-8" style={{ fontSize: '14px' }}>
                        로딩 중...
                      </div>
                    ) : (
                      <>
                        <div className="relative w-80 h-80 flex items-center justify-center">
                          <Pie data={pieChartData} options={pieChartOptions} />
                        </div>
                        <div className="w-full">
                          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2.5 px-2">
                            {contentPreferenceData.map((item) => (
                              <div 
                                key={item.label} 
                                className="flex items-center gap-2 flex-shrink-0"
                                style={{
                                  minWidth: 'fit-content'
                                }}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span 
                                  className="text-white font-medium whitespace-nowrap"
                                  style={{ 
                                    fontSize: 'clamp(12px, 2vw, 16px)',
                                    lineHeight: '24px'
                                  }}
                                >
                                  {item.label}
                                </span>
                                <span 
                                  className="text-white/70 whitespace-nowrap"
                                  style={{ 
                                    fontSize: 'clamp(12px, 2vw, 16px)',
                                    lineHeight: '24px'
                                  }}
                                >
                                  {item.value}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold" style={{ fontSize: '20px', lineHeight: '28px' }}>
                시청 기록
              </h3>
            </div>
            <p className="text-white/60 text-sm">
              최근 시청한 영상을 확인해보세요
            </p>
            <div className="space-y-4">
              {isLoadingHistory && (
                <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4 animate-pulse" style={{ border: '2px solid #39489A' }}>
                  <div className="flex gap-4">
                    <div className="w-40 h-28 rounded-xl bg-gray-700/60" />
                    <div className="flex-1 space-y-3">
                      <div className="w-3/4 h-5 bg-gray-700/60 rounded" />
                      <div className="w-full h-10 bg-gray-700/40 rounded" />
                      <div className="w-1/3 h-4 bg-gray-700/60 rounded" />
                    </div>
                  </div>
                </div>
              )}
              {historyError && !isLoadingHistory && (
                <div className="bg-[#1a1f3a]/80 rounded-2xl p-4 text-red-300" style={{ border: '2px solid #39489A' }}>
                  {historyError}
                </div>
              )}
              {!isLoadingHistory && !historyError && watchHistory.length === 0 && (
                <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4 text-center text-white/60" style={{ border: '2px solid #39489A' }}>
                  아직 시청 기록이 없습니다.
                </div>
              )}
              {!isLoadingHistory && !historyError && watchHistory.map((video, index) => {
                // YouTube URL 생성 (유효성 검사 포함)
                const videoId = video.id || video.video_id
                const isValidVideoId = videoId && typeof videoId === 'string' && videoId.length >= 10 && videoId.length <= 12
                const youtubeUrl = video.youtube_url || (isValidVideoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : null)
                
                return (
                <div
                  key={video.id || index}
                  className="block bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4 transition-colors"
                  style={{ border: '2px solid #39489A' }}
                >
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative w-full md:w-52 lg:w-60 h-32 md:h-32 lg:h-36 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500/30 to-purple-500/30">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            // 썸네일 로드 실패 시 비디오 ID로 YouTube 썸네일 생성
                            const img = e.target
                            const videoId = video.id || video.video_id
                            
                            // 무한 루프 방지: 이미 시도한 횟수 확인
                            const retryCount = parseInt(img.dataset.retryCount || '0', 10)
                            if (retryCount >= 3) {
                              // 3번 이상 시도했으면 포기하고 placeholder 표시
                              img.style.display = 'none'
                              if (img.parentElement) {
                                img.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/60 text-sm">썸네일 없음</div>'
                              }
                              return
                            }
                            
                            // 비디오 ID 유효성 검사 강화
                            const isValidVideoId = videoId && 
                              typeof videoId === 'string' && 
                              videoId.length >= 10 && 
                              videoId.length <= 12 &&
                              (videoId.match(/[-_]/g) || []).length <= 2 // 특수문자 2개 이하
                            
                            if (!isValidVideoId) {
                              // 비디오 ID가 유효하지 않으면 placeholder 표시
                              img.style.display = 'none'
                              if (img.parentElement) {
                                img.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/60 text-sm">썸네일 없음</div>'
                              }
                              return
                            }
                            
                            // YouTube 썸네일 URL 생성 (여러 품질 시도)
                            img.dataset.retryCount = String(retryCount + 1)
                            if (retryCount === 0 && !img.src.includes('sddefault')) {
                              img.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
                            } else if (retryCount === 1 && !img.src.includes('hqdefault')) {
                              img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                            } else if (retryCount === 2 && !img.src.includes('/0.jpg')) {
                              img.src = `https://i.ytimg.com/vi/${videoId}/0.jpg`
                            } else {
                              // 모든 시도 실패 시 placeholder 표시
                              img.style.display = 'none'
                              if (img.parentElement) {
                                img.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/60 text-sm">썸네일 없음</div>'
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                          썸네일 없음
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h4 className="text-white font-semibold text-lg leading-7 line-clamp-2">
                          {video.title}
                        </h4>
                        <span className="text-sm text-blue-200 whitespace-nowrap">
                          조회수 {video.views}
                        </span>
                      </div>
                      {video.description && (
                        <p className="text-white/60 text-sm leading-6 line-clamp-2">
                          {video.description}
                        </p>
                      )}
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-white/50">
                          {video.category && <span>{video.category}</span>}
                          <span>•</span>
                          <span>{index === 0 ? '방금 시청' : index === 1 ? '1시간 전' : `${index + 1}시간 전`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={youtubeUrl || '#'}
                            target={youtubeUrl ? '_blank' : undefined}
                            rel={youtubeUrl ? 'noopener noreferrer' : undefined}
                            onClick={!youtubeUrl ? (e) => { e.preventDefault(); console.warn('[MyPage] Invalid video ID:', videoId) } : undefined}
                            className="px-3 py-1 text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                          >
                            YouTube 보기
                          </a>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleVideoKeywordAnalysis(video)
                            }}
                            className="px-3 py-1 text-xs font-medium bg-blue-600/40 hover:bg-blue-600/60 text-white rounded-lg transition-colors"
                          >
                            키워드 분석
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold" style={{ fontSize: '20px', lineHeight: '28px' }}>
                오늘
              </h3>
            </div>
            {bookmarks.length === 0 ? (
              <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4 text-center" style={{ border: '2px solid #39489A' }}>
                <Bookmark className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2" style={{ fontSize: '18px' }}>
                  저장된 북마크가 없습니다
                </h3>
                <p className="text-white/60 text-sm">
                  관심 있는 영상을 북마크하면 이곳에 모아둘 수 있어요.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookmarks.map((bookmark, index) => {
                  const videoId = bookmark.id || bookmark.video_id
                  const isValidVideoId = videoId && typeof videoId === 'string' && videoId.length >= 10 && videoId.length <= 12
                  const youtubeUrl = bookmark.youtube_url || (isValidVideoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : null)
                  return (
                    <a
                      key={videoId || index}
                      href={youtubeUrl || '#'}
                      target={youtubeUrl ? '_blank' : undefined}
                      rel={youtubeUrl ? 'noopener noreferrer' : undefined}
                      onClick={!youtubeUrl ? (e) => { e.preventDefault(); console.warn('[MyPage] Invalid bookmark video ID:', videoId) } : undefined}
                      className="block bg-[#0f1629]/60 backdrop-blur-lg rounded-2xl p-4 transition-colors"
                  style={{ border: '2px solid #39489A' }}
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative w-full md:w-52 lg:w-60 h-32 md:h-32 lg:h-36 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500/30 to-purple-500/30 group">
                          {bookmark.thumbnail_url ? (
                            <img
                              src={bookmark.thumbnail_url}
                              alt={bookmark.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                // 썸네일 로드 실패 시 비디오 ID로 YouTube 썸네일 생성
                                const img = e.target
                                const videoId = bookmark.id || bookmark.video_id
                                
                                // 무한 루프 방지: 이미 시도한 횟수 확인
                                const retryCount = parseInt(img.dataset.retryCount || '0', 10)
                                if (retryCount >= 3) {
                                  // 3번 이상 시도했으면 포기하고 placeholder 표시
                                  img.style.display = 'none'
                                  if (img.parentElement) {
                                    img.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/60 text-sm">썸네일 없음</div>'
                                  }
                                  return
                                }
                                
                                // 비디오 ID 유효성 검사 강화
                                const isValidVideoId = videoId && 
                                  typeof videoId === 'string' && 
                                  videoId.length >= 10 && 
                                  videoId.length <= 12 &&
                                  (videoId.match(/[-_]/g) || []).length <= 2 // 특수문자 2개 이하
                                
                                if (!isValidVideoId) {
                                  // 비디오 ID가 유효하지 않으면 placeholder 표시
                                  img.style.display = 'none'
                                  if (img.parentElement) {
                                    img.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/60 text-sm">썸네일 없음</div>'
                                  }
                                  return
                                }
                                
                                // YouTube 썸네일 URL 생성 (여러 품질 시도)
                                img.dataset.retryCount = String(retryCount + 1)
                                if (retryCount === 0 && !img.src.includes('sddefault')) {
                                  img.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
                                } else if (retryCount === 1 && !img.src.includes('hqdefault')) {
                                  img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                                } else if (retryCount === 2 && !img.src.includes('/0.jpg')) {
                                  img.src = `https://i.ytimg.com/vi/${videoId}/0.jpg`
                                } else {
                                  // 모든 시도 실패 시 placeholder 표시
                                  img.style.display = 'none'
                                  if (img.parentElement) {
                                    img.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/60 text-sm">썸네일 없음</div>'
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                              썸네일 없음
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col min-w-0">
                          <div className="flex items-start gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold text-lg leading-7 line-clamp-2">
                                {bookmark.title}
                              </h4>
                              {bookmark.channel && (
                                <p className="text-blue-200 text-sm mt-1">{bookmark.channel}</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleToggleBookmark(bookmark)
                              }}
                              className="flex items-center justify-center w-10 h-10 rounded-full border border-blue-500/40 text-white hover:bg-blue-600/20 transition-colors"
                              title="북마크 해제"
                            >
                              <Bookmark className="w-5 h-5 fill-current" />
                            </button>
                          </div>
                          {bookmark.description && (
                            <p className="text-white/60 text-sm leading-6 line-clamp-2">
                              {bookmark.description}
                            </p>
                          )}
                          <div className="mt-auto pt-4 flex items-center gap-4 text-xs text-white/50">
                            {bookmark.views && <span>조회수 {bookmark.views}</span>}
                            <span>•</span>
                            <span>{index === 0 ? '방금 저장' : `${index}시간 전 저장`}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {/* Activity Item 1 */}
            <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-xl p-4 flex items-start gap-4" style={{ border: '2px solid #39489A' }}>
              <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-white mb-1" style={{
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  제주도 여행 계획 생성
                </p>
                <p className="text-white/60" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  2025.11.01
                </p>
              </div>
            </div>

            {/* Activity Item 2 */}
            <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-xl p-4 flex items-start gap-4" style={{ border: '2px solid #39489A' }}>
              <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-white mb-1" style={{
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  교토 여행 예산 수정
                </p>
                <p className="text-white/60" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  2025.10.28
                </p>
              </div>
            </div>

            {/* Activity Item 3 */}
            <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-xl p-4 flex items-start gap-4" style={{ border: '2px solid #39489A' }}>
              <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-white mb-1" style={{
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  파리 여행 완료
                </p>
                <p className="text-white/60" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  2025.10.25
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            {settingsCards.map((card) => (
              <div
                key={card.id}
                className="bg-[#0f1629]/80 rounded-2xl p-4"
                style={{ border: '2px solid #39489A' }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    {card.icon}
                  </div>
                  <h3 className="text-white font-semibold text-lg">{card.title}</h3>
                </div>
                <div className="space-y-5">
                  {card.items.map((item, idx) => (
                    <div
                      key={`${card.id}-${idx}`}
                      className="flex items-center justify-between gap-6"
                    >
                      <div>
                        <p className="text-white font-medium text-sm">{item.label}</p>
                        {item.value && (
                          <p className="text-white/60 text-sm mt-1">
                            {item.value}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {item.action ? item.action : null}
                        {item.toggle ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              defaultChecked={item.toggle.defaultChecked}
                            />
                            <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Profile Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1f3a] rounded-2xl p-6 w-full max-w-md border border-blue-900/40">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold" style={{
                fontSize: '20px',
                lineHeight: '28px',
                fontFamily: 'Arial, sans-serif'
              }}>
                프로필 수정
              </h2>
              <button 
                onClick={handleCancel}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-white mb-2" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  이름
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0f1629]/60 border border-blue-900/40 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-white mb-2" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  이메일
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-[#0f1629]/60 border border-blue-900/40 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white font-semibold transition-opacity"
                style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
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
              {passwordFieldConfig.map((field) => (
                <div key={field.id}>
                  <label className="text-white text-sm">{field.label}</label>
                  <div className="relative mt-2">
                    <input
                      type={passwordForm[field.toggle] ? 'text' : 'password'}
                      value={passwordForm[field.id]}
                      onChange={(e) => handlePasswordInputChange(field.id, e.target.value)}
                      autoComplete={field.autoComplete}
                      className="w-full bg-[#0f1629]/60 border border-blue-900/40 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.toggle)}
                      className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white transition-colors"
                    >
                      {passwordForm[field.toggle] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-white/40 text-xs whitespace-nowrap">
                비밀번호는 영문, 숫자, 특수문자 중 2종류 조합으로 10자리 이상 입력해야 합니다.
              </p>
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

      {/* Password Change Success Modal */}
      {isPasswordSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#10173a] border border-blue-900/40 rounded-3xl w-full max-w-sm p-6 text-center">
            <p className="text-white text-sm leading-6 mb-6">
              새 비밀번호 변경이 완료되었습니다.<br />다시 로그인해주세요.
            </p>
            <button
              onClick={handlePasswordSuccessConfirm}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:opacity-90"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Travel Preference Modal */}
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
            <div className="grid grid-cols-2 gap-3">
              {preferenceOptions.map((option) => {
                const isSelected = preferenceDraft.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => togglePreferenceSelection(option.id)}
                    className={`px-4 py-2 rounded-full border transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-lg'
                        : 'bg-[#0b1026] border-blue-600/40 text-white/70 hover:border-blue-400 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {preferenceModalError && (
              <p className="text-red-400 text-sm mt-4">{preferenceModalError}</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closePreferenceModal}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitPreferenceChanges}
                disabled={isSavingPreferences}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingPreferences ? '저장 중...' : '변경하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Keyword Analysis Modal */}
      {isVideoKeywordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0f1629] rounded-2xl shadow-2xl overflow-hidden" style={{ border: '2px solid #39489A' }}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-blue-500/20">
              <h2 className="text-white font-bold text-xl">키워드 분석</h2>
              <button
                onClick={handleCloseVideoKeywordModal}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 모달 본문 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {selectedVideoForKeywords && (
                <div className="mb-6">
                  <h3 className="text-white font-semibold text-lg mb-2">{selectedVideoForKeywords.title}</h3>
                  {selectedVideoForKeywords.description && (
                    <p className="text-white/60 text-sm line-clamp-2">{selectedVideoForKeywords.description}</p>
                  )}
                </div>
              )}
              
              {isLoadingKeywords && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-white/60">키워드를 분석하는 중...</p>
                </div>
              )}
              
              {keywordsError && !isLoadingKeywords && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
                  {keywordsError}
                </div>
              )}
              
              {!isLoadingKeywords && !keywordsError && videoKeywords.length > 0 && (
                <div className="bg-white rounded-lg p-6">
                  <VideoKeywordVisualization
                    keywords={videoKeywords}
                    videoTitle={selectedVideoForKeywords?.title}
                  />
                </div>
              )}
              
              {!isLoadingKeywords && !keywordsError && videoKeywords.length === 0 && (
                <div className="text-center py-12 text-white/60">
                  키워드 데이터가 없습니다.
                </div>
              )}
            </div>
            
            {/* 모달 푸터 */}
            <div className="flex justify-end gap-3 p-6 border-t border-blue-500/20">
              <button
                onClick={handleCloseVideoKeywordModal}
                className="px-5 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Preference Modal */}
      {isKeywordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#10173a] border border-blue-900/40 rounded-3xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">키워드</h3>
              <button onClick={closeKeywordModal} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 text-sm mb-4">최대 5개 / 복수선택가능</p>
            <div className="grid grid-cols-2 gap-3">
              {keywordOptions.map((option) => {
                const isSelected = keywordDraft.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleKeywordSelection(option.id)}
                    className={`px-4 py-2 rounded-full border transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-lg'
                        : 'bg-[#0b1026] border-blue-600/40 text-white/70 hover:border-blue-400 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {keywordModalError && (
              <p className="text-red-400 text-sm mt-4">{keywordModalError}</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeKeywordModal}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitKeywordChanges}
                disabled={isSavingPreferences}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingPreferences ? '저장 중...' : '변경하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MyPageLayout>
  )
}

export default MyPage
