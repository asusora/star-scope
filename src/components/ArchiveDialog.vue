<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
import type { Atlas } from '../scene/atlas'
import { normalized } from '../data/archive'
import { deepGroups, type ArchiveEntry } from '../scene/types'
import { groupLabel, isEn, pick, tabLabel, type ArchiveTab } from '../i18n'
import { worldKind, worldName } from '../i18n/catalogEn'
import { archiveSearchTokens, localizedEntry } from '../i18n/archiveLocale'

const { atlas } = defineProps<{ atlas: Atlas }>()
const dialog = useTemplateRef('dialog'),
  browseButton = useTemplateRef('browseButton'),
  list = useTemplateRef('list'),
  detail = useTemplateRef('detail')
const tabs: readonly ArchiveTab[] = ['全部', ...deepGroups, '太阳系', '探测器实拍']
const group = ref<ArchiveTab>(deepGroups[0]),
  query = ref(''),
  observing = ref(false),
  openedEntry = shallowRef<ArchiveEntry | null>(null),
  current = shallowRef<ArchiveEntry | null>(null),
  mediaMode = ref<'probe' | 'model'>('probe'),
  probeIndex = ref(0)

const probeEntryCount = computed(() => atlas.entries.filter((e) => e.probePhotos?.length).length)

const items = computed(() => {
  const needle = normalized(query.value.trim())
  return atlas.entries.filter((e) => {
    const matchGroup =
      group.value === '全部'
        ? true
        : group.value === '探测器实拍'
          ? !!e.probePhotos?.length
          : group.value === e.group
    if (!matchGroup) return false
    if (needle) {
      return archiveSearchTokens(e).some((s) => s && normalized(s).includes(needle))
    }
    return e === openedEntry.value || !e.moon || e.featured || !!e.probePhotos?.length
  })
})

const currentView = computed(() => (current.value ? localizedEntry(current.value) : null))
const activeProbePhoto = computed(() => currentView.value?.probePhotos?.[probeIndex.value] ?? null)
const hasProbePhotos = computed(() => !!currentView.value?.probePhotos?.length)
const hasBothMedia = computed(
  () => !!(currentView.value?.probePhotos?.length && current.value?.photo),
)
const hasVisual = computed(() => !!(activeProbePhoto.value || current.value?.photo))

watch(items, (entries) => {
  if (!current.value || !entries.includes(current.value)) current.value = entries[0] ?? null
  if (list.value) list.value.scrollTop = 0
})
watch(current, (entry) => {
  probeIndex.value = 0
  mediaMode.value = entry?.probePhotos?.length ? 'probe' : 'model'
  if (detail.value) detail.value.scrollTop = 0
})

