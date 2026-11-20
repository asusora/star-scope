<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  ref,
} from 'vue'
import NavigationDock from './components/NavigationDock.vue'
import BodyDrawer from './components/BodyDrawer.vue'
import ArchiveDialog from './components/ArchiveDialog.vue'
import GuideDialog from './components/GuideDialog.vue'
import SurfaceHud from './components/SurfaceHud.vue'
import { createAtlas, type Atlas } from './scene/atlas'
import { createSceneUI } from './scene/ui'

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
    notice.value = '当前窗口无法进入全屏。'
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => (notice.value = ''), 2200)
  }
}

const note = computed(() => ui.notes[ui.noteIndex])
const sourceName = computed(() => {
  const url = note.value?.source ?? ''
  return url.includes('nasa.gov')
    ? 'NASA 资料'
    : url.includes('eso.org')
      ? 'ESO 资料'
      : url.includes('harvard.edu')
        ? 'IAU 通报'
        : '轨道研究'
})

const regionMeta: Record<string, { mode: string; code: string; telemetry: string }> = {
  main: { mode: '主小行星带', code: 'MAIN BELT', telemetry: '火星至木星间 · 含希尔达族 2.1–4.0 AU' },
  trojan: { mode: '木星特洛伊群', code: 'JUPITER TROJANS', telemetry: '木星轨道 L4/L5 共轨云 · 5.2 AU' },
  centaur: { mode: '半人马小天体带', code: 'CENTAUR BELT', telemetry: '巨行星轨道之间 · 5.5–30 AU' },
  outer: { mode: '柯伊伯带区域', code: 'KUIPER BELT', telemetry: '海王星外冰质盘 · 30–50 AU' },
  scattered: {
    mode: '离散盘与内奥尔特云',
    code: 'SCATTERED & OORT',
    telemetry: '极远分离天体区 · 50–1000 AU',
  },
}

const totalMoons = computed(() => {
  const a = atlas.value
  if (!a) return 470
  return [...a.planets, ...a.smallBodies].reduce((sum, w) => sum + w.moons.length, 0)
})

const hudModeTag = computed(() => {
  if (ui.deepEntry) return '深空三维观测'
  if (ui.galaxy) return '银河宏观尺度'
  if (ui.moon) return '卫星近距追踪'
  if (ui.planet) return ui.planet.kind ? ui.planet.kind + '轨道' : '行星近距轨道'
  if (ui.region) return regionMeta[ui.region]?.mode ?? '外太阳系区域'
  return '太阳系轨道图鉴'
})

const hudCode = computed(() => {
  if (ui.deepEntry) return ui.deepEntry.code.split(' · ')[0]
  if (ui.galaxy) return 'MILKY WAY'
  if (ui.moon) return ui.moon.name.toUpperCase()
  if (ui.planet) return (ui.planet.code ?? ui.planet.id).toUpperCase()
  if (ui.region) return regionMeta[ui.region]?.code ?? 'SOLAR BELT'
  return 'SOL SYSTEM'
})

