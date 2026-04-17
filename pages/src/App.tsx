import Hero from './components/Hero'
import WhyPlumy from './components/WhyPlumy'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import BestFor from './components/BestFor'
import PrivacyProof from './components/PrivacyProof'
import AgentPrompts from './components/AgentPrompts'
import Download from './components/Download'
import Footer from './components/Footer'

function App() {
  return (
    <div className="landing-shell">
      <Hero />
      <WhyPlumy />
      <Features />
      <HowItWorks />
      <BestFor />
      <PrivacyProof />
      <AgentPrompts />
      <Download />
      <Footer />
    </div>
  )
}

export default App
