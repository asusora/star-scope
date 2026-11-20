<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { Atlas } from '../scene/atlas'
import { deepGroups, type Belt, type SceneUI, type Group, type OrbitMode } from '../scene/types'
import { thumbs } from '../data/assets'

const { atlas, ui } = defineProps<{ atlas: Atlas; ui: SceneUI }>()
const groups: Group[] = ['太阳系', ...deepGroups]
const beltZones: { id: Belt; label: string }[] = [
  { id: 'main', label: '主小行星带' },
  { id: 'trojan', label: '木星特洛伊' },
  { id: 'centaur', label: '半人马带' },
  { id: 'outer', label: '柯伊伯带' },
  { id: 'scattered', label: '离散盘 · 极远' },
]
const smallStrip = computed(() =>
  [...atlas.smallBodies].sort((a, b) => (a.au ?? 0) - (b.au ?? 0)),
)
function formatAU(au?: number) {
  if (!au) return ''
  return (au >= 100 ? Math.round(au) : au.toFixed(1)) + ' AU'
}
const tracks: { value: OrbitMode; label: string }[] = [
  { value: 'smart', label: '智能' },
  { value: 'all', label: '全部' },
  { value: 'off', label: '关闭' },
]
const deepEntries = computed(() =>
  ui.group === '太阳系' ? [] : atlas.entries.filter((e) => e.group === ui.group),
)
const tray = useTemplateRef('tray'),
  toggle = useTemplateRef('toggle')

watch(
  () => ui.dockOpen,
  (open) => {
    if (!open && tray.value?.contains(document.activeElement))
      toggle.value?.focus({ preventScroll: true })
  },
  { flush: 'sync' },
)

