/**
 * Axios 클라이언트 설정
 * 백엔드 API 호출을 위한 기본 설정
 */
import axios from 'axios';

// 백엔드 API 기본 URL
// Vite proxy 설정: /api로 시작하는 요청이 자동으로 백엔드로 프록시됨
// baseURL을 '/api'로 설정하면 모든 요청이 /api로 시작됨
// FIX: 404 에러 방지를 위해 base URL이 /api로 끝나지 않으면 자동 추가
let API_BASE_URL = import.meta.env?.VITE_API_URL || '/api';
// base URL이 /api로 끝나지 않으면 /api를 추가
if (!API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`;
}

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60초 타임아웃 (백엔드 응답 지연 대응)
});

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    // 요청 전 처리 (인증 토큰 추가 등)
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 에러 처리
    if (error.response) {
      // 서버에서 응답을 받았지만 에러 상태
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못함
      console.error('Network Error:', error.request);
    } else {
      // 요청 설정 중 에러
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;

