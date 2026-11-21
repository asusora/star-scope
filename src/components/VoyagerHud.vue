<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import type { Atlas } from '../scene/atlas'
import type { SceneUI, VoyagerMode } from '../scene/types'
import {
  LIGHT_DAY_AU,
  VOYAGER_END_YEAR,
  missionStart,
  missionName,
  missionMilestones,
  voyagerIds,
  formatLightTime,
  milestoneBody,
  milestoneShort,
  milestoneTitle,
  voyagerViews,
} from '../data/voyager'
import { tritonEncounter } from '../data/voyagerNeptune'
import { isEn, locale, pick } from '../i18n'

const { atlas, ui } = defineProps<{ atlas: Atlas; ui: SceneUI }>()
const collapsed = ref(false)
const speeds = [0.25, 0.5, 1, 2, 5] as const
const panel = ref<HTMLElement | null>(null)
onMounted(() => atlas.setVoyagerPanel(panel.value))
onBeforeUnmount(() => atlas.setVoyagerPanel(null))
const modes: VoyagerMode[] = ['v1', 'v2', 'both']
const milestones = computed(() => missionMilestones(ui.voyagerFocus))
const timelineEvents = computed(() => ui.voyagerMode === 'both'
  ? [...missionMilestones('v1'), ...missionMilestones('v2')] : milestones.value)
const inGravityAssist = computed(() => timelineEvents.value.some(m =>
  m.focusPlanetId && m.id !== 'launch' && Math.abs(m.year - ui.voyagerYear) < 0.28))
const start = computed(() => missionStart(ui.voyagerMode))
const progressPct = computed(() => milestonePct(ui.voyagerYear))
const atEnd = computed(() => ui.voyagerYear >= VOYAGER_END_YEAR)
const activeMilestone = computed(() =>
  milestones.value.find(m => m.id === ui.voyagerMilestone) ?? milestones.value[0])
const views = computed(() => voyagerViews.map(v => {
  if (ui.voyagerMode !== 'v1' && v.id === 'flyby') return { ...v, zh: '四星大巡游', en: 'Grand Tour' }
  if (v.id === 'climb' && ui.voyagerMode === 'both') return { ...v, zh: '南北侧视', en: 'Side View' }
  if (v.id === 'climb' && ui.voyagerMode === 'v2') return { ...v, zh: '−48° 下潜', en: '−48° Dive' }
  return v
}))
function latitude(deg: number) {
  return (deg < 0 ? '−' : '+') + Math.abs(deg).toFixed(1) + '°'
}
const comparison = computed(() => voyagerIds.map(id => ({
  id, stats: id === ui.voyagerFocus ? ui.voyagerStats : ui.voyagerPeerStats,
})))

const lightDays = computed(() => ui.voyagerStats.earthAU / LIGHT_DAY_AU)
const reachedOneLightDay = computed(() => ui.voyagerFocus === 'v1' && activeMilestone.value.id === 'oneLightDay')

const distanceEarthText = computed(() => {
  const bKm = ui.voyagerStats.earthBillionKm
  if (isEn.value) {
    return bKm >= 1 ? `${bKm.toFixed(2)}B km` : `${Math.round(bKm * 1000)}M km`
  }
  const yiKm = bKm * 10
  return yiKm >= 1 ? `${yiKm.toFixed(1)} 亿 km` : `${Math.round(yiKm * 10000)} 万 km`
})

function milestonePct(year: number) {
  return ((year - start.value) / (VOYAGER_END_YEAR - start.value)) * 100
}

function onScrub(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(val)) atlas.setVoyagerYear(val, true)
}

function toggleFlight() {
  atlas.setPlaying(!ui.playing)
}
</script>

