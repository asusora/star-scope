import { shallowReactive } from 'vue'
import type { SceneUI } from './types'
import { pick } from '../i18n'

export function createSceneUI() {
  return shallowReactive<SceneUI>({
    title: pick('太阳系', 'Solar System'),
    landing: null,
    galaxy: false,
    planet: null,
    moon: null,
    region: null,
    deepEntry: null,
    playing: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    speed: 1,
    orbitMode: 'smart',
    showNames: true,
    tracksDisabled: false,
    dockOpen: false,
    drawerOpen: false,
    notesOpen: false,
    notes: [],
    noteIndex: 0,
    group: '太阳系',
    presets: [],
    preset: '',
    deepClass: '',
    search: '',
  })
}
