/**
 * 채널 관련 API 호출 함수
 */
import { optimizeThumbnailUrl } from '../utils/imageUtils'

// Vite 환경 변수 우선 사용, 없으면 '/api' 프록시 사용
const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api'

/**
 * 추천 채널 목록 조회
 * @param {Array<number>} travelPreferences - 여행 취향 ID 목록
 * @param {number} limit - 조회할 채널 수
 * @returns {Promise<Array>} 추천 채널 목록
 */
export const getRecommendedChannels = async (travelPreferences = [], limit = 4) => {
  try {
    // travelPreferences를 쉼표로 구분된 문자열로 변환
    const prefParam = travelPreferences.length > 0 
      ? `?travel_preferences=${travelPreferences.join(',')}&limit=${limit}`
      : `?limit=${limit}`
    
    const response = await fetch(`${API_BASE_URL}/channels/recommended${prefParam}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch recommended channels`)
    }
    
    const result = await response.json()
    
    // 백엔드 응답 형식: { channels: [...], total: number }
    const channels = result.channels || result
    
    // 데이터 형식 변환
    return channels.map(channel => ({
      id: channel.id || channel.channel_id,
      channel_id: channel.channel_id,
      name: channel.name || 'Unknown Channel',
      subscribers: channel.subscribers || '0명',
      video_count: channel.video_count || 0,
      thumbnail_url: channel.thumbnail_url ? optimizeThumbnailUrl(channel.thumbnail_url, channel.channel_id) : null
    }))
  } catch (error) {
    console.error('[channels.js] Error fetching recommended channels:', error?.message || error)
    throw error
  }
}

/**
 * 채널 검색 (임베딩 기반 유사도 검색 지원)
 * @param {string} query - 검색 쿼리
 * @param {number} limit - 조회할 채널 수
 * @param {boolean} useEmbedding - 임베딩 기반 검색 사용 여부
 * @returns {Promise<Array>} 검색된 채널 목록
 */
export const searchChannels = async (query, limit = 20, useEmbedding = true) => {
  try {
    const url = `${API_BASE_URL}/channels/search?q=${encodeURIComponent(query)}&limit=${limit}&use_embedding=${useEmbedding}`
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to search channels`)
    }
    
    const result = await response.json()
    
    // 백엔드 응답 형식: { channels: [...], total: number }
    const channels = result.channels || result
    
    // 데이터 형식 변환
    return channels.map(channel => ({
      id: channel.id || channel.channel_id,
      channel_id: channel.channel_id,
      name: channel.name || 'Unknown Channel',
      subscribers: channel.subscribers || '0명',
      video_count: channel.video_count || 0,
      thumbnail_url: channel.thumbnail_url ? optimizeThumbnailUrl(channel.thumbnail_url, channel.channel_id) : null
    }))
  } catch (error) {
    console.error('[channels.js] Error searching channels:', error?.message || error)
    throw error
  }
}

/**
 * 전체 채널 목록 조회
 * @param {number} skip - 페이지네이션 오프셋
 * @param {number} limit - 조회할 채널 수
 * @returns {Promise<Array>} 채널 목록
 */
export const getAllChannels = async (skip = 0, limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/channels/?skip=${skip}&limit=${limit}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch channels`)
    }
    
    const result = await response.json()
    
    // 백엔드 응답 형식: { channels: [...], total: number }
    const channels = result.channels || result
    
    // 데이터 형식 변환
    return channels.map(channel => ({
      id: channel.id || channel.channel_id,
      channel_id: channel.channel_id,
      name: channel.name || 'Unknown Channel',
      subscribers: channel.subscribers || '0명',
      video_count: channel.video_count || 0,
      thumbnail_url: channel.thumbnail_url ? optimizeThumbnailUrl(channel.thumbnail_url, channel.channel_id) : null
    }))
  } catch (error) {
    console.error('[channels.js] Error fetching channels:', error?.message || error)
    throw error
  }
}

