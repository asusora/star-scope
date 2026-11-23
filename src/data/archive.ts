import { comets } from './comets'
import { cometProfile } from './cometProfiles'
import { archivePhotos, thumbs } from './assets'
import { getProbePhotos } from './probePhotos'
import type { ArchiveEntry, World } from '../scene/types'
export const jplFacts = 'https://ssd.jpl.nasa.gov/sats/elem/'
export const moonSources: Record<string, string> = {
  Makemake: 'https://arxiv.org/abs/2509.05880',
  Haumea: 'https://doi.org/10.1088/0004-6256/137/6/4766',
  Eris: 'https://arxiv.org/abs/2009.13733',
  Orcus: 'https://doi.org/10.1088/0004-6256/139/6/2700',
  Quaoar: 'https://doi.org/10.1038/s41586-022-05629-6',
  Gonggong: 'https://doi.org/10.1016/j.icarus.2019.03.013',
  Patroclus: 'https://doi.org/10.1038/nature04350',
  Eurybates: 'https://doi.org/10.3847/PSJ/abb772',
}
export function normalized(s: string) {
  return String(s)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f\s/'’ʻ()_-]/g, '')
}
export function createArchive(worlds: World[]): ArchiveEntry[] {
  const messierBase =
    'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-'
  // Galaxy center coordinates in ICRS degrees from the CDS SIMBAD catalogue.
  const catalogEntries: ArchiveEntry[] = [
    {
      id: 'm31',
      sky: { ra: 10.684708, dec: 41.268750 },
      title: '仙女座星系',
      code: 'M31 · NGC 224',
      alt: 'Andromeda Galaxy',
      distance: '约 250 万光年',
      place: '仙女座',
      discovered: '自古已知（964 年见于记载）',
      body: '与银河系同属本星系群。星盘相对我们大幅倾斜，从地球看去呈细长的椭圆形。照片是哈勃拼接的部分星盘。',
      credit: 'NASA、ESA、PHAT 团队、J. Dalcanton、B. F. Williams、L. C. Johnson 与 R. Gendler',
    },
    {
      id: 'm33',
      sky: { ra: 23.462069, dec: 30.660175 },
      title: '三角座星系',
      code: 'M33 · NGC 598',
      alt: 'Triangulum Galaxy',
      distance: '约 300 万光年',
      place: '三角座',
      discovered: '1654 年前（1764 年编目）',
      body: '本星系群的另一个旋涡星系。沿旋臂可以看到密集的年轻恒星和形成恒星的区域。',
      credit: 'NASA、ESA、M. Durbin、J. Dalcanton 与 B. F. Williams',
    },
    {
      id: 'm51',
      sky: { ra: 202.469575, dec: 47.195258 },
      title: '涡状星系',
      code: 'M51 · NGC 5194',
      alt: 'Whirlpool Galaxy',
      distance: '约 3100 万光年',
      place: '猎犬座',
      discovered: '1773 年',
      body: '从地球看过去，它几乎正面朝向我们。两条明亮旋臂向外延伸，旁边可见与之相互作用的伴星系。',
      credit: 'NASA、ESA、S. Beckwith 与 Hubble Heritage Team（STScI/AURA）',
    },
    {
      id: 'm104',
      sky: { ra: 189.997633, dec: -11.623054 },
      title: '草帽星系',
      code: 'M104 · NGC 4594',
      alt: 'Sombrero Galaxy 宽边帽星系',
      distance: '约 2800 万光年',
      place: '室女座',
      discovered: '1781 年',
      body: '接近侧向的视角让深色尘埃带横贯明亮的中央核球，形成了像宽檐帽一样的轮廓。',
      credit: 'NASA 与 Hubble Heritage Team（STScI/AURA）',
    },
    {
      id: 'm82',
      sky: { ra: 148.968458, dec: 69.679703 },
      title: '雪茄星系',
      code: 'M82 · NGC 3034',
      alt: 'Cigar Galaxy',
      distance: '约 1200 万光年',
      place: '大熊座',
      discovered: '1774 年',
      body: '沿侧面看去，M82 的星盘细长如雪茄。中心区域正大量形成恒星，红色气体从星盘向外延伸。',
      credit:
        'NASA、ESA、Hubble Heritage Team（STScI/AURA）；致谢 J. Gallagher、M. Mountain、P. Puxley',
    },
    {
      id: 'm87',
      sky: { ra: 187.705931, dec: 12.391123 },
      title: '室女座 A',
      code: 'M87 · NGC 4486',
      alt: 'Virgo A 室女A 室女座A星系 M87星系',
      distance: '约 5400 万光年',
      place: '室女座',
      discovered: '1781 年',
      body: '这座巨椭圆星系的中心有一颗超大质量黑洞。一束高速物质从核心喷出，在哈勃影像中显出蓝色。',
      credit: 'NASA、ESA、Hubble Heritage Team（STScI/AURA）；致谢 P. Côté、E. Baltz',
    },
  ].map((e) => ({
    ...e,
    group: '河外星系' as const,
    photo: archivePhotos[e.id],
    caption: '哈勃望远镜观测影像',
    facts: [
      ['距离', e.distance],
      ['星座', e.place],
      ['发现年份', e.discovered],
    ],
    source: messierBase + e.id.slice(1) + '/',
  }))
  for (const e of [
    {
      id: 'sirius',
      title: '天狼星',
      code: 'Sirius · α Canis Majoris',
      alt: '大犬座α Sirius A Sirius B',
      distance: '约 8.6 光年',
      place: '大犬座',
      type: '双星系统',
      discovered: '自古已知（伴星 1862 年发现）',
      body: '明亮的天狼星 A 与暗弱的白矮星天狼星 B 约每 50 年互绕一周。哈勃影像中，主星的光芒几乎淹没了伴星。',
      caption: '哈勃望远镜观测影像',
      credit: 'NASA、ESA、H. Bond（STScI）、M. Barstow（University of Leicester）',
      source: 'https://esahubble.org/images/heic0516a/',
    },
    {
      id: 'betelgeuse',
      title: '参宿四',
      code: 'Betelgeuse · α Orionis',
      alt: '猎户座α',
      distance: '约 600 光年',
      place: '猎户座',
      type: '红超巨星',
      discovered: '自古已知',
      body: '参宿四位于猎户座的肩部。ALMA 在毫米波波段分辨出了它延展的大气层，盘面上一块区域比周围更亮。',
      caption: 'ALMA 毫米波观测影像',
      credit: 'ALMA（ESO/NAOJ/NRAO）/ E. O’Gorman / P. Kervella',
      source: 'https://www.eso.org/public/images/potw1726a/',
    },
    {
      id: 'vega',
      title: '织女星',
      code: 'Vega · α Lyrae',
      alt: '天琴座α 织女一',
      distance: '约 25 光年',
      place: '天琴座',
      type: '主序星',
      discovered: '自古已知',
      body: '织女星周围有一片近乎正面朝向我们的尘埃盘。韦布在中红外波段记录了暖尘的辐射，揭示出盘内平滑的结构。',
      caption: '织女星周围的尘埃盘 · 韦伯中红外观测',
      credit: 'NASA、ESA、CSA、STScI、K. Su、A. Gáspár（University of Arizona）',
      source: 'https://science.nasa.gov/asset/hubble/vega-webb-compass-image/',
    },
    {
      id: 'proxima',
      title: '比邻星',
      code: 'Proxima Centauri · α Centauri C',
      alt: '半人马座α星C 毗邻星',
      distance: '约 4.2 光年',
      place: '半人马座',
      type: '红矮星',
      discovered: '1915 年',
      body: '这是离太阳最近的恒星。它本身十分暗弱，肉眼难以看见，偶尔却会因耀斑而增亮。「比邻星 b」是绕它运行的行星。',
      caption: '哈勃望远镜观测影像',
      credit: 'ESA/Hubble 与 NASA',
      source: 'https://esahubble.org/images/potw1343a/',
    },
  ]) {
    catalogEntries.push({
      ...e,
      group: '恒星',
      photo: archivePhotos[e.id],
      facts: [
        ['类型', e.type],
        ['距离', e.distance],
        ['星座', e.place],
        ['发现年份', e.discovered],
      ],
    })
  }
  for (const [id, title, code, days, year, type, body] of [
    [
      'proxima-centauri-b',
      '比邻星 b',
      'Proxima Centauri b',
      '11.2 天',
      '2016',
      '超级地球',
      '环绕比邻星这颗红矮星运行。它在大约十一个地球日内就绕恒星一周。',
    ],
    [
      'trappist-1-e',
      'TRAPPIST-1 e',
      'TRAPPIST-1 e',
      '6.1 天',
      '2017',
      '类地行星',
      '它是 TRAPPIST-1 多行星系统的一员，绕一颗低温的 M 型恒星运行。',
    ],
    [
      '51-pegasi-b',
      '飞马座 51 b',
      '51 Pegasi b',
      '4.2 天',
      '1995',
      '气态巨行星',
      '这颗热木星非常靠近母恒星，轨道半长轴约 0.052 个天文单位。',
    ],
    [
      '55-cancri-e',
      '巨蟹座 55 e',
      '55 Cancri e · Janssen',
      '约 0.7 天',
      '2004',
      '超级地球',
      '它紧贴母恒星运行，公转一周不到一个地球日。',
    ],
    [
      'kepler-452-b',
      '开普勒-452 b',
      'Kepler-452 b',
      '384.8 天',
      '2015',
      '超级地球',
      '它绕一颗 G 型恒星运行，一年比地球长约 20 天。它与母恒星的轨道距离约为日地距离的 1.05 倍。',
    ],
    [
      'hd-209458-b',
      '奥西里斯',
      'HD 209458 b · Osiris',
      '约 3.5 天',
      '1999',
      '气态巨行星',
      '它是一颗紧靠母恒星的热木星。「奥西里斯」是它的非正式昵称。行星从恒星前方经过时，星光穿过其大气，为研究大气成分提供了线索。',
    ],
  ]) {
    const artwork =
      id === 'hd-209458-b'
        ? {
            credit: 'NASA、ESA、G. Bacon（STScI）',
            imageSource: 'https://esahubble.org/images/opo1436a/',
          }
        : { credit: 'NASA 系外行星目录' }
    const discovered = `${year} 年`
    catalogEntries.push({
      id,
      title,
      code,
      group: '系外行星',
      discovered,
      photo: archivePhotos[id],
      caption: '艺术想象图',
      ...artwork,
      body,
      facts: [
        ['类型', type],
        ['公转周期', days],
        ['发现年份', discovered],
      ],
      source: 'https://science.nasa.gov/exoplanet-catalog/' + id + '/',
    })
  }
  const regionNames: Record<string, string> = {
    main: '主小行星带（火星–木星之间）',
    trojan: '木星特洛伊群（L4/L5 共轨区）',
    centaur: '半人马小天体带（巨行星之间）',
    outer: '柯伊伯带（海王星外 30–50 AU）',
    scattered: '离散盘与内奥尔特云（50 AU 以外）',
    oort: '外奥尔特云与引力边界（2,000–150,000 AU）',
  }
  const upcomingMissions: Record<string, string> = {
    Psyche: '暂无（灵神星号在途，预计 2029 年抵达）',
    Eurybates: '暂无（露西号在途，预计 2027 年飞掠）',
    Patroclus: '暂无（露西号在途，预计 2033 年飞掠）',
  }
  const worldAliases: Record<string, string> = {
    Psyche: '16 Psyche 金属小行星 灵神星号',
    Eurybates: '3548 Eurybates 露西号 希腊营 L4',
    Patroclus: '617 Patroclus 露西号 特洛伊营 L5',
    Chiron: '2060 Chiron 95P 凯龙',
    Chariklo: '10199 Chariklo 查莉克洛 环带',
    Pholus: '5145 Pholus 福罗斯',
    Orcus: '90482 Orcus 反冥王星 亡神',
    Quaoar: '50000 Quaoar 夸欧尔 创神',
    Arrokoth: '486958 Arrokoth 2014 MU69 天涯海角 Ultima Thule',
    Gonggong: '225088 Gonggong 2007 OR10 共工',
    Farfarout: '2018 AG37 远极星 Farfarout 最远天体',
    VP113: '2012 VP113 拜登 类赛德娜 分离天体',
    Sedna: '90377 Sedna 赛德娜 塞德娜 内奥尔特云',
    Leleakuhonua: 'Leleakuhonua The Goblin 哥布林 类赛德娜',
  }
  for (const p of worlds) {
    const worldProbes = getProbePhotos(p.id)
    const facts: string[][] = [
      ['类别', p.kind || '行星'],
      ['发现年份', p.discovered || '未列出'],
      ['卫星数', String(p.moons.length)],
      ['公转周期', (p.days / 365.25).toFixed(p.days > 36525 ? 0 : 2) + ' 年'],
    ]
    if (p.au) {
      facts.push([
        '日心轨道',
        p.periAU && p.apoAU && Math.abs(p.apoAU - p.periAU) > 1
          ? `${p.au.toFixed(p.au >= 100 ? 0 : 1)} AU（${p.periAU.toFixed(1)}–${p.apoAU.toFixed(p.apoAU >= 100 ? 0 : 1)} AU）`
          : `${p.au.toFixed(2)} AU`,
      ])
    }
    if (p.region && regionNames[p.region]) {
      facts.push(['所属区域', regionNames[p.region]])
    }
    facts.push([
      '探测器实拍',
      worldProbes
        ? `已收录 ${worldProbes.length} 张实拍`
        : upcomingMissions[p.id] || '暂无近距实拍',
    ])
    catalogEntries.push({
      id: p.id,
      title: p.name,
      code: p.code || p.id,
      alt: worldAliases[p.id],
      group: '太阳系',
      discovered: p.discovered,
      photo: thumbs[p.id],
      caption: '场景模型',
      probePhotos: worldProbes,
      object: p,
      facts,
      body:
        p.summary ||
        (p.region === 'main'
          ? '位于火星和木星之间的主小行星带。'
          : p.region === 'outer'
            ? '轨道延伸至海王星之外，可在柯伊伯带视图中沿轨道跟随观察。'
            : '从三维场景靠近这颗行星，可以跟随它公转并查看卫星目录。'),
      source: p.source || 'https://science.nasa.gov/' + p.id.toLowerCase() + '/',
    })
    for (const m of p.moons) {
      const moonId = p.id + '-' + m.name
      const moonProbes = getProbePhotos(moonId)
      const moonFacts: string[][] = [
        ['母天体', p.name],
        ['发现年份', m.discovered || '未列出'],
        [m.estimate ? '观测距离' : '轨道半长轴', m.a.toLocaleString('zh-CN') + ' km'],
        ['公转周期', m.period ? m.period + ' 天' : '未列出'],
        [
          '探测器实拍',
          moonProbes
            ? `已收录 ${moonProbes.length} 张实拍`
            : upcomingMissions[p.id]
              ? '暂无（露西号计划探测所属系统）'
              : '暂无近距实拍',
        ],
      ]
      catalogEntries.push({
        id: moonId,
        title: m.label,
        code: [...new Set([m.numberName, m.name].filter((s) => s && s !== m.label))].join(' · '),
        group: '太阳系',
        discovered: m.discovered,
        probePhotos: moonProbes,
        moon: m,
        object: p,
        keys: m.searchNames,
        featured: m.featured,
        body: m.otherNames.length
          ? '也可以用' + m.otherNames.join('、') + '查找这颗卫星。'
          : m.name + ' 环绕' + p.name + '运行。',
        facts: moonFacts,
        source:
          moonSources[p.id] ||
          (m.estimate ? 'https://tamkin3.eps.harvard.edu/iauc/09000/09091.html' : jplFacts),
      })
    }
  }
  for (const comet of comets) {
    catalogEntries.push({ ...cometProfile(comet, 'zh'), id: comet.id, comet,
      alt: comet.en, group: '太阳系', probePhotos: getProbePhotos(comet.id) })
  }
  return catalogEntries
}
