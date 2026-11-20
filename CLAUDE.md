# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Star Scope (太阳系漫游) is an interactive 3D atlas of the solar system, the Milky Way and selected deep-sky objects, built with Vue 3, Vite, TypeScript and Three.js. All user-facing text is Simplified Chinese (`lang="zh-CN"`); keep new UI strings, aria labels and notes in Chinese.

## Commands

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci              # install
npm run dev         # Vite dev server
npm run typecheck   # vue-tsc --noEmit (TS + Vue templates)
npm run build       # typecheck, then vite build → dist/
npm run preview     # serve the built dist/
```

There is no test suite and no linter; `npm run typecheck` is the correctness gate. `dist/` is a fully static site (Vite `base: './'`, so it works from any sub-path).

## Architecture

### Vue ↔ scene bridge

- `src/App.vue` mounts the canvas and calls `createAtlas(elements, ui)` (`src/scene/atlas.ts`). The atlas is a large closure-style factory, not a class; its public API is the object it returns, and `type Atlas = ReturnType<typeof createAtlas>`.
- State flows one way through `SceneUI` (`src/scene/types.ts`, created in `src/scene/ui.ts` as a `shallowReactive`). The scene writes `ui.*` fields; components read `ui` and call `atlas.*` methods (`openPlanet`, `openMoon`, `openGalaxy`, `openDeepTarget`, `land`, `takeOff`, `setPlaying`, …). Components never touch Three.js objects directly.
- Because `ui` is *shallow* reactive, nested mutation does not re-render. Replace the value instead (e.g. `ui.landing = { ...state }`).

### Rendering

- **WebGL with a Canvas 2D fallback.** `createAtlas` tries `WebGLRenderer`; if that fails it renders the same 3D camera/positions through software paths: `planetCanvas.ts` (planets), `deepCanvas.ts` + `galaxyVolume.ts` `buildSoftwareVolume` (deep-sky), `landing/software.ts` (surface excursion). In fallback mode `textures[id]` is `null` and many factories receive a `!!renderer` / `renderer | null` flag. Visual changes usually need a matching change in the fallback path.
- **On-demand render loop.** `tick` only keeps requesting frames while `playing`, a camera `transition`, or orbit-path fades are active. Anything that changes visuals while paused (async texture load, UI toggle) must call `requestDraw()`.
- Teardown goes through `atlas.dispose()`, which walks the scene to free geometries/materials/textures; DOM listeners are registered with a shared `AbortController`. New long-lived resources should be added to that disposal path.

### View modes (all inside `atlas.ts`)

1. Solar system: `createSolarModels` (`solarModels.ts`) builds sun, planets, moons, orbit lines, asteroid/Kuiper belts (`belts.ts`). Close-up planet/moon detail is swapped in by `planetDetail.ts` + `planetSurfaces.ts` (materials, atmospheres, rings, shaders from `shaders.ts`).
2. Galaxy view: Milky Way volume.
3. Deep-sky targets: galaxies, stars and exoplanet systems from the archive, built by `deepModels.ts` (`galaxyForms`, `planetarySystems`) with types in `deepTypes.ts`; each has view presets surfaced as `ui.presets`.
4. Surface excursion: `scene/landing/*` — `landscape.ts` picks terrain per body id, `excursion.ts` drives the walk/descent state reported as `ui.landing`, `view.ts`/`ground.ts`/`sky.ts` build the scene.

### Procedural body detail

`bodyDetail.ts` holds per-body specs (craters, lineae, patches, coronae) and generates displaced geometry and synthesized texture maps. Large maps use `synthesizeBodyMapsAsync`, which time-slices row processing under a per-step budget (default ~7 ms) and returns a cancel function — keep heavy synthesis on that path so the frame rate does not drop. All procedural randomness uses the seeded PRNG `seeded()` from `math.ts` (often seeded from `hashString(id)`), so output is deterministic per body; don't use `Math.random()` for anything that should look the same across reloads.

### Data and assets

- `src/data/solar.ts` defines planets, dwarf planets and small bodies in scene units (orbital elements, axial tilts in `declinations`, highlighted moons in `featured`). Moon orbital elements come from `src/data/moons.json`, keyed by parent planet id (JPL-style records with `frame` = `ecliptic` / `Laplace` / …).
- `World` and `Moon` (`scene/types.ts`) are classes that copy their definition record in and are then decorated at runtime with meshes, orbits and DOM tags.
- `src/data/archive.ts` builds `ArchiveEntry` records (solar-system bodies plus deep-sky `河外星系` / `恒星` / `系外行星`) used by the archive dialog, search and deep-sky mode.
- `src/data/assets.ts` auto-discovers images with `import.meta.glob` and keys them by **file name without extension** (`textures/Jupiter.jpg` → `sources.Jupiter`). Adding an asset is just dropping a file in the right folder; its base name must match the body id or archive id that looks it up. `vite.config.ts` sets `assetsInlineLimit: 0` (every image is a separate file) and splits `three` into its own chunk.

### Other

- `three` is pinned to `~0.160`; check API changes before upgrading.
- `outputs/solar-system.html` is the pre-migration single-file version, kept only for visual comparison. Don't edit it or import from it.
