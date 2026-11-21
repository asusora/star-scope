import { probePhotoSources } from './assets'
import type { ProbePhoto } from '../scene/types'

interface ProbePhotoSpec {
  id: string
  title: string
  description: string
  probe: string
  date: string
  credit: string
  source?: string
}

const photojournal = (id: string) => `https://photojournal.jpl.nasa.gov/catalog/${id}`

const rawProbePhotos: Record<string, ProbePhotoSpec[]> = {
  '1P': [{
    id: 'halley-giotto',
    title: '乔托号飞掠哈雷彗核',
    description: '明亮的喷流从彗核受太阳照射的一侧向外延伸，背后可辨认出细长而暗的彗核轮廓。',
    probe: '乔托号（ESA Giotto）', date: '1986 年 3 月', credit: 'Halley Multicolor Camera Team / Giotto Project / ESA',
    source: 'https://science.nasa.gov/solar-system/comets/1p-halley/',
  }],
  Mercury: [
    {
      id: 'PIA10179',
      title: '信使号首次飞掠水星全貌',
      description: '信使号抵近水星时拍摄的月牙面影像，清晰记录密集的古老撞击坑与地貌轮廓。',
      probe: '信使号（MESSENGER）',
      date: '2008 年 1 月 14 日',
      credit: 'NASA / JHUAPL / CIW',
    },
  ],
  Venus: [
    {
      id: 'PIA23791',
      title: '水手 10 号金星云层影像',
      description: '依据水手 10 号原始飞掠数据重制：左图为近似自然色，右图经增强对比度突出浓密云带结构。',
      probe: '水手 10 号（Mariner 10）',
      date: '1974 年 2 月 7–8 日',
      credit: 'NASA / JPL-Caltech / Kevin M. Gill',
    },
  ],
  Earth: [
    {
      id: 'PIA00114',
      title: '伽利略号飞掠地球自然色全盘',
      description: '伽利略号前往木星途中首次飞掠地球时拍摄，可见南美洲大陆、南大洋与大片白色云系。',
      probe: '伽利略号（Galileo）',
      date: '1990 年 12 月 11 日',
      credit: 'NASA / JPL',
    },
  ],
  'Earth-Moon': [
    {
      id: 'PIA00130',
      title: '伽利略号月球北极区拼接影像',
      description: '由伽利略号飞掠月球时通过绿滤镜拍摄的 18 幅影像拼接而成，展示北极附近月海与高地。',
      probe: '伽利略号（Galileo）',
      date: '1992 年 12 月 7 日',
      credit: 'NASA / JPL',
    },
  ],
  Mars: [
    {
      id: 'PIA24542',
      title: '毅力号与机智号耶泽罗坑地表自拍',
      description: '毅力号火星车机械臂相机在耶泽罗撞击坑拍摄的拼接自拍，右前方停放着机智号火星直升机。',
      probe: '毅力号火星车（Perseverance / WATSON）',
      date: '2021 年 4 月 6 日',
      credit: 'NASA / JPL-Caltech / MSSS',
    },
    {
      id: 'PIA19819',
      title: '机遇号“马拉松谷”地表实拍全景',
      description: '机遇号在奋进撞击坑边缘仰望“马拉松谷”岩壁与“欣纳斯角”地貌拍摄的真彩色拼接影像。',
      probe: '机遇号火星车（Opportunity / Pancam）',
      date: '2015 年 8 月 14 日',
      credit: 'NASA / JPL-Caltech / Cornell Univ. / Arizona State Univ.',
    },
  ],
  'Mars-Phobos': [
    {
      id: 'PIA10368',
      title: '火卫一增强色高分辨率特写',
      description: '从约 6800 千米处拍摄，清晰呈现右侧巨大的斯蒂克尼撞击坑以及横贯表面的平行沟槽。',
      probe: '火星勘测轨道飞行器（MRO / HiRISE）',
      date: '2008 年 3 月 23 日',
      credit: 'NASA / JPL-Caltech / University of Arizona',
    },
  ],
  'Mars-Deimos': [
    {
      id: 'PIA11826',
      title: '火卫二高分辨率双视角影像',
      description: '增强色影像揭示火卫二表面覆盖着厚重平滑的风化层，绝大多数撞击坑边缘已被碎屑填平。',
      probe: '火星勘测轨道飞行器（MRO / HiRISE）',
      date: '2009 年 2 月 21 日',
      credit: 'NASA / JPL-Caltech / University of Arizona',
    },
  ],
  Jupiter: [
    {
      id: 'PIA02856',
      title: '卡西尼号木星真彩色半球影像',
      description: '卡西尼号飞掠木星期间拍摄的真彩色全貌，展现赤道亮带、暗色云带与高纬斑驳大气涡旋。',
      probe: '卡西尼号（Cassini）',
      date: '2000 年 12 月 13 日',
      credit: 'NASA / JPL / University of Arizona',
    },
  ],
  'Jupiter-Io': [
    {
      id: 'PIA03530',
      title: '木卫一洛基火山区近掠影像',
      description: '伽利略号近距离拍摄到活跃的洛基（Loki）火山口及周边暗色熔岩流与亮色二氧化硫霜沉积。',
      probe: '伽利略号（Galileo）',
      date: '2001 年 10 月 16 日',
      credit: 'NASA / JPL / University of Arizona',
    },
  ],
  'Jupiter-Europa': [
    {
      id: 'PIA00502',
      title: '木卫二近似自然色与伪彩色对比',
      description: '左图为近似自然色，右图用红外与可见光合成增强冰壳裂纹、矿物沉积与普维尔撞击坑辐射纹。',
      probe: '伽利略号（Galileo）',
      date: '1996 年 9 月 7 日',
      credit: 'NASA / JPL / DLR',
    },
  ],
  'Jupiter-Ganymede': [
    {
      id: 'PIA24681',
      title: '朱诺号木卫三近掠高分辨率特写',
      description: '朱诺号近距飞掠时由 JunoCam 绿滤镜拍下，呈现古老暗区、明亮年轻撞击坑与长条形构造槽沟。',
      probe: '朱诺号（Juno / JunoCam）',
      date: '2021 年 6 月 7 日',
      credit: 'NASA / JPL-Caltech / SwRI / MSSS',
    },
  ],
  'Jupiter-Callisto': [
    {
      id: 'PIA00516',
      title: '木卫四瓦尔哈拉撞击盆地中心区',
      description: '高分辨率影像显示这一巨型多环撞击盆地中心分布着亮色冰峰与被暗色碎屑覆盖的平坦低地。',
      probe: '伽利略号（Galileo）',
      date: '1996 年 11 月 4 日',
      credit: 'NASA / JPL',
    },
  ],
  'Jupiter-Amalthea': [
    {
      id: 'PIA01074',
      title: '木卫五四视角飞掠拼图',
      description: '记录这颗不规则长形内卫星的先行与后行半球，可见表面大型撞击坑与起伏的山脊轮廓。',
      probe: '伽利略号（Galileo）',
      date: '1997 年 2–6 月',
      credit: 'NASA / JPL / Cornell University',
    },
  ],
  Saturn: [
    {
      id: 'PIA12513',
      title: '卡西尼号土星自然色全貌',
      description: '接近土星分点时拍摄，土星环几乎侧对镜头形成一道穿过盘面的细线，右侧可见土卫五。',
      probe: '卡西尼号（Cassini）',
      date: '2009 年 11 月 4 日',
      credit: 'NASA / JPL / SSI',
    },
    {
      id: 'PIA21348',
      title: '土星北极六边形急流近红外影像',
      description: '卡西尼号任务末期从北半球上空斜拍，清晰勾勒出标志性的北极六边形急流与平滑大气条带。',
      probe: '卡西尼号（Cassini）',
      date: '2017 年 6 月 28 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Mimas': [
    {
      id: 'PIA02266',
      title: '旅行者 1 号土卫一飞掠实拍',
      description: '正面呈现跨度达 130 千米的巨大赫歇尔撞击坑及其中央峰，赋予土卫一独特的辨识轮廓。',
      probe: '旅行者 1 号（Voyager 1）',
      date: '1980 年 11 月 12 日',
      credit: 'NASA / JPL',
    },
  ],
  'Saturn-Enceladus': [
    {
      id: 'PIA07758',
      title: '土卫二南极冰喷泉逆光实拍',
      description: '卡西尼号逆光观测清晰拍下从土卫二南极“虎皮条纹”裂隙喷向太空的水冰羽流。',
      probe: '卡西尼号（Cassini）',
      date: '2005 年 11 月 27 日',
      credit: 'NASA / JPL / SSI',
    },
  ],
  'Saturn-Tethys': [
    {
      id: 'PIA14622',
      title: '土卫三奥德修斯盆地北缘特写',
      description: '窄角相机近距离记录了巨型奥德修斯撞击盆地北部坑壁及密布小型陨坑的古老冰面。',
      probe: '卡西尼号（Cassini）',
      date: '2012 年 6 月 28 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Dione': [
    {
      id: 'PIA11532',
      title: '土卫四后行半球丝缕冰崖',
      description: '展现土卫四后行半球明亮的丝缕状构造，实为数百米高的断裂冰崖切过较暗冰壳所致。',
      probe: '卡西尼号（Cassini）',
      date: '2009 年 5 月 26 日',
      credit: 'NASA / JPL / SSI',
    },
  ],
  'Saturn-Rhea': [
    {
      id: 'PIA14605',
      title: '土卫五高分辨率重度陨坑表面',
      description: '近距拍摄揭示土卫五冰质地壳上层层叠加的撞击坑与局部断裂带。',
      probe: '卡西尼号（Cassini）',
      date: '2012 年 3 月 10 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Titan': [
    {
      id: 'PIA07232',
      title: '惠更斯号着陆土卫六首张地表彩色照',
      description: '人类首次从外太阳系卫星表面传回的实拍画面，橙色浓雾下散落着被液态烃冲刷圆润的水冰砾石。',
      probe: '惠更斯号着陆器（Huygens / DISR）',
      date: '2005 年 1 月 14 日',
      credit: 'ESA / NASA / JPL / University of Arizona',
    },
  ],
  'Saturn-Hyperion': [
    {
      id: 'PIA14580',
      title: '土卫七海绵状多孔表面特写',
      description: '卡西尼号飞掠影像展示这颗低密度冰卫星布满深邃陡峭撞击坑的奇特海绵状地貌。',
      probe: '卡西尼号（Cassini）',
      date: '2011 年 9 月 16 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Iapetus': [
    {
      id: 'PIA08372',
      title: '土卫八赤道山脊高分辨率特写',
      description: '近距拍摄赤道附近高达约 10 千米的独特隆起山脊与密布的深色撞击坑。',
      probe: '卡西尼号（Cassini）',
      date: '2007 年 9 月 10 日',
      credit: 'NASA / JPL / SSI',
    },
  ],
  'Saturn-Phoebe': [
    {
      id: 'PIA06062',
      title: '卡西尼号抵近土卫九序列影像',
      description: '进入土星轨道前夕连续拍摄的三幅接近影像，揭示这颗逆行外卫星表面明暗相间的地形与陨坑。',
      probe: '卡西尼号（Cassini）',
      date: '2004 年 6 月 4–7 日',
      credit: 'NASA / JPL / SSI',
    },
  ],
  'Saturn-Janus': [
    {
      id: 'PIA11534',
      title: '土卫十朝向土星一侧影像',
      description: '清晰展现这颗与土卫十一共享轨道的小型不规则冰卫星上的撞击坑地貌。',
      probe: '卡西尼号（Cassini）',
      date: '2009 年 5 月 25 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Epimetheus': [
    {
      id: 'PIA12725',
      title: '卡西尼号飞掠土卫十一近照',
      description: '在约 8.7 万千米处拍下土卫十一朝向土星的一面，布满大大小小的撞击坑。',
      probe: '卡西尼号（Cassini）',
      date: '2010 年 4 月 7 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Atlas': [
    {
      id: 'PIA09907',
      title: '土星 A 环外缘的土卫十五',
      description: '画面右上方紧贴土星 A 环外缘的亮点为土卫十五（Atlas），下方基勒环缝内同时可见土卫三十五。',
      probe: '卡西尼号（Cassini）',
      date: '2008 年 4 月 22 日',
      credit: 'NASA / JPL / SSI',
    },
  ],
  'Saturn-Prometheus': [
    {
      id: 'PIA17207',
      title: '土卫十六近距飞掠特写',
      description: '近距离呈现 F 环内侧牧羊卫星土卫十六细长、坑洼的马铃薯状外形，背景可见纤细的土星环带。',
      probe: '卡西尼号（Cassini）',
      date: '2015 年 12 月 6 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Pandora': [
    {
      id: 'PIA12690',
      title: '卡西尼号飞掠土卫十七实拍',
      description: '拍摄 F 环外侧牧羊卫星土卫十七的多孔冰岩轮廓，表面可见若干浅层撞击坑与浅沟。',
      probe: '卡西尼号（Cassini）',
      date: '2010 年 6 月 3 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Pan': [
    {
      id: 'PIA21436',
      title: '恩克环缝内的土卫十八双视角特写',
      description: '卡西尼号近掠拍下土卫十八标志性的核桃／飞碟状外形，赤道裙边由吸积的环带细粒堆积而成。',
      probe: '卡西尼号（Cassini）',
      date: '2017 年 3 月 7 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  'Saturn-Daphnis': [
    {
      id: 'PIA12698',
      title: '基勒环缝中的土卫三十五与引力波纹',
      description: '土卫三十五在土星 A 环狭窄的基勒环缝内运行，其微弱引力在环缝边缘掀起了清晰可见的波浪结构。',
      probe: '卡西尼号（Cassini）',
      date: '2010 年 7 月 5 日',
      credit: 'NASA / JPL-Caltech / SSI',
    },
  ],
  Uranus: [
    {
      id: 'PIA00032',
      title: '旅行者 2 号天王星真彩色与伪彩色对比',
      description: '左图呈现肉眼所见的淡青蓝色光滑云顶；右图经极端增强对比度揭示暗色极冠薄雾与大气环带。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1986 年 1 月 17 日',
      credit: 'NASA / JPL',
    },
  ],
  'Uranus-Ariel': [
    {
      id: 'PIA00037',
      title: '天卫一最近飞掠清晰滤镜影像',
      description: '展现纵横交错的断层裂谷（地堑）、光滑冰平原与撞击坑，显示其历史上曾经历剧烈地质活动。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1986 年 1 月 24 日',
      credit: 'NASA / JPL',
    },
  ],
  'Uranus-Umbriel': [
    {
      id: 'PIA00040',
      title: '天卫二近掠实拍与旺达亮环',
      description: '展示天王星最暗主要卫星布满撞击坑的南半球，顶部边缘附近可见反照率极高的神秘旺达坑亮环。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1986 年 1 月 24 日',
      credit: 'NASA / JPL',
    },
  ],
  'Uranus-Titania': [
    {
      id: 'PIA00039',
      title: '天卫三最高分辨率拼接影像',
      description: '旅行者 2 号飞掠天王星最大卫星的最清晰记录，右侧晨昏线附近清晰可见绵延数百千米的梅西纳大峡谷。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1986 年 1 月 24 日',
      credit: 'NASA / JPL',
    },
  ],
  'Uranus-Oberon': [
    {
      id: 'PIA00034',
      title: '天卫四最近飞掠实拍影像',
      description: '呈现天王星最外侧大卫星布满撞击坑的古老冰壳、明亮撞击辐射纹以及中央带暗色坑底的大型陨坑。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1986 年 1 月 24 日',
      credit: 'NASA / JPL',
    },
  ],
  'Uranus-Miranda': [
    {
      id: 'PIA00141',
      title: '天卫五拼贴式奇特地貌近照',
      description: '窄角相机近距离记录古老陨坑平原与同心槽沟冕区、陡峭悬崖突兀交界的罕见地质拼贴。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1986 年 1 月 24 日',
      credit: 'NASA / JPL',
    },
  ],
  Neptune: [
    {
      id: 'PIA02210',
      title: '旅行者 2 号海王星全盘彩色影像',
      description: '对比度增强彩色照片清晰呈现深蓝甲烷大气、著名的大暗斑风暴系统以及高空白色卷云带。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1989 年 8 月 14 日',
      credit: 'NASA / JPL',
    },
  ],
  'Neptune-Triton': [
    {
      id: 'PIA02246',
      title: '海卫一彩色合成飞掠影像',
      description: '展示海卫一偏粉白的南极氮冰极冠、暗色喷发条纹以及表面起伏如哈密瓜皮般的独特冰火山地形。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1989 年 8 月 20 日',
      credit: 'NASA / JPL',
    },
  ],
  'Neptune-Nereid': [
    {
      id: 'PIA00054',
      title: '旅行者 2 号海卫二远距实拍',
      description: '飞掠海王星系统期间对这颗高偏心率外卫星拍摄的唯一分辨轮廓影像，用于测定其尺寸与反照率。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1989 年 8 月 24 日',
      credit: 'NASA / JPL',
    },
  ],
  'Neptune-Proteus': [
    {
      id: 'PIA00062',
      title: '海卫八表面细节近掠影像',
      description: '展现旅行者 2 号新发现的这颗暗色不规则大卫星，表面遍布撞击坑与多边形棱角轮廓。',
      probe: '旅行者 2 号（Voyager 2）',
      date: '1989 年 8 月 25 日',
      credit: 'NASA / JPL',
    },
  ],
  Ceres: [
    {
      id: 'PIA19889',
      title: '谷神星奥卡托撞击坑亮斑测绘影像',
      description: '黎明号在高轨测绘阶段拍摄，清晰呈现奥卡托撞击坑中央及东侧耀眼的碳酸钠盐亮穹沉积。',
      probe: '黎明号（Dawn）',
      date: '2015 年 8–10 月',
      credit: 'NASA / JPL-Caltech / UCLA / MPS / DLR / IDA',
    },
  ],
  Vesta: [
    {
      id: 'PIA14778',
      title: '黎明号灶神星全幅实拍影像',
      description: '黎明号入轨初期拍下的完整视图，清晰可见布满古老撞击坑的北半球、赤道环绕槽沟与不规则轮廓。',
      probe: '黎明号（Dawn）',
      date: '2011 年 7 月 24 日',
      credit: 'NASA / JPL-Caltech / UCLA / MPS / DLR / IDA',
    },
  ],
  Pluto: [
    {
      id: 'PIA19952',
      title: '新视野号冥王星增强色全球影像',
      description: '结合蓝、红与红外滤镜合成的高分辨率全球影像，凸显心形汤博区氮冰平原与暗红克苏鲁斑的鲜明色彩差异。',
      probe: '新视野号（New Horizons / Ralph）',
      date: '2015 年 7 月 14 日',
      credit: 'NASA / JHUAPL / SwRI',
    },
  ],
  'Pluto-Charon': [
    {
      id: 'PIA19968',
      title: '冥卫一增强色高分辨率全盘',
      description: '清晰呈现北极红褐色的莫多尔斑、横贯赤道的巨型构造裂谷带以及南部相对平滑的冰平原。',
      probe: '新视野号（New Horizons / Ralph）',
      date: '2015 年 7 月 14 日',
      credit: 'NASA / JHUAPL / SwRI',
    },
  ],
  'Pluto-Nix': [
    {
      id: 'PIA20287',
      title: '冥卫二半受照面实拍影像',
      description: '新视野号多光谱可见光相机在飞掠当天拍下，展现其长形不规则轮廓与显著的大型撞击坑。',
      probe: '新视野号（New Horizons / MVIC）',
      date: '2015 年 7 月 14 日',
      credit: 'NASA / JHUAPL / SwRI',
    },
  ],
  'Pluto-Hydra': [
    {
      id: 'PIA19711',
      title: '冥卫三飞掠分辨影像',
      description: '由 LORRI 远距相机在飞掠冥王星系统时拍摄，揭示这颗高反照率冰质外卫星的不规则土豆状外形。',
      probe: '新视野号（New Horizons / LORRI）',
      date: '2015 年 7 月 14 日',
      credit: 'NASA / JHUAPL / SwRI',
    },
  ],
  'Pluto-Kerberos': [
    {
      id: 'PIA20034',
      title: '冥卫四双瓣轮廓合成影像',
      description: '飞掠前约 7 小时由 LORRI 拍摄的合成图，意外发现它由两个大小不同的高反照率冰瓣相接而成。',
      probe: '新视野号（New Horizons / LORRI）',
      date: '2015 年 7 月 14 日',
      credit: 'NASA / JHUAPL / SwRI',
    },
  ],
  'Pluto-Styx': [
    {
      id: 'styx-lorri',
      title: '冥卫五飞掠抵近合成影像',
      description: '新视野号飞掠冥王星前约 12.5 小时在约 63 万千米外拍下，记录了冥王星最小最暗弱卫星的拉长外形。',
      probe: '新视野号（New Horizons / LORRI）',
      date: '2015 年 7 月 13 日',
      credit: 'NASA / JHUAPL / SwRI',
      source: 'https://science.nasa.gov/mission/new-horizons/',
    },
  ],
  Arrokoth: [
    {
      id: 'arrokoth-lorri',
      title: '阿罗科斯近掠最高分辨率影像',
      description: '人类航天器迄今近距探测的最远天体，清晰展示原始柯伊伯带星子轻柔合并而成的扁平双瓣结构。',
      probe: '新视野号（New Horizons / LORRI）',
      date: '2019 年 1 月 1 日',
      credit: 'NASA / JHUAPL / SwRI',
      source: 'https://science.nasa.gov/solar-system/kuiper-belt/arrokoth/',
    },
  ],
}

export const probePhotosByEntryId: Record<string, ProbePhoto[]> = Object.fromEntries(
  Object.entries(rawProbePhotos).map(([entryId, specs]) => [
    entryId,
    specs
      .filter((spec) => !!probePhotoSources[spec.id])
      .map((spec) => ({
        id: spec.id,
        url: probePhotoSources[spec.id],
        title: spec.title,
        description: spec.description,
        probe: spec.probe,
        date: spec.date,
        credit: spec.credit,
        source: spec.source || photojournal(spec.id),
      })),
  ]),
)

export function getProbePhotos(entryId: string): ProbePhoto[] | undefined {
  const list = probePhotosByEntryId[entryId]
  return list?.length ? list : undefined
}
