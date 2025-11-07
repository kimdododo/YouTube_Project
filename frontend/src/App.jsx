import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import RecommendedVideos from './components/RecommendedVideos'
import TravelTrends from './components/TravelTrends'
import Login from './components/Login'
import Signup from './components/Signup'
import TravelPreference from './components/TravelPreference'
import RecommendChannels from './components/RecommendChannels'
import SignupComplete from './components/SignupComplete'
import FindChannel from './components/FindChannel'
import MyPage from './components/MyPage'
import VideoList from './components/VideoList'
import './App.css'

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/recommendedVideos" element={<RecommendedVideos />} />
        <Route path="/travel-trends" element={<TravelTrends />} />
        {/* Travel Plan route removed */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/travel-preference" element={<TravelPreference />} />
        <Route path="/recommend-channels" element={<RecommendChannels />} />
        <Route path="/signup-complete" element={<SignupComplete />} />
        <Route path="/find-channel" element={<FindChannel />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/api-test" element={<VideoList />} />
      </Routes>
    </Router>
  )
}

export default App

