import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function DataChart() {
  // 임시 데이터 (실제로는 API에서 가져옴)
  const data = [
    { date: '11-01', videos: 120, comments: 5000 },
    { date: '11-02', videos: 145, comments: 6200 },
    { date: '11-03', videos: 135, comments: 5800 },
    { date: '11-04', videos: 158, comments: 7200 },
    { date: '11-05', videos: 142, comments: 6500 },
    { date: '11-06', videos: 168, comments: 8000 },
    { date: '11-07', videos: 175, comments: 8500 },
  ]

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">데이터 수집 추이</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            yAxisId="left"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px'
            }}
          />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="videos" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="비디오 수"
            dot={{ fill: '#3b82f6', r: 4 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="comments" 
            stroke="#10b981" 
            strokeWidth={2}
            name="댓글 수"
            dot={{ fill: '#10b981', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default DataChart

