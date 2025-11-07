"""
콘텐츠 기반 추천 알고리즘 구현
비디오의 특징(태그, 키워드, 지역)을 기반으로 유사한 영상을 추천
"""
import re
from typing import List, Dict, Set, Optional
from sqlalchemy.orm import Session
from app.models.video import Video
from collections import Counter
import math


class ContentBasedRecommender:
    """콘텐츠 기반 추천 알고리즘"""
    
    def __init__(self):
        """초기화"""
        pass
    
    def _extract_features(self, video: Video) -> Dict[str, any]:
        """
        비디오에서 특징 추출
        Returns:
            Dict with features: tags, keywords, region, etc.
        """
        features = {
            'tags': [],
            'keywords': [],
            'region': None,
            'title_keywords': [],
            'description_keywords': []
        }
        
        # 태그 처리
        if video.tags:
            if isinstance(video.tags, list):
                features['tags'] = [str(tag).lower().strip() for tag in video.tags if tag]
            elif isinstance(video.tags, dict):
                # dict인 경우 값 추출
                features['tags'] = [str(v).lower().strip() for v in video.tags.values() if v]
            elif isinstance(video.tags, str):
                # 문자열인 경우 쉼표로 분리
                features['tags'] = [tag.lower().strip() for tag in video.tags.split(',') if tag.strip()]
        
        # 키워드
        if video.keyword:
            features['keywords'] = [kw.lower().strip() for kw in str(video.keyword).split(',') if kw.strip()]
        
        # 지역
        if video.region:
            features['region'] = str(video.region).lower().strip()
        
        # 제목에서 키워드 추출 (한글, 영문, 숫자)
        if video.title:
            title_words = re.findall(r'[가-힣a-zA-Z0-9]+', str(video.title))
            features['title_keywords'] = [w.lower() for w in title_words if len(w) > 1]
        
        # 설명에서 키워드 추출 (간단한 키워드만)
        if video.description:
            desc_words = re.findall(r'[가-힣a-zA-Z0-9]+', str(video.description))
            # 길이 2 이상인 단어만 선택
            features['description_keywords'] = [w.lower() for w in desc_words if len(w) > 1]
        
        return features
    
    def _build_feature_vector(self, features: Dict) -> Dict[str, float]:
        """
        특징을 벡터로 변환 (TF-IDF 스타일)
        Returns:
            Dict with feature names as keys and weights as values
        """
        vector = {}
        
        # 태그 가중치 (높음)
        for tag in features['tags']:
            vector[f'tag_{tag}'] = 3.0
        
        # 키워드 가중치 (중간)
        for keyword in features['keywords']:
            vector[f'keyword_{keyword}'] = 2.0
        
        # 지역 가중치 (높음)
        if features['region']:
            vector[f'region_{features["region"]}'] = 2.5
        
        # 제목 키워드 가중치 (중간)
        for keyword in features['title_keywords']:
            if keyword not in ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with']:
                key = f'title_{keyword}'
                if key not in vector:
                    vector[key] = 1.5
        
        # 설명 키워드 가중치 (낮음, 중복 제거)
        desc_keywords = set(features['description_keywords'])
        for keyword in desc_keywords:
            if keyword not in ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with']:
                key = f'desc_{keyword}'
                if key not in vector:
                    vector[key] = 0.5
        
        return vector
    
    def _calculate_cosine_similarity(self, vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        """
        코사인 유사도 계산
        Args:
            vec1, vec2: Feature vectors
        Returns:
            Similarity score (0-1)
        """
        # 모든 키의 합집합
        all_keys = set(vec1.keys()) | set(vec2.keys())
        
        if not all_keys:
            return 0.0
        
        # 벡터 내적 계산
        dot_product = sum(vec1.get(key, 0) * vec2.get(key, 0) for key in all_keys)
        
        # 벡터 크기 계산
        magnitude1 = math.sqrt(sum(val ** 2 for val in vec1.values()))
        magnitude2 = math.sqrt(sum(val ** 2 for val in vec2.values()))
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        # 코사인 유사도
        similarity = dot_product / (magnitude1 * magnitude2)
        
        return similarity
    
    def _calculate_user_preference_vector(self, user_preferences: Dict) -> Dict[str, float]:
        """
        사용자 선호도를 벡터로 변환
        Args:
            user_preferences: {
                'preferred_tags': List[str],
                'preferred_keywords': List[str],
                'preferred_regions': List[str],
                'viewed_videos': List[str],  # 시청한 영상 ID 목록
                'bookmarked_videos': List[str]  # 북마크한 영상 ID 목록
            }
        Returns:
            User preference vector
        """
        vector = {}
        
        # 선호 태그
        for tag in user_preferences.get('preferred_tags', []):
            vector[f'tag_{tag.lower().strip()}'] = 3.0
        
        # 선호 키워드
        for keyword in user_preferences.get('preferred_keywords', []):
            vector[f'keyword_{keyword.lower().strip()}'] = 2.0
        
        # 선호 지역
        for region in user_preferences.get('preferred_regions', []):
            vector[f'region_{region.lower().strip()}'] = 2.5
        
        # 시청한 영상의 특징도 반영 (가중치 낮음)
        # 실제로는 시청한 영상의 특징을 분석해야 하지만, 여기서는 간단히 처리
        
        return vector
    
    def recommend(
        self,
        db: Session,
        user_preferences: Dict,
        viewed_video_ids: Optional[List[str]] = None,
        limit: int = 10,
        min_duration_sec: int = 240
    ) -> List[Video]:
        """
        사용자에게 맞춤 영상 추천
        Args:
            db: Database session
            user_preferences: 사용자 선호도 정보
            viewed_video_ids: 이미 시청한 영상 ID 목록 (제외할 영상)
            limit: 추천할 영상 개수
            min_duration_sec: 최소 영상 길이 (초)
        Returns:
            List of recommended videos sorted by similarity
        """
        # 1. 사용자 선호도 벡터 생성
        user_vector = self._calculate_user_preference_vector(user_preferences)
        
        if not user_vector:
            # 선호도 정보가 없으면 빈 리스트 반환
            return []
        
        # 2. 후보 영상 조회 (4분 이상, 시청하지 않은 영상)
        query = db.query(Video).filter(
            Video.duration_sec >= min_duration_sec
        )
        
        if viewed_video_ids:
            query = query.filter(~Video.id.in_(viewed_video_ids))
        
        candidate_videos = query.all()
        
        if not candidate_videos:
            return []
        
        # 3. 각 영상의 유사도 계산
        video_scores = []
        
        for video in candidate_videos:
            # 영상 특징 추출
            features = self._extract_features(video)
            video_vector = self._build_feature_vector(features)
            
            # 유사도 계산
            similarity = self._calculate_cosine_similarity(user_vector, video_vector)
            
            # 추가 점수: 조회수와 좋아요 수를 가중치로 추가 (선택적)
            popularity_score = 0.0
            if video.view_count:
                # 조회수를 로그 스케일로 변환 (0-1 범위)
                popularity_score = min(math.log10(video.view_count + 1) / 10, 0.1)
            
            # 최종 점수 = 유사도 * 0.9 + 인기도 * 0.1
            final_score = similarity * 0.9 + popularity_score * 0.1
            
            video_scores.append((video, final_score, similarity))
        
        # 4. 점수 기준으로 정렬 (내림차순)
        video_scores.sort(key=lambda x: x[1], reverse=True)
        
        # 5. 상위 N개 반환
        recommended = [video for video, score, similarity in video_scores[:limit]]
        
        return recommended
    
    def get_similar_videos(
        self,
        db: Session,
        video_id: str,
        limit: int = 10,
        min_duration_sec: int = 240
    ) -> List[Video]:
        """
        특정 영상과 유사한 영상 추천
        Args:
            db: Database session
            video_id: 기준 영상 ID
            limit: 추천할 영상 개수
            min_duration_sec: 최소 영상 길이 (초)
        Returns:
            List of similar videos
        """
        # 기준 영상 조회
        base_video = db.query(Video).filter(Video.id == video_id).first()
        
        if not base_video:
            return []
        
        # 기준 영상의 특징 추출
        base_features = self._extract_features(base_video)
        base_vector = self._build_feature_vector(base_features)
        
        # 후보 영상 조회 (자기 자신 제외)
        candidate_videos = db.query(Video).filter(
            Video.duration_sec >= min_duration_sec,
            Video.id != video_id
        ).all()
        
        if not candidate_videos:
            return []
        
        # 각 영상의 유사도 계산
        video_scores = []
        
        for video in candidate_videos:
            features = self._extract_features(video)
            video_vector = self._build_feature_vector(features)
            
            similarity = self._calculate_cosine_similarity(base_vector, video_vector)
            video_scores.append((video, similarity))
        
        # 유사도 기준으로 정렬
        video_scores.sort(key=lambda x: x[1], reverse=True)
        
        # 상위 N개 반환
        similar = [video for video, score in video_scores[:limit]]
        
        return similar

