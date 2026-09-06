import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[TestSpace] render error', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#f8fafc',
            color: '#0f172a',
          }}
        >
          <div style={{ maxWidth: 420, width: '100%' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              {this.state.error.message || 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                } catch {}
                window.location.reload();
              }}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 0,
                borderRadius: 12,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
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
  document.body.innerHTML =
    '<p style="padding:24px;font-family:system-ui">Root element missing. Please reload.</p>';
} else {
  // Drop broken legacy keys that can leave the app in a stuck state
  try {
    const ver = localStorage.getItem('ts_app_ver');
    if (ver !== '5.1.2') {
      localStorage.removeItem('ts_student_token');
      localStorage.removeItem('quizbot_webapp_cache_v1');
      localStorage.removeItem('quizbot_attempt_sync_queue_v1');
      localStorage.setItem('ts_app_ver', '5.1.2');
    }
  } catch {
    /* ignore */
  }

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
