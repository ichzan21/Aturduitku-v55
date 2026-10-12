import React from 'react';
import { reportClientError } from './monitoring.js';
import { classifyRuntimeFailure, scheduleModuleLoadRecovery } from './runtimeRecovery.js';

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err, info) {
    console.error('AturDuitku Error:', err, info);
    const runtimeFailure = classifyRuntimeFailure(err);
    const type = runtimeFailure.kind === 'module_load' ? 'asset_load_recovery' : 'react_boundary';
    reportClientError(err, { type, component:info?.componentStack }).catch(() => {});
    if (runtimeFailure.kind === 'module_load') scheduleModuleLoadRecovery();
  }
  render() {
    if (this.state.hasError) return (
      <main className="app-boot" data-testid="app-runtime-unavailable">
        <img className="app-boot-logo" src="/icon-192.png" alt="" width="84" height="84" />
        <h1>AturDuitku belum dapat dibuka</h1>
        <p role="alert">Halaman belum berhasil dimuat. Coba muat ulang.</p>
        <button type="button" onClick={() => window.location.reload()}>Muat ulang</button>
        {this.state.error && <details className="app-boot-details">
          <summary>Detail error</summary>
          <pre>{String(this.state.error)}</pre>
        </details>}
      </main>
    );
    return this.props.children;
  }
}
