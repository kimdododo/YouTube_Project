import { format } from 'date-fns'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

function RecentRuns() {
  // 임시 데이터
  const runs = [
    {
      id: 1,
      runId: 'manual__2025-11-03T01:02:27',
      status: 'success',
      startTime: new Date('2025-11-03T01:02:27'),
      duration: '5분 23초',
      videos: 45,
      comments: 1234
    },
    {
      id: 2,
      runId: 'manual__2025-11-02T23:24:49',
      status: 'success',
      startTime: new Date('2025-11-02T23:24:49'),
      duration: '4분 12초',
      videos: 42,
      comments: 1156
    },
    {
      id: 3,
      runId: 'scheduled__2025-11-02T02:00:00',
      status: 'success',
      startTime: new Date('2025-11-02T02:00:00'),
      duration: '6분 01초',
      videos: 48,
      comments: 1423
    },
    {
      id: 4,
      runId: 'manual__2025-11-02T17:29:31',
      status: 'failed',
      startTime: new Date('2025-11-02T17:29:31'),
      duration: '2분 15초',
      videos: 0,
      comments: 0
    }
  ]

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">최근 실행 내역</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">상태</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">실행 ID</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">시작 시간</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">소요 시간</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">비디오</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">댓글</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(run.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                      {run.status === 'success' ? '성공' : run.status === 'failed' ? '실패' : '대기'}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 font-mono">
                  {run.runId.length > 30 ? `${run.runId.substring(0, 30)}...` : run.runId}
                </td>
                <td className="py-3 px-4 text-sm text-gray-700">
                  {format(run.startTime, 'yyyy-MM-dd HH:mm:ss')}
                </td>
                <td className="py-3 px-4 text-sm text-gray-700">{run.duration}</td>
                <td className="py-3 px-4 text-sm text-gray-700">{run.videos.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-700">{run.comments.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecentRuns

