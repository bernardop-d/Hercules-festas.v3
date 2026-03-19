import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { SolicitarPage } from './components/SolicitarPage'

const isPublic = window.location.pathname.startsWith('/solicitar')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublic ? <SolicitarPage /> : <App />}
  </StrictMode>,
)
