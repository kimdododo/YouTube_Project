import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import Logo from './Logo'
import { register, verifyEmail, resendVerificationCode } from '../api/auth'

function Signup() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // 이메일 인증 관련 상태
  const [showVerification, setShowVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0) // 재전송 제한 카운트다운

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // 재전송 카운트다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    
    // 비밀번호 길이 체크
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }
    
    setLoading(true)
    
    try {
      // 백엔드 회원가입 API 호출
      const result = await register({
        name: formData.name,
        username: formData.name,
        email: formData.email,
        password: formData.password
      })
      
      // 회원가입 성공 시 반드시 이메일 인증 화면 표시
      // 인증 완료 전에는 다른 페이지로 이동할 수 없음
      if (result.requires_verification) {
        setShowVerification(true)
        setCountdown(60) // 재전송 제한: 60초
        // 인증 완료 전에는 상태를 저장하지 않음 (회원가입 미완료 상태)
      } else {
        // 인증이 필요 없는 경우는 발생하지 않아야 함 (예외 처리)
        console.warn('[Signup] requires_verification is false, but email verification is mandatory')
        setError('이메일 인증이 필요합니다. 다시 시도해주세요.')
      }
    } catch (error) {
      console.error('[Signup] Signup error:', error)
      setError(error.message || '회원가입에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyEmail = async (e) => {
    e.preventDefault()
    setError('')
    
    if (verificationCode.length !== 6) {
      setError('인증코드는 6자리 숫자입니다.')
      return
    }
    
    setVerificationLoading(true)
    
    try {
      const result = await verifyEmail(formData.email, verificationCode)
      
      if (result.success) {
        setVerificationSuccess(true)
        // 인증 성공 시 상태 저장
        localStorage.setItem('hasAccount', 'true')
        localStorage.setItem('userName', formData.name)
        localStorage.setItem('pendingLoginEmail', formData.email)
        localStorage.setItem('pendingLoginPassword', formData.password)
        
        // 1초 후 여행 취향 선택 페이지로 이동
        setTimeout(() => {
          navigate('/travel-preference')
        }, 1000)
      }
    } catch (error) {
      console.error('[Signup] Verification error:', error)
      setError(error.message || '인증코드가 올바르지 않습니다. 다시 확인해주세요.')
      setVerificationCode('') // 입력 초기화
    } finally {
      setVerificationLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) {
      setError(`${countdown}초 후에 재전송할 수 있습니다.`)
      return
    }
    
    setResendLoading(true)
    setError('')
    
    try {
      const result = await resendVerificationCode(formData.email)
      if (result.success) {
        setError('')
        setCountdown(60) // 재전송 제한: 60초
        alert('인증코드가 재전송되었습니다. 이메일을 확인해주세요.')
      }
    } catch (error) {
      console.error('[Signup] Resend code error:', error)
      setError(error.message || '인증코드 재전송에 실패했습니다.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleVerificationCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '') // 숫자만 허용
    if (value.length <= 6) {
      setVerificationCode(value)
      setError('') // 입력 시 에러 메시지 초기화
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden flex items-center justify-center">
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

      {/* 중앙 카드 */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
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

          {/* 이메일 인증 화면 */}
          {showVerification ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                  <Mail className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">이메일 인증</h2>
                <p className="text-white/70 text-sm">
                  <span className="font-medium text-blue-400">{formData.email}</span>로<br />
                  인증코드를 발송했습니다.
                </p>
              </div>

              {verificationSuccess ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-green-400 font-medium mb-2">인증이 완료되었습니다!</p>
                  <p className="text-white/70 text-sm">잠시 후 이동합니다...</p>
                </div>
              ) : (
                <form onSubmit={handleVerifyEmail} className="space-y-6">
                  {/* 에러 메시지 */}
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                      {error}
                    </div>
                  )}

                  {/* 인증코드 입력 */}
                  <div>
                    <label htmlFor="verificationCode" className="block text-white text-sm font-medium mb-2">
                      인증코드 (6자리)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="verificationCode"
                        value={verificationCode}
                        onChange={handleVerificationCodeChange}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                        required
                        autoFocus
                      />
                    </div>
                    <p className="text-white/50 text-xs mt-2 text-center">
                      인증코드는 3분 후 만료됩니다.
                    </p>
                  </div>

                  {/* 인증 버튼 */}
                  <button
                    type="submit"
                    disabled={verificationLoading || verificationCode.length !== 6}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verificationLoading ? '인증 중...' : '인증하기'}
                  </button>

                  {/* 재전송 버튼 */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendLoading || countdown > 0}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                    >
                      {resendLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          재전송 중...
                        </>
                      ) : countdown > 0 ? (
                        `${countdown}초 후 재전송 가능`
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          인증코드 재전송
                        </>
                      )}
                    </button>
                  </div>

                  {/* 뒤로가기 */}
                  <div className="text-center pt-4 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerification(false)
                        setVerificationCode('')
                        setError('')
                        setCountdown(0)
                      }}
                      className="text-white/70 hover:text-white text-sm transition-colors"
                    >
                      ← 회원가입 정보 수정
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* 회원가입 폼 */
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-xl font-bold text-white text-center mb-6">회원가입</h2>
            
            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* 이름 입력 */}
            <div>
              <label htmlFor="name" className="block text-white text-sm font-medium mb-2">
                이름
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="이름을 입력하세요"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

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
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
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
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="........"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-white text-sm font-medium mb-2">
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="........"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </div>


            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '회원가입 중...' : '회원가입'}
            </button>

            {/* 로그인 링크 */}
            <div className="text-center">
              <p className="text-white/70 text-sm">
                이미 계정이 있으신가요?{' '}
                <Link 
                  to="/login" 
                  state={{ fromSignup: true }}
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors underline"
                >
                  로그인
                </Link>
              </p>
            </div>
          </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/50 text-xs">© 2025 여유. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

export default Signup

