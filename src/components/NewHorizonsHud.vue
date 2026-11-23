<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Atlas } from '../scene/atlas'
import type { ArchiveEntry, SceneUI, VoyagerMode } from '../scene/types'
import {
  NH_END_YEAR,
  NH_START_YEAR,
  formatCaOffset,
  newHorizonsEncounters,
  newHorizonsMilestones,
  newHorizonsSpiceSource,
  newHorizonsViews,
  nhMilestoneBadge,
  nhMilestoneBody,
  nhMilestoneShort,
  nhMilestoneTitle,
} from '../data/newHorizons'
import { formatLightTime, missionName } from '../data/voyager'
import { formatNum, isEn, locale, pick } from '../i18n'

const { atlas, ui } = defineProps<{
  atlas: Atlas
  ui: SceneUI
}>()
const emit = defineEmits<{ 'open-archive': [entry: ArchiveEntry] }>()

const collapsed = ref(false)
const speeds = [0.25, 0.5, 1, 2, 5] as const
const voyagerModes: VoyagerMode[] = ['v1', 'v2', 'both']
const panel = ref<HTMLElement | null>(null)
onMounted(() => atlas.setNewHorizonsPanel(panel.value))
onBeforeUnmount(() => atlas.setNewHorizonsPanel(null))

const stats = computed(() => ui.newHorizonsStats)
const atEnd = computed(() => ui.newHorizonsYear >= NH_END_YEAR - 1e-5)
const activeMilestone = computed(
  () => newHorizonsMilestones.find((m) => m.id === ui.newHorizonsMilestone) ?? newHorizonsMilestones[0],
)
const activeEncounterMeta = computed(() =>
  stats.value.activeEncounter ? newHorizonsEncounters[stats.value.activeEncounter] : null,
)
const highlightGold = computed(
  () => !!activeEncounterMeta.value || activeMilestone.value.id === 'fiftyAU',
)

const photoEntry = computed(() => {
  const id = activeEncounterMeta.value?.bodyId ?? activeMilestone.value.photoBodyId ?? null
  return id ? atlas.entries.find((entry) => entry.id === id && entry.probePhotos?.length) : undefined
})

function milestonePct(year: number) {
  return ((year - NH_START_YEAR) / (NH_END_YEAR - NH_START_YEAR)) * 100
}
const progressPct = computed(() => milestonePct(ui.newHorizonsYear))

function latitude(deg: number) {
  return (deg < 0 ? '−' : '+') + Math.abs(deg).toFixed(1) + '°'
}

const distanceEarthText = computed(() => {
  const bKm = stats.value.earthBillionKm
  if (isEn.value) {
    return bKm >= 1 ? `${bKm.toFixed(2)}B km` : `${Math.round(bKm * 1000)}M km`
  }
  const yiKm = bKm * 10
  return yiKm >= 1 ? `${yiKm.toFixed(1)} 亿 km` : `${Math.round(yiKm * 10000)} 万 km`
})

const targetDistanceText = computed(() => {
  const km = stats.value.targetDistanceKm
  if (km === null) return ''
  if (km >= 1_000_000) {
    return isEn.value ? `${(km / 1e6).toFixed(2)}M km` : `${(km / 1e4).toFixed(1)} 万 km`
  }
  return `${formatNum(Math.round(km), locale.value)} km`
})

const badgeText = computed(() => nhMilestoneBadge(activeMilestone.value, locale.value))

function onScrub(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(val)) atlas.setNewHorizonsYear(val, true)
}

function toggleFlight() {
  atlas.setPlaying(!ui.playing)
}
</script>

