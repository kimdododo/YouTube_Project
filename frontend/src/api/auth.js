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
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { detail: response.statusText }
      }
      
      // 백엔드에서 반환한 상세 오류 메시지 사용
      const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: 로그인에 실패했습니다`
      console.error('[auth.js] Login error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      })
      throw new Error(errorMessage)
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
 * 이메일 인증코드 검증
 * @param {string} email - 이메일 주소
 * @param {string} code - 인증코드 (6자리 숫자)
 * @returns {Promise<Object>} 인증 결과
 */
export const verifyEmail = async (email, code) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        code: code
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}: 이메일 인증에 실패했습니다`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[auth.js] Error verifying email:', error?.message || error)
    throw error
  }
}

/**
 * 인증코드 재전송
 * @param {string} email - 이메일 주소
 * @returns {Promise<Object>} 재전송 결과
 */
export const resendVerificationCode = async (email) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/resend-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}: 인증코드 재전송에 실패했습니다`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[auth.js] Error resending verification code:', error?.message || error)
    throw error
  }
}

/**
 * 로그아웃
 */
export const logout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('token_type')
  sessionStorage.removeItem('isLoggedIn')
  sessionStorage.removeItem('userName')
  // localStorage에서도 제거 (이전 버전 호환성)
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

const authHeaders = () => {
  const token = getToken()
  if (!token) {
    throw new Error('로그인이 필요합니다.')
  }
  return {
    Authorization: `Bearer ${token}`
  }
}

export const changePassword = async (currentPassword, newPassword) => {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders()
  }

  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(errorData.detail || '비밀번호 변경에 실패했습니다.')
  }

  const result = await response.json()
  return result.data || result
}

export const saveTravelPreferences = async (preferenceIds = [], keywords = []) => {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders()
  }

  const response = await fetch(`${API_BASE_URL}/auth/preferences`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      preference_ids: preferenceIds,
      keywords
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(errorData.detail || '여행 취향을 저장하지 못했습니다.')
  }

  const result = await response.json()
  return result.data || result
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 * @returns {Promise<Object>} 사용자 정보 (username, email, id)
 */
export const getCurrentUser = async () => {
  const token = getToken()
  if (!token) {
    return null
  }

  try {
    const headers = {
      ...authHeaders()
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      // 401 Unauthorized인 경우 토큰이 만료되었을 수 있음
      if (response.status === 401) {
        console.warn('[auth.js] Unauthorized - token may be expired')
        localStorage.removeItem('access_token')
        localStorage.removeItem('token_type')
        return null
      }
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || '사용자 정보를 불러오지 못했습니다.')
    }

    const result = await response.json()
    return result.data || result
  } catch (error) {
    console.error('[auth.js] Error getting current user:', error?.message || error)
    return null
  }
}

export const fetchTravelPreferences = async () => {
  const token = getToken()
  if (!token) {
    // 토큰이 없으면 빈 객체 반환 (에러를 던지지 않음)
    return { preference_ids: [], keywords: [] }
  }

  const headers = {
    ...authHeaders()
  }

  const response = await fetch(`${API_BASE_URL}/auth/preferences`, {
    method: 'GET',
    headers
  })

  if (!response.ok) {
    // 401 Unauthorized인 경우 토큰이 만료되었을 수 있으므로 빈 객체 반환
    if (response.status === 401) {
      console.warn('[auth.js] Unauthorized - token may be expired')
      localStorage.removeItem('access_token')
      localStorage.removeItem('token_type')
      return { preference_ids: [], keywords: [] }
    }
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(errorData.detail || '여행 취향을 불러오지 못했습니다.')
  }

  const result = await response.json()
  return result.data || result
}

/**
 * 키워드 목록을 임베딩 벡터로 변환 (word2vec 기반 키워드 클라우드용)
 * @param {string[]} keywords - 키워드 ID 배열
 * @returns {Promise<Array<{keyword: string, embedding: number[]}>>} 키워드와 임베딩 매핑
 * [DEPRECATED] getMyKeywords 사용 권장
 */
export const getKeywordEmbeddings = async (keywords) => {
  const token = getToken()
  if (!token || !keywords || keywords.length === 0) {
    return []
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders()
    }

    const response = await fetch(`${API_BASE_URL}/auth/keywords/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(keywords)
    })

    if (!response.ok) {
      // 401 Unauthorized인 경우 토큰이 만료되었을 수 있음
      if (response.status === 401) {
        console.warn('[auth.js] Unauthorized - token may be expired')
        localStorage.removeItem('access_token')
        localStorage.removeItem('token_type')
        return []
      }
      console.warn('[auth.js] Failed to get keyword embeddings:', response.status)
      return []
    }

    const result = await response.json()
    return result.data?.embeddings || result.embeddings || []
  } catch (error) {
    console.error('[auth.js] Error getting keyword embeddings:', error?.message || error)
    return []
  }
}

/**
 * 사용자 키워드 기반 word2vec 유사 키워드 추천
 * 백엔드에서 유사 키워드 Top-K + 유사도 점수를 반환
 * @param {number} topK - 반환할 키워드 개수 (기본값: 7)
 * @returns {Promise<Array<{word: string, score: number}>>} 유사 키워드와 점수 배열
 */
export const getMyKeywords = async (topK = 7) => {
  const token = getToken()
  if (!token) {
    return []
  }

  try {
    const headers = {
      ...authHeaders()
    }

    const response = await fetch(`${API_BASE_URL}/auth/my_keywords?top_k=${topK}`, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      // 401 Unauthorized인 경우 토큰이 만료되었을 수 있음
      if (response.status === 401) {
        console.warn('[auth.js] Unauthorized - token may be expired')
        localStorage.removeItem('access_token')
        localStorage.removeItem('token_type')
        return []
      }
      console.warn('[auth.js] Failed to get my keywords:', response.status)
      return []
    }

    const result = await response.json()
    return result.data || result || []
  } catch (error) {
    console.error('[auth.js] Error getting my keywords:', error?.message || error)
    return []
  }
}

/**
 * 사용자 프로필 업데이트 (이름 변경)
 * @param {string} username - 새 사용자명
 * @returns {Promise<Object>} 업데이트된 사용자 정보
 */
export const updateUserProfile = async (username) => {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders()
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      username: username
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(errorData.detail || '프로필 업데이트에 실패했습니다.')
  }

  const result = await response.json()
  return result.data || result
}

