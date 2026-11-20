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
const title = computed(() =>
  ui.region
    ? ui.region === 'main'
      ? '小行星带天体'
      : '外太阳系天体'
    : (ui.planet?.name ?? '') + '卫星',
)
</script>
<template>
  <div class="stage-actions">
    <button id="land" v-if="!ui.galaxy && !ui.deepEntry && !ui.region" @click="atlas.land()">
      {{
        !ui.moon && gasGiants.includes(ui.planet?.id ?? '')
          ? '进入云层'
          : '着陆' + (ui.moon?.label ?? ui.planet?.name ?? '火星')
      }}
    </button>
    <button id="return" :hidden="!ui.deepEntry && !ui.planet && !ui.region" @click="atlas.goBack()">
      ‹
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
      <span id="catalogType">{{ ui.region ? '区域天体' : '卫星目录' }}</span>
      <span id="count">{{ ui.planet?.moons.length ?? smallBodies.length }}</span>
    </button>
  </div>
  <aside id="drawer" :hidden="!ui.drawerOpen" :aria-label="title">
    <div class="drawer-head">
      <strong id="drawerTitle">{{ title }}</strong><button
        id="closeDrawer"
        aria-label="关闭卫星目录"
        @click="atlas.drawer(false)"
      >
        ×
      </button>
    </div>
    <input
      id="search"
      type="search"
      v-model="ui.search"
      @input="atlas.preview(null)"
      :hidden="!ui.planet?.moons.length"
      placeholder="搜索名称或临时编号"
      aria-label="搜索卫星"
    />
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
          <span>{{ p.name }}</span><small>{{ p.kind }} · {{ p.id }}</small>
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
          <span>{{ m.label }}</span><small>{{
            [m.label === m.name ? '' : m.name, m.numberName].filter(Boolean).join(' · ') ||
            (m.year ?? '')
          }}</small>
        </button>
        <p v-if="!moons.length" class="empty">
          {{ ui.planet?.moons.length ? '没有匹配的卫星。' : '这颗行星没有已知天然卫星。' }}
        </p></template
      >
    </div>
    <div id="detail" aria-live="polite">
      <template v-if="ui.moon"
        ><b>{{ [ui.moon.label, ...ui.moon.otherNames].join(' · ') }}</b>
        <div>
          {{ ui.moon.estimate ? '观测距离' : '轨道半长轴' }}
          {{ ui.moon.a.toLocaleString('zh-CN') }} km
        </div>
        <div>
          公转周期 {{ ui.moon.period ? ui.moon.period + ' 天' : 'JPL 表中未列出' }}
        </div></template
      >
    </div>
  </aside>
</template>
