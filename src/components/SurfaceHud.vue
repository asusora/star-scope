<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import type { Atlas } from '../scene/atlas'
import type { SurfaceStatus } from '../scene/types'
const { atlas, status } = defineProps<{ atlas: Atlas; status: SurfaceStatus }>()
const emit = defineEmits<{ exit: [] }>()
const hud = useTemplateRef('hud')
const keys = new Set<string>(),
  holds = new Map<number, string>()
const accepted = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
const moves = [
  ['KeyW', '↑', '向前'],
  ['KeyA', '←', '向左'],
  ['KeyS', '↓', '向后'],
  ['KeyD', '→', '向右'],
] as const
const compass = computed(
  () =>
    ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(status.bearing / 45) % 8],
)
function drive() {
  const values = new Set([...keys, ...holds.values()])
  const axis = (positive: string, negative: string) =>
    Number(values.has(positive)) - Number(values.has(negative))
  atlas.surfaceDrive(
    axis('KeyW', 'KeyS'),
    axis('KeyD', 'KeyA'),
    axis('ArrowRight', 'ArrowLeft'),
    axis('ArrowUp', 'ArrowDown'),
  )
}
function key(e: KeyboardEvent, pressed: boolean) {
  if (e.code === 'Escape' && pressed) {
    e.preventDefault()
    emit('exit')
    return
  }
  if (!accepted.includes(e.code)) return
  e.preventDefault()
  if (pressed) keys.add(e.code)
  else keys.delete(e.code)
  drive()
}
function hold(e: PointerEvent, code: string) {
  if (e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  holds.set(e.pointerId, code)
  drive()
}
function release(e: PointerEvent) {
  if (holds.delete(e.pointerId)) drive()
}
let tapTimer: number | undefined
function accessibleStep(e: MouseEvent, code: string) {
  if (e.detail !== 0) return
  window.clearTimeout(tapTimer)
  holds.set(-1, code)
  drive()
  tapTimer = window.setTimeout(() => {
    holds.delete(-1)
    drive()
  }, 230)
}
let drag: { id: number; x: number; y: number } | null = null
function startLook(e: PointerEvent) {
  if (e.button !== 0 || drag) return
  hud.value?.focus({ preventScroll: true })
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
}
function pointerMove(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return
  atlas.surfaceLook(e.clientX - drag.x, e.clientY - drag.y)
  drag.x = e.clientX
  drag.y = e.clientY
}
function stopLook(e: PointerEvent) {
  if (drag?.id === e.pointerId) drag = null
}
function reset() {
  drag = null
  keys.clear()
  holds.clear()
  window.clearTimeout(tapTimer)
  drive()
}
function focusOut(e: FocusEvent) {
  if (!hud.value?.contains(e.relatedTarget as Node | null)) reset()
}
function visibility() {
  if (document.hidden) reset()
}
onMounted(() => {
  hud.value?.focus({ preventScroll: true })
  window.addEventListener('blur', reset)
  document.addEventListener('visibilitychange', visibility)
})
onBeforeUnmount(() => {
  reset()
  window.removeEventListener('blur', reset)
  document.removeEventListener('visibilitychange', visibility)
})
</script>
<template>
  <section
    id="surfaceHUD"
    ref="hud"
    tabindex="-1"
    :aria-label="status.name + (status.cloud ? '云层观测' : '地表漫游')"
    @keydown="key($event, true)"
    @keyup="key($event, false)"
    @focusout="focusOut"
  >
    <div
      id="surfaceLook"
      @pointerdown="startLook"
      @pointermove="pointerMove"
      @pointerup="stopLook"
      @pointercancel="stopLook"
      @lostpointercapture="stopLook"
      @contextmenu.prevent
    ></div>
    <div class="surface-veil" :style="{ opacity: status.veil }"></div>
    <div class="surface-compass" aria-label="朝向">
      <span class="compass-rule"></span
      ><span
        >{{ compass }} <b>{{ String(status.bearing).padStart(3, '0') }}°</b></span
      ><span class="compass-rule"></span>
    </div>
    <button id="leaveSurface" @click="emit('exit')">↗ 返回轨道</button>
    <div class="surface-readout">
      <div class="surface-mode">
        <i></i
        ><span role="status">{{
          status.descending ? '正在下降' : status.cloud ? '云层巡航' : '地表漫游'
        }}</span
        ><span class="surface-separator">/</span><span>{{ status.region }} · 模拟</span>
      </div>
      <h2>{{ status.name }}</h2>
      <div class="surface-metrics">
        <span
          >{{ status.cloud ? '距云顶' : '离地' }} <b>{{ status.altitude }} m</b></span
        ><span
          >距{{ status.cloud ? '起点' : '着陆点' }} <b>{{ status.distance }} m</b></span
        >
      </div>
      <p class="desktop-hint">WASD 移动 · 拖动或用方向键环顾</p>
      <p class="touch-hint">按住方向键移动 · 拖动画面环顾</p>
    </div>
    <div class="surface-pad" role="group" aria-label="移动方向">
      <button
        v-for="[code, arrow, label] in moves"
        :key="code"
        :data-move="code"
        :aria-label="label"
        :disabled="status.descending"
        @pointerdown.prevent="hold($event, code)"
        @pointerup="release"
        @pointercancel="release"
        @lostpointercapture="release"
        @click="accessibleStep($event, code)"
      >
        {{ arrow }}
      </button>
    </div>
  </section>
</template>
<style scoped>
#surfaceHUD {
  position: absolute;
  inset: 0;
  z-index: 8;
  isolation: isolate;
  outline: none;
  color: #fff7e9;
  --rail: clamp(16px, 3.2vw, 52px);
}
#surfaceLook,
.surface-veil {
  position: absolute;
  inset: 0;
}
#surfaceLook {
  touch-action: none;
  cursor: grab;
}
#surfaceLook:active {
  cursor: grabbing;
}
.surface-veil {
  pointer-events: none;
  background: #241f1c;
}
#surfaceHUD::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(180deg, #1013165c, transparent 20%, transparent 65%, #0d1217a8);
  pointer-events: none;
}
.surface-compass,
.surface-readout,
.surface-pad,
#leaveSurface {
  position: absolute;
}
.surface-compass,
.surface-readout {
  pointer-events: none;
  text-shadow: 0 1px 8px #171815aa;
}
.surface-compass {
  top: max(23px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  white-space: nowrap;
}
.surface-compass b,
.surface-metrics b {
  font:
    500 12px Consolas,
    monospace;
}
.compass-rule {
  width: 45px;
  height: 5px;
  border-bottom: 1px solid #fff6;
  background: repeating-linear-gradient(90deg, #fff8 0 1px, transparent 1px 11px);
}
#leaveSurface {
  right: var(--rail);
  top: max(17px, env(safe-area-inset-top));
  border: 1px solid #fff5;
  border-radius: 20px;
  background: #111a20aa;
  padding: 8px 15px;
  font-size: 13px;
}
.surface-readout {
  bottom: max(25px, env(safe-area-inset-bottom));
  left: var(--rail);
}
.surface-mode,
.surface-metrics {
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 12px;
}
.surface-mode i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffd293;
}
.surface-separator {
  opacity: 0.55;
}
.surface-readout h2 {
  margin: 6px 0 10px;
  font: 500 clamp(33px, 4vw, 60px)/1.1 var(--serif);
}
.surface-metrics {
  gap: 18px;
  color: #f2e8d5;
}
.surface-readout p {
  margin: 8px 0 0;
  color: #e5dfd1;
  font-size: 12px;
}
.touch-hint {
  display: none;
}
.surface-pad {
  right: var(--rail);
  bottom: max(25px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: repeat(3, 42px);
  grid-template-rows: repeat(2, 40px);
  gap: 4px;
}
.surface-pad button {
  border-radius: 9px;
  border: 1px solid #ffffff52;
  background: #10181e91;
  color: #fff;
  font: 18px var(--sans);
  touch-action: none;
  user-select: none;
}
.surface-pad button:first-child {
  grid-column: 2;
}
.surface-pad button:nth-child(2) {
  grid-column: 1;
}
.surface-pad button:active,
#leaveSurface:hover {
  background: #463b2cce;
}
@media (pointer: coarse), (max-width: 620px) {
  .desktop-hint {
    display: none;
  }
  .touch-hint {
    display: block;
  }
  .surface-compass {
    left: var(--rail);
    transform: none;
  }
  .compass-rule {
    width: 18px;
  }
  .surface-pad {
    grid-template-columns: repeat(3, 40px);
    grid-template-rows: repeat(2, 44px);
  }
  .surface-readout {
    max-width: calc(100% - 167px);
  }
  .surface-mode,
  .surface-metrics,
  .surface-readout p {
    font-size: 11px;
  }
  .surface-mode {
    flex-wrap: wrap;
    gap: 5px;
  }
  .surface-metrics {
    gap: 6px;
    flex-wrap: wrap;
  }
}
</style>
