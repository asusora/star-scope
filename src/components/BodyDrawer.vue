<script setup lang="ts">
import { computed } from 'vue'
import type { Atlas } from '../scene/atlas'
import type { SceneUI } from '../scene/types'
import { normalized } from '../data/archive'

const gasGiants = ['Jupiter', 'Saturn', 'Uranus', 'Neptune']
const { ui, atlas } = defineProps<{ ui: SceneUI; atlas: Atlas }>()
const smallBodies = computed(() => atlas.smallBodies.filter((p) => p.region === ui.region))
const moons = computed(() => {
  const q = normalized(ui.search)
  return (
    ui.planet?.moons.filter((m) => m.searchNames.some((key) => normalized(key).includes(q))) ?? []
  )
})
const regionTitles: Record<string, string> = {
  main: '主小行星带天体',
  trojan: '木星特洛伊群天体',
  centaur: '半人马小天体带',
  outer: '柯伊伯带天体',
  scattered: '离散盘与极远天体',
}
const title = computed(() =>
  ui.region ? regionTitles[ui.region] ?? '区域天体' : (ui.planet?.name ?? '') + '卫星',
)
function bodySubtitle(p: { kind?: string; au?: number; id: string }) {
  const au = p.au ? (p.au >= 100 ? Math.round(p.au) : p.au.toFixed(1)) + ' AU' : p.id
  return `${p.kind ?? '小天体'} · ${au}`
}
</script>
<template>
  <div class="stage-actions">
    <button id="land" v-if="!ui.galaxy && !ui.deepEntry && !ui.region" @click="atlas.land()">
      <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 2v7.2M4.3 6.7L7 9.4l2.7-2.7M2.6 11.6h8.8"
          stroke="currentColor"
          stroke-width="1.35"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{{
        !ui.moon && gasGiants.includes(ui.planet?.id ?? '')
          ? '进入云层'
          : '着陆' + (ui.moon?.label ?? ui.planet?.name ?? '火星')
      }}</span>
    </button>
    <button id="return" :hidden="!ui.deepEntry && !ui.planet && !ui.region" @click="atlas.goBack()">
      <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M8.8 3.2L5 7l3.8 3.8"
          stroke="currentColor"
          stroke-width="1.45"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{{
        ui.deepEntry ? '返回原视图' : ui.moon ? '返回' + ui.planet?.name : '太阳系全景'
      }}</span></button
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
      <span id="catalogType">{{ ui.region ? '区域天体' : '卫星目录' }}</span>
      <span id="count">{{ ui.planet?.moons.length ?? smallBodies.length }}</span>
    </button>
  </div>
  <aside id="drawer" :hidden="!ui.drawerOpen" :aria-label="title">
    <div class="drawer-kicker">{{ ui.region ? 'REGION // 区域名录' : 'ORBITAL CATALOG // 卫星' }}</div>
    <div class="drawer-head">
      <strong id="drawerTitle">{{ title }}</strong
      ><button
        id="closeDrawer"
        :aria-label="ui.region ? '关闭区域名录' : '关闭卫星目录'"
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
        placeholder="搜索名称或临时编号"
        aria-label="搜索卫星"
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
          <span>{{ p.name }}</span
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
          <span>{{ m.label }}</span
          ><small>{{
            [m.label === m.name ? '' : m.name, m.numberName].filter(Boolean).join(' · ') ||
            (m.year ?? '')
          }}</small>
        </button>
        <p v-if="!moons.length" class="empty">
          {{ ui.planet?.moons.length ? '没有匹配的卫星。' : '该天体目前没有已知天然卫星。' }}
        </p></template
      >
    </div>
    <div id="detail" aria-live="polite" :hidden="!ui.moon">
      <template v-if="ui.moon">
        <b>{{ [ui.moon.label, ...ui.moon.otherNames].join(' · ') }}</b>
        <div class="detail-row">
          <span>{{ ui.moon.estimate ? '观测距离' : '轨道半长轴' }}</span>
          <code>{{ ui.moon.a.toLocaleString('zh-CN') }} km</code>
        </div>
        <div class="detail-row">
          <span>公转周期</span>
          <code>{{ ui.moon.period ? ui.moon.period + ' 天' : 'JPL 未列出' }}</code>
        </div>
      </template>
    </div>
  </aside>
</template>
