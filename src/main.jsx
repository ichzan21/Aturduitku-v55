import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { ErrorBoundary } from './App.jsx'
import { reportClientError } from './monitoring.js'

window.addEventListener('error', event => {
  reportClientError(event.error || event.message, { type:'window_error' })
})

window.addEventListener('unhandledrejection', event => {
  reportClientError(event.reason, { type:'unhandled_rejection' })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
