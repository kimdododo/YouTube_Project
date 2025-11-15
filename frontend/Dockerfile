# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
# Use npm ci for faster, reliable, reproducible builds
RUN npm ci --only=production=false || npm install

# Copy source files
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드 확인
RUN ls -la /usr/share/nginx/html/ || echo "Warning: dist directory is empty"

# Nginx 설정 검증
RUN nginx -t

EXPOSE 80

# Nginx 시작 (daemon off로 포그라운드 실행)
CMD ["nginx", "-g", "daemon off;"]