function filter(tab: ArchiveTab, entry: ArchiveEntry | null = null) {
  openedEntry.value = entry
  group.value = tab
  query.value = ''
}
function listSubtitle(entry: ArchiveEntry) {
  const view = localizedEntry(entry)
  if (group.value === '探测器实拍') {
    const scope = entry.moon
      ? isEn.value
        ? `${entry.object ? worldName(entry.object, 'en') : ''} Moon`
        : `${entry.object?.name ?? ''}卫星`
      : entry.object
        ? worldKind(entry.object)
        : pick('行星', 'Planet')
    const probeShort = view.probePhotos?.[0]?.probe.split(/[（(]/)[0]?.trim()
    return [scope, probeShort].filter(Boolean).join(' · ')
  }
  return (
    view.code ||
    (entry.object ? worldName(entry.object) : '') ||
    groupLabel(entry.group)
  )
}
const dialogTitle = computed(() => {
  if (!observing.value) return pick('星图档案', 'Astro Archive')
  if (group.value === '探测器实拍') return pick('探测器实拍档案', 'Spacecraft Imagery')
  const g = current.value?.group ?? (group.value === '全部' ? '太阳系' : group.value)
  return isEn.value ? `${groupLabel(g, 'en')} Archive` : g + '档案'
})
async function open(
  entry?: ArchiveEntry,
  options?: { tab?: ArchiveTab; observing?: boolean },
) {
  observing.value = options?.observing ?? !!entry
  const targetTab: ArchiveTab =
    options?.tab ??
    (entry ? (entry.probePhotos?.length ? '探测器实拍' : entry.group) : deepGroups[0])
  filter(targetTab, entry)
  current.value = entry ?? items.value[0] ?? null
  probeIndex.value = 0
  mediaMode.value = current.value?.probePhotos?.length ? 'probe' : 'model'
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  if (observing.value) browseButton.value?.focus({ preventScroll: true })
}
function expandCurrent() {
  if (!current.value) return
  observing.value = true
  if (current.value.probePhotos?.length) mediaMode.value = 'probe'
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
    <div class="dialog-kicker">
      {{ pick('ASTRO ARCHIVE // 星图与实拍数据库', 'ASTRO ARCHIVE // CATALOG & SPACECRAFT IMAGERY') }}
    </div>
    <div class="dialog-head">
      <h2 id="archiveTitle">{{ dialogTitle }}</h2>
      <div class="archive-actions">
        <button ref="browseButton" id="browseArchive" :hidden="!observing" @click="browse">
          {{ pick('浏览目录', 'Browse Catalog') }}</button
        ><button
          id="archiveClose"
          :aria-label="pick('关闭星图档案', 'Close Archive')"
          @click="dialog?.close()"
        >
          <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
    <div class="archive-search-wrap" :hidden="observing">
      <svg class="search-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7.2" cy="7.2" r="4.6" stroke="currentColor" stroke-width="1.35" />
        <path d="M10.7 10.7L13.5 13.5" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
      </svg>
      <input
        id="archiveSearch"
        type="search"
        :aria-label="pick('搜索全部星图档案', 'Search all archive entries')"
        :placeholder="
          pick('搜索天体、探测器、发现年份或编号', 'Search body, spacecraft, year, or ID')
        "
        v-model="query"
        @input="group = '全部'"
      />
    </div>
    <div id="archiveTabs" role="group" :aria-label="pick('档案分类', 'Archive Categories')">
      <button v-for="tab in tabs" :key="tab" :aria-pressed="group === tab" @click="filter(tab)">
        <span>{{ tabLabel(tab) }}</span>
        <span v-if="tab === '探测器实拍'" class="tab-count">{{ probeEntryCount }}</span>
      </button>
    </div>
    <div class="archive-layout">
      <div ref="list" id="archiveList" :aria-label="pick('条目', 'Entries')">
        <button
          v-for="entry in items"
          :key="entry.id"
          :data-key="entry.id"
          :aria-pressed="current === entry"
          @click="current = entry"
        >
          <span class="archive-item-head">
            <span>{{ localizedEntry(entry).title }}</span>
            <em v-if="entry.probePhotos?.length" class="probe-badge">
              {{
                entry.probePhotos.length > 1
                  ? isEn
                    ? `Photo ×${entry.probePhotos.length}`
                    : `实拍 ×${entry.probePhotos.length}`
                  : pick('实拍', 'Photo')
              }}
            </em>
          </span>
          <small>{{ listSubtitle(entry) }}</small>
        </button>
        <p v-if="!items.length" class="empty">
          {{ pick('没有匹配的档案。', 'No matching archive entries.') }}
        </p>
      </div>
      <article
        id="archiveDetail"
        ref="detail"
        aria-live="polite"
        :class="{ 'no-visual': !hasVisual }"
      >
        <template v-if="current && currentView">
          <div v-if="hasProbePhotos" class="archive-visual">
            <div class="visual-bar">
              <div
                v-if="hasBothMedia"
                class="media-switch"
                role="group"
                :aria-label="pick('影像类别', 'Media Type')"
              >
                <button :aria-pressed="mediaMode === 'probe'" @click="mediaMode = 'probe'">
                  {{ pick('探测器实拍', 'Spacecraft Photo')
                  }}{{
                    currentView.probePhotos && currentView.probePhotos.length > 1
                      ? ` (${currentView.probePhotos.length})`
                      : ''
                  }}
                </button>
                <button :aria-pressed="mediaMode === 'model'" @click="mediaMode = 'model'">
                  {{ pick('场景模型', '3D Model') }}
                </button>
              </div>
              <span v-else class="media-pill is-probe">
                {{ pick('探测器实拍', 'Spacecraft Photo')
                }}{{
                  currentView.probePhotos && currentView.probePhotos.length > 1
                    ? isEn
                      ? ` · ${currentView.probePhotos.length}`
                      : ` · ${currentView.probePhotos.length} 张`
                    : ''
                }}
              </span>
              <button
                v-if="!observing && mediaMode === 'probe'"
                class="visual-expand"
                @click="expandCurrent()"
              >
                {{ pick('查看大图 ↗', 'Enlarge ↗') }}
              </button>
            </div>
            <figure v-if="mediaMode === 'probe' && activeProbePhoto" class="probe-figure">
              <div
                class="probe-stage"
                :class="{ zoomable: !observing }"
                @click="!observing && expandCurrent()"
              >
                <img
                  :src="activeProbePhoto.url"
                  :alt="currentView.title + ' · ' + activeProbePhoto.title"
                />
              </div>
              <div
                v-if="currentView.probePhotos && currentView.probePhotos.length > 1"
                class="probe-switcher"
                role="group"
                :aria-label="pick('切换探测器实拍影像', 'Select spacecraft photo')"
              >
                <button
                  v-for="(item, idx) in currentView.probePhotos"
                  :key="item.id"
                  :aria-pressed="probeIndex === idx"
                  @click="probeIndex = idx"
                >
                  <img :src="item.url" alt="" />
                  <span>
                    <b>{{ item.probe.split(/[（(]/)[0]?.trim() }}</b>
                    <small>{{ item.date }}</small>
                  </span>
                </button>
              </div>
              <figcaption class="probe-meta">
                <div class="probe-title-row">
                  <span class="media-pill is-probe">{{ pick('实拍', 'Real Photo') }}</span>
                  <strong>{{ activeProbePhoto.title }}</strong>
                </div>
                <p class="probe-desc">{{ activeProbePhoto.description }}</p>
                <div class="probe-facts">
                  <span><b>{{ pick('探测器', 'Spacecraft') }}</b>{{ activeProbePhoto.probe }}</span>
                  <span><b>{{ pick('拍摄时间', 'Captured') }}</b>{{ activeProbePhoto.date }}</span>
                  <span>
                    <b>{{ pick('来源', 'Credit') }}</b>{{ activeProbePhoto.credit }}
                    <a :href="activeProbePhoto.source" target="_blank" rel="noopener">{{
                      pick('原图 ↗', 'Original ↗')
                    }}</a>
                  </span>
                </div>
              </figcaption>
            </figure>
            <figure v-else-if="current.photo" class="solar-portrait">
              <img :src="current.photo" :alt="currentView.title + ' · ' + pick('场景模型', '3D Model')" />
              <figcaption>
                <span class="media-pill is-model">{{ pick('场景模型', '3D Model') }}</span>
                {{
                  pick(
                    '三维渲染示意，仅用于场景位置与外观参考，非探测器实拍。',
                    '3D scene render for orbital and visual reference, not a spacecraft photograph.',
                  )
                }}
              </figcaption>
            </figure>
          </div>
          <figure v-else-if="current.photo" :class="{ 'solar-portrait': current.object }">
            <img :src="current.photo" :alt="currentView.title + ' · ' + currentView.caption" />
            <figcaption>
              <span v-if="current.object" class="media-pill is-model">{{
                pick('场景模型', '3D Model')
              }}</span>
              {{
                current.object
                  ? pick(
                      '三维渲染示意 · 该天体暂无探测器近距实拍影像',
                      '3D scene render · No close-up spacecraft imagery available yet',
                    )
                  : currentView.caption + (currentView.credit ? ' · ' + currentView.credit : '')
              }}
              <a
                v-if="current.imageSource"
                :href="current.imageSource"
                target="_blank"
                rel="noopener"
                >{{ pick('原图 ↗', 'Original ↗') }}</a
              >
            </figcaption>
          </figure>
          <div class="entry-info">
            <h3>{{ currentView.title }}</h3>
            <div class="archive-code" v-if="currentView.code && currentView.code !== currentView.title">
              {{ currentView.code }}
            </div>
            <p>{{ currentView.body }}</p>
            <dl>
              <template v-for="[name, value] in currentView.facts" :key="name"
                ><dt>{{ name }}</dt>
                <dd>{{ value }}</dd></template
              >
            </dl>
            <div class="entry-actions">
              <button class="btn-primary" @click="visit(current)">
                <span>{{ pick('进入三维视图', 'Open 3D View') }}</span>
                <svg class="ui-ico-xs" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg></button
              ><button
                class="btn-ghost"
                v-if="!observing && hasProbePhotos"
                @click="expandCurrent()"
              >
                {{ pick('展开实拍图', 'Expand Photo') }}</button
              ><button
                class="btn-ghost"
                v-else-if="!observing && !current.object && current.photo"
                @click="open(current)"
              >
                {{ pick('展开观测图', 'Expand Image') }}</button
              ><a :href="current.source" target="_blank" rel="noopener">{{
                pick('来源资料 ↗', 'Source ↗')
              }}</a>
            </div>
          </div>
        </template>
      </article>
    </div>
    <div id="entryPager" :hidden="!observing">
      <button
        id="entryPrevious"
        :aria-label="pick('上一份档案', 'Previous entry')"
        @click="step(-1)"
      >
        {{ pick('‹ 上一个', '‹ Prev') }}</button
      ><span id="entryCount"
        >{{ current ? items.indexOf(current) + 1 : 0 }} / {{ items.length }}</span
      ><button
        id="entryNext"
        :aria-label="pick('下一份档案', 'Next entry')"
        @click="step(1)"
      >
        {{ pick('下一个 ›', 'Next ›') }}
      </button>
    </div>
  </dialog>
</template>
