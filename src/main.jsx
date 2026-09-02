import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { supabase } from './lib/supabase.js'
import './live-match.js'
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
import './fm-theme.css'
import './sky-theme.css'
import './club-badge.css'
import './season-home.css'

globalThis.auctions = globalThis.auctions || []

const formationLimits = {
  '4-4-2': { CD: 4, MD: 4, ATT: 2 },
  '4-3-3': { CD: 4, MD: 3, ATT: 3 },
  '3-5-2': { CD: 3, MD: 5, ATT: 2 },
  '4-2-3-1': { CD: 4, MD: 5, ATT: 1 },
  '5-3-2': { CD: 5, MD: 3, ATT: 2 },
}

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
  const surplusRow = [...starterRows].reverse().find((row) => row.querySelector('.avatar')?.textContent?.trim() === surplusPosition)
  const removeButton = surplusRow?.querySelector('.lineup-remove')
  if (!removeButton) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  removeButton.click()
  setTimeout(() => button.click(), 0)
}, true)

async function installClubBadgeControl() {
  const topbar = document.querySelector('.topbar')
  if (!topbar || topbar.querySelector('.club-badge-control')) return
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData?.session?.user
  if (!user) return
  const { data: state } = await supabase.rpc('get_my_game_state')
  if (!state?.club) return

  const identity = topbar.firstElementChild
  if (!identity) return
  identity.classList.add('club-identity')
  const badge = document.createElement('div')
  badge.className = 'club-badge-control'
  badge.innerHTML = '<button type="button" class="club-badge-button" aria-label="Upload club badge" title="Upload club badge"><span class="club-badge-placeholder">+</span><img alt="Club badge" hidden></button><input type="file" accept="image/png,image/jpeg,image/webp" hidden><small>Club badge</small>'
  identity.prepend(badge)
  const img = badge.querySelector('img')
  const placeholder = badge.querySelector('.club-badge-placeholder')
  const input = badge.querySelector('input')
  const button = badge.querySelector('button')

  const showBadge = (path) => {
    if (!path) return
    const { data } = supabase.storage.from('club-badges').getPublicUrl(path)
    if (!data?.publicUrl) return
    img.src = `${data.publicUrl}?v=${Date.now()}`
    img.hidden = false
    placeholder.hidden = true
  }
  showBadge(state.club.badge_path)
  button.addEventListener('click', () => input.click())
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return window.alert('Club badge must be 2 MB or smaller.')
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) return window.alert('Please use a PNG, JPG or WebP image.')
    button.disabled = true
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${user.id}/badge.${ext}`
    const { error: uploadError } = await supabase.storage.from('club-badges').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      button.disabled = false
      return window.alert(uploadError.message)
    }
    const { error: saveError } = await supabase.rpc('set_my_club_badge', { p_badge_path: path })
    button.disabled = false
    if (saveError) return window.alert(saveError.message)
    showBadge(path)
  })
}

const badgeObserver = new MutationObserver(() => installClubBadgeControl())
badgeObserver.observe(document.documentElement, { childList: true, subtree: true })

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