let swipeY: number | null = null
function touchStart(event: TouchEvent) {
  swipeY = event.touches.length === 1 ? event.touches[0].clientY : null
}
function touchEnd(event: TouchEvent) {
  if (swipeY !== null) {
    const dy = event.changedTouches[0].clientY - swipeY
    if (Math.abs(dy) > 30) atlas.setDock(dy < 0)
  }
  swipeY = null
}
</script>
<template>
  <div
    id="dock"
    :class="{ open: ui.dockOpen }"
    @touchstart.passive="touchStart"
    @touchend.passive="touchEnd"
  >
    <button
      ref="toggle"
      id="dockToggle"
      :aria-expanded="ui.dockOpen"
      aria-controls="tray"
      @click="atlas.setDock(!ui.dockOpen)"
    >
      <svg class="dock-radar-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.8" stroke="currentColor" stroke-width="1.2" opacity="0.55" />
        <circle cx="8" cy="8" r="2.2" fill="currentColor" />
        <circle cx="12.2" cy="4.2" r="1.2" fill="var(--cyan)" />
      </svg>
      <span>{{ ui.dockOpen ? '收起导航' : '天体导航' }}</span>
      <svg class="dock-chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M3.2 8.8L7 5l3.8 3.8"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div id="tray" ref="tray" :inert="!ui.dockOpen">
      <div class="controlbar">
        <div class="transport">
          <button
            id="play"
            :aria-label="ui.playing ? '暂停动画' : '播放动画'"
            @click="atlas.setPlaying(!ui.playing)"
          >
            <svg v-if="ui.playing" class="ui-ico-sm" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2.4" width="2.8" height="9.2" rx="0.9" />
              <rect x="8.2" y="2.4" width="2.8" height="9.2" rx="0.9" />
            </svg>
            <svg v-else class="ui-ico-sm" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M3.5 2.4l8 4.6-8 4.6V2.4z" />
            </svg>
            <span>{{ ui.playing ? '暂停' : '播放' }}</span>
          </button>
          <div class="speed-control">
            <span aria-hidden="true">速率</span>
            <div id="speed" role="group" aria-label="动画速度">
              <button
                v-for="n in [0.25, 0.5, 1, 2, 5]"
                :key="n"
                :aria-pressed="ui.speed === n"
                @click="atlas.setSpeed(n)"
              >
                {{ n }}×
              </button>
            </div>
          </div>
        </div>
        <div class="toggles">
          <div class="orbit-options">
            <span aria-hidden="true">轨道</span>
            <fieldset id="tracks" :disabled="ui.tracksDisabled">
              <legend class="sr-only">轨道显示</legend>
              <label v-for="mode in tracks" :key="mode.value"
                ><input
                  type="radio"
                  name="orbit-mode"
                  :value="mode.value"
                  :checked="ui.orbitMode === mode.value"
                  @change="atlas.setOrbitMode(mode.value)"
                /><span>{{ mode.label }}</span></label
              >
            </fieldset>
          </div>
          <button id="labels" :aria-pressed="ui.showNames" @click="atlas.setLabels(!ui.showNames)">
            <i></i><span>标注</span>
          </button>
        </div>
      </div>
      <div class="dock-nav-row">
        <div id="navGroups" role="group" aria-label="天体导航分类">
          <button
            v-for="group in groups"
            :key="group"
            :aria-pressed="ui.group === group"
            @click="ui.group = group"
          >
            {{ group }}
          </button>
        </div>
        <div class="belt-links" :hidden="ui.group !== '太阳系'" role="group" aria-label="小天体带区域">
          <button
            v-for="zone in beltZones"
            :key="zone.id"
            :id="'belt-' + zone.id"
            :aria-pressed="ui.region === zone.id"
            @click="atlas.openRegion(zone.id)"
          >
            <span>{{ zone.label }}</span>
            <svg class="ui-ico-xs" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4.5 2.8L7.8 6 4.5 9.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div
        id="solarDestinations"
        :hidden="ui.group !== '太阳系'"
        @pointerleave="atlas.preview(null)"
        @focusout="atlas.preview(null)"
      >
        <nav id="destinations" aria-label="太阳系八大行星">
          <button
            class="destination"
            id="home"
            :aria-pressed="!ui.deepEntry && !ui.galaxy && !ui.planet && !ui.region"
            @pointerover="$event.pointerType === 'mouse' && atlas.preview(null)"
            @click="atlas.openPlanet(null)"
          >
            <span class="home-orbit" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="3.4" fill="currentColor" />
                <circle cx="14" cy="14" r="7.4" stroke="currentColor" stroke-width="1.15" opacity="0.7" />
                <circle cx="14" cy="14" r="11.4" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2.5" opacity="0.48" />
                <circle cx="21.4" cy="14" r="1.5" fill="var(--amber)" />
              </svg>
            </span>
            <span class="dest-meta"><b>全景</b><small>OVERVIEW</small></span>
          </button>
          <button
            v-for="planet in atlas.planets"
            :key="planet.id"
            class="destination"
            :data-planet="planet.id"
            :aria-label="planet.name + '，' + planet.moons.length + ' 颗卫星'"
            :aria-pressed="!ui.deepEntry && planet === ui.planet"
            @pointerover="$event.pointerType === 'mouse' && atlas.preview(planet)"
            @focus="atlas.preview(planet)"
            @click="atlas.openPlanet(planet)"
          >
            <span class="planet-thumb">
              <img :src="thumbs[planet.id]" alt="" />
            </span>
            <span class="dest-meta"
              ><b>{{ planet.name }}</b
              ><small>{{ planet.id }}</small></span
            >
          </button>
        </nav>
        <nav id="smallDestinations" aria-label="矮行星、半人马与极远天体">
          <button
            v-for="body in smallStrip"
            :key="body.id"
            class="small-dest"
            :data-planet="body.id"
            :aria-label="body.name + '，' + (body.kind ?? '小天体') + '，' + formatAU(body.au)"
            :aria-pressed="!ui.deepEntry && body === ui.planet"
            @pointerover="$event.pointerType === 'mouse' && atlas.preview(body)"
            @focus="atlas.preview(body)"
            @click="atlas.openPlanet(body)"
          >
            <span class="small-thumb">
              <img v-if="thumbs[body.id]" :src="thumbs[body.id]" alt="" />
              <span v-else class="small-dot" aria-hidden="true"></span>
            </span>
            <span class="small-meta"
              ><b>{{ body.name }}</b
              ><small>{{ formatAU(body.au) }}</small></span
            >
          </button>
        </nav>
      </div>
      <nav id="deepDestinations" :hidden="ui.group === '太阳系'" :aria-label="ui.group + '天体'">
        <button
          v-for="entry in deepEntries"
          :key="entry.id"
          :data-entry="entry.id"
          :aria-label="'三维观测 ' + entry.title"
          :aria-pressed="ui.deepEntry === entry"
          @click="atlas.openDeepTarget(entry)"
        >
          <img :src="entry.photo" alt="" /><span class="deep-name"
            ><b>{{ entry.title }}</b
            ><small>{{ entry.code.split(' · ')[0] }}</small></span
          >
        </button>
      </nav>
    </div>
  </div>
</template>
