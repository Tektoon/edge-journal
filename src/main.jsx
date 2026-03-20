import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Enregistrement du Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW enregistré ✅'))
      .catch((err) => console.log('SW erreur:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
