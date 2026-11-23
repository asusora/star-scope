import type { Comet } from './comets'
import type { Locale } from '../i18n'

const profiles = {
  '1P': {
    source: 'https://science.nasa.gov/solar-system/comets/1p-halley/',
    zh: {
      body: '哈雷彗星约每 76 年绕太阳一周，公转方向与地球相反。天文学家埃德蒙·哈雷比较了 1531、1607 和 1682 年的观测，推断人们看到的是同一颗彗星。1758 年它如期归来。1986 年，乔托号拍到暗色彗核向外喷射物质。从地球上看到的明亮彗头，主要是环绕彗核的气体和尘埃在发光或散射阳光。',
      facts: [['平均公转周期', '约 76 年'], ['上次／预计下次回归', '1986 年／2061 年'], ['彗核尺寸', '约 15 × 8 公里'], ['相关流星雨', '宝瓶座 η 流星雨和猎户座流星雨']],
    },
    en: {
      body: 'Halley takes about 76 years to circle the Sun and travels in the opposite direction to Earth. Edmond Halley connected appearances in 1531, 1607 and 1682. Its return in 1758 confirmed his prediction. During the 1986 encounter, Giotto photographed a dark nucleus emitting jets. Gas and dust around that nucleus make the head look bright from Earth.',
      facts: [['Mean orbital period', 'About 76 years'], ['Last / expected next return', '1986 / 2061'], ['Nucleus dimensions', 'About 15 × 8 km'], ['Associated meteor showers', 'Eta Aquariids and Orionids']],
    },
  },
  '2P': {
    source: 'https://science.nasa.gov/solar-system/comets/2p-encke/',
    zh: {
      body: '恩克彗星绕太阳一周只需约 3.3 年。约翰·恩克把多次出现的彗星联系起来，算出它们属于同一条轨道，这颗彗星因而以他命名。它沿途留下的碎屑与金牛座流星群有关；地球穿过这些碎屑时，有些颗粒会在大气中形成明亮的火流星。',
      facts: [['公转周期', '约 3.3 年'], ['相关流星群', '金牛座流星群'], ['命名缘由', '约翰·恩克计算了它的轨道']],
    },
    en: {
      body: 'Encke completes an orbit in about 3.3 years. Johann Encke linked observations from different returns and calculated the common orbit, giving the comet its name. Debris associated with Encke feeds the Taurid meteor stream. Some pieces produce bright fireballs as they enter Earth’s atmosphere.',
      facts: [['Orbital period', 'About 3.3 years'], ['Associated meteor stream', 'Taurids'], ['Namesake', 'Johann Encke, who calculated the orbit']],
    },
  },
  'C/1995 O1': {
    source: 'https://science.nasa.gov/solar-system/comets/c-1995-o1-hale-bopp/',
    zh: {
      body: '海尔和波普在 1995 年分别发现这颗彗星时，它离太阳仍有约 7.15 AU。它的轨道几乎直立于地球公转的平面。它在 1997 年 4 月 1 日经过近日点，前后共有约 18 个月能被肉眼看到。哈勃望远镜还记录到彗核自转时喷出物展开成旋涡的形状。',
      facts: [['发现日期', '1995 年 7 月 23 日'], ['上次近日点', '1997 年 4 月 1 日'], ['肉眼可见时长', '约 18 个月']],
    },
    en: {
      body: 'Alan Hale and Thomas Bopp independently discovered this comet about 7.15 AU from the Sun. Its orbit stands almost perpendicular to Earth’s orbital plane. It reached perihelion on 1 April 1997 and was visible without a telescope for about 18 months. Hubble recorded material spiraling away from the rotating nucleus.',
      facts: [['Discovery', '23 July 1995'], ['Last perihelion', '1 April 1997'], ['Naked-eye visibility', 'About 18 months']],
    },
  },
  'C/2014 UN271': {
    source: 'https://science.nasa.gov/missions/hubble/hubble-confirms-largest-comet-nucleus-ever-seen/',
    zh: {
      body: '在暗能量巡天档案影像中发现的巨型外奥尔特云彗星。哈勃望远镜与 ALMA 毫米波观测确认其漆黑彗核直径约 119–137 千米，是人类已知最大的奥尔特云彗核。它在距太阳 20 AU 以外便因一氧化碳等极易挥发冰升华而显露彗发，预计 2031 年 1 月在土星轨道外侧（约 10.94 AU）过近日点，随后沿高倾角逆行轨道重返数万 AU 之外的外奥尔特云。',
      facts: [
        ['彗核直径', '约 119–137 公里（已知最大）'],
        ['估算远日点', '约 40,000–55,000 AU（外奥尔特云）'],
        ['预计近日点', '2031 年 1 月（约 10.94 AU）'],
        ['发现来源', '2014 年暗能量巡天影像（2021 年确认）'],
      ],
    },
    en: {
      body: 'A giant outer Oort Cloud comet identified in Dark Energy Survey archival images. Hubble and ALMA measurements place its coal-dark nucleus at roughly 119–137 km across—the largest Oort Cloud comet nucleus ever measured. Already active beyond 20 AU from hypervolatile CO outgassing, it will reach perihelion just outside Saturn’s orbit (~10.94 AU) in January 2031 before returning tens of thousands of AU into the Outer Oort Cloud.',
      facts: [
        ['Nucleus diameter', 'About 119–137 km (largest known)'],
        ['Estimated aphelion', '~40,000–55,000 AU (Outer Oort Cloud)'],
        ['Expected perihelion', 'January 2031 (~10.94 AU)'],
        ['Discovery', '2014 DES archive (identified 2021)'],
      ],
    },
  },
}

export function cometProfile(comet: Comet, lang: Locale) {
  const profile = profiles[comet.id]
  const en = lang === 'en'
  const { body, facts } = profile[lang]
  return {
    title: en ? 'Comet ' + comet.en : comet.zh + '彗星',
    code: comet.id,
    body, source: profile.source, discovered: '',
    facts: [...facts,
      [en ? 'Perihelion (model elements)' : '近日点（日心轨道模型）', (comet.a * (1 - comet.e)).toFixed(2) + ' AU'],
      [en ? 'Orbital inclination' : '轨道倾角', comet.i.toFixed(1) + '°']],
  }
}
