import { CheckCircle, XCircle, Clock, Loader2, Play } from 'lucide-react'
import { format } from 'date-fns'

function PipelineStatus({ status }) {
  const statusConfig = {
    running: {
      icon: <Loader2 className="w-5 h-5 animate-spin text-blue-600" />,
      label: '실행 중',
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      bgColor: 'bg-blue-100'
    },
    success: {
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      label: '성공',
      color: 'bg-green-50 border-green-200 text-green-800',
      bgColor: 'bg-green-100'
    },
    failed: {
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      label: '실패',
      color: 'bg-red-50 border-red-200 text-red-800',
      bgColor: 'bg-red-100'
    },
    idle: {
      icon: <Clock className="w-5 h-5 text-gray-600" />,
      label: '대기 중',
      color: 'bg-gray-50 border-gray-200 text-gray-800',
      bgColor: 'bg-gray-100'
    }
  }

  const config = statusConfig[status] || statusConfig.idle
  const tasks = [
    { id: 'collect_videos', name: '비디오 수집', status: 'success' },
    { id: 'collect_comments', name: '댓글 수집', status: 'success' },
    { id: 'load_to_mysql', name: 'MySQL 적재', status: status },
    { id: 'load_to_bigquery', name: 'BigQuery 적재', status: status }
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">파이프라인 상태</h3>
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${config.color}`}>
          {config.icon}
          <span className="text-sm font-medium">{config.label}</span>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.map((task, index) => (
          <div key={task.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                task.status === 'success' ? 'bg-green-100' :
                task.status === 'running' ? 'bg-blue-100' :
                task.status === 'failed' ? 'bg-red-100' :
                'bg-gray-100'
              }`}>
                {task.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : task.status === 'running' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : task.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">{task.name}</span>
            </div>
            {task.status === 'success' && (
              <span className="text-xs text-gray-500">
                {format(new Date(), 'HH:mm')}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">다음 실행 예정</span>
          <span className="font-medium text-gray-900">
            {format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd 02:00')}
          </span>
        </div>
      </div>
    </div>
  )
}

export default PipelineStatus

