import type { Label } from './types'
export function createLabels(tags: HTMLElement) {
  function tag(text: string, cls = '') {
    const el = document.createElement('span')
    el.className = 'tag ' + cls
    el.textContent = text
    tags.append(el)
    return el
  }
  const shownLabels = new Set<HTMLElement>()
  const measure = document.createElement('canvas').getContext('2d')!
  const labelMetrics = new Map<string, { width: number; hitWidth: number }>()
  function placeLabels(markers: Label[], width: number, height: number) {
    const used: { x: number; y: number; w: number }[] = [],
      visible = new Set<HTMLElement>()
    for (const { el, q, r, left } of markers) {
      if (r > width * 0.55) continue
      const key = (width < 530 ? 's:' : 'l:') + el.textContent
      if (!labelMetrics.has(key)) {
        const style = getComputedStyle(el)
        measure.font = style.fontSize + ' ' + style.fontFamily
        const width = Math.ceil(
          measure.measureText(el.textContent || '').width + (el.textContent || '').length * 0.5 + 3,
        )
        labelMetrics.set(key, { width, hitWidth: el.offsetWidth })
      }
      const { width: len, hitWidth } = labelMetrics.get(key)!
      const x = left ? q.x - r - 7 - len : q.x + r + 7,
        y = q.y - 8
      if (x < 3 || x + len > width - 3 || y < 3 || y > height - 19) continue
      // Avoid drifting underneath the fixed top-left HUD brand card or top-right toolbar
      if (width > 680 && x < 360 && y < 116) continue
      if (width > 680 && x + len > width - 390 && y < 60) continue
      // A label keeps its anchor. Yield space to the higher-priority label
      // and require extra clearance before fading back in.
      const gap = shownLabels.has(el) ? 2 : 8
      if (
        used.some((b) => Math.abs(y - b.y) < 16 + gap && x < b.x + b.w + gap && x + len + gap > b.x)
      )
        continue
      used.push({ x, y, w: len })
      visible.add(el)
      placeText(el, x, y, hitWidth)
      if (!shownLabels.has(el)) el.classList.add('visible')
    }
    for (const el of shownLabels) if (!visible.has(el)) el.classList.remove('visible')
    shownLabels.clear()
    for (const el of visible) shownLabels.add(el)
  }
  const textPositions = new WeakMap<HTMLElement, { x: number; y: number; width: number }>()
  function placeText(el: HTMLElement, rawX: number, rawY: number, width = 0) {
    const precision = 4 * (window.devicePixelRatio || 1)
    const x = Math.round(rawX * precision) / precision
    const y = Math.round(rawY * precision) / precision
    const prev = textPositions.get(el)
    if (prev?.x === x && prev.y === y && prev.width === width) return
    textPositions.set(el, { x, y, width })
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  return { tag, placeLabels, placeText, shownLabels, textPositions }
}
