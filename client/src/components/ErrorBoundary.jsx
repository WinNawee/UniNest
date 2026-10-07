import { Component } from 'react'

// Shows the error on screen instead of a blank white page.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-lg bg-white rounded-2xl border border-black/5 shadow-sm p-6">
          <h1 className="text-xl font-bold text-nest mb-2">Something went wrong</h1>
          <p className="mb-3">Please copy the message below and send it to the team.</p>
          <pre className="text-xs bg-cream rounded-xl p-3 whitespace-pre-wrap break-words">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button onClick={() => location.reload()} className="mt-4 px-4 py-2 rounded-xl bg-nest text-white font-semibold">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
