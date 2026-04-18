import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.onerror = function(msg, src, line, col, err) {
  document.getElementById('root').innerHTML = `
    <div style="padding:40px;font-family:monospace;background:#1a1a1a;color:#ff6b6b;min-height:100vh">
      <h2>Runtime Error</h2>
      <p><b>Message:</b> ${msg}</p>
      <p><b>Source:</b> ${src}</p>
      <p><b>Line:</b> ${line}, Col: ${col}</p>
      <pre style="background:#000;padding:20px;overflow:auto;color:#ffa;font-size:12px">${err?.stack || 'no stack'}</pre>
    </div>
  `;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
