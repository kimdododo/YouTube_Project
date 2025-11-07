import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // 모든 인터페이스에서 접근 가능
    port: 5173,
    strictPort: false,  // 포트가 사용 중이면 다른 포트 사용
    watch: {
      usePolling: true,  // Docker에서 파일 변경 감지
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',  // Docker 환경: backend 서비스 이름 사용
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

