import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/abeezee/400.css'
import '@fontsource/cutive-mono/400.css'
import '@fontsource/source-serif-pro/400.css'
import '@fontsource/source-serif-pro/600.css'
import '@fontsource/source-serif-pro/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
