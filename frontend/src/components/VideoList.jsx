import { useState, useEffect } from 'react';
import apiClient from '../api/client';

/**
 * VideoList 컴포넌트
 * 비디오 목록을 조회하고 표시합니다.
 */
function VideoList() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/videos', {
        params: {
          skip: 0,
          limit: 10,
        },
      });
      
      setVideos(response.data.videos);
      setTotal(response.data.total);
    } catch (err) {
      setError(err.message || '비디오 목록을 불러오는데 실패했습니다.');
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-red-600 text-lg mb-4">에러 발생</div>
        <div className="text-gray-600">{error}</div>
        <button
          onClick={fetchVideos}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">비디오 목록</h1>
      <div className="mb-4 text-gray-600">총 {total}개의 비디오</div>
      
      {videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          비디오가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <h2 className="font-semibold text-lg mb-2 line-clamp-2">
                {video.title}
              </h2>
              <div className="text-sm text-gray-600 mb-2">
                <div>채널 ID: {video.channel_id || 'N/A'}</div>
                {video.view_count !== null && (
                  <div>조회수: {video.view_count.toLocaleString()}</div>
                )}
                {video.published_at && (
                  <div>
                    게시일: {new Date(video.published_at).toLocaleDateString('ko-KR')}
                  </div>
                )}
              </div>
              {video.description && (
                <p className="text-sm text-gray-500 line-clamp-3 mt-2">
                  {video.description}
                </p>
              )}
              <div className="mt-2 text-xs text-gray-400">
                Video ID: {video.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoList;

