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
import './league-table.css'
import './match-centre.css'
import './tactics.css'
import './player-profile.css'
import './squad-owned.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
