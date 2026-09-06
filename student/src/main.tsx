import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui', background: '#f8fafc' }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</h1>
            <p style={{ color: '#64748b', margin: '8px 0 16px' }}>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => {
                try { localStorage.clear(); sessionStorage.clear(); } catch {}
                window.location.href = '/';
              }}
              style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: 12, padding: '10px 16px', fontWeight: 600 }}
            >
              Clear data & reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Root element missing.</p>';
} else {
  try {
    const ver = localStorage.getItem('ts_app_ver');
    if (ver !== '5.2.0') {
      localStorage.removeItem('quizbot_webapp_cache_v1');
      localStorage.setItem('ts_app_ver', '5.2.0');
    }
  } catch {}
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
}
