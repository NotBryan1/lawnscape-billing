import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Renderer entry point: mounts the React app into the window loaded by
// src/main/index.js's createWindow().

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
