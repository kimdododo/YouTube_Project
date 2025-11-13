import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { User, Search } from 'lucide-react'
import Logo from '../Logo'

/**
 * 공통 레이아웃 컴포넌트
 * 모든 페이지에서 공통으로 사용되는 헤더를 제공
 * MyPage 전용 섹션은 제외
 */
function AppLayout({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const location = useLocation()

  // 로그인 상태 체크 (최적화: storage 이벤트만 사용, interval 제거)
  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(
        sessionStorage.getItem('isLoggedIn') === 'true' || 
        localStorage.getItem('isLoggedIn') === 'true'
      )
    }
    
    // 초기 체크
    checkLoginStatus()
    
    // storage 이벤트 리스너 (다른 탭에서 로그인/로그아웃 시)
    window.addEventListener('storage', checkLoginStatus)
    
    // location 변경 시 체크 (같은 탭에서 네비게이션 시)
    checkLoginStatus()
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus)
    }
  }, [location.pathname])

  // 마이페이지 경로인지 확인
  const isMyPageRoute = location.pathname === '/mypage'

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

      {/* Header - 모든 페이지에서 공통 */}
      <header className="relative z-[100] bg-[#0a0e27]/80 backdrop-blur-sm border-b border-blue-900/30">
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
              {/* 돋보기 아이콘 (검색) */}
              <button
                className="text-blue-300 hover:text-white transition-colors flex-shrink-0"
                style={{ 
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}
                aria-label="검색"
              >
                <Search className="w-5 h-5" />
              </button>
              
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
              
              {/* 채널 찾기 */}
              <Link 
                to="/find-channel" 
                className={`font-bold leading-6 whitespace-nowrap ${location.pathname === '/find-channel' ? 'text-white' : 'text-blue-300'}`}
                style={{ 
                  fontSize: '14px',
                  lineHeight: '24px',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                채널 찾기
              </Link>
              
              {/* 마이페이지 또는 로그인하기 */}
              {isLoggedIn ? (
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
              ) : (
                <Link 
                  to="/login" 
                  className="font-bold leading-6 flex items-center text-blue-300 whitespace-nowrap"
                  style={{ 
                    fontSize: '14px',
                    lineHeight: '24px',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  <span className="hidden sm:inline">로그인하기</span>
                  <span className="sm:hidden">로그인</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - MyPage 전용 섹션은 여기에 포함되지 않음 */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  )
}

export default AppLayout

