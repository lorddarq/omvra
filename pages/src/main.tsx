import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/anatomy-kit/iso.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
