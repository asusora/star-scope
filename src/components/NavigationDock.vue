<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { Atlas } from '../scene/atlas'
import { deepGroups, type SceneUI, type Group, type OrbitMode } from '../scene/types'
import { thumbs } from '../data/assets'
const { atlas, ui } = defineProps<{ atlas: Atlas; ui: SceneUI }>()
const groups: Group[] = ['太阳系', ...deepGroups]
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
      <i aria-hidden="true"></i><span>{{ ui.dockOpen ? '收起导航' : '天体导航' }}</span>
    </button>
    <div id="tray" ref="tray" :inert="!ui.dockOpen">
      <div class="controlbar">
        <div class="transport">
          <button
            id="play"
            :aria-label="ui.playing ? '暂停动画' : '播放动画'"
            @click="atlas.setPlaying(!ui.playing)"
          >
            <i :class="ui.playing ? 'pause-symbol' : 'play-symbol'"></i
            ><span>{{ ui.playing ? '暂停' : '播放' }}</span>
          </button>
          <label
            >速度
            <select
              id="speed"
              :value="ui.speed"
              aria-label="动画速度"
              @change="atlas.setSpeed(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="n in [0.25, 0.5, 1, 2, 5]" :key="n" :value="n">{{ n }}×</option>
            </select></label
          >
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
            <i></i>名称
          </button>
        </div>
      </div>
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
      <div id="solarDestinations" :hidden="ui.group !== '太阳系'">
        <nav id="destinations" aria-label="太阳系天体">
          <button
            class="destination"
            id="home"
            :aria-pressed="!ui.deepEntry && !ui.galaxy && !ui.planet"
            @click="atlas.openPlanet(null)"
          >
            <span class="home-orbit" aria-hidden="true">☉</span
            ><span><b>全景</b><small>Overview</small></span>
          </button>
          <button
            v-for="planet in atlas.planets"
            :key="planet.id"
            class="destination"
            :data-planet="planet.id"
            :aria-label="planet.name + '，' + planet.moons.length + ' 颗卫星'"
            :aria-pressed="!ui.deepEntry && planet === ui.planet"
            @click="atlas.openPlanet(planet)"
          >
            <img :src="thumbs[planet.id]" alt="" /><span
              ><b>{{ planet.name }}</b
              ><small>{{ planet.id }}</small></span
            >
          </button>
        </nav>
        <div class="belt-links">
          <button id="mainBelt" @click="atlas.openRegion('main')">小行星带 ›</button
          ><button id="outerBelt" @click="atlas.openRegion('outer')">外太阳系 · 矮行星 ›</button>
        </div>
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
