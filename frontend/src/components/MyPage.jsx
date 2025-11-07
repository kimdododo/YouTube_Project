import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, MapPin, Calendar, CreditCard, Plane, Globe, Settings, Camera, Edit3, Pin, Bell, Lock, X, LogOut, Bookmark } from 'lucide-react'
import Logo from './Logo'

function MyPage() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeTab, setActiveTab] = useState('settings')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [userName, setUserName] = useState('김여행')
  const [userEmail, setUserEmail] = useState('travel@example.com')
  const [editName, setEditName] = useState('김여행')
  const [editEmail, setEditEmail] = useState('travel@example.com')
  const [bookmarks, setBookmarks] = useState([])

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

  // 북마크 저장
  useEffect(() => {
    if (bookmarks.length > 0 || localStorage.getItem('bookmarks')) {
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks))
    }
  }, [bookmarks])

  // 사용자 데이터
  const userData = {
    stats: {
      totalTrips: 12,
      countriesVisited: 8,
      totalExpenses: 15000000,
      nextTrip: '2025.12.15'
    }
  }

  // 여행 계획 기능 제거됨
  const savedPlans = [
    {
      id: 1,
      location: '제주도',
      dates: '2025.12.01 - 12.05',
      budget: 800000,
      status: '예정',
      statusColor: 'bg-yellow-500'
    },
    {
      id: 2,
      location: '교토',
      dates: '2026.03.10 - 03.15',
      budget: 1500000,
      status: '계획중',
      statusColor: 'bg-purple-500'
    },
    {
      id: 3,
      location: '파리',
      dates: '2026.05.20 - 05.27',
      budget: 2500000,
      status: '계획중',
      statusColor: 'bg-purple-500'
    }
  ]

  const handleEditClick = () => {
    setEditName(userName)
    setEditEmail(userEmail)
    setIsEditModalOpen(true)
  }

  const handleSave = () => {
    setUserName(editName)
    setUserEmail(editEmail)
    setIsEditModalOpen(false)
  }

  const handleCancel = () => {
    setIsEditModalOpen(false)
  }

  const handleLogout = () => {
    // localStorage에서 로그인 관련 데이터 제거
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('hasAccount')
    localStorage.removeItem('userName')
    localStorage.removeItem('travelPreferences')
    localStorage.removeItem('subscribedChannels')
    
    // 로그인 상태 업데이트
    setIsLoggedIn(false)
    
    // 홈으로 이동
    navigate('/')
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #090E29 0%, #0E1435 50%, #090E29 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* 밤하늘 별 배경 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(1.14px 0.91px at 56.4% 50.4%, rgba(255,255,255,0.83), transparent),
            radial-gradient(0.62px 0.61px at 84.0% 97.7%, rgba(255,255,255,0.74), transparent),
            radial-gradient(1.53px 2.2px at 23.2% 8.0%, rgba(255,255,255,0.49), transparent),
            radial-gradient(1.45px 1.42px at 50.1% 51.1%, rgba(255,255,255,0.41), transparent),
            radial-gradient(0.73px 1.62px at 61.5% 37.0%, rgba(255,255,255,0.53), transparent)
          `,
          backgroundSize: '100% 100%'
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10" style={{
        padding: '12px 16px 1px',
        height: '65px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          width: '990px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '40px'
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
                color: 'rgba(147, 197, 253, 1)',
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
            <Link 
              to="/mypage" 
              className="font-bold leading-6 flex items-center" 
              style={{ 
                fontSize: '16px',
                lineHeight: '24px',
                color: '#FFFFFF',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              <User className="w-4 h-4 mr-1" />
              마이페이지
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10" style={{
        width: '990px',
        margin: '0 auto',
        padding: '0 16px',
        paddingTop: '32px',
        paddingBottom: '64px'
      }}>
        {/* User Profile Card */}
        <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            {/* Left: Profile Info */}
            <div className="flex items-start gap-4">
              {/* Profile Picture */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, #9333EA 0%, #3B82F6 100%)'
                }}>
                  <span className="text-white font-bold" style={{
                    fontSize: '32px',
                    lineHeight: '40px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    {userName.charAt(0)}
                  </span>
                </div>
                {/* Camera Icon */}
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-[#0f1629] cursor-pointer">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              
              {/* Name and Email */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-white font-bold" style={{
                    fontSize: '24px',
                    lineHeight: '32px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    {userName}
                  </h2>
                  <button 
                    onClick={handleEditClick}
                    className="flex items-center gap-1 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm" style={{
                      fontSize: '14px',
                      lineHeight: '20px',
                      fontFamily: 'Arial, sans-serif'
                    }}>
                      프로필 수정
                    </span>
                  </button>
                </div>
                <p className="text-gray-400" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  {userEmail}
                </p>
              </div>
            </div>

            {/* Right: Statistics */}
            <div className="grid grid-cols-4 gap-6">
              {/* Total Trips */}
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2">
                  <Plane className="w-5 h-5 text-white" />
                  <span className="text-white" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    총 여행
                  </span>
                </div>
                <span className="text-white font-bold" style={{
                  fontSize: '20px',
                  lineHeight: '28px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  {userData.stats.totalTrips}회
                </span>
              </div>

              {/* Countries Visited */}
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-white" />
                  <span className="text-white" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    방문 국가
                  </span>
                </div>
                <span className="text-white font-bold" style={{
                  fontSize: '20px',
                  lineHeight: '28px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  {userData.stats.countriesVisited}개국
                </span>
              </div>

              {/* Total Expenses */}
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-white" />
                  <span className="text-white" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    총 경비
                  </span>
                </div>
                <span className="text-white font-bold" style={{
                  fontSize: '20px',
                  lineHeight: '28px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  {userData.stats.totalExpenses.toLocaleString()}원
                </span>
              </div>

              {/* Next Trip */}
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-white" />
                  <span className="text-white" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    다음 여행
                  </span>
                </div>
                <span className="text-white font-bold" style={{
                  fontSize: '20px',
                  lineHeight: '28px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  {userData.stats.nextTrip}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-1.5 mb-6">
          <div className="relative flex">
            {[
              { id: 'saved', label: '저장된 계획', icon: Pin },
              { id: 'bookmarks', label: '북마크', icon: Bookmark },
              { id: 'activity', label: '최근 활동', icon: User },
              { id: 'settings', label: '설정', icon: Settings }
            ].map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all relative z-10 flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-white'
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
                left: activeTab === 'saved' ? '0.5rem' : 
                      activeTab === 'bookmarks' ? 'calc(25% + 0.25rem)' :
                      activeTab === 'activity' ? 'calc(50% + 0.25rem)' : 
                      'calc(75% + 0.25rem)',
                width: 'calc(25% - 0.5rem)'
              }}
            />
          </div>
        </div>

        {/* Content */}
        {activeTab === 'saved' && (
          <div className="space-y-4">
            {savedPlans.map((plan) => (
              <div key={plan.id} className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-5 flex items-center gap-4">
                {/* Left: Icon */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Pin className="w-6 h-6 text-white" />
                </div>

                {/* Center: Plan Info */}
                <div className="flex-1">
                  <h3 className="text-white font-bold mb-2" style={{
                    fontSize: '18px',
                    lineHeight: '26px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    {plan.location}
                  </h3>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-white/70">
                      <Calendar className="w-4 h-4" />
                      <span style={{
                        fontSize: '14px',
                        lineHeight: '20px',
                        fontFamily: 'Arial, sans-serif'
                      }}>
                        {plan.dates}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <CreditCard className="w-4 h-4" />
                      <span style={{
                        fontSize: '14px',
                        lineHeight: '20px',
                        fontFamily: 'Arial, sans-serif'
                      }}>
                        {plan.budget.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Status Badge */}
                <div className={`${plan.statusColor} px-3 py-1.5 rounded-lg`}>
                  <span className="text-white font-semibold" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    {plan.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-6">
            {bookmarks.length === 0 ? (
              <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-12 text-center">
                <Bookmark className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-white font-bold mb-2" style={{
                  fontSize: '20px',
                  lineHeight: '28px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  저장된 북마크가 없습니다
                </h3>
                <p className="text-gray-400" style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  비디오나 콘텐츠를 북마크하여 나중에 쉽게 찾아보세요.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-4 hover:border-blue-600/50 transition-all cursor-pointer"
                  >
                    <div className="flex gap-4">
                      {bookmark.thumbnail_url && (
                        <div className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-gray-900">
                          <img
                            src={bookmark.thumbnail_url}
                            alt={bookmark.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-semibold line-clamp-2" style={{
                            fontSize: '16px',
                            lineHeight: '24px',
                            fontFamily: 'Arial, sans-serif'
                          }}>
                            {bookmark.title}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const newBookmarks = bookmarks.filter(b => b.id !== bookmark.id)
                              setBookmarks(newBookmarks)
                            }}
                            className="flex-shrink-0 ml-2 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {bookmark.description && (
                          <p className="text-gray-400 line-clamp-1 mb-2" style={{
                            fontSize: '14px',
                            lineHeight: '20px',
                            fontFamily: 'Arial, sans-serif'
                          }}>
                            {bookmark.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-gray-500" style={{
                          fontSize: '12px',
                          lineHeight: '16px',
                          fontFamily: 'Arial, sans-serif'
                        }}>
                          {bookmark.category && (
                            <span>{bookmark.category}</span>
                          )}
                          {bookmark.views && (
                            <span>◎ {bookmark.views}</span>
                          )}
                          {bookmark.rating && (
                            <span className="flex items-center gap-1">
                              <span>⭐</span>
                              {bookmark.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {/* Activity Item 1 */}
            <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-5 flex items-start gap-4">
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
            <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-5 flex items-start gap-4">
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
            <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-5 flex items-start gap-4">
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
          <div className="space-y-6">
            {/* 알림 설정 */}
            <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Bell className="w-5 h-5 text-white" />
                <h3 className="text-white font-bold" style={{
                  fontSize: '18px',
                  lineHeight: '26px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  알림 설정
                </h3>
              </div>

              {/* 푸시 알림 */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-semibold mb-1" style={{
                    fontSize: '16px',
                    lineHeight: '24px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    푸시 알림
                  </p>
                  <p className="text-white/60" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    여행 관련 알림 받기
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* 이메일 업데이트 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold mb-1" style={{
                    fontSize: '16px',
                    lineHeight: '24px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    이메일 업데이트
                  </p>
                  <p className="text-white/60" style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    여행 트렌드 및 소식 받기
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* 계정 관리 */}
            <div className="bg-[#0f1629]/60 backdrop-blur-lg border border-blue-900/40 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-white" />
                  <h3 className="text-white font-bold" style={{
                    fontSize: '18px',
                    lineHeight: '26px',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    계정 관리
                  </h3>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors font-semibold border border-red-500/30" 
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

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
    </div>
  )
}

export default MyPage
