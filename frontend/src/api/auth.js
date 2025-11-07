/**
 * 인증 관련 API 호출 함수
 */
// Vite 환경 변수 우선 사용, 없으면 '/api' 프록시 사용
const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'

/**
 * 회원가입
 * @param {Object} userData - 사용자 정보
 * @param {string} userData.username - 사용자 이름ㅋ
 * @param {string} userData.email - 이메일
 * @param {string} userData.password - 비밀번호
 * @returns {Promise<Object>} 회원가입 결과
 */
export const register = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: userData.username || userData.name,
        email: userData.email,
        password: userData.password
      })
    })

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { detail: response.statusText }
      }
      console.error('[auth.js] Register error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      })
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}: 회원가입에 실패했습니다`)
    }

    const result = await response.json()
    return result.data || result
  } catch (error) {
    console.error('[auth.js] Error registering user:', error?.message || error)
    throw error
  }
}

/**
 * 로그인 (OAuth2 Password Flow)
 * @param {string} username - 사용자 이름 또는 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 로그인 결과 (access_token 포함)
 */
export const login = async (username, password) => {
  try {
    // OAuth2 Password Flow 형식으로 FormData 생성
    const formData = new URLSearchParams()
    formData.append('username', username)
    formData.append('password', password)

    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: 로그인에 실패했습니다`)
    }

    const result = await response.json()
    const tokenData = result.data || result
    
    // 토큰을 localStorage에 저장
    if (tokenData.access_token) {
      localStorage.setItem('access_token', tokenData.access_token)
      localStorage.setItem('token_type', tokenData.token_type || 'bearer')
    }
    
    return tokenData
  } catch (error) {
    console.error('[auth.js] Error logging in:', error?.message || error)
    throw error
  }
}

/**
 * 로그아웃
 */
export const logout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('token_type')
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('userName')
}

/**
 * 현재 로그인 상태 확인
 * @returns {boolean} 로그인 여부
 */
export const isAuthenticated = () => {
  return !!localStorage.getItem('access_token')
}

/**
 * 저장된 토큰 가져오기
 * @returns {string|null} 액세스 토큰
 */
export const getToken = () => {
  return localStorage.getItem('access_token')
}

