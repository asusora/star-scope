<script setup lang="ts">
import { useTemplateRef } from 'vue'
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
defineExpose({ open: () => dialog.value?.showModal() })
</script>
<template>
  <dialog ref="dialog" id="guide" @click.self="dialog?.close()" aria-labelledby="guideTitle">
    <div class="dialog-kicker">SYSTEM MANUAL // 操作指南</div>
    <div class="dialog-head">
      <h2 id="guideTitle">使用说明</h2>
      <button id="closeGuide" @click="dialog?.close()" aria-label="关闭说明">
        <svg class="ui-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
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
      4.0），经缩放和压缩。拉近观察时会载入更精细的表面。地球分别使用昼面、夜灯、云层、地形法线和水面反光贴图；云层随时间移动。土星环的条带会在受光的云顶投下阴影。其余卫星采用示意材质。
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
  </dialog>
</template>
