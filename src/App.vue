<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  ref,
  watch,
} from 'vue'
import NavigationDock from './components/NavigationDock.vue'
import BodyDrawer from './components/BodyDrawer.vue'
import ArchiveDialog from './components/ArchiveDialog.vue'
import GuideDialog from './components/GuideDialog.vue'
import SurfaceHud from './components/SurfaceHud.vue'
import VoyagerHud from './components/VoyagerHud.vue'
import PhenomenaHud from './components/PhenomenaHud.vue'
import { createAtlas, type Atlas } from './scene/atlas'
import { createSceneUI } from './scene/ui'
import { formatLightTime } from './data/voyager'
import { getPhenomenon } from './data/phenomena'
import {
  formatNum,
  groupLabel,
  isEn,
  locale,
  pick,
  toggleLocale,
} from './i18n'
import { worldKind } from './i18n/catalogEn'
import { localizedEntry } from './i18n/archiveLocale'
import { trappistCatalog, trappistEntryId, trappistPlanets, trappistSecondsPerDay } from './data/trappist'

const ui = createSceneUI(),
  atlas = shallowRef<Atlas | null>(null)
const canvas = useTemplateRef('canvas'),
  stage = useTemplateRef('stage'),
  tags = useTemplateRef('tags'),
  pins = useTemplateRef('pins')
const archive = useTemplateRef('archive'),
  guide = useTemplateRef('guide')
const notice = ref(''),
  isFullscreen = ref(false),
  canFullscreen = !!document.documentElement.requestFullscreen
let noticeTimer: number | undefined

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

watch(locale, (lang) => {
  atlas.value?.setLocale(lang)
})

onMounted(() => {
  atlas.value = createAtlas(
    { canvas: canvas.value!, stage: stage.value!, tags: tags.value!, pins: pins.value! },
    ui,
  )
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  atlas.value?.dispose()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.clearTimeout(noticeTimer)
})

async function returnToOrbit() {
  atlas.value?.takeOff()
  await nextTick()
  canvas.value?.focus({ preventScroll: true })
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    notice.value = pick(
      '当前窗口无法进入全屏。',
      'Fullscreen is unavailable in this window.',
    )
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => (notice.value = ''), 2200)
  }
}

const note = computed(() => ui.notes[ui.noteIndex])
const inTrappist = computed(() => ui.deepEntry?.id === trappistEntryId)
const trappistPlanet = computed(() => trappistPlanets.find((p) => p.key === ui.preset))
function switchScale(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'voyager') atlas.value?.openVoyager()
  else if (value === 'phenomena') atlas.value?.openPhenomena()
  else if (value === 'trappist') atlas.value?.openTrappistSystem()
  else if (value === 'galaxy') atlas.value?.openGalaxy()
  else atlas.value?.openPlanet(null)
}
const currentSolarEntry = computed(() => {
  const a = atlas.value
  if (!a || ui.galaxy || ui.voyager || ui.phenomena || ui.deepEntry || ui.region) return null
  if (ui.comet) return a.entries.find(e => e.comet === ui.comet) ?? null
  if (!ui.planet) return null
  const id = ui.moon ? `${ui.planet.id}-${ui.moon.name}` : ui.planet.id
  return a.entries.find((e) => e.id === id) ?? null
})
const noteEntry = computed(() => inTrappist.value ? null : ui.deepEntry ?? currentSolarEntry.value)
const noteEntryView = computed(() => (noteEntry.value ? localizedEntry(noteEntry.value) : null))
const deepEntryView = computed(() => (ui.deepEntry ? localizedEntry(ui.deepEntry) : null))
const observationTitle = computed(() => inTrappist.value ? ui.title : deepEntryView.value?.title ?? ui.title)
const observationCode = computed(() => {
  if (!inTrappist.value) return ui.deepEntry?.code
  if (trappistPlanet.value) return pick('行星特写', 'Planet View')
  return ui.preset === 'host' ? pick('母恒星', 'Host Star') : pick('七行星全景', 'Seven-Planet View')
})