<template>
  <section
    ref="panel"
    id="voyagerHUD"
    :class="{ collapsed }"
    :aria-label="pick('旅行者飞行轨道控制台', 'Voyager flight console')"
  >
    <div class="voy-modes" role="group" :aria-label="pick('任务模式', 'Mission mode')">
      <button v-for="mode in modes" :key="mode" :data-mode="mode" :aria-pressed="ui.voyagerMode === mode"
        @click="atlas.setVoyagerMode(mode)">{{ missionName(mode, locale) }}</button>
    </div>
    <div v-if="ui.voyagerMode === 'both'" class="voy-compare" role="group" :aria-label="pick('跟踪探测器', 'Tracked spacecraft')">
      <button v-for="{ id, stats } in comparison" :key="id" :disabled="!stats" :aria-pressed="ui.voyagerFocus === id"
        :class="id" @click="atlas.setVoyagerFocus(id)">
        <b>{{ id.toUpperCase() }}</b>
        <span>{{ stats ? stats.sunAU.toFixed(1) + ' AU · ' + latitude(stats.latDeg) : pick('等待发射', 'Pre-launch') }}</span>
      </button>
    </div>
    <div class="voy-head">
      <div class="voy-head-main">
        <div class="voy-kicker">
          <span class="voy-dot" :class="{ reached: reachedOneLightDay }" aria-hidden="true"></span>
          <span>VOYAGER {{ ui.voyagerFocus === 'v1' ? '1' : '2' }} // 1977–2026</span>
          <span v-if="reachedOneLightDay" class="voy-badge">
            {{ pick('1 光日达成', '1 LIGHT-DAY') }}
          </span>
        </div>
        <h2 class="voy-title">{{ milestoneTitle(activeMilestone, locale) }}</h2>
      </div>
      <button
        class="voy-collapse"
        :aria-expanded="!collapsed"
        :title="collapsed ? pick('展开控制台', 'Expand panel') : pick('收起控制台', 'Collapse panel')"
        :aria-label="
          collapsed ? pick('展开控制台', 'Expand panel') : pick('收起控制台', 'Collapse panel')
        "
        @click="collapsed = !collapsed"
      >
        <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            :d="collapsed ? 'M3.2 8.8L7 5l3.8 3.8' : 'M3.2 5.2L7 9l3.8-3.8'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <div class="voy-telemetry" aria-live="polite">
      <div class="voy-metric" :class="{ 'is-gold': reachedOneLightDay }">
        <span>{{ pick('地球单程光时', 'Light time') }}</span>
        <strong>{{ formatLightTime(ui.voyagerStats.lightHours, locale) }}</strong>
        <small>{{
          isEn ? `${lightDays.toFixed(2)} light-day` : `${lightDays.toFixed(2)} 光日`
        }}</small>
      </div>
      <div class="voy-metric">
        <span>{{ pick('距地球', 'From Earth') }}</span>
        <strong>{{ distanceEarthText }}</strong>
        <small>{{ ui.voyagerStats.earthAU.toFixed(1) }} AU</small>
      </div>
      <div class="voy-metric">
        <span>{{ pick('距太阳', 'From Sun') }}</span>
        <strong>{{ ui.voyagerStats.sunAU.toFixed(1) }} AU</strong>
        <small>{{
          (ui.voyagerFocus === 'v2' && ui.voyagerYear > tritonEncounter ? pick('示意', 'Model') : pick('黄纬', 'Lat')) + ' ' + latitude(ui.voyagerStats.latDeg)
        }}</small>
      </div>
      <div class="voy-metric">
        <span>{{ pick('日心速度', 'Helio Speed') }}</span>
        <strong>{{ ui.voyagerStats.speedKmS.toFixed(1) }}</strong>
        <small>km/s</small>
      </div>
    </div>

    <div class="voy-timeline">
      <button
        class="voy-play"
        :title="
          ui.playing
            ? pick('暂停飞行演进', 'Pause flight')
            : atEnd
              ? pick('从 1977 年地球发射重播全程', 'Replay full flight from 1977')
              : pick('继续飞行演进', 'Play flight')
        "
        :aria-label="
          ui.playing
            ? pick('暂停飞行演进', 'Pause flight')
            : atEnd
              ? pick('重播全程', 'Replay flight')
              : pick('播放飞行演进', 'Play flight')
        "
        @click="toggleFlight"
      >
        <svg v-if="ui.playing" class="ui-ico-sm" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <rect x="3" y="2.4" width="2.8" height="9.2" rx="0.9" />
          <rect x="8.2" y="2.4" width="2.8" height="9.2" rx="0.9" />
        </svg>
        <svg v-else-if="atEnd" class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2.8 7a4.2 4.2 0 1 0 1.2-3M2.8 2.6v2.2H5"
            stroke="currentColor"
            stroke-width="1.45"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else class="ui-ico-sm" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <path d="M3.5 2.4l8 4.6-8 4.6V2.4z" />
        </svg>
      </button>

      <div class="voy-slider-wrap">
        <div class="voy-track-fill" :style="{ width: progressPct + '%' }"></div>
        <div class="voy-ticks" aria-hidden="true">
          <span
            v-for="m in timelineEvents"
            :key="m.year"
            class="voy-tick"
            :class="{ passed: ui.voyagerYear >= m.year, active: activeMilestone === m }"
            :style="{ left: milestonePct(m.year) + '%' }"
          ></span>
        </div>
        <input
          class="voy-range"
          type="range"
          :min="start"
          :max="VOYAGER_END_YEAR"
          step="any"
          :value="ui.voyagerYear"
          :aria-label="pick('旅行者飞行时间轴', 'Voyager flight timeline')"
          @input="onScrub"
        />
      </div>

      <code class="voy-date">{{ ui.voyagerStats.dateLabel }}</code>
    </div>

    <div class="voy-speed-row">
      <div class="voy-speed-pills" role="group" :aria-label="pick('飞行播放速率', 'Flight playback speed')">
        <span class="voy-speed-label">{{ pick('倍速', 'Speed') }}</span>
        <button
          v-for="n in speeds"
          :key="n"
          class="voy-speed-btn"
          :aria-pressed="ui.speed === n"
          @click="atlas.setSpeed(n)"
        >
          {{ n }}×
        </button>
      </div>
      <span v-if="inGravityAssist" class="voy-assist-hint">
        {{ pick('引力借力窗口', 'Gravity assist') }}
      </span>
    </div>

    <div v-if="!collapsed" class="voy-body">
      <div class="voy-milestones" role="group" :aria-label="pick('任务里程碑', 'Mission milestones')">
        <button
          v-for="m in milestones"
          :key="m.id"
          class="voy-ms-btn"
          :class="{ 'is-1ld': m.id === 'oneLightDay' }"
          :aria-pressed="ui.voyagerMilestone === m.id"
          @click="atlas.jumpVoyagerMilestone(m.id)"
        >
          <span>{{ milestoneShort(m, locale) }}</span>
          <small>{{ Math.floor(m.year) }}</small>
        </button>
      </div>

      <p class="voy-desc">
        {{ milestoneBody(activeMilestone, locale) }}
        <button v-if="activeMilestone.id === 'neptune'" class="voy-triton"
          @click="atlas.jumpVoyagerMilestone('neptune'); atlas.setVoyagerYear(tritonEncounter, true)">
          {{ pick('定位海卫一飞掠', 'Track Triton flyby') }} ↗
        </button>
        <a :href="activeMilestone.source" target="_blank" rel="noopener">{{ activeMilestone.id === 'cruise' ? 'JPL' : 'NASA' }} ↗</a>
      </p>

      <div class="voy-views" role="group" :aria-label="pick('观察视角', 'Camera views')">
        <button
          v-for="v in views"
          :key="v.id"
          class="voy-view-btn"
          :aria-pressed="ui.voyagerView === v.id"
          @click="atlas.setVoyagerView(v.id)"
        >
          {{ pick(v.zh, v.en) }}
        </button>
      </div>
    </div>
  </section>
</template>
