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
  ['KeyW', 'up', '向前'],
  ['KeyA', 'left', '向左'],
  ['KeyS', 'down', '向后'],
  ['KeyD', 'right', '向右'],
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
    <div class="visor-frame" aria-hidden="true"></div>
    <div class="surface-compass" aria-label="朝向">
      <span class="compass-rule"></span>
      <span class="compass-value">
        <span class="compass-dir">{{ compass }}</span>
        <b>{{ String(status.bearing).padStart(3, '0') }}°</b>
      </span>
      <span class="compass-rule"></span>
    </div>
    <button id="leaveSurface" @click="emit('exit')">
      <svg class="ui-ico-sm" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 11.5V3.4M4.3 5.9L7 3.2l2.7 2.7"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>返回轨道</span>
    </button>
    <div class="surface-readout">
      <div class="surface-mode">
        <i :class="{ descending: status.descending }"></i>
        <span role="status">{{
          status.descending ? '正在下降' : status.cloud ? '云层巡航' : '地表漫游'
        }}</span>
        <span class="surface-separator">//</span>
        <span>{{ status.region }} · 模拟</span>
      </div>
      <h2>{{ status.name }}</h2>
      <div class="surface-metrics">
        <span class="metric-pill">
          <em>{{ status.cloud ? '距云顶' : '离地高度' }}</em>
          <b>{{ status.altitude }} m</b>
        </span>
        <span class="metric-pill">
          <em>距{{ status.cloud ? '起点' : '着陆点' }}</em>
          <b>{{ status.distance }} m</b>
        </span>
      </div>
      <p class="desktop-hint">WASD 移动 · 拖动或方向键环顾 · ESC 返回</p>
      <p class="touch-hint">按住方向键移动 · 拖动画面环顾</p>
    </div>
    <div class="surface-pad" role="group" aria-label="移动方向">
      <button
        v-for="[code, dir, label] in moves"
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
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            v-if="dir === 'up'"
            d="M4.2 10L8 6.2 11.8 10"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            v-else-if="dir === 'down'"
            d="M4.2 6L8 9.8 11.8 6"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            v-else-if="dir === 'left'"
            d="M10 4.2L6.2 8 10 11.8"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            v-else
            d="M6 4.2L9.8 8 6 11.8"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
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
  color: #eef6ff;
  --rail: clamp(18px, 3.2vw, 48px);
}
#surfaceLook,
.surface-veil,
.visor-frame {
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
  background: #060a12;
}
.visor-frame {
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(4, 10, 20, 0.56), transparent 18%, transparent 66%, rgba(4, 9, 18, 0.72));
}
.visor-frame::before,
.visor-frame::after {
  content: '';
  position: absolute;
  inset: 14px;
  pointer-events: none;
  opacity: 0.28;
}
.visor-frame::before {
  background:
    linear-gradient(90deg, var(--cyan, #46d9ff) 18px, transparent 18px) top left / 22px 1.5px no-repeat,
    linear-gradient(180deg, var(--cyan, #46d9ff) 18px, transparent 18px) top left / 1.5px 22px no-repeat,
    linear-gradient(270deg, var(--cyan, #46d9ff) 18px, transparent 18px) top right / 22px 1.5px no-repeat,
    linear-gradient(180deg, var(--cyan, #46d9ff) 18px, transparent 18px) top right / 1.5px 22px no-repeat;
}
.visor-frame::after {
  background:
    linear-gradient(90deg, var(--cyan, #46d9ff) 18px, transparent 18px) bottom left / 22px 1.5px no-repeat,
    linear-gradient(0deg, var(--cyan, #46d9ff) 18px, transparent 18px) bottom left / 1.5px 22px no-repeat,
    linear-gradient(270deg, var(--cyan, #46d9ff) 18px, transparent 18px) bottom right / 22px 1.5px no-repeat,
    linear-gradient(0deg, var(--cyan, #46d9ff) 18px, transparent 18px) bottom right / 1.5px 22px no-repeat;
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
}
.surface-compass {
  top: max(20px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid rgba(114, 214, 255, 0.24);
  background: rgba(6, 13, 25, 0.62);
  backdrop-filter: blur(14px);
  box-shadow:
    inset 0 1px 0 rgba(168, 228, 255, 0.14),
    0 8px 28px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.compass-value {
  display: flex;
  align-items: center;
  gap: 7px;
}
.compass-dir {
  color: #9dc3dd;
  font-weight: 500;
}
.surface-compass b,
.surface-metrics b {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.surface-compass b {
  color: #7ee8ff;
  font-size: 13px;
}
.compass-rule {
  width: 48px;
  height: 6px;
  border-bottom: 1px solid rgba(126, 232, 255, 0.35);
  background: repeating-linear-gradient(90deg, rgba(160, 226, 255, 0.55) 0 1px, transparent 1px 10px);
}
#leaveSurface {
  right: var(--rail);
  top: max(18px, env(safe-area-inset-top));
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(114, 214, 255, 0.32);
  border-radius: 12px;
  background: rgba(7, 15, 28, 0.72);
  backdrop-filter: blur(16px);
  box-shadow:
    inset 0 1px 0 rgba(168, 228, 255, 0.16),
    0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 9px 15px;
  font-size: 12.5px;
  font-weight: 500;
  color: #e6f5ff;
  transition: border-color 0.18s, background 0.18s, transform 0.18s, box-shadow 0.18s;
}
#leaveSurface:hover {
  border-color: rgba(70, 217, 255, 0.68);
  background: rgba(16, 40, 66, 0.85);
  box-shadow: 0 0 18px rgba(56, 217, 255, 0.22);
}
.surface-readout {
  bottom: max(24px, env(safe-area-inset-bottom));
  left: var(--rail);
  text-shadow: 0 2px 14px rgba(3, 8, 16, 0.8);
}
.surface-mode {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: #9ec8e4;
}
.surface-mode i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #46d9ff;
  box-shadow: 0 0 10px #46d9ff;
}
.surface-mode i.descending {
  background: #ffb85c;
  box-shadow: 0 0 10px #ffb85c;
}
.surface-separator {
  color: rgba(114, 214, 255, 0.45);
  font-family: var(--mono);
}
.surface-readout h2 {
  margin: 6px 0 12px;
  font: 600 clamp(30px, 3.8vw, 54px) / 1.08 var(--sans);
  letter-spacing: -0.01em;
  color: #f4f9ff;
}
.surface-metrics {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.metric-pill {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(114, 214, 255, 0.22);
  background: rgba(6, 13, 25, 0.64);
  backdrop-filter: blur(12px);
  font-size: 12px;
}
.metric-pill em {
  font-style: normal;
  color: #8eb0cb;
  font-size: 11px;
}
.metric-pill b {
  color: #eef8ff;
  font-size: 13px;
}
.surface-readout p {
  margin: 10px 0 0;
  color: #9db6cc;
  font-size: 11.5px;
  letter-spacing: 0.03em;
}
.touch-hint {
  display: none;
}
.surface-pad {
  right: var(--rail);
  bottom: max(24px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(2, 42px);
  gap: 6px;
}
.surface-pad button {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  border: 1px solid rgba(114, 214, 255, 0.28);
  background: rgba(7, 15, 28, 0.68);
  backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 rgba(168, 228, 255, 0.14);
  color: #dceeff;
  touch-action: none;
  user-select: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.surface-pad button svg {
  width: 18px;
  height: 18px;
}
.surface-pad button:first-child {
  grid-column: 2;
}
.surface-pad button:nth-child(2) {
  grid-column: 1;
}
.surface-pad button:hover {
  border-color: rgba(70, 217, 255, 0.6);
  background: rgba(16, 38, 62, 0.8);
}
.surface-pad button:active {
  border-color: #46d9ff;
  background: rgba(42, 168, 224, 0.35);
  box-shadow: 0 0 16px rgba(56, 217, 255, 0.32);
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
    padding: 6px 12px;
  }
  .compass-rule {
    width: 18px;
  }
  .surface-pad {
    grid-template-columns: repeat(3, 40px);
    grid-template-rows: repeat(2, 42px);
  }
  .surface-readout {
    max-width: calc(100% - 168px);
  }
  .surface-mode,
  .surface-readout p {
    font-size: 11px;
  }
  .surface-mode {
    flex-wrap: wrap;
    gap: 5px;
  }
  .metric-pill {
    padding: 4px 9px;
    font-size: 11px;
  }
}
</style>