const sourceName = computed(() => {
  const url = note.value?.source ?? ''
  if (isEn.value) {
    return url.includes('nasa.gov')
      ? 'NASA Data'
      : url.includes('eso.org')
        ? 'ESO Data'
        : url.includes('harvard.edu')
          ? 'IAU Circular'
          : 'Orbital Study'
  }
  return url.includes('nasa.gov')
    ? 'NASA 资料'
    : url.includes('eso.org')
      ? 'ESO 资料'
      : url.includes('harvard.edu')
        ? 'IAU 通报'
        : '轨道研究'
})

const regionMeta = computed<Record<string, { mode: string; code: string; telemetry: string }>>(
  () =>
    isEn.value
      ? {
          main: {
            mode: 'Main Asteroid Belt',
            code: 'MAIN BELT',
            telemetry: 'Mars–Jupiter · incl. Hilda 2.1–4.0 AU',
          },
          trojan: {
            mode: 'Jupiter Trojans',
            code: 'JUPITER TROJANS',
            telemetry: 'L4/L5 Co-orbital Clouds · 5.2 AU',
          },
          centaur: {
            mode: 'Centaur Belt',
            code: 'CENTAUR BELT',
            telemetry: 'Between Giant Planets · 5.5–30 AU',
          },
          outer: {
            mode: 'Kuiper Belt',
            code: 'KUIPER BELT',
            telemetry: 'Trans-Neptunian Ice Disk · 30–50 AU',
          },
          scattered: {
            mode: 'Scattered Disc & Inner Oort',
            code: 'SCATTERED & OORT',
            telemetry: 'Extreme Detached Zone · 50–1000 AU',
          },
        }
      : {
          main: {
            mode: '主小行星带',
            code: 'MAIN BELT',
            telemetry: '火星至木星间 · 含希尔达族 2.1–4.0 AU',
          },
          trojan: {
            mode: '木星特洛伊群',
            code: 'JUPITER TROJANS',
            telemetry: '木星轨道 L4/L5 共轨云 · 5.2 AU',
          },
          centaur: {
            mode: '半人马小天体带',
            code: 'CENTAUR BELT',
            telemetry: '巨行星轨道之间 · 5.5–30 AU',
          },
          outer: {
            mode: '柯伊伯带区域',
            code: 'KUIPER BELT',
            telemetry: '海王星外冰质盘 · 30–50 AU',
          },
          scattered: {
            mode: '离散盘与内奥尔特云',
            code: 'SCATTERED & OORT',
            telemetry: '极远分离天体区 · 50–1000 AU',
          },
        },
)

const totalMoons = computed(() => {
  const a = atlas.value
  if (!a) return 470
  return [...a.planets, ...a.smallBodies].reduce((sum, w) => sum + w.moons.length, 0)
})

const hudModeTag = computed(() => {
  if (inTrappist.value) return pick('系外行星轨道', 'Exoplanet Orbits')
  if (ui.deepEntry) return pick('深空三维观测', 'Deep-Sky 3D View')
  if (ui.galaxy) return pick('银河宏观尺度', 'Galactic Scale')
  if (ui.phenomena) return pick('罕见天象演算', 'Rare Phenomenon')
  if (ui.voyager) return pick('星际飞行轨道', 'Interstellar Trajectory')
  if (ui.comet) return pick('彗星跟随观测', 'Comet Tracking')
  if (ui.moon) return pick('卫星近距追踪', 'Moon Tracking')
  if (ui.planet) {
    if (isEn.value) return `${worldKind(ui.planet, 'en')} Orbit`
    return ui.planet.kind ? ui.planet.kind + '轨道' : '行星近距轨道'
  }
  if (ui.region) return regionMeta.value[ui.region]?.mode ?? pick('外太阳系区域', 'Outer Region')
  return pick('太阳系轨道图鉴', 'Solar System Atlas')
})

