import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { User, Settings, Camera, Edit3, Clock, Bookmark, Search } from 'lucide-react'
import Logo from '../Logo'
import { getCurrentUser, getToken } from '../../api/auth'

/**
 * 마이페이지 전용 레이아웃 컴포넌트
 * 프로필 카드, 취향 분석, 설정 섹션 등 마이페이지 전용 UI 포함
 */
function MyPageLayout({ children, activeTab, setActiveTab }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '')
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || '')
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(false)
  const [userInfoError, setUserInfoError] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const location = useLocation()

  // 로그인 상태 체크
  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(
        sessionStorage.getItem('isLoggedIn') === 'true' || 
        localStorage.getItem('isLoggedIn') === 'true'
      )
    }
    
    checkLoginStatus()
    window.addEventListener('storage', checkLoginStatus)
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus)
    }
  }, [location.pathname])

  // 사용자 정보 로드
  useEffect(() => {
    const loadUserInfo = async () => {
      const token = getToken()
      if (!token) {
        setUserInfoError('로그인이 필요합니다.')
        return
      }

      setIsLoadingUserInfo(true)
      setUserInfoError('')
      
      try {
        const userInfo = await getCurrentUser()
        if (userInfo) {
          setUserName(userInfo.username || userName)
          setUserEmail(userInfo.email || userEmail)
          if (userInfo.username) {
            localStorage.setItem('userName', userInfo.username)
          }
          if (userInfo.email) {
            localStorage.setItem('userEmail', userInfo.email)
          }
          setUserInfoError('')
        } else {
          setUserInfoError('사용자 정보를 불러올 수 없습니다.')
        }
      } catch (error) {
        console.error('[MyPageLayout] Failed to load user info:', error)
        setUserInfoError(error?.message || '사용자 정보를 불러오지 못했습니다.')
      } finally {
        setIsLoadingUserInfo(false)
      }
    }

    if (isLoggedIn) {
      loadUserInfo()
    }
  }, [isLoggedIn])

  const handleEditClick = () => {
    setIsEditModalOpen(true)
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #090E29 0%, #0E1435 50%, #090E29 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
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
            <nav className="flex items-center space-x-4 sm:space-x-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* 돋보기 아이콘 (채널 찾기) */}
              <Link
                to="/find-channel"
                className={`text-blue-300 hover:text-white transition-colors flex-shrink-0 ${location.pathname === '/find-channel' ? 'text-white' : 'text-blue-300'}`}
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}
                aria-label="채널 찾기"
              >
                <Search className="w-5 h-5" />
              </Link>
              
              {/* 여행 트렌드 */}
              <Link 
                to="/travel-trends" 
                className={`font-bold leading-6 whitespace-nowrap ${location.pathname === '/travel-trends' ? 'text-white' : 'text-blue-300'}`}
                style={{ 
                  fontSize: '14px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                여행 트렌드
              </Link>
              
              {/* 개인 맞춤 영상 추천 */}
              <Link 
                to="/recommendedVideos" 
                className={`font-bold leading-6 whitespace-nowrap ${location.pathname === '/recommendedVideos' ? 'text-white' : 'text-blue-300'}`}
                style={{ 
                  fontSize: '14px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                개인 맞춤 영상 추천
              </Link>
              
              {/* 마이페이지 */}
              <Link 
                to="/mypage" 
                className={`font-bold leading-6 flex items-center whitespace-nowrap ${location.pathname === '/mypage' ? 'text-white' : 'text-blue-300'}`}
                style={{ 
                  fontSize: '14px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                <User className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="hidden sm:inline">마이페이지</span>
                <span className="sm:hidden">마이</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - 마이페이지 전용 레이아웃 */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{
        paddingTop: '32px',
        paddingBottom: '64px'
      }}>
        {/* User Profile Card - 마이페이지에서만 렌더링 */}
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
                <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-[#060d2c] cursor-pointer shadow-lg">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2
                    className="text-white font-bold"
                    style={{
                      fontSize: '28px',
                      lineHeight: '36px'
                    }}
                  >
                    {isLoadingUserInfo ? '로딩 중...' : userName || '사용자'}
                  </h2>
                  <button
                    onClick={handleEditClick}
                    className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">프로필 수정</span>
                  </button>
                </div>
                {userInfoError && (
                  <p className="text-red-400 text-sm mb-2">{userInfoError}</p>
                )}
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

        {/* Tabs - 마이페이지 전용 */}
        {setActiveTab && (
          <div className="bg-[#0f1629]/60 backdrop-blur-lg rounded-xl p-1.5 mb-6" style={{ border: '2px solid #39489A' }}>
            <div className="relative flex">
              {[
                { id: 'insight', label: '취향 분석', icon: User },
                { id: 'history', label: '시청 기록', icon: Clock },
                { id: 'bookmarks', label: '북마크', icon: Bookmark },
                { id: 'settings', label: '설정', icon: Settings }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab && setActiveTab(tab.id)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all relative z-10 flex items-center justify-center gap-2 ${
                    activeTab === tab.id ? 'text-white' : 'text-white/70'
                  }`}
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              <div
                className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg transition-all duration-300"
                style={{
                  left: activeTab === 'insight' ? '0.5rem' : 
                        activeTab === 'history' ? 'calc(25% + 0.25rem)' :
                        activeTab === 'bookmarks' ? 'calc(50% + 0.25rem)' : 
                        'calc(75% + 0.25rem)',
                  width: 'calc(25% - 0.5rem)'
                }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        {children}
      </main>
    </div>
  )
}

export default MyPageLayout

