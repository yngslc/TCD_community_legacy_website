import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.error('TCD Error:', err.message) }
  render() {
    if (this.state.hasError) return (
      <div style={{background:'#030208',color:'#8090b0',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'IBM Plex Mono,monospace',fontSize:'13px',letterSpacing:'0.04em'}}>
        Something went wrong. Please refresh the page.
      </div>
    )
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>,
)
