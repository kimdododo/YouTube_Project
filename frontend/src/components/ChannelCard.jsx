import { Search, Sparkles } from 'lucide-react'

function ChannelCard({ channels }) {
  return (
    <div className="bg-blue-900/50 backdrop-blur-sm rounded-lg p-8 border border-blue-800/50 h-fit">
      <div className="flex items-center mb-6">
        <Search className="w-5 h-5 text-blue-300 mr-2" />
        <h3 className="text-xl font-bold text-white">
          채널 찾기 (AI 한줄평)
        </h3>
      </div>
      <p className="text-blue-200 text-sm mb-8">
        AI가 분석한 채널 특징과 추천 포인트를 확인하세요.
      </p>

      <div className="space-y-5">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="bg-blue-950/50 rounded-lg p-5 border border-blue-800/30 hover:border-blue-700/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold mb-2 group-hover:text-blue-300 transition-colors">
                  {channel.name}
                </h4>
                <p className="text-blue-200/80 text-xs leading-relaxed">
                  {channel.summary}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors text-sm font-medium">
        더 많은 채널 보기
      </button>
    </div>
  )
}

export default ChannelCard

