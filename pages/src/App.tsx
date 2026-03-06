import Hero from './components/Hero'
import Features from './components/Features'
import BestFor from './components/BestFor'
import Download from './components/Download'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-nordic-bg text-nordic-gray-800">
      <Hero />
      <Features />
      <BestFor />
      <Download />
      <Footer />
    </div>
  )
}

export default App
