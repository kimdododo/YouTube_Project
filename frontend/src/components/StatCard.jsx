import { Loader2 } from 'lucide-react'

function StatCard({ icon, title, value, change, changeType, loading }) {
  const changeColor = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          {loading ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-2xl font-bold text-gray-400">...</span>
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          changeType === 'positive' ? 'bg-green-100 text-green-600' :
          changeType === 'negative' ? 'bg-red-100 text-red-600' :
          'bg-gray-100 text-gray-600'
        }`}>
          {icon}
        </div>
      </div>
      {change && !loading && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            changeColor[changeType]
          }`}>
            {changeType === 'positive' && '↑'} {change}
          </span>
        </div>
      )}
    </div>
  )
}

export default StatCard

