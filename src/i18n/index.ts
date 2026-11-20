import { computed, ref } from 'vue'
import type { Belt, Group } from '../scene/types'

export type Locale = 'zh' | 'en'
export type ArchiveTab = '全部' | Group | '探测器实拍'

const STORAGE_KEY = 'star-scope-lang'

function detectInitialLocale(): Locale {
  try {
    const param = new URLSearchParams(window.location.search).get('lang')?.toLowerCase()
    if (param === 'en' || param?.startsWith('en-')) return 'en'
    if (param === 'zh' || param?.startsWith('zh-')) return 'zh'
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch {
    // Ignore storage/URL errors in restricted contexts
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? '' : ''
  return nav.startsWith('en') ? 'en' : 'zh'
}

export const locale = ref<Locale>(detectInitialLocale())
export const isEn = computed(() => locale.value === 'en')

export function syncDocumentMeta(lang: Locale = locale.value) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  document.title = lang === 'en' ? 'Star Scope · 3D Solar System Atlas' : '太阳系漫游 · 3D 轨道图鉴'
}

syncDocumentMeta(locale.value)

export function setLocale(next: Locale) {
  if (locale.value === next) return
  locale.value = next
  syncDocumentMeta(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Ignore storage errors
  }
}

export function toggleLocale() {
  setLocale(locale.value === 'en' ? 'zh' : 'en')
}

export function pick<T>(zh: T, en: T, lang: Locale = locale.value): T {
  return lang === 'en' ? en : zh
}

export function formatNum(n: number, lang: Locale = locale.value): string {
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN')
}

export function groupLabel(group: Group, lang: Locale = locale.value): string {
  if (lang === 'zh') return group
  switch (group) {
    case '太阳系':
      return 'Solar System'
    case '河外星系':
      return 'Galaxies'
    case '恒星':
      return 'Stars'
    case '系外行星':
      return 'Exoplanets'
  }
}

export function tabLabel(tab: ArchiveTab, lang: Locale = locale.value): string {
  if (lang === 'zh') return tab
  if (tab === '全部') return 'All'
  if (tab === '探测器实拍') return 'Spacecraft Photos'
  return groupLabel(tab, lang)
}

export function regionLabel(region: Belt, lang: Locale = locale.value): string {
  const map: Record<Belt, [string, string]> = {
    main: ['主小行星带', 'Main Asteroid Belt'],
    trojan: ['木星特洛伊群', 'Jupiter Trojans'],
    centaur: ['半人马小天体带', 'Centaur Belt'],
    outer: ['柯伊伯带', 'Kuiper Belt'],
    scattered: ['离散盘与内奥尔特云', 'Scattered Disc & Inner Oort'],
  }
  return pick(map[region][0], map[region][1], lang)
}

export function regionDrawerTitle(region: Belt, lang: Locale = locale.value): string {
  const map: Record<Belt, [string, string]> = {
    main: ['主小行星带天体', 'Main Belt Bodies'],
    trojan: ['木星特洛伊群天体', 'Jupiter Trojan Bodies'],
    centaur: ['半人马小天体带', 'Centaur Bodies'],
    outer: ['柯伊伯带天体', 'Kuiper Belt Objects'],
    scattered: ['离散盘与极远天体', 'Scattered & Extreme Bodies'],
  }
  return pick(map[region][0], map[region][1], lang)
}

export function regionFullLabel(region: Belt, lang: Locale = locale.value): string {
  const map: Record<Belt, [string, string]> = {
    main: ['主小行星带（火星–木星之间）', 'Main Asteroid Belt (Mars–Jupiter)'],
    trojan: ['木星特洛伊群（L4/L5 共轨区）', 'Jupiter Trojans (L4/L5 Co-orbital)'],
    centaur: ['半人马小天体带（巨行星之间）', 'Centaur Belt (Between Giant Planets)'],
    outer: ['柯伊伯带（海王星外 30–50 AU）', 'Kuiper Belt (30–50 AU beyond Neptune)'],
    scattered: ['离散盘与内奥尔特云（50–1000 AU）', 'Scattered Disc & Inner Oort (50–1000 AU)'],
  }
  return pick(map[region][0], map[region][1], lang)
}
