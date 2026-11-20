<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { isEn, pick } from '../i18n'

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
defineExpose({ open: () => dialog.value?.showModal() })
</script>
<template>
  <dialog ref="dialog" id="guide" @click.self="dialog?.close()" aria-labelledby="guideTitle">
    <div class="dialog-kicker">
      {{ pick('SYSTEM MANUAL // 操作指南', 'SYSTEM MANUAL // USER GUIDE') }}
    </div>
    <div class="dialog-head">
      <h2 id="guideTitle">{{ pick('使用说明', 'User Guide') }}</h2>
      <button
        id="closeGuide"
        @click="dialog?.close()"
        :aria-label="pick('关闭说明', 'Close Guide')"
      >
        <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <template v-if="isEn">
      <p>
        Drag to orbit; right-drag or Shift-drag to pan. Scroll to zoom toward the cursor; on touch
        screens, pinch to zoom and drag with two fingers to pan. Use Reset to return to the active
        target.
      </p>
      <p>
        Switch between the Solar System and the Milky Way at top right. Open “Notes” for curated
        astronomy commentary, and click scene pins to switch topics. Clicking the Solar System
        marker in the Milky Way zooms back to planetary orbits.
      </p>
      <p>
        Open “Explore” at the bottom to jump directly to any planet, minor body, galaxy, star, or
        exoplanet system. Galaxies offer oblique, face-on, and edge-on presets; exoplanets toggle
        between close-up and full-system views. “Photos &amp; Info” preserves real telescope
        imagery, spacecraft photographs, and primary sources.
      </p>
      <p>
        The Solar System overview spans all eight planets, 22 major dwarf planets and minor bodies,
        and five regions: the Main Asteroid Belt (with the Hilda group), Jupiter Trojans (L4/L5),
        the Centaur Belt, the Kuiper Belt, and the Scattered Disc / Inner Oort zone. Click any belt
        or select it from the dock to browse representative worlds; zoom out to inspect extreme
        elliptical orbits like Sedna.
      </p>
      <p>
        Switch orbit display modes in the dock. Smart mode keeps only the eight planetary orbits
        visible and illuminates minor-body or moon orbits individually on hover, approach, or
        selection. Choose “All” to display every cataloged orbit or “Off” for an unobstructed view.
      </p>
      <p>
        Select any Solar System body and click “Land” to descend onto a simulated landscape. Move
        with WASD and look around by dragging or using arrow keys (or touch controls). Gas and ice
        giants provide an upper-cloud flight mode. Press Esc or “Return to Orbit” to exit.
      </p>
      <h3>Models &amp; Data</h3>
      <p>
        Landing sites use procedurally generated terrain with grayscale surface detail derived from
        Poly Haven materials tinted per body.
        <a href="https://polyhaven.com/a/gravel_floor" target="_blank" rel="noopener"
          >Gravel Floor ↗</a
        >
        ·
        <a href="https://polyhaven.com/a/rocky_terrain_02" target="_blank" rel="noopener"
          >Rocky Terrain 02 ↗</a
        >
      </p>
      <p>
        Includes 8 planets, 22 representative dwarf planets and minor bodies (across the Main Belt,
        Jupiter Trojans, Centaurs, Kuiper Belt, Scattered Disc, and detached Inner Oort Cloud), and
        470 known natural satellites. Sizes, orbital distances, and periods are logarithmically and
        piecewise scaled for clarity; moons can be searched by name, Roman numeral, or provisional
        designation.
      </p>
      <p>
        The six external galaxies reconstruct 3D luminous distributions from observed imagery, with
        line-of-sight depth and disk thickness estimated morphologically. Andromeda additionally
        uses NASA/ESA/DSS 2 wide-field imagery (credit Davide De Martin) and Triangulum uses ESO/VST
        data. Stellar surfaces and exoplanet atmospheres are illustrative.
        <a href="https://esahubble.org/images/heic1502b/" target="_blank" rel="noopener"
          >Andromeda Wide-Field ↗</a
        >
        ·
        <a href="https://www.eso.org/public/images/eso1424a/" target="_blank" rel="noopener"
          >Triangulum Wide-Field ↗</a
        >
      </p>
      <p>
        Pluto’s surface uses the New Horizons global color mosaic with unmapped southern regions
        neutrally filled. Other dwarf planets and asteroids use illustrative textures. Minor-body
        heliocentric elements come from JPL.
        <a
          href="https://science.nasa.gov/resource/pluto-global-color-map/"
          target="_blank"
          rel="noopener"
          >NASA/JHUAPL/SwRI Pluto Map ↗</a
        >
        ·
        <a href="https://ssd.jpl.nasa.gov/sb/orbits.html" target="_blank" rel="noopener"
          >JPL Small-Body Orbits ↗</a
        >
      </p>
      <p>
        Planet, Sun, Moon, and starfield textures derive from Solar System Scope (CC BY 4.0).
        Close-ups of Mercury, the Moon, and Mars incorporate MESSENGER stereo DEM, LRO LOLA, and MGS
        MOLA elevation data for terrain relief.
        <a
          href="https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m"
          target="_blank"
          rel="noopener"
          >USGS Mercury DEM ↗</a
        >
        ·
        <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener"
          >NASA SVS Lunar DEM ↗</a
        >
        ·
        <a href="https://pds-geosciences.wustl.edu/missions/mgs/megdr.html" target="_blank" rel="noopener"
          >NASA PDS Mars DEM ↗</a
        >
      </p>
      <p>
        The four Galilean moons, five major Uranian moons, and Triton use spacecraft mosaics curated
        by NASA/JPL, Caltech, and USGS. Six icy Saturnian moons use Cassini enhanced-color maps
        (NASA/JPL-Caltech/SSI/LPI), and Charon uses the New Horizons basemap. Unimaged regions are
        procedurally completed.
        <a href="https://maps.jpl.nasa.gov/tmaps/jupiter.html" target="_blank" rel="noopener"
          >JPL Satellite Maps ↗</a
        >
        ·
        <a
          href="https://science.nasa.gov/photojournal/color-maps-of-enceladus-2014/"
          target="_blank"
          rel="noopener"
          >Cassini Satellite Maps ↗</a
        >
        ·
        <a
          href="https://science.nasa.gov/photojournal/charons-surface-in-detail/"
          target="_blank"
          rel="noopener"
          >New Horizons Charon Map ↗</a
        >
        ·
        <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener"
          >USGS Planetary Nomenclature ↗</a
        >
      </p>
      <p>
        The Archive includes a “Spacecraft Photos” category featuring 49 Solar System bodies (51
        real images) photographed by flyby, orbiter, or lander missions, each annotated with
        spacecraft, capture date, and source credit to clearly distinguish real photography from 3D
        models, alongside verified discovery years for all cataloged bodies.
        <a href="https://photojournal.jpl.nasa.gov/" target="_blank" rel="noopener"
          >NASA/JPL Photojournal ↗</a
        >
      </p>
      <p>
        Planetary oblateness is estimated from JPL mean and equatorial radii; rotation rates are
        scaled for observation. The Milky Way illustration is based on NASA/JPL-Caltech/ESO/R. Hurt.
        <a href="https://ssd.jpl.nasa.gov/planets/phys_par.html" target="_blank" rel="noopener"
          >JPL Physical Parameters ↗</a
        >
        ·
        <a href="https://www.eso.org/public/images/eso1339g/" target="_blank" rel="noopener"
          >ESO Milky Way ↗</a
        >
      </p>
      <div class="sources">
        <a href="https://ssd.jpl.nasa.gov/sats/discovery.html" target="_blank" rel="noopener"
          >JPL Moon Discoveries ↗</a
        ><a href="https://ssd.jpl.nasa.gov/sats/elem/" target="_blank" rel="noopener"
          >JPL Moon Orbits ↗</a
        ><a
          href="https://tamkin3.eps.harvard.edu/iauc/09000/09091.html"
          target="_blank"
          rel="noopener"
          >IAUC 9091 ↗</a
        ><a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener"
          >Solar System Scope ↗</a
        ><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener"
          >CC BY 4.0 ↗</a
        >
      </div>
    </template>

    <template v-else>
      <p>
        拖动旋转，右键或 Shift
        加拖动平移。滚轮向指针所指的区域缩放；触屏上双指捏合缩放、双指同向拖动平移。复位键可回到当前目标。
      </p>
      <p>
        从右上角切换太阳系与银河系。点“注释”查看当前视图的天文说明，点图中的标记可切换讲解。银河系中的太阳系标记可带你回到行星轨道。
      </p>
      <p>
        展开「天体导航」并点选天体，即可进入它的三维视图。拖动环绕，滚动或双指缩放。星系可切换俯视、侧视；系外行星可切换特写和系统全景。「原图与资料」保留观测影像、艺术想象图与来源。
      </p>
      <p>
        全景中可见八大行星、各大矮行星、半人马天体与极远天体，以及主小行星带（含希尔达族）、木星特洛伊群（L4/L5）、半人马小天体带、柯伊伯带与离散盘/内奥尔特云。点击任意小天体带或从导航进入，可浏览其代表天体；拉远视角可完整观察赛德娜等极远天体的椭圆轨道。
      </p>
      <p>
        底部导航可切换轨道显示。智能模式下始终只保留太阳系八大行星轨道，不会因拉近视角而铺满轨道线；仅当鼠标悬停、放大靠近或点击选中具体矮行星/小天体与卫星时，才单独亮起它的轨道。选择「全部」可一次性显示全部收录天体的轨道，「关闭」可只看天体。
      </p>
      <p>
        选中太阳系天体后，点击「着陆」可下降到模拟地表。用 WASD
        移动，拖动或按方向键环顾；触屏可按住方向按钮。木星、土星、天王星和海王星提供云层飞行。按 Esc
        或「返回轨道」结束漫游。
      </p>
      <h3>模型与数据</h3>
      <p>
        着陆区使用程序生成的地貌。地面细节采用 Poly Haven 的实拍材质，经灰度处理后按天体着色。
        <a href="https://polyhaven.com/a/gravel_floor" target="_blank" rel="noopener"
          >Gravel Floor ↗</a
        >
        ·
        <a href="https://polyhaven.com/a/rocky_terrain_02" target="_blank" rel="noopener"
          >Rocky Terrain 02 ↗</a
        >
      </p>
      <p>
        收录八大行星、22 颗代表性矮行星与小天体（涵括主小行星带、木星特洛伊群、巨行星间的半人马小天体带、柯伊伯带、离散盘及内奥尔特云分离天体），以及这些天体的 470 颗已知天然卫星。天体大小、轨道间距及周期差异经科学分段/对数缩放以便同屏观察，卫星可按常用译名、英文名或编号检索。
      </p>
      <p>
        六个河外星系根据观测影像的亮度与颜色建立三维发光分布，沿视线的深度和盘厚采用形态模型估计。仙女座星系的模型另用
        NASA/ESA/DSS 2 的广域图（致谢 Davide De Martin），三角座星系另用 ESO/VST
        广域图。恒星表面和系外行星的地貌、云层与颜色为示意。<a
          href="https://esahubble.org/images/heic1502b/"
          target="_blank"
          rel="noopener"
          >仙女座广域图 ↗</a
        >
        ·
        <a href="https://www.eso.org/public/images/eso1424a/" target="_blank" rel="noopener"
          >三角座广域图 ↗</a
        >
      </p>
      <p>
        冥王星纹理采用新视野号拼接图，未测绘的南部区域以中性色填充。其他矮行星和小行星表面为示意。小天体日心轨道参数来自
        JPL，部分卫星轨道方向为示意。<a
          href="https://science.nasa.gov/resource/pluto-global-color-map/"
          target="_blank"
          rel="noopener"
          >NASA/JHUAPL/SwRI 冥王星图 ↗</a
        >
        ·
        <a href="https://ssd.jpl.nasa.gov/sb/orbits.html" target="_blank" rel="noopener"
          >JPL 小天体轨道 ↗</a
        >
      </p>
      <p>
        行星、太阳、月球和星空纹理来自 Solar System Scope（CC BY
        4.0），经缩放和压缩。水星、月球和火星近景分别使用信使号立体测绘、月球勘测轨道器 LOLA 和火星全球探勘者号 MOLA 的高程数据，适度强化坡度以显示地形。地球云影随日照角度移动。金星、四颗巨行星和土卫六的云带运动、天王星的极区薄雾与离散亮云均为示意。土星环斜看时透光减弱，环影落在云顶。
        <a href="https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m" target="_blank" rel="noopener">USGS 水星高程 ↗</a> ·
        <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener">NASA SVS 月球高程 ↗</a> ·
        <a href="https://pds-geosciences.wustl.edu/missions/mgs/megdr.html" target="_blank" rel="noopener">NASA PDS 火星高程 ↗</a>
      </p>
      <p>
        四颗伽利略卫星、天王星五颗主要卫星和海卫一采用 NASA/JPL、Caltech 与 USGS 整理的探测器拼图。六颗土星冰卫星采用卡西尼号增强色地图（NASA/JPL-Caltech、空间科学研究所、月球与行星研究所）。冥卫一采用新视野号底图。天王星五颗主要卫星、海卫一和冥卫一底图的空白区域以示意地貌补全。木卫一夜侧热点的亮度为示意。火星两颗卫星、海卫二、海卫八及冥王星的小卫星按各自的形状和地貌特征建模。
        <a href="https://maps.jpl.nasa.gov/tmaps/jupiter.html" target="_blank" rel="noopener">JPL 卫星拼图 ↗</a> ·
        <a href="https://science.nasa.gov/photojournal/color-maps-of-enceladus-2014/" target="_blank" rel="noopener">卡西尼号卫星地图 ↗</a> ·
        <a href="https://science.nasa.gov/photojournal/charons-surface-in-detail/" target="_blank" rel="noopener">新视野号冥卫一底图 ↗</a> ·
        <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener">USGS 撞击坑与火山坐标 ↗</a>
      </p>
      <p>
        主小行星带（含柯克伍德空隙与 3:2 共振希尔达族）、木星与海王星特洛伊群（L4/L5 同步共轨）、巨行星间半人马小天体带、柯伊伯带、离散盘与内奥尔特云均以三维模型与远景微尘示意；女凯龙星双冰环、凯龙星彗发与环盘、创神星洛希极限外双环及阿罗科斯双瓣形态均依据 NASA 黎明号、新视野号、露西号、灵神星号、CHEOPS 与韦布望远镜等真实探测成果建模。银河系绘图由
        NASA/JPL-Caltech/ESO/R. Hurt 制作，在本图中经缩放并用于三维星盘与星点采样。<a
          href="https://www.eso.org/public/images/eso1339g/"
          target="_blank"
          rel="noopener"
          >ESO 原图 ↗</a
        >
      </p>
      <p>
        星图档案新增「探测器实拍」分类，收录 49 颗曾有航天器飞掠、环绕或着陆拍摄的太阳系天体（共 51 幅真实影像），均标明探测器、拍摄时间与影像来源以区别于场景模型；所有天体档案并补充核对后的发现年份。实拍影像主要来自 NASA/JPL Planetary Photojournal 与新视野号任务发布。<a
          href="https://photojournal.jpl.nasa.gov/"
          target="_blank"
          rel="noopener"
          >NASA/JPL Photojournal ↗</a
        >
      </p>
      <p>
        行星的极径与赤道半径之比由 JPL 的平均半径和赤道半径估算，自转周期经压缩以便观察。<a
          href="https://ssd.jpl.nasa.gov/planets/phys_par.html"
          target="_blank"
          rel="noopener"
          >JPL 行星物理参数 ↗</a
        >
      </p>
      <div class="sources">
        <a href="https://ssd.jpl.nasa.gov/sats/discovery.html" target="_blank" rel="noopener"
          >JPL 卫星名录 ↗</a
        ><a href="https://ssd.jpl.nasa.gov/sats/elem/" target="_blank" rel="noopener"
          >JPL 卫星轨道根数 ↗</a
        ><a
          href="https://tamkin3.eps.harvard.edu/iauc/09000/09091.html"
          target="_blank"
          rel="noopener"
          >IAUC 9091 ↗</a
        ><a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener"
          >Solar System Scope 纹理 ↗</a
        ><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener"
          >CC BY 4.0 ↗</a
        >
      </div>
    </template>
  </dialog>
</template>
