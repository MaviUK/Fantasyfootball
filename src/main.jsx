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
import './auction-stages.css'
import './auction-list.css'

// Compatibility guard for the lineup planner's legacy dependency reference.
// App.jsx currently reads `auctions` in a lineup-only effect even though that
// component receives `players`. Keeping a stable global binding prevents the
// lineup route from crashing while its player-driven effects continue to load
// and save the current squad selection normally.
globalThis.auctions = globalThis.auctions || []

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