const hudCode = computed(() => {
  if (inTrappist.value) return ''
  if (ui.deepEntry) return ui.deepEntry.code.split(' · ')[0]
  if (ui.galaxy) return 'MILKY WAY'
  if (ui.phenomena) return getPhenomenon(ui.phenomenonId).code
  if (ui.voyager) return ui.voyagerMode === 'both' ? 'V1 + V2' : 'VOYAGER ' + ui.voyagerMode.slice(1)
  if (ui.comet) return ui.comet.id
  if (ui.moon) return ui.moon.name.toUpperCase()
  if (ui.planet) return (ui.planet.code ?? ui.planet.id).toUpperCase()
  if (ui.region) return regionMeta.value[ui.region]?.code ?? 'SOLAR BELT'
  return 'SOL SYSTEM'
})

const hudTelemetry = computed(() => {
  if (inTrappist.value) return pick('超冷红矮星 · 7 颗行星', 'Ultracool red dwarf · 7 planets')
  if (ui.deepEntry) return groupLabel(ui.deepEntry.group)
  if (ui.galaxy) return pick('猎户支臂 · 距银心 2.6 万光年', 'Orion Spur · 26,000 ly from Center')
  if (ui.phenomena) {
    const s = ui.phenomenonStats
    const primary = s.metrics[0]
    return `${s.dateLabel} · ${primary.label} ${primary.value}`
  }
  if (ui.voyager) {
    const s = ui.voyagerStats
    return `${s.dateLabel} · ${s.sunAU.toFixed(1)} AU · ${formatLightTime(s.lightHours, locale.value)}`
  }
  if (ui.comet) {
    const c = ui.comet
    return pick('近日点', 'Perihelion') + ' ' + (c.a * (1 - c.e)).toFixed(2) + ' AU · ' +
      pick('倾角', 'Inclination') + ' ' + c.i.toFixed(1) + '°'
  }
  if (ui.moon) {
    const axis = formatNum(ui.moon.a) + ' km'
    if (isEn.value) {
      return ui.moon.period
        ? `a ${axis} · Period ${ui.moon.period} d`
        : `Obs. Distance ${axis}`
    }
    return ui.moon.period ? `半长轴 ${axis} · 周期 ${ui.moon.period} 天` : `观测距离 ${axis}`
  }
  if (ui.planet) {
    if (isEn.value) {
      const period =
        ui.planet.days > 3652
          ? (ui.planet.days / 365.25).toFixed(ui.planet.days > 36525 ? 0 : 1) + ' yr'
          : formatNum(Math.round(ui.planet.days), 'en') + ' d'
      const au = ui.planet.au
        ? `${ui.planet.au >= 100 ? Math.round(ui.planet.au) : ui.planet.au.toFixed(1)} AU · `
        : ''
      const mCount = ui.planet.moons.length
      return `${au}Orbit ${period} · ${mCount} ${mCount === 1 ? 'Moon' : 'Moons'}`
    }
    const days =
      ui.planet.days > 3652
        ? (ui.planet.days / 365.25).toFixed(ui.planet.days > 36525 ? 0 : 1) + ' 年'
        : Math.round(ui.planet.days).toLocaleString('zh-CN') + ' 天'
    const au = ui.planet.au
      ? `半长轴 ${ui.planet.au >= 100 ? Math.round(ui.planet.au) : ui.planet.au.toFixed(1)} AU · `
      : ''
    return `${au}公转 ${days} · 卫星 ${ui.planet.moons.length}`
  }
  if (ui.region) return regionMeta.value[ui.region]?.telemetry ?? ''
  const smallCount = atlas.value?.smallBodies.length ?? 22
  return isEn.value
    ? `8 Planets · ${smallCount} Minor Bodies · 5 Belts · ${totalMoons.value} Moons`
    : `8 行星 · ${smallCount} 矮行星/小天体 · 5 天体带 · ${totalMoons.value} 卫星`
})
</script>
<template>
  <main
    :class="{ 'notes-open': ui.notesOpen, 'dock-open': ui.dockOpen, 'on-surface': !!ui.landing }"
  >
    <section id="stage" ref="stage" :aria-label="pick('三维星空', '3D Sky Canvas')">
      <canvas
        ref="canvas"
        id="space"
        :tabindex="ui.landing ? -1 : 0"
        :aria-hidden="ui.landing ? true : undefined"
        :aria-label="
          deepEntryView
            ? isEn
              ? `${observationTitle} 3D model. Drag to orbit, scroll to zoom.`
              : observationTitle + '三维示意，拖动旋转，滚轮缩放。'
            : pick(
                '交互式三维太阳系。方向键旋转，加减键缩放，Home 键复位。',
                'Interactive 3D Solar System. Arrow keys to orbit, +/- to zoom, Home to reset.',
              )
        "
        >{{
          pick(
            '请使用支持 Canvas 的浏览器查看太阳系。',
            'Please use a browser with Canvas support to explore the Solar System.',
          )
        }}</canvas
      >
      <div ref="tags" id="tags" aria-hidden="true"></div>
      <h1 class="sr-only" id="title" aria-live="polite">
        {{
          ui.landing
            ? isEn
              ? `${ui.landing.name} ${ui.landing.cloud ? 'Cloud Flight' : 'Surface Excursion'}`
              : ui.landing.name + (ui.landing.cloud ? '云层观测' : '地表漫游')
            : ui.title
        }}
      </h1>

      <header id="hudBrand" aria-hidden="true">
        <div class="hud-kicker">
          <span class="hud-beacon" :class="{ paused: !ui.playing }"></span>
          <span class="hud-app">STAR SCOPE</span>
          <span class="hud-divider"></span>
          <span class="hud-mode">{{ hudModeTag }}</span>
        </div>
        <div class="hud-title-row">
          <strong class="hud-title">{{ observationTitle }}</strong>
          <span v-if="hudCode" class="hud-code">{{ hudCode }}</span>
        </div>
        <div class="hud-meta">
          <span class="hud-chip">{{ hudTelemetry }}</span>
          <span class="hud-chip hud-state" :class="{ paused: !ui.playing }">
            {{
              ui.playing
                ? isEn
                  ? `LIVE ${ui.speed}×`
                  : `实时 ${ui.speed}×`
                : pick('已暂停', 'PAUSED')
            }}
          </span>
        </div>
      </header>

      <div class="sky-tools">
        <select class="compact-scale" :aria-label="pick('观察尺度', 'View Scale')"
          :value="inTrappist ? 'trappist' : ui.deepEntry ? 'deep' : ui.galaxy ? 'galaxy' : ui.phenomena ? 'phenomena' : ui.voyager ? 'voyager' : 'solar'" @change="switchScale">
          <option v-if="ui.deepEntry && !inTrappist" disabled value="deep">{{ pick('深空', 'Deep Sky') }}</option>
          <option value="solar">{{ pick('太阳系', 'Solar System') }}</option>
          <option value="phenomena">{{ pick('罕见天象', 'Rare Events') }}</option>
          <option value="voyager">{{ pick('旅行者计划', 'Voyager') }}</option>
          <option value="trappist">TRAPPIST-1</option>
          <option value="galaxy">{{ pick('银河系', 'Milky Way') }}</option>
        </select>
        <div class="scale-switch" role="group" :aria-label="pick('观察尺度', 'View Scale')">
          <button
            id="solarTab"
            :aria-pressed="!ui.deepEntry && !ui.galaxy && !ui.voyager && !ui.phenomena"
            @click="atlas?.openPlanet(null)"
          >
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="2.2" fill="currentColor" />
              <ellipse cx="8" cy="8" rx="6.5" ry="3.2" transform="rotate(-24 8 8)" stroke="currentColor" stroke-width="1.25" />
            </svg>
            <span>{{ pick('太阳系', 'Solar') }}</span>
          </button>
          <button
            id="phenomenaTab"
            :aria-pressed="!ui.deepEntry && !ui.galaxy && ui.phenomena"
            @click="atlas?.openPhenomena()"
          >
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.2 12.2L13.8 3.8" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" opacity="0.58" />
              <circle cx="4.4" cy="10.6" r="1.2" fill="currentColor" />
              <circle cx="8" cy="8" r="1.8" fill="currentColor" />
              <circle cx="11.8" cy="5.2" r="1.35" stroke="currentColor" stroke-width="1.2" />
              <path d="M8 2.2v1.6M8 12.2v1.6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.72" />
            </svg>
            <span>{{ pick('罕见天象', 'Phenomena') }}</span>
          </button>
          <button
            id="voyagerTab"
            :aria-pressed="!ui.deepEntry && !ui.galaxy && ui.voyager"
            @click="atlas?.openVoyager()"
          >
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.2 9.4a5.2 5.2 0 0 1 6.2-6.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              <path d="M4.6 8.2L9.8 13.4M6.6 6.2l3.8-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
              <circle cx="11.4" cy="4.4" r="1.25" fill="currentColor" />
              <path d="M12.2 2.4a3.2 3.2 0 0 1 1.4 1.4" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" opacity="0.7" />
            </svg>
            <span>{{ pick('旅行者计划', 'Voyager') }}</span>
          </button>
          <button id="trappistTab" :aria-pressed="inTrappist" @click="atlas?.openTrappistSystem()">
            TRAPPIST-1
          </button>
          <button
            id="galaxyTab"
            :aria-pressed="!ui.deepEntry && ui.galaxy"
            @click="atlas?.openGalaxy()"
          >
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <path
                d="M8 2.2c3.2 0 5.5 2.4 5.5 5.4 0 1.4-.5 2.6-1.4 3.5M8 13.8c-3.2 0-5.5-2.4-5.5-5.4 0-1.4.5-2.6 1.4-3.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
              <path
                d="M5.2 4.5c1.6-.9 3.8-.7 5.2.6M10.8 11.5c-1.6.9-3.8.7-5.2-.6"
                stroke="currentColor"
                stroke-width="1.15"
                stroke-linecap="round"
              />
            </svg>
            <span>{{ pick('银河系', 'Milky Way') }}</span>
          </button>
        </div>
        <button
          id="archiveOpen"
          :aria-label="pick('星图档案', 'Archive')"
          :title="pick('星图档案', 'Archive')"
          aria-haspopup="dialog"
          aria-controls="archive"
          @click="archive?.open()"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.2" y="2.6" width="11.6" height="10.8" rx="2" stroke="currentColor" stroke-width="1.3" />
            <path d="M5 6h6M5 8.8h4.2M5 11.4h2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            <circle cx="11.2" cy="10.4" r="1" fill="currentColor" />
          </svg>
          <span>{{ pick('星图档案', 'Archive') }}</span></button
        ><button
          id="notes"
          :aria-label="pick('注释', 'Notes')"
          :title="pick('注释', 'Notes')"
          :aria-pressed="ui.notesOpen"
          aria-controls="noteCard"
          @click="atlas?.setNotes(!ui.notesOpen)"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.8" stroke="currentColor" stroke-width="1.3" />
            <path d="M8 7.2v3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
          </svg>
          <span>{{ pick('注释', 'Notes') }}</span></button
        ><button
          id="langToggle"
          class="lang-btn"
          :title="pick('Switch to English', '切换为简体中文')"
          :aria-label="pick('Switch to English', '切换为简体中文')"
          @click="toggleLocale()"
        >
          <span>{{ isEn ? '中文' : 'EN' }}</span></button
        ><button
          class="tool-icon"
          id="help"
          :title="pick('使用说明', 'User Guide')"
          :aria-label="pick('使用说明', 'User Guide')"
          @click="guide?.open()"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6.1 6.1a2 2 0 1 1 2.9 1.8c-.7.4-1 .8-1 1.6v.4"
              stroke="currentColor"
              stroke-width="1.45"
              stroke-linecap="round"
            />
            <circle cx="8" cy="12.2" r="0.9" fill="currentColor" />
          </svg></button
        ><button
          class="tool-icon"
          id="fullscreen"
          :title="pick('切换全屏', 'Toggle Fullscreen')"
          :aria-label="pick('切换全屏', 'Toggle Fullscreen')"
          :hidden="!canFullscreen"
          @click="toggleFullscreen"
        >
          <svg v-if="!isFullscreen" class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2.5 5.8V3.2a.7.7 0 0 1 .7-.7h2.6M10.2 2.5h2.6a.7.7 0 0 1 .7.7v2.6M13.5 10.2v2.6a.7.7 0 0 1-.7.7h-2.6M5.8 13.5H3.2a.7.7 0 0 1-.7-.7v-2.6"
              stroke="currentColor"
              stroke-width="1.35"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 2.8v2.5a.7.7 0 0 1-.7.7H2.8M13.2 6h-2.5a.7.7 0 0 1-.7-.7V2.8M10 13.2v-2.5a.7.7 0 0 1 .7-.7h2.5M2.8 10h2.5a.7.7 0 0 1 .7.7v2.5"
              stroke="currentColor"
              stroke-width="1.35"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <div ref="pins" id="pins"></div>
      <section id="deepHUD" :aria-label="pick('深空三维观测', 'Deep-Sky 3D View')" :hidden="!ui.deepEntry">
        <div class="deep-caption">
          <span class="deep-dot" aria-hidden="true"></span>
          <span id="deepClass">{{ ui.deepClass }}</span><i></i
          ><span id="deepCode">{{ observationCode }}</span>
        </div>
        <h2 id="deepName">{{ observationTitle }}</h2>
        <p v-if="inTrappist" class="system-facts">
          <template v-if="trappistPlanet">
            {{ pick('周期', 'Period') }} {{ trappistPlanet.days.toFixed(3) }} {{ pick('天', 'd') }} ·
            {{ pick('半长轴', 'Semi-major axis') }} {{ trappistPlanet.axisAU.toFixed(5) }} AU ·
            {{ pick('倾角', 'Inclination') }} {{ trappistPlanet.inclination.toFixed(3) }}°
          </template>
          <template v-else>
            {{ pick('公转周期 1.51–18.77 天', 'Orbital periods 1.51–18.77 d') }} ·
            {{ pick(`标准速度下 ${trappistSecondsPerDay} 秒演示 1 天`, `1 simulated day per ${trappistSecondsPerDay} s at 1×`) }}
          </template>
        </p>
        <div class="deep-controls">
          <div id="deepPresets" :class="{ 'system-presets': inTrappist }" role="group" :aria-label="pick('观测视角', 'View Presets')">
            <button
              v-for="[mode, label] in ui.presets"
              :key="mode"
              :data-preset="mode"
              :aria-label="inTrappist && mode.length === 1 ? 'TRAPPIST-1 ' + mode : label"
              :aria-pressed="ui.preset === mode"
              @click="atlas?.deepPreset(mode)"
            >
              {{ label }}
            </button>
          </div>
          <button v-if="!inTrappist || ui.preset === 'e'" id="deepSource" @click="ui.deepEntry && archive?.open(ui.deepEntry)">
            <span>{{ pick('原图与资料', 'Photos & Info') }}</span>
            <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M4.5 9.5l5-5M5.5 4.5h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div v-if="!inTrappist || ui.preset === 'e'" class="deep-step">
            <button
              id="deepPrev"
              :aria-label="pick('上一个三维天体', 'Previous 3D target')"
              @click="atlas?.switchDeepTarget(-1)"
            >
              <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3.8L5.8 8 10 12.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg></button
            ><button
              id="deepNext"
              :aria-label="pick('下一个三维天体', 'Next 3D target')"
              @click="atlas?.switchDeepTarget(1)"
            >
              <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3.8L10.2 8 6 12.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <p v-if="inTrappist" class="system-credit">
          {{ pick('天体已放大，表面为艺术示意。', 'Bodies enlarged. Surfaces are illustrative.') }}
          <a :href="trappistCatalog" target="_blank" rel="noopener">{{ pick('轨道资料 ↗', 'Orbit data ↗') }}</a>
        </p>
      </section>
      <VoyagerHud
        v-if="atlas && ui.voyager && !ui.deepEntry"
        :atlas="atlas"
        :ui="ui"
      />
      <PhenomenaHud
        v-if="atlas && ui.phenomena && !ui.deepEntry"
        :atlas="atlas"
        :ui="ui"
      />
      <SurfaceHud
        v-if="atlas && ui.landing"
        :atlas="atlas"
        :status="ui.landing"
        @exit="returnToOrbit"
      />
      <BodyDrawer
        v-if="atlas"
        :atlas="atlas"
        :ui="ui"
        :current-entry="currentSolarEntry"
        @open-archive="archive?.open($event)"
      />
      <aside id="noteCard" :hidden="!ui.notesOpen" :aria-label="pick('天文注释', 'Astronomy Notes')">
        <div class="note-kicker">{{ pick('TELEMETRY // 天文注释', 'TELEMETRY // ASTRONOMY NOTES') }}</div>
        <div class="note-head">
          <h2 id="noteTitle">{{ note?.name }}</h2>
          <button
            id="closeNotes"
            :aria-label="pick('收起注释', 'Close Notes')"
            @click="atlas?.setNotes(false)"
          >
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div v-if="noteEntryView?.discovered || noteEntry?.probePhotos?.length" class="note-meta">
          <span v-if="noteEntryView?.discovered" class="note-pill">
            {{ isEn ? `Discovered · ${noteEntryView.discovered}` : `发现年份 · ${noteEntryView.discovered}` }}
          </span>
          <span v-if="noteEntry?.probePhotos?.length" class="note-pill is-probe">
            {{
              isEn
                ? `Spacecraft Photos · ${noteEntry.probePhotos.length}`
                : `探测器实拍 · ${noteEntry.probePhotos.length} 张`
            }}
          </span>
        </div>
        <p id="noteText">{{ note?.body }}</p>
        <div class="note-foot">
          <div class="note-links">
            <a id="noteSource" :href="note?.source" target="_blank" rel="noopener"
              >{{ sourceName }} ↗</a
            >
            <button
              v-if="currentSolarEntry"
              class="note-archive"
              @click="archive?.open(currentSolarEntry)"
            >
              {{
                currentSolarEntry.probePhotos?.length
                  ? pick('实拍与档案', 'Photos & Info')
                  : pick('查看档案', 'View Profile')
              }}
            </button>
          </div>
          <div id="notePages" :hidden="ui.notes.length < 2">
            <button
              id="prevNote"
              :aria-label="pick('上一条注释', 'Previous Note')"
              @click="atlas?.showNote(ui.noteIndex - 1)"
            >
              <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M8.8 3.2L5 7l3.8 3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg></button
            ><span id="noteNumber">{{ ui.noteIndex + 1 }} / {{ ui.notes.length }}</span
            ><button
              id="nextNote"
              :aria-label="pick('下一条注释', 'Next Note')"
              @click="atlas?.showNote(ui.noteIndex + 1)"
            >
              <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5.2 3.2L9 7l-3.8 3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <div class="camera-buttons" role="group" :aria-label="pick('视角缩放与复位', 'Zoom and Reset Camera')">
        <button
          id="zoomIn"
          :title="pick('拉近', 'Zoom In')"
          :aria-label="pick('拉近', 'Zoom In')"
          @click="atlas?.changeZoom(0.78)"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
          </svg></button
        ><button
          id="zoomOut"
          :title="pick('拉远', 'Zoom Out')"
          :aria-label="pick('拉远', 'Zoom Out')"
          @click="atlas?.changeZoom(1 / 0.78)"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 8h9" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
          </svg></button
        ><button
          id="reset"
          :title="pick('复位视角', 'Reset View')"
          :aria-label="pick('复位视角', 'Reset View')"
          @click="atlas?.reset()"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="2.1" stroke="currentColor" stroke-width="1.35" />
            <path d="M8 2.2v2.1M8 11.7v2.1M2.2 8h2.1M11.7 8h2.1" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div id="notice" role="status" :hidden="!notice">{{ notice }}</div>
    </section>
    <NavigationDock v-if="atlas" :atlas="atlas" :ui="ui" />
  </main>
  <ArchiveDialog v-if="atlas" ref="archive" :atlas="atlas" />
  <GuideDialog ref="guide" />
</template>