const hudTelemetry = computed(() => {
  if (ui.deepEntry) return ui.deepEntry.group
  if (ui.galaxy) return '猎户支臂 · 距银心 2.6 万光年'
  if (ui.moon) {
    const axis = ui.moon.a.toLocaleString('zh-CN') + ' km'
    return ui.moon.period ? `半长轴 ${axis} · 周期 ${ui.moon.period} 天` : `观测距离 ${axis}`
  }
  if (ui.planet) {
    const days =
      ui.planet.days > 3652
        ? (ui.planet.days / 365.25).toFixed(ui.planet.days > 36525 ? 0 : 1) + ' 年'
        : Math.round(ui.planet.days).toLocaleString('zh-CN') + ' 天'
    const au = ui.planet.au
      ? `半长轴 ${ui.planet.au >= 100 ? Math.round(ui.planet.au) : ui.planet.au.toFixed(1)} AU · `
      : ''
    return `${au}公转 ${days} · 卫星 ${ui.planet.moons.length}`
  }
  if (ui.region) return regionMeta[ui.region]?.telemetry ?? ''
  const smallCount = atlas.value?.smallBodies.length ?? 22
  return `8 行星 · ${smallCount} 矮行星/小天体 · 5 天体带 · ${totalMoons.value} 卫星`
})
</script>
<template>
  <main
    :class="{ 'notes-open': ui.notesOpen, 'dock-open': ui.dockOpen, 'on-surface': !!ui.landing }"
  >
    <section id="stage" ref="stage" aria-label="三维星空">
      <canvas
        ref="canvas"
        id="space"
        :tabindex="ui.landing ? -1 : 0"
        :aria-hidden="ui.landing ? true : undefined"
        :aria-label="
          ui.deepEntry
            ? ui.deepEntry.title + '三维示意，拖动旋转，滚轮缩放。'
            : '交互式三维太阳系。方向键旋转，加减键缩放，Home 键复位。'
        "
        >请使用支持 Canvas 的浏览器查看太阳系。</canvas
      >
      <div ref="tags" id="tags" aria-hidden="true"></div>
      <h1 class="sr-only" id="title" aria-live="polite">
        {{ ui.landing ? ui.landing.name + (ui.landing.cloud ? '云层观测' : '地表漫游') : ui.title }}
      </h1>

      <header id="hudBrand" aria-hidden="true">
        <div class="hud-kicker">
          <span class="hud-beacon" :class="{ paused: !ui.playing }"></span>
          <span class="hud-app">STAR SCOPE</span>
          <span class="hud-divider"></span>
          <span class="hud-mode">{{ hudModeTag }}</span>
        </div>
        <div class="hud-title-row">
          <strong class="hud-title">{{ ui.deepEntry ? ui.deepEntry.title : ui.title }}</strong>
          <span class="hud-code">{{ hudCode }}</span>
        </div>
        <div class="hud-meta">
          <span class="hud-chip">{{ hudTelemetry }}</span>
          <span class="hud-chip hud-state" :class="{ paused: !ui.playing }">
            {{ ui.playing ? `实时 ${ui.speed}×` : '已暂停' }}
          </span>
        </div>
      </header>

      <div class="sky-tools">
        <div class="scale-switch" role="group" aria-label="观察尺度">
          <button
            id="solarTab"
            :aria-pressed="!ui.deepEntry && !ui.galaxy"
            @click="atlas?.openPlanet(null)"
          >
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="2.2" fill="currentColor" />
              <ellipse cx="8" cy="8" rx="6.5" ry="3.2" transform="rotate(-24 8 8)" stroke="currentColor" stroke-width="1.25" />
            </svg>
            <span>太阳系</span></button
          ><button
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
            <span>银河系</span>
          </button>
        </div>
        <button
          id="archiveOpen"
          aria-haspopup="dialog"
          aria-controls="archive"
          @click="archive?.open()"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.2" y="2.6" width="11.6" height="10.8" rx="2" stroke="currentColor" stroke-width="1.3" />
            <path d="M5 6h6M5 8.8h4.2M5 11.4h2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            <circle cx="11.2" cy="10.4" r="1" fill="currentColor" />
          </svg>
          <span>深空档案</span></button
        ><button
          id="notes"
          :aria-pressed="ui.notesOpen"
          aria-controls="noteCard"
          @click="atlas?.setNotes(!ui.notesOpen)"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.8" stroke="currentColor" stroke-width="1.3" />
            <path d="M8 7.2v3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
          </svg>
          <span>注释</span></button
        ><button
          class="tool-icon"
          id="help"
          title="使用说明"
          aria-label="使用说明"
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
          title="切换全屏"
          aria-label="切换全屏"
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
      <section id="deepHUD" aria-label="深空三维观测" :hidden="!ui.deepEntry">
        <div class="deep-caption">
          <span class="deep-dot" aria-hidden="true"></span>
          <span id="deepClass">{{ ui.deepClass }}</span><i></i
          ><span id="deepCode">{{ ui.deepEntry?.code }}</span>
        </div>
        <h2 id="deepName">{{ ui.deepEntry?.title }}</h2>
        <div class="deep-controls">
          <div id="deepPresets" role="group" aria-label="观测视角">
            <button
              v-for="[mode, label] in ui.presets"
              :key="mode"
              :data-preset="mode"
              :aria-pressed="ui.preset === mode"
              @click="atlas?.deepPreset(mode)"
            >
              {{ label }}
            </button>
          </div>
          <button id="deepSource" @click="ui.deepEntry && archive?.open(ui.deepEntry)">
            <span>原图与资料</span>
            <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M4.5 9.5l5-5M5.5 4.5h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div class="deep-step">
            <button id="deepPrev" aria-label="上一个三维天体" @click="atlas?.switchDeepTarget(-1)">
              <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3.8L5.8 8 10 12.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg></button
            ><button id="deepNext" aria-label="下一个三维天体" @click="atlas?.switchDeepTarget(1)">
              <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3.8L10.2 8 6 12.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>
      <SurfaceHud
        v-if="atlas && ui.landing"
        :atlas="atlas"
        :status="ui.landing"
        @exit="returnToOrbit"
      />
      <BodyDrawer v-if="atlas" :atlas="atlas" :ui="ui" />
      <aside id="noteCard" :hidden="!ui.notesOpen" aria-label="天文注释">
        <div class="note-kicker">TELEMETRY // 天文注释</div>
        <div class="note-head">
          <h2 id="noteTitle">{{ note?.name }}</h2>
          <button id="closeNotes" aria-label="收起注释" @click="atlas?.setNotes(false)">
            <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <p id="noteText">{{ note?.body }}</p>
        <div class="note-foot">
          <a id="noteSource" :href="note?.source" target="_blank" rel="noopener"
            >{{ sourceName }} ↗</a
          >
          <div id="notePages" :hidden="ui.notes.length < 2">
            <button
              id="prevNote"
              aria-label="上一条注释"
              @click="atlas?.showNote(ui.noteIndex - 1)"
            >
              <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M8.8 3.2L5 7l3.8 3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg></button
            ><span id="noteNumber">{{ ui.noteIndex + 1 }} / {{ ui.notes.length }}</span
            ><button
              id="nextNote"
              aria-label="下一条注释"
              @click="atlas?.showNote(ui.noteIndex + 1)"
            >
              <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5.2 3.2L9 7l-3.8 3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <div class="camera-buttons" role="group" aria-label="视角缩放与复位">
        <button id="zoomIn" title="拉近" aria-label="拉近" @click="atlas?.changeZoom(0.78)">
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
          </svg></button
        ><button id="zoomOut" title="拉远" aria-label="拉远" @click="atlas?.changeZoom(1 / 0.78)">
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 8h9" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
          </svg></button
        ><button id="reset" title="复位视角" aria-label="复位视角" @click="atlas?.reset()">
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
