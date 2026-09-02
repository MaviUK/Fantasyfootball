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
globalThis.auctions = globalThis.auctions || []

const formationLimits = {
  '4-4-2': { CD: 4, MD: 4, ATT: 2 },
  '4-3-3': { CD: 4, MD: 3, ATT: 3 },
  '3-5-2': { CD: 3, MD: 5, ATT: 2 },
  '4-2-3-1': { CD: 4, MD: 5, ATT: 1 },
  '5-3-2': { CD: 5, MD: 3, ATT: 2 },
}

// Formation-aware hotfix for a full XI. If the manager changes formation and
// then starts a player in an under-filled line, automatically remove one player
// from a line that is over the new formation limit before allowing the Start
// action through. This keeps 11 starters while reshaping the XI.
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.lineup-actions button:first-child')
  if (!button) return

  const lineupPage = button.closest('.lineup-page')
  if (!lineupPage) return

  const formation = lineupPage.querySelector('.formation-select select')?.value
  const limits = formationLimits[formation]
  if (!limits) return

  const targetPosition = button.closest('.lineup-player')?.querySelector('.avatar')?.textContent?.trim()
  if (!['CD', 'MD', 'ATT'].includes(targetPosition)) return

  const starterColumn = lineupPage.querySelector('.lineup-column')
  const starterRows = [...(starterColumn?.querySelectorAll('.lineup-player') || [])]
  const counts = { CD: 0, MD: 0, ATT: 0 }

  starterRows.forEach((row) => {
    const pos = row.querySelector('.avatar')?.textContent?.trim()
    if (counts[pos] !== undefined) counts[pos] += 1
  })

  if (starterRows.length < 11 || counts[targetPosition] >= limits[targetPosition]) return

  const surplusPosition = ['CD', 'MD', 'ATT'].find((pos) => counts[pos] > limits[pos])
  if (!surplusPosition) return

  const surplusRow = [...starterRows].reverse().find(
    (row) => row.querySelector('.avatar')?.textContent?.trim() === surplusPosition,
  )
  const removeButton = surplusRow?.querySelector('.lineup-remove')
  if (!removeButton) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  removeButton.click()
  setTimeout(() => button.click(), 0)
}, true)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
