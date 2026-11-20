<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
import type { Atlas } from '../scene/atlas'
import { normalized } from '../data/archive'
import { deepGroups, type ArchiveEntry, type Group } from '../scene/types'
const { atlas } = defineProps<{ atlas: Atlas }>()
const dialog = useTemplateRef('dialog'),
  browseButton = useTemplateRef('browseButton'),
  list = useTemplateRef('list'),
  detail = useTemplateRef('detail')
const tabs = ['全部', ...deepGroups, '太阳系'] as const
const group = ref<Group | '全部'>(deepGroups[0]),
  query = ref(''),
  observing = ref(false),
  current = shallowRef<ArchiveEntry | null>(null)
const items = computed(() => {
  const needle = normalized(query.value.trim())
  return atlas.entries.filter(
    (e) =>
      (group.value === '全部' || group.value === e.group) &&
      (needle
        ? [e.id, e.title, e.code, e.alt, e.object?.name, ...(e.keys || [])].some(
            (s) => s && normalized(s).includes(needle),
          )
        : !e.moon || e.featured),
  )
})
watch(items, (entries) => {
  if (!current.value || !entries.includes(current.value)) current.value = entries[0] ?? null
  if (list.value) list.value.scrollTop = 0
})
watch(current, () => {
  if (detail.value) detail.value.scrollTop = 0
})
function filter(tab: (typeof tabs)[number]) {
  group.value = tab
  query.value = ''
}
async function open(entry?: ArchiveEntry) {
  observing.value = !!entry
  filter(entry?.group ?? deepGroups[0])
  current.value = entry ?? items.value[0] ?? null
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  if (entry) browseButton.value?.focus({ preventScroll: true })
}
async function browse() {
  observing.value = false
  await nextTick()
  list.value
    ?.querySelector<HTMLButtonElement>('[aria-pressed=true]')
    ?.focus({ preventScroll: true })
}
function step(offset: number) {
  const entries = items.value
  if (current.value && entries.length)
    current.value =
      entries[(entries.indexOf(current.value) + offset + entries.length) % entries.length]
}
function visit(entry: ArchiveEntry) {
  dialog.value?.close()
  atlas.visit(entry)
}
function backdrop(event: MouseEvent) {
  const box = dialog.value?.getBoundingClientRect()
  if (
    box &&
    (event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom)
  )
    dialog.value?.close()
}
defineExpose({ open })
</script>
<template>
  <dialog
    id="archive"
    ref="dialog"
    aria-labelledby="archiveTitle"
    :class="{ observing }"
    @click.self="backdrop"
  >
    <div class="dialog-head">
      <h2 id="archiveTitle">{{ observing ? group + '档案' : '星图档案' }}</h2>
      <div class="archive-actions">
        <button ref="browseButton" id="browseArchive" :hidden="!observing" @click="browse">
          浏览目录</button
        ><button id="archiveClose" aria-label="关闭星图档案" @click="dialog?.close()">×</button>
      </div>
    </div>
    <input
      id="archiveSearch"
      type="search"
      aria-label="搜索全部星图档案"
      placeholder="搜索星系、恒星、行星、卫星或编号"
      v-model="query"
      @input="group = '全部'"
    />
    <div id="archiveTabs" role="group" aria-label="档案分类">
      <button v-for="tab in tabs" :key="tab" :aria-pressed="group === tab" @click="filter(tab)">
        {{ tab }}
      </button>
    </div>
    <div class="archive-layout">
      <div ref="list" id="archiveList" aria-label="条目">
        <button
          v-for="entry in items"
          :key="entry.id"
          :data-key="entry.id"
          :aria-pressed="current === entry"
          @click="current = entry"
        >
          <span>{{ entry.title }}</span
          ><small>{{ entry.code || entry.object?.name || entry.group }}</small>
        </button>
        <p v-if="!items.length" class="empty">没有匹配的档案。</p>
      </div>
      <article id="archiveDetail" ref="detail" aria-live="polite">
        <template v-if="current">
          <figure v-if="current.photo" :class="{ 'solar-portrait': current.object }">
            <img :src="current.photo" :alt="current.title + ' · ' + current.caption" />
            <figcaption>
              {{ current.caption }}{{ current.credit ? ' · ' + current.credit : '' }}
              <a
                v-if="current.imageSource"
                :href="current.imageSource"
                target="_blank"
                rel="noopener"
                >原图 ↗</a
              >
            </figcaption>
          </figure>
          <div class="entry-info">
            <h3>{{ current.title }}</h3>
            <div class="archive-code" v-if="current.code && current.code !== current.title">
              {{ current.code }}
            </div>
            <p>{{ current.body }}</p>
            <dl>
              <template v-for="[name, value] in current.facts" :key="name"
                ><dt>{{ name }}</dt>
                <dd>{{ value }}</dd></template
              >
            </dl>
            <div class="entry-actions">
              <button @click="visit(current)">进入三维视图</button
              ><button v-if="!observing && !current.object" @click="open(current)">
                展开观测图</button
              ><a :href="current.source" target="_blank" rel="noopener">来源资料 ↗</a>
            </div>
          </div>
        </template>
      </article>
    </div>
    <div id="entryPager" :hidden="!observing">
      <button id="entryPrevious" aria-label="上一份档案" @click="step(-1)">‹ 上一个</button
      ><span id="entryCount"
        >{{ current ? items.indexOf(current) + 1 : 0 }} / {{ items.length }}</span
      ><button id="entryNext" aria-label="下一份档案" @click="step(1)">下一个 ›</button>
    </div>
  </dialog>
</template>
