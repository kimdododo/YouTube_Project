# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
# npm ci requires package-lock.json, use npm install to generate it
RUN npm install

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

