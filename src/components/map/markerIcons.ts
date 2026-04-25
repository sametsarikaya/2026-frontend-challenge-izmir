import L from 'leaflet'

const MARKER_SIZE = 28
const ANCHOR = MARKER_SIZE / 2

function createSvgIcon(fill: string, strokeColor: string, pulse = false): string {
  const pulseRing = pulse
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${fill}" stroke-width="2" opacity="0.4">
        <animate attributeName="r" from="13" to="22" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.4" to="0" dur="1.4s" repeatCount="indefinite"/>
       </circle>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_SIZE}" height="${MARKER_SIZE}" viewBox="0 0 ${MARKER_SIZE} ${MARKER_SIZE}">
    ${pulseRing}
    <circle cx="14" cy="14" r="10" fill="${fill}" stroke="${strokeColor}" stroke-width="2.5"/>
    <circle cx="14" cy="14" r="3.5" fill="${strokeColor}" opacity="0.85"/>
  </svg>`
}

function createNumberedSvgIcon(fill: string, strokeColor: string, num: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="13" fill="${fill}" stroke="${strokeColor}" stroke-width="2.5"/>
    <text x="16" y="21" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="12" font-weight="600" fill="${strokeColor}">${num}</text>
  </svg>`
}

export const defaultIcon = L.divIcon({
  html: createSvgIcon('oklch(95% 0.014 78)', 'oklch(42% 0.014 50)'),
  className: 'case-marker',
  iconSize: [MARKER_SIZE, MARKER_SIZE],
  iconAnchor: [ANCHOR, ANCHOR],
  popupAnchor: [0, -ANCHOR],
})

export const selectedIcon = L.divIcon({
  html: createSvgIcon('oklch(46% 0.165 28)', 'oklch(97.5% 0.011 80)', true),
  className: 'case-marker case-marker--selected',
  iconSize: [MARKER_SIZE, MARKER_SIZE],
  iconAnchor: [ANCHOR, ANCHOR],
  popupAnchor: [0, -ANCHOR],
})

export function numberedIcon(num: number, active = false): L.DivIcon {
  const fill = active ? 'oklch(46% 0.165 28)' : 'oklch(95% 0.014 78)'
  const stroke = active ? 'oklch(97.5% 0.011 80)' : 'oklch(42% 0.014 50)'
  return L.divIcon({
    html: createNumberedSvgIcon(fill, stroke, num),
    className: 'case-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}
