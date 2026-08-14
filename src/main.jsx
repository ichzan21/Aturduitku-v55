import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { ErrorBoundary } from './App.jsx'
import { reportClientError } from './monitoring.js'
import { classifyRuntimeFailure, scheduleModuleLoadRecovery } from './runtimeRecovery.js'

const STORAGE_RECOVERY_KEY = 'aturduitku_storage_recovery_at'
let storageRecoveryScheduled = false

function scheduleStorageRecovery() {
  if (storageRecoveryScheduled) return
  let previousRecovery = 0
  try {
    previousRecovery = Number(sessionStorage.getItem(STORAGE_RECOVERY_KEY) || 0)
    if (Date.now() - previousRecovery < 5 * 60 * 1000) {
      storageRecoveryScheduled = true
      return
    }
    sessionStorage.setItem(STORAGE_RECOVERY_KEY, String(Date.now()))
  } catch {}
  storageRecoveryScheduled = true

  const reload = () => window.setTimeout(() => window.location.reload(), 1200)
  if (document.visibilityState === 'visible') {
    reload()
  } else {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reload()
    }, { once:true })
  }
}

function handleRuntimeFailure(reason, type, event) {
  const classification = classifyRuntimeFailure(reason)
  if (classification.kind === 'ignored') {
    event?.preventDefault?.()
    return
  }
  if (classification.kind === 'storage_disconnect') {
    event?.preventDefault?.()
    reportClientError(reason, {
      type:'storage_connection_lost',
      component:'firebase_auth_persistence',
    })
    scheduleStorageRecovery()
    return
  }
  if (classification.kind === 'module_load') {
    event?.preventDefault?.()
    reportClientError(reason, { type:'asset_load_recovery', component:'runtime_asset_loader' })
    scheduleModuleLoadRecovery()
    return
  }
  if (classification.kind === 'request_failure') {
    event?.preventDefault?.()
    if (!reason?.monitoringReported) {
      reportClientError(reason, {
        type:classification.code === 'API_TIMEOUT' ? 'api_timeout' : 'api_network_error',
        component:'runtime_request_guard',
        route:reason?.route || window.location.pathname,
        durationMs:reason?.durationMs,
      })
    }
    return
  }
  reportClientError(reason, { type })
}

window.addEventListener('error', event => {
  handleRuntimeFailure(event.error || event.message, 'window_error', event)
})

window.addEventListener('unhandledrejection', event => {
  handleRuntimeFailure(event.reason, 'unhandled_rejection', event)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

document.documentElement.dataset.appReady = '1'
