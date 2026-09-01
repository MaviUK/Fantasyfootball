import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './auction-room.css'
import './dashboard.css'
import './squad.css'
import './lineup.css'
import './saved-lineup.css'
import './formation.css'
import './pitch.css'
import './lineup-order.css'
import './fixtures.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
