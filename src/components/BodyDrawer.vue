<script setup lang="ts">
import { computed } from 'vue'
import type { Atlas } from '../scene/atlas'
import type { ArchiveEntry, Moon, SceneUI, World } from '../scene/types'
import { normalized } from '../data/archive'
import { localizedEntry } from '../i18n/archiveLocale'
import { formatNum, isEn, pick, regionDrawerTitle } from '../i18n'
import {
  moonDiscovered,
  moonLabel,
  moonNumberName,
  moonOtherNames,
  worldKind,
  worldName,
} from '../i18n/catalogEn'

const gasGiants = ['Jupiter', 'Saturn', 'Uranus', 'Neptune']
const { ui, atlas, currentEntry } = defineProps<{
  ui: SceneUI
  atlas: Atlas
  currentEntry?: ArchiveEntry | null
}>()
const emit = defineEmits<{ openArchive: [entry: ArchiveEntry] }>()
const cometFact = computed(() => currentEntry?.comet ? localizedEntry(currentEntry).facts[0] : null)
const cometActivityLabel = computed(() => {
  const a = ui.cometActivity
  if (a >= 75) return pick('近日爆发', 'Peak Outgassing')
  if (a >= 38) return pick('活跃喷发', 'Active Jets')
  if (a >= 16) return pick('温和升华', 'Sublimating')
  return pick('远日休眠', 'Quiescent')
})
const smallBodies = computed(() => atlas.smallBodies.filter((p) => p.region === ui.region))
const moons = computed(() => {
  const q = normalized(ui.search)
  return (
    ui.planet?.moons.filter((m) => m.searchNames.some((key) => normalized(key).includes(q))) ?? []
  )
})
const title = computed(() => {
  if (ui.region) return regionDrawerTitle(ui.region)
  if (!ui.planet) return ''
  return isEn.value ? `${worldName(ui.planet, 'en')} Moons` : ui.planet.name + '卫星'
})
function bodySubtitle(p: World) {
  const au = p.au ? (p.au >= 100 ? Math.round(p.au) : p.au.toFixed(1)) + ' AU' : p.id
  return `${worldKind(p)} · ${au}`
}
function moonRowSub(m: Moon) {
  if (isEn.value) {
    const num = moonNumberName(m, 'en')
    return [num, m.des].filter((s) => s && s !== m.name).join(' · ') || (m.year ? String(m.year) : '')
  }
  return (
    [m.label === m.name ? '' : m.name, m.numberName].filter(Boolean).join(' · ') || (m.year ?? '')
  )
}
const landLabel = computed(() => {
  if (!ui.moon && gasGiants.includes(ui.planet?.id ?? '')) {
    return pick('进入云层', 'Enter Clouds')
  }
  const target = ui.moon
    ? moonLabel(ui.moon)
    : ui.planet
      ? worldName(ui.planet)
      : pick('火星', 'Mars')
  return isEn.value ? `Land on ${target}` : '着陆' + target
})
const returnLabel = computed(() => {
  if (ui.deepEntry) return pick('返回原视图', 'Back')
  if (ui.moon) {
    const pName = ui.planet ? worldName(ui.planet) : ''
    return isEn.value ? `Back to ${pName}` : '返回' + pName
  }
  return pick('太阳系全景', 'Solar Overview')
})
</script>
<template>
  <section v-if="ui.comet && !ui.deepEntry && !ui.dockOpen && !ui.notesOpen" class="comet-motion" :aria-label="pick('跟随观测', 'Tracking view')">
    <p v-if="cometFact" class="comet-fact">{{ cometFact[0] }} · {{ cometFact[1] }}</p>
    <div class="comet-telemetry">
      <span>{{ pick('模拟日距', 'Solar distance') }}</span>
      <strong>{{ ui.cometDistanceAU.toFixed(2) }} AU</strong>
    </div>
    <div class="comet-telemetry">
      <span>{{ pick('轨道速率', 'Orbital speed') }}</span>
      <strong>{{ ui.cometSpeedKmS.toFixed(1) }} km/s</strong>
    </div>
    <div class="comet-telemetry">
      <span>{{ pick('喷发活性', 'Outgassing') }} · {{ cometActivityLabel }}</span>
      <span class="comet-activity-bar" aria-hidden="true">
        <i :style="{ width: ui.cometActivity + '%' }" />
      </span>
    </div>
    <div class="comet-controls">
      <span class="comet-dir" :class="{ inbound: ui.cometInbound }">
        {{ ui.cometInbound ? pick('接近太阳', 'Inbound') : pick('远离太阳', 'Outbound') }}
      </span>
      <span class="comet-btn-group">
        <button type="button" id="cometPerihelion" @click="atlas.seekCometPerihelion()">
          {{ pick('近日点', 'Perihelion') }}
        </button>
        <button type="button" id="cometPlayback" @click="atlas.setPlaying(!ui.playing)">
          {{ ui.playing ? pick('暂停', 'Pause') : pick('播放', 'Play') }}
        </button>
      </span>
    </div>
  </section>
  <div class="stage-actions">
    <span v-if="ui.comet && !ui.deepEntry" class="comet-tracking-title">{{ ui.title }}</span>
    <button
      v-if="!ui.galaxy && !ui.voyager && !ui.phenomena && !ui.deepEntry"
      id="cometsToggle"
      type="button"
      :aria-pressed="ui.showComets"
      @click="atlas.setShowComets(!ui.showComets)"
    >
      <span>{{ pick('彗星', 'Comets') }}</span>
      <span class="orbit-toggle-state" aria-hidden="true">{{ ui.showComets ? pick('开', 'On') : pick('关', 'Off') }}</span>
    </button>
    <button
      v-if="ui.showComets && !ui.galaxy && !ui.voyager && !ui.phenomena && !ui.deepEntry"
      id="cometOrbitsToggle"
      type="button"
      :aria-pressed="ui.cometOrbits"
      @click="atlas.setCometOrbits(!ui.cometOrbits)"
    >
      <span>{{ pick('彗星轨道', 'Comet Orbits') }}</span>
      <span class="orbit-toggle-state" aria-hidden="true">{{ ui.cometOrbits ? pick('开', 'On') : pick('关', 'Off') }}</span>
    </button>
    <button id="land" v-if="!ui.galaxy && !ui.deepEntry && !ui.region && !ui.voyager && !ui.phenomena && !ui.comet" @click="atlas.land()">
      <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 2v7.2M4.3 6.7L7 9.4l2.7-2.7M2.6 11.6h8.8"
          stroke="currentColor"
          stroke-width="1.35"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{{ landLabel }}</span>
    </button>
    <button
      id="bodyArchive"
      v-if="currentEntry"
      :class="{ 'has-probe': !!currentEntry.probePhotos?.length }"
      @click="emit('openArchive', currentEntry)"
    >
      <svg
        v-if="currentEntry.probePhotos?.length"
        class="ui-ico-sm"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <rect x="1.8" y="3.3" width="10.4" height="7.9" rx="1.6" stroke="currentColor" stroke-width="1.25" />
        <circle cx="7" cy="7.2" r="2.1" stroke="currentColor" stroke-width="1.2" />
        <path d="M4.8 3.3l.7-1.2h3l.7 1.2" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
      <svg v-else class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <rect x="2.2" y="2.2" width="9.6" height="9.6" rx="1.6" stroke="currentColor" stroke-width="1.25" />
        <path d="M4.5 5.4h5M4.5 7.8h3.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
      <span>{{
        currentEntry.comet ? pick('科普资料', 'Comet Guide') : currentEntry.probePhotos?.length
          ? pick('实拍与资料', 'Photos & Info')
          : pick('天体资料', 'Profile')
      }}</span>
      <span v-if="currentEntry.probePhotos?.length" class="probe-count">
        {{ currentEntry.probePhotos.length }}
      </span>
    </button>
    <button id="return" :hidden="!ui.deepEntry && !ui.planet && !ui.region && !ui.voyager && !ui.phenomena && !ui.comet" @click="atlas.goBack()">
      <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M8.8 3.2L5 7l3.8 3.8"
          stroke="currentColor"
          stroke-width="1.45"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{{ returnLabel }}</span></button
    ><button
      id="catalogButton"
      :hidden="!!ui.deepEntry || (!ui.planet && !ui.region)"
      :aria-expanded="ui.drawerOpen"
      aria-controls="drawer"
      @click="atlas.drawer(!ui.drawerOpen)"
    >
      <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="2.2" stroke="currentColor" stroke-width="1.25" />
        <circle cx="7" cy="7" r="5.3" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 2" />
        <circle cx="11.3" cy="4.2" r="1.1" fill="currentColor" />
      </svg>
      <span id="catalogType">{{
        ui.region ? pick('区域天体', 'Region') : pick('卫星目录', 'Moons')
      }}</span>
      <span id="count">{{ ui.planet?.moons.length ?? smallBodies.length }}</span>
    </button>
  </div>
  <aside id="drawer" :hidden="!ui.drawerOpen" :aria-label="title">
    <div class="drawer-kicker">
      {{
        ui.region
          ? pick('REGION // 区域名录', 'REGION // MINOR BODIES')
          : pick('ORBITAL CATALOG // 卫星', 'ORBITAL CATALOG // MOONS')
      }}
    </div>
    <div class="drawer-head">
      <strong id="drawerTitle">{{ title }}</strong
      ><button
        id="closeDrawer"
        :aria-label="
          ui.region
            ? pick('关闭区域名录', 'Close Region Catalog')
            : pick('关闭卫星目录', 'Close Moon Catalog')
        "
        @click="atlas.drawer(false)"
      >
        <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="search-field" :hidden="!ui.planet?.moons.length">
      <svg class="search-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7.2" cy="7.2" r="4.6" stroke="currentColor" stroke-width="1.35" />
        <path d="M10.7 10.7L13.5 13.5" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
      </svg>
      <input
        id="search"
        type="search"
        v-model="ui.search"
        @input="atlas.preview(null)"
        :placeholder="pick('搜索名称或临时编号', 'Search name or designation')"
        :aria-label="pick('搜索卫星', 'Search moons')"
      />
    </div>
    <div id="moonList" @pointerleave="atlas.preview(null)" @focusout="atlas.preview(null)">
      <template v-if="ui.region"
        ><button
          v-for="p in smallBodies"
          class="moon-row"
          :key="p.id"
          :data-body="p.id"
          @pointerover="$event.pointerType === 'mouse' && atlas.preview(p)"
          @focus="atlas.preview(p)"
          @click="atlas.openPlanet(p)"
        >
          <span>{{ worldName(p) }}</span
          ><small>{{ bodySubtitle(p) }}</small>
        </button></template
      >
      <template v-else
        ><button
          v-for="m in moons"
          class="moon-row"
          :key="m.index"
          :data-index="m.index"
          :aria-pressed="m === ui.moon"
          @pointerover="$event.pointerType === 'mouse' && atlas.preview(m)"
          @focus="atlas.preview(m)"
          @click="atlas.openMoon(m)"
        >
          <span>{{ moonLabel(m) }}</span
          ><small>{{ moonRowSub(m) }}</small>
        </button>
        <p v-if="!moons.length" class="empty">
          {{
            ui.planet?.moons.length
              ? pick('没有匹配的卫星。', 'No matching moons.')
              : pick('该天体目前没有已知天然卫星。', 'No known natural satellites.')
          }}
        </p></template
      >
    </div>
    <div id="detail" aria-live="polite" :hidden="!ui.moon">
      <template v-if="ui.moon">
        <b>{{ [moonLabel(ui.moon), ...moonOtherNames(ui.moon)].join(' · ') }}</b>
        <div class="detail-row">
          <span>{{
            ui.moon.estimate
              ? pick('观测距离', 'Observed Distance')
              : pick('轨道半长轴', 'Semi-Major Axis')
          }}</span>
          <code>{{ formatNum(ui.moon.a) }} km</code>
        </div>
        <div class="detail-row">
          <span>{{ pick('公转周期', 'Orbital Period') }}</span>
          <code>{{
            ui.moon.period
              ? ui.moon.period + pick(' 天', ' d')
              : pick('JPL 未列出', 'Not listed')
          }}</code>
        </div>
        <div class="detail-row">
          <span>{{ pick('发现年份', 'Discovered') }}</span>
          <code>{{ moonDiscovered(ui.moon) }}</code>
        </div>
        <button
          v-if="currentEntry && currentEntry.moon === ui.moon"
          class="detail-archive-btn"
          @click="emit('openArchive', currentEntry)"
        >
          <span>{{
            currentEntry.probePhotos?.length
              ? isEn
                ? `View Spacecraft Photos (${currentEntry.probePhotos.length})`
                : `查看探测器实拍与档案 (${currentEntry.probePhotos.length})`
              : pick('查看卫星档案', 'View Moon Profile')
          }}</span>
        </button>
      </template>
    </div>
  </aside>
</template>
