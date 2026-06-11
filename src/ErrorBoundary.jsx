import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0d0d0d', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
          gap: '12px', padding: '24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '2rem' }}>⚠️</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Something went wrong</p>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 400 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
            }}>
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
