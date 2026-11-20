<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  ref,
} from 'vue'
import NavigationDock from './components/NavigationDock.vue'
import BodyDrawer from './components/BodyDrawer.vue'
import ArchiveDialog from './components/ArchiveDialog.vue'
import GuideDialog from './components/GuideDialog.vue'
import SurfaceHud from './components/SurfaceHud.vue'
import { createAtlas, type Atlas } from './scene/atlas'
import { createSceneUI } from './scene/ui'
const ui = createSceneUI(),
  atlas = shallowRef<Atlas | null>(null)
const canvas = useTemplateRef('canvas'),
  stage = useTemplateRef('stage'),
  tags = useTemplateRef('tags'),
  pins = useTemplateRef('pins')
const archive = useTemplateRef('archive'),
  guide = useTemplateRef('guide')
const notice = ref(''),
  canFullscreen = !!document.documentElement.requestFullscreen
let noticeTimer: number | undefined
onMounted(() => {
  atlas.value = createAtlas(
    { canvas: canvas.value!, stage: stage.value!, tags: tags.value!, pins: pins.value! },
    ui,
  )
})
onBeforeUnmount(() => {
  atlas.value?.dispose()
  window.clearTimeout(noticeTimer)
})
async function returnToOrbit() {
  atlas.value?.takeOff()
  await nextTick()
  canvas.value?.focus({ preventScroll: true })
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    notice.value = '当前窗口无法进入全屏。'
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => (notice.value = ''), 2200)
  }
}
const note = computed(() => ui.notes[ui.noteIndex])
const sourceName = computed(() => {
  const url = note.value?.source ?? ''
  return url.includes('nasa.gov')
    ? 'NASA 资料'
    : url.includes('eso.org')
      ? 'ESO 资料'
      : url.includes('harvard.edu')
        ? 'IAU 通报'
        : '轨道研究'
})
</script>
<template>
  <main
    :class="{ 'notes-open': ui.notesOpen, 'dock-open': ui.dockOpen, 'on-surface': !!ui.landing }"
  >
    <section id="stage" ref="stage" aria-label="三维星空">
      <canvas
        ref="canvas"
        id="space"
        :tabindex="ui.landing ? -1 : 0"
        :aria-hidden="ui.landing ? true : undefined"
        :aria-label="
          ui.deepEntry
            ? ui.deepEntry.title + '三维示意，拖动旋转，滚轮缩放。'
            : '交互式三维太阳系。方向键旋转，加减键缩放，Home 键复位。'
        "
        >请使用支持 Canvas 的浏览器查看太阳系。</canvas
      >
      <div ref="tags" id="tags" aria-hidden="true"></div>
      <h1 class="sr-only" id="title" aria-live="polite">
        {{ ui.landing ? ui.landing.name + (ui.landing.cloud ? '云层观测' : '地表漫游') : ui.title }}
      </h1>
      <div class="sky-tools">
        <div class="scale-switch" role="group" aria-label="观察尺度">
          <button
            id="solarTab"
            :aria-pressed="!ui.deepEntry && !ui.galaxy"
            @click="atlas?.openPlanet(null)"
          >
            太阳系</button
          ><button
            id="galaxyTab"
            :aria-pressed="!ui.deepEntry && ui.galaxy"
            @click="atlas?.openGalaxy()"
          >
            银河系
          </button>
        </div>
        <button
          id="archiveOpen"
          aria-haspopup="dialog"
          aria-controls="archive"
          @click="archive?.open()"
        >
          深空档案</button
        ><button
          id="notes"
          :aria-pressed="ui.notesOpen"
          aria-controls="noteCard"
          @click="atlas?.setNotes(!ui.notesOpen)"
        >
          注释</button
        ><button
          class="tool-icon"
          id="help"
          title="使用说明"
          aria-label="使用说明"
          @click="guide?.open()"
        >
          ?</button
        ><button
          class="tool-icon"
          id="fullscreen"
          title="切换全屏"
          aria-label="切换全屏"
          :hidden="!canFullscreen"
          @click="toggleFullscreen"
        >
          ⛶
        </button>
      </div>
      <div ref="pins" id="pins"></div>
      <section id="deepHUD" aria-label="深空三维观测" :hidden="!ui.deepEntry">
        <div class="deep-caption">
          <span id="deepClass">{{ ui.deepClass }}</span><i></i
          ><span id="deepCode">{{ ui.deepEntry?.code }}</span>
        </div>
        <h2 id="deepName">{{ ui.deepEntry?.title }}</h2>
        <div class="deep-controls">
          <div id="deepPresets" role="group" aria-label="观测视角">
            <button
              v-for="[mode, label] in ui.presets"
              :key="mode"
              :data-preset="mode"
              :aria-pressed="ui.preset === mode"
              @click="atlas?.deepPreset(mode)"
            >
              {{ label }}
            </button>
          </div>
          <button id="deepSource" @click="ui.deepEntry && archive?.open(ui.deepEntry)">
            原图与资料 ↗
          </button>
          <div class="deep-step">
            <button id="deepPrev" aria-label="上一个三维天体" @click="atlas?.switchDeepTarget(-1)">
              ‹</button
            ><button id="deepNext" aria-label="下一个三维天体" @click="atlas?.switchDeepTarget(1)">
              ›
            </button>
          </div>
        </div>
      </section>
      <SurfaceHud
        v-if="atlas && ui.landing"
        :atlas="atlas"
        :status="ui.landing"
        @exit="returnToOrbit"
      />
      <BodyDrawer v-if="atlas" :atlas="atlas" :ui="ui" />
      <aside id="noteCard" :hidden="!ui.notesOpen" aria-label="天文注释">
        <div class="note-head">
          <h2 id="noteTitle">{{ note?.name }}</h2>
          <button id="closeNotes" aria-label="收起注释" @click="atlas?.setNotes(false)">×</button>
        </div>
        <p id="noteText">{{ note?.body }}</p>
        <div class="note-foot">
          <a id="noteSource" :href="note?.source" target="_blank" rel="noopener"
            >{{ sourceName }} ↗</a
          >
          <div id="notePages" :hidden="ui.notes.length < 2">
            <button
              id="prevNote"
              aria-label="上一条注释"
              @click="atlas?.showNote(ui.noteIndex - 1)"
            >
              ‹</button
            ><span id="noteNumber">{{ ui.noteIndex + 1 }} / {{ ui.notes.length }}</span
            ><button
              id="nextNote"
              aria-label="下一条注释"
              @click="atlas?.showNote(ui.noteIndex + 1)"
            >
              ›
            </button>
          </div>
        </div>
      </aside>
      <div class="camera-buttons">
        <button id="zoomIn" title="拉近" aria-label="拉近" @click="atlas?.changeZoom(0.78)">
          +</button
        ><button id="zoomOut" title="拉远" aria-label="拉远" @click="atlas?.changeZoom(1 / 0.78)">
          −</button
        ><button id="reset" title="复位视角" aria-label="复位视角" @click="atlas?.reset()">
          ⟲
        </button>
      </div>
      <div id="notice" role="status" :hidden="!notice">{{ notice }}</div>
    </section>
    <NavigationDock v-if="atlas" :atlas="atlas" :ui="ui" />
  </main>
  <ArchiveDialog v-if="atlas" ref="archive" :atlas="atlas" />
  <GuideDialog ref="guide" />
</template>