<template>
  <section
    ref="panel"
    id="newHorizonsHUD"
    :class="{ collapsed }"
    :aria-label="pick('新视野号飞行轨道控制台', 'New Horizons flight console')"
  >
    <div class="voy-modes" role="group" :aria-label="pick('任务模式', 'Mission mode')">
      <button
        v-for="mode in voyagerModes"
        :key="mode"
        :data-mode="mode"
        :aria-pressed="false"
        @click="atlas.openVoyager(undefined, mode)"
      >
        {{ missionName(mode, locale) }}
      </button>
      <button id="newHorizonsOpen" aria-pressed="true">
        {{ pick('新视野号', 'New Horizons') }}
      </button>
    </div>

    <div class="voy-head">
      <div class="voy-head-main">
        <div class="voy-kicker">
          <span class="voy-dot" :class="{ reached: highlightGold }" aria-hidden="true"></span>
          <span>NEW HORIZONS // 2006–2026</span>
          <span v-if="badgeText" class="voy-badge">{{ badgeText }}</span>
        </div>
        <h2 class="voy-title">{{ nhMilestoneTitle(activeMilestone, locale) }}</h2>
      </div>
      <button
        class="voy-collapse"
        :aria-expanded="!collapsed"
        :title="collapsed ? pick('展开控制台', 'Expand panel') : pick('收起控制台', 'Collapse panel')"
        :aria-label="collapsed ? pick('展开控制台', 'Expand panel') : pick('收起控制台', 'Collapse panel')"
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
      <div class="voy-metric" :class="{ 'is-gold': activeMilestone.id === 'fiftyAU' }">
        <span>{{ pick('地球单程光时', 'Light time') }}</span>
        <strong>{{ formatLightTime(stats.lightHours, locale) }}</strong>
        <small>{{ stats.earthAU.toFixed(2) }} AU</small>
      </div>
      <div v-if="activeEncounterMeta && stats.targetDistanceKm !== null" class="voy-metric is-gold">
        <span>{{ isEn ? `To ${activeEncounterMeta.en}` : `距${activeEncounterMeta.zh}中心` }}</span>
        <strong>{{ targetDistanceText }}</strong>
        <small>{{ stats.caDeltaSec !== null ? formatCaOffset(stats.caDeltaSec) : 'CA' }}</small>
      </div>
      <div v-else class="voy-metric">
        <span>{{ pick('距地球', 'From Earth') }}</span>
        <strong>{{ distanceEarthText }}</strong>
        <small>{{ stats.earthAU.toFixed(1) }} AU</small>
      </div>
      <div class="voy-metric">
        <span>{{ pick('距太阳', 'From Sun') }}</span>
        <strong>{{ stats.sunAU.toFixed(2) }} AU</strong>
        <small>{{ pick('黄纬', 'Lat') }} {{ latitude(stats.latDeg) }}</small>
      </div>
      <div class="voy-metric">
        <span>{{ pick('日心速度', 'Helio Speed') }}</span>
        <strong>{{ stats.speedKmS.toFixed(1) }}</strong>
        <small v-if="stats.targetSpeedKmS !== null">
          {{ pick('相对', 'Rel') }} {{ stats.targetSpeedKmS.toFixed(1) }}
        </small>
        <small v-else>km/s</small>
      </div>
    </div>

    <div class="voy-timeline">
      <button
        class="voy-play"
        :title="
          ui.playing
            ? pick('暂停飞行演进', 'Pause flight')
            : atEnd
              ? pick('从 2006 年地球发射重播全程', 'Replay full flight from 2006')
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
        <div
          class="voy-track-fill"
          :style="{ transform: `scaleX(${Math.max(0, Math.min(1, progressPct / 100))})` }"
        ></div>
        <div class="voy-ticks" aria-hidden="true">
          <span
            v-for="m in newHorizonsMilestones"
            :key="m.id"
            class="voy-tick"
            :class="{ passed: ui.newHorizonsYear >= m.year - 1e-4, active: activeMilestone.id === m.id }"
            :style="{ left: milestonePct(m.year) + '%' }"
          ></span>
        </div>
        <input
          class="voy-range"
          type="range"
          :min="NH_START_YEAR"
          :max="NH_END_YEAR"
          step="any"
          :value="ui.newHorizonsYear"
          :aria-label="pick('新视野号飞行时间轴', 'New Horizons flight timeline')"
          @input="onScrub"
        />
      </div>

      <code class="voy-date">{{ activeEncounterMeta ? stats.dateTimeLabel : stats.dateLabel }}</code>
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
      <span v-if="activeEncounterMeta" class="voy-assist-hint">
        {{
          activeEncounterMeta.id === 'jupiter'
            ? pick('木星引力借力窗口', 'Jupiter assist')
            : activeEncounterMeta.id === 'pluto'
              ? pick('冥王星飞掠窗口', 'Pluto flyby')
              : pick('阿罗科斯飞掠窗口', 'Arrokoth flyby')
        }}
      </span>
      <span v-else-if="stats.isPostArchive" class="nh-ext-hint">
        {{ pick('太阳引力弹道递推', 'Ballistic cruise') }}
      </span>
    </div>

    <div v-if="!collapsed" class="voy-body">
      <div class="voy-milestones" role="group" :aria-label="pick('任务里程碑', 'Mission milestones')">
        <button
          v-for="m in newHorizonsMilestones"
          :key="m.id"
          class="voy-ms-btn"
          :class="{ 'is-1ld': m.id === 'pluto' || m.id === 'arrokoth' }"
          :data-nh-event="m.id"
          :aria-pressed="ui.newHorizonsMilestone === m.id"
          @click="atlas.jumpNewHorizonsMilestone(m.id)"
        >
          <span>{{ nhMilestoneShort(m, locale) }}</span>
          <small>{{ m.dateZh.slice(0, 4) }}</small>
        </button>
      </div>

      <p class="voy-desc">
        {{ nhMilestoneBody(activeMilestone, locale) }}
        <button
          v-if="photoEntry"
          class="voy-triton"
          @click="emit('open-archive', photoEntry)"
        >
          {{ pick('查看飞掠实拍', 'Flyby photos') }} ↗
        </button>
        <a :href="activeMilestone.source" target="_blank" rel="noopener">NASA ↗</a>
        <a :href="newHorizonsSpiceSource" target="_blank" rel="noopener">SPICE ↗</a>
      </p>

      <div class="voy-views" role="group" :aria-label="pick('观察视角', 'Camera views')">
        <button
          v-for="v in newHorizonsViews"
          :key="v.id"
          class="voy-view-btn"
          :aria-pressed="ui.newHorizonsView === v.id"
          @click="atlas.setNewHorizonsView(v.id)"
        >
          {{ pick(v.zh, v.en) }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nh-ext-hint {
  font: 500 10px / 1 var(--mono);
  color: rgba(134, 226, 255, 0.72);
  padding: 3px 6px;
  border-radius: 5px;
  border: 1px solid rgba(114, 206, 255, 0.22);
  background: rgba(14, 34, 58, 0.52);
  white-space: nowrap;
}
.voy-desc a + a {
  margin-left: 6px;
}
</style>
