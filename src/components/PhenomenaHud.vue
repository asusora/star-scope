<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Atlas } from '../scene/atlas'
import type { SceneUI } from '../scene/types'
import {
  getPhenomenon,
  phenomenaList,
  phenomenonMilestoneBody,
  phenomenonMilestoneShort,
  phenomenonMilestoneTitle,
  phenomenonShort,
} from '../data/phenomena'
import { locale, pick } from '../i18n'

const { atlas, ui } = defineProps<{ atlas: Atlas; ui: SceneUI }>()
const collapsed = ref(false)
const speeds = [0.25, 0.5, 1, 2, 5] as const
const panel = ref<HTMLElement | null>(null)

onMounted(() => atlas.setPhenomenaPanel(panel.value))
onBeforeUnmount(() => atlas.setPhenomenaPanel(null))

const current = computed(() => getPhenomenon(ui.phenomenonId))
const activeMilestone = computed(
  () => current.value.milestones.find((m) => m.id === ui.phenomenonMilestone) ?? current.value.milestones[0],
)
const atEnd = computed(() => ui.phenomenonYear >= current.value.endYear - 1e-5)

function yearPct(year: number) {
  const { startYear, endYear } = current.value
  const pct = ((year - startYear) / Math.max(1e-6, endYear - startYear)) * 100
  return Math.max(0, Math.min(100, pct))
}

const progressPct = computed(() => yearPct(ui.phenomenonYear))

function onScrub(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(val)) atlas.setPhenomenaYear(val, true)
}

function togglePlayback() {
  atlas.setPlaying(!ui.playing)
}

function sourceLabel(url: string) {
  if (url.includes('esahubble.org')) return 'Hubble'
  if (url.includes('jpl.nasa.gov')) return 'JPL'
  return 'NASA'
}
</script>

<template>
  <section
    ref="panel"
    id="phenomenaHUD"
    :class="{ collapsed }"
    :aria-label="pick('宇宙罕见现象实时演算台', 'Rare Cosmic Phenomena console')"
  >
    <div class="phen-tabs" role="group" :aria-label="pick('选择罕见天象', 'Select cosmic phenomenon')">
      <button
        v-for="item in phenomenaList"
        :key="item.id"
        :data-phenomenon="item.id"
        :aria-pressed="ui.phenomenonId === item.id"
        @click="atlas.setPhenomenon(item.id)"
      >
        <span>{{ phenomenonShort(item, locale) }}</span>
        <small>{{ item.yearBadge }}</small>
      </button>
    </div>

    <div class="voy-head">
      <div class="voy-head-main">
        <div class="voy-kicker">
          <span
            class="voy-dot"
            :class="{ reached: ui.phenomenonStats.inPeakWindow }"
            aria-hidden="true"
          ></span>
          <span>{{ pick(current.kickerZh, current.kickerEn) }}</span>
          <span v-if="ui.phenomenonStats.windowHint" class="voy-badge">
            {{ ui.phenomenonStats.windowHint }}
          </span>
        </div>
        <h2 class="voy-title">{{ phenomenonMilestoneTitle(activeMilestone, locale) }}</h2>
      </div>
      <button
        class="voy-collapse"
        :aria-expanded="!collapsed"
        :title="collapsed ? pick('展开演算台', 'Expand panel') : pick('收起演算台', 'Collapse panel')"
        :aria-label="collapsed ? pick('展开演算台', 'Expand panel') : pick('收起演算台', 'Collapse panel')"
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

    <div class="voy-telemetry">
      <div
        v-for="(metric, idx) in ui.phenomenonStats.metrics"
        :key="idx"
        class="voy-metric"
        :class="{ 'is-gold': metric.highlight }"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.sub }}</small>
      </div>
    </div>

    <div class="voy-timeline">
      <button
        class="voy-play"
        :class="{ 'is-paused': !ui.playing }"
        :title="
          ui.playing
            ? pick('暂停实时演算以细致观察（空格键）', 'Pause live simulation to inspect (Space)')
            : atEnd
              ? pick('从起点重新演算全程', 'Replay simulation from start')
              : pick('继续实时演算（空格键）', 'Resume live simulation (Space)')
        "
        :aria-label="
          ui.playing
            ? pick('暂停实时演算', 'Pause simulation')
            : atEnd
              ? pick('重播全程', 'Replay simulation')
              : pick('继续实时演算', 'Play simulation')
        "
        @click="togglePlayback"
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
          class="voy-track-fill phen-track-fill"
          :style="{ transform: `scaleX(${progressPct / 100})` }"
        ></div>
        <div class="voy-ticks" aria-hidden="true">
          <span
            v-for="m in current.milestones"
            :key="m.id"
            class="voy-tick"
            :class="{ passed: ui.phenomenonYear >= m.year, active: activeMilestone.id === m.id }"
            :style="{ left: yearPct(m.year) + '%' }"
          ></span>
        </div>
        <input
          class="voy-range"
          type="range"
          :min="current.startYear"
          :max="current.endYear"
          step="any"
          :value="ui.phenomenonYear"
          :aria-label="pick('罕见天象演算时间轴', 'Phenomenon simulation timeline')"
          @input="onScrub"
        />
      </div>

      <code class="voy-date">{{ ui.phenomenonStats.dateLabel }}</code>
    </div>

    <div class="voy-speed-row">
      <div class="voy-speed-pills" role="group" :aria-label="pick('演算播放速率', 'Simulation playback speed')">
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
      <span class="phen-state-hint" :class="{ paused: !ui.playing }">
        {{
          ui.playing
            ? pick('实时演算中 · 点左侧暂停', 'LIVE · Pause to inspect')
            : pick('已暂停 · 可拖动环绕细看', 'PAUSED · Drag to orbit')
        }}
      </span>
    </div>

    <div v-if="!collapsed" class="voy-body">
      <div
        class="voy-milestones"
        role="group"
        :aria-label="pick('年份节点（点击即开始实时演算）', 'Year epochs (click to simulate live)')"
      >
        <button
          v-for="m in current.milestones"
          :key="m.id"
          class="voy-ms-btn"
          :class="{ 'is-1ld': m.highlight }"
          :aria-pressed="ui.phenomenonMilestone === m.id"
          @click="atlas.jumpPhenomenaMilestone(m.id)"
        >
          <small class="phen-yr">{{ m.yearLabel }}</small>
          <span>{{ phenomenonMilestoneShort(m, locale) }}</span>
        </button>
      </div>

      <p class="voy-desc">
        {{ phenomenonMilestoneBody(activeMilestone, locale) }}
        <a :href="activeMilestone.source" target="_blank" rel="noopener">{{ sourceLabel(activeMilestone.source) }} ↗</a>
      </p>

      <div class="phen-views" role="group" :aria-label="pick('观察视角', 'Camera views')">
        <button
          v-for="v in current.views"
          :key="v.id"
          class="voy-view-btn"
          :aria-pressed="ui.phenomenonView === v.id"
          @click="atlas.setPhenomenaView(v.id)"
        >
          {{ pick(v.zh, v.en) }}
        </button>
      </div>
    </div>
  </section>
</template>
