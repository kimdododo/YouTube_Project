import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import Logo from './Logo'
import AppLayout from './layouts/AppLayout'
import { login } from '../api/auth'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 로그인 페이지 접근 시 계정이 없으면 회원가입 페이지로 리다이렉트 (하지만 회원가입 페이지에서 온 경우는 제외)
  useEffect(() => {
    // 계정이 없으면 회원가입 페이지로 이동 (단, 회원가입 페이지에서 직접 로그인 링크를 클릭한 경우는 제외)
    const hasAccount = localStorage.getItem('hasAccount') === 'true'
    const fromSignup = location.state?.fromSignup || document.referrer.includes('/signup')
    // 히스토리 스택을 유지하여 뒤로가기 가능하도록 함
    if (!hasAccount && !fromSignup) {
      navigate('/signup', { replace: false })
    }
  }, [navigate, location.state])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // 백엔드 로그인 API 호출
      const result = await login(email, password)
      
      // 로그인 성공 시 상태 저장 (sessionStorage 사용 - 브라우저 닫으면 로그아웃)
      sessionStorage.setItem('isLoggedIn', 'true')
      if (result.user?.username || result.username) {
        sessionStorage.setItem('userName', result.user?.username || result.username)
      }
      
      // 홈으로 이동
      navigate('/')
    } catch (error) {
      console.error('[Login] Login error:', error)
      // 에러 메시지 개선
      let errorMessage = '로그인에 실패했습니다.'
      if (error.message) {
        if (error.message.includes('비밀번호가 일치하지 않습니다')) {
          errorMessage = '비밀번호가 일치하지 않습니다.'
        } else if (error.message.includes('사용자를 찾을 수 없습니다')) {
          errorMessage = '사용자를 찾을 수 없습니다. 이메일 또는 사용자 이름을 확인해주세요.'
        } else if (error.message.includes('401') || error.message.includes('invalid credentials')) {
          errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.'
        } else {
          errorMessage = error.message
        }
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center py-12">
        {/* 중앙 카드 */}
        <div className="w-full max-w-md mx-auto px-4">
          <div className="bg-[#1a1f3a]/80 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl p-8">
          {/* 로고 영역 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Logo size="w-16 h-16" />
            </div>
            <Link to="/" className="block">
              <h1 className="text-3xl font-bold text-white mb-2 hover:opacity-80 transition-opacity cursor-pointer">여유</h1>
            </Link>
            <p className="text-white/70 text-sm">당신의 완벽한 여행 컨텐츠</p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-bold text-white text-center mb-6">로그인</h2>
            
            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* 이메일 입력 */}
            <div>
              <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-white text-sm font-medium mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="........"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* 옵션 행 */}
            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-white text-sm hover:text-purple-400 transition-colors">
                비밀번호 찾기
              </Link>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            {/* 회원가입 링크 */}
            <div className="text-center">
              <p className="text-white/70 text-sm">
                아직 계정이 없으신가요?{' '}
                <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                  회원가입
                </Link>
              </p>
            </div>
          </form>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-white/50 text-xs">© 2025 여유. All rights reserved.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default Login

