import Hero from './components/Hero'
import WhyOmvra from './components/WhyOmvra'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import BestFor from './components/BestFor'
import PrivacyProof from './components/PrivacyProof'
import AgentPrompts from './components/AgentPrompts'
import Download from './components/Download'
import Faq from './components/Faq'
import Footer from './components/Footer'

function App() {
  return (
    <div className="landing-shell">
      <Hero />
      <WhyOmvra />
      <Features />
      <HowItWorks />
      <BestFor />
      <PrivacyProof />
      <AgentPrompts />
      <Download />
      <Faq />
      <Footer />
    </div>
  )
}

export default App
