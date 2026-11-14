/**
 * Preset catalogues for the mind map editor.
 *
 * simple-mind-map ships a single `default` theme and exposes everything else
 * (shapes, layouts, line styles) as plain option strings. The official demo at
 * web.sxmind.cn keeps its theme/structure catalogues in the demo app rather than
 * the npm package, so the equivalents live here — as data, so the inspector UI
 * stays declarative and the persisted artifact only has to store an id plus the
 * user's overrides.
 */

/** Layout values understood by `mindMap.setLayout()`. */
export type MindMapStructure =
  | 'logicalStructure'
  | 'logicalStructureLeft'
  | 'mindMap'
  | 'organizationStructure'
  | 'catalogOrganization'
  | 'timeline'
  | 'timeline2'
  | 'verticalTimeline'
  | 'verticalTimeline2'
  | 'verticalTimeline3'
  | 'fishbone'
  | 'fishbone2'
  | 'rightFishbone'
  | 'rightFishbone2'

/** Connector rendering mode (`lineStyle` theme property). */
export type MindMapLineStyle = 'straight' | 'curve' | 'direct'

export type MindMapShape =
  | 'rectangle'
  | 'roundedRectangle'
  | 'ellipse'
  | 'circle'
  | 'diamond'
  | 'parallelogram'
  | 'octagonalRectangle'
  | 'outerTriangularRectangle'
  | 'innerTriangularRectangle'

export type MindMapImagePlacement = 'top' | 'bottom' | 'left' | 'right'

/**
 * `curve` and `direct` are only implemented for a subset of layouts; picking one
 * elsewhere silently falls back to straight lines, so the inspector greys them
 * out instead of offering a no-op.
 */
const CURVE_STRUCTURES: MindMapStructure[] = [
  'logicalStructure',
  'logicalStructureLeft',
  'mindMap',
  'verticalTimeline',
  'verticalTimeline2',
  'verticalTimeline3',
]
const DIRECT_STRUCTURES: MindMapStructure[] = [
  ...CURVE_STRUCTURES,
  'organizationStructure',
]

export function lineStyleSupported(structure: MindMapStructure, style: MindMapLineStyle): boolean {
  if (style === 'straight') return true
  if (style === 'curve') return CURVE_STRUCTURES.includes(structure)
  return DIRECT_STRUCTURES.includes(structure)
}

/** `nodeUseLineStyle` (underline-only nodes) is layout dependent too. */
export function underlineStyleSupported(structure: MindMapStructure): boolean {
  return (
    structure === 'logicalStructure' ||
    structure === 'logicalStructureLeft' ||
    structure === 'mindMap' ||
    structure === 'catalogOrganization' ||
    structure === 'organizationStructure'
  )
}

export const MIND_MAP_STRUCTURES = [
  { value: 'logicalStructure', labelKey: 'mindmap.presets.structure.logicalStructure' },
  { value: 'logicalStructureLeft', labelKey: 'mindmap.presets.structure.logicalStructureLeft' },
  { value: 'mindMap', labelKey: 'mindmap.presets.structure.mindMap' },
  { value: 'organizationStructure', labelKey: 'mindmap.presets.structure.organizationStructure' },
  { value: 'catalogOrganization', labelKey: 'mindmap.presets.structure.catalogOrganization' },
  { value: 'timeline', labelKey: 'mindmap.presets.structure.timeline' },
  { value: 'timeline2', labelKey: 'mindmap.presets.structure.timeline2' },
  { value: 'verticalTimeline', labelKey: 'mindmap.presets.structure.verticalTimeline' },
  { value: 'verticalTimeline2', labelKey: 'mindmap.presets.structure.verticalTimeline2' },
  { value: 'verticalTimeline3', labelKey: 'mindmap.presets.structure.verticalTimeline3' },
  { value: 'fishbone', labelKey: 'mindmap.presets.structure.fishbone' },
  { value: 'fishbone2', labelKey: 'mindmap.presets.structure.fishbone2' },
  { value: 'rightFishbone', labelKey: 'mindmap.presets.structure.rightFishbone' },
  { value: 'rightFishbone2', labelKey: 'mindmap.presets.structure.rightFishbone2' },
] as const satisfies ReadonlyArray<{ value: MindMapStructure; labelKey: string }>

const STRUCTURE_VALUES = new Set(MIND_MAP_STRUCTURES.map((item) => item.value))
export function isMindMapStructure(value: unknown): value is MindMapStructure {
  return typeof value === 'string' && STRUCTURE_VALUES.has(value as MindMapStructure)
}

/**
 * 分支连线的三种画法。名字要和画出来的东西一致：
 * 库里 `straight` 画的是**带圆角的折线**（`lineRadius` 只对它生效），
 * 之前却标成「直线」，而真正一条直线过去的 `direct` 标成了「直连」—— 选谁都对不上号。
 */
export const MIND_MAP_LINE_STYLES = [
  { value: 'direct', labelKey: 'mindmap.presets.lineStyle.direct', hintKey: 'mindmap.presets.lineStyle.directHint' },
  { value: 'curve', labelKey: 'mindmap.presets.lineStyle.curve', hintKey: 'mindmap.presets.lineStyle.curveHint' },
  { value: 'straight', labelKey: 'mindmap.presets.lineStyle.straight', hintKey: 'mindmap.presets.lineStyle.straightHint' },
] as const satisfies ReadonlyArray<{ value: MindMapLineStyle; labelKey: string; hintKey: string }>

export const MIND_MAP_SHAPES = [
  { value: 'rectangle', labelKey: 'mindmap.presets.shape.rectangle' },
  { value: 'roundedRectangle', labelKey: 'mindmap.presets.shape.roundedRectangle' },
  { value: 'ellipse', labelKey: 'mindmap.presets.shape.ellipse' },
  { value: 'circle', labelKey: 'mindmap.presets.shape.circle' },
  { value: 'diamond', labelKey: 'mindmap.presets.shape.diamond' },
  { value: 'parallelogram', labelKey: 'mindmap.presets.shape.parallelogram' },
  { value: 'octagonalRectangle', labelKey: 'mindmap.presets.shape.octagonalRectangle' },
  { value: 'outerTriangularRectangle', labelKey: 'mindmap.presets.shape.outerTriangularRectangle' },
  { value: 'innerTriangularRectangle', labelKey: 'mindmap.presets.shape.innerTriangularRectangle' },
] as const satisfies ReadonlyArray<{ value: MindMapShape; labelKey: string }>

export const MIND_MAP_IMAGE_PLACEMENTS = [
  { value: 'top', labelKey: 'mindmap.presets.placement.top' },
  { value: 'bottom', labelKey: 'mindmap.presets.placement.bottom' },
  { value: 'left', labelKey: 'mindmap.presets.placement.left' },
  { value: 'right', labelKey: 'mindmap.presets.placement.right' },
] as const satisfies ReadonlyArray<{ value: MindMapImagePlacement; labelKey: string }>

export const MIND_MAP_DASH_STYLES = [
  { value: 'none', labelKey: 'mindmap.presets.dash.none' },
  { value: '5,5', labelKey: 'mindmap.presets.dash.dashed' },
  { value: '10,10', labelKey: 'mindmap.presets.dash.longDashed' },
  { value: '2,3', labelKey: 'mindmap.presets.dash.dotted' },
  { value: '10,5,2,5', labelKey: 'mindmap.presets.dash.dashDotted' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: string }>

export const MIND_MAP_FONT_FAMILIES: Array<{ value: string; label: string }> = [
  { value: '微软雅黑, Microsoft YaHei', label: '微软雅黑' },
  { value: '宋体, SimSun, Songti SC', label: '宋体' },
  { value: '黑体, SimHei, Heiti SC', label: '黑体' },
  { value: '楷体, KaiTi, Kaiti SC', label: '楷体' },
  { value: '仿宋, FangSong', label: '仿宋' },
  { value: 'Source Han Serif SC, Noto Serif SC, serif', label: '思源宋体' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Consolas, Menlo, monospace', label: '等宽' },
]

export const MIND_MAP_FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48]

/**
 * 每一级的字号。以前根节点和二级节点都是 16px、三级以下统一 14px，画出来
 * 一屏字一样大，「父 → 子 → 孙」的关系只能靠连线猜。这里改成逐级递减：
 * 第一级 20、第二级 17、第三级 15，之后每深一层小 1px，12px 是下限。
 */
export const MIND_MAP_LEVEL_FONT_SIZES = [20, 17, 15, 14, 13, 12] as const

/** 主题能原生表达的层级数：根 / 二级 / 三级及以下（`buildTheme` 的三档）。 */
export const MIND_MAP_THEME_TIER_COUNT = 3

/** 某一层的字号；超过最后一档的深度一律用下限。 */
export function mindMapFontSizeForDepth(depth: number): number {
  const sizes = MIND_MAP_LEVEL_FONT_SIZES
  const index = Math.min(Math.max(Math.trunc(depth) || 0, 0), sizes.length - 1)
  return sizes[index]
}

/**
 * 节点数据上的标记：这个字号是按层级算出来的，不是用户手调的。
 * 下划线开头是库约定的「用户自定义字段」，不会被当成样式键。
 */
export const MIND_MAP_LEVEL_FONT_MARK = '_levelFontSize'

type LevelFontNode = {
  data?: Record<string, unknown>
  children?: LevelFontNode[]
}

/** 只描述「层级 + 节点数据」的最小树形，测试和编辑器共用。 */
export type MindMapLevelFontNode = LevelFontNode

/**
 * 把层级字号写进节点数据，返回改动过的节点 uid。
 *
 * 主题只认 root / second / node 三档，三级以下没法靠主题区分，所以这些层级
 * 的字号必须落到节点自己身上。规则：
 * - 三级以下：写入该层字号，并打上 `MIND_MAP_LEVEL_FONT_MARK` 标记；
 * - 用户手调过字号（有 fontSize 但没有标记）的节点不动；
 * - 带标记的节点被拖回前三级时把字号还给主题，否则会留下一个 12px 的二级节点。
 *
 * 原地修改（调用方传进来的就是活的节点数据），离线树和渲染树都能直接用。
 */
export function applyLevelFontSizes(root: LevelFontNode | null | undefined): string[] {
  const changed: string[] = []
  const walk = (node: LevelFontNode | null | undefined, depth: number) => {
    if (!node || !node.data) return
    const data = node.data
    const auto = data[MIND_MAP_LEVEL_FONT_MARK] === true
    const manual = !auto && typeof data.fontSize === 'number'
    if (depth < MIND_MAP_THEME_TIER_COUNT) {
      if (auto) {
        delete data.fontSize
        delete data[MIND_MAP_LEVEL_FONT_MARK]
        const uid = typeof data.uid === 'string' ? data.uid : ''
        if (uid) changed.push(uid)
      }
    } else if (!manual) {
      const fontSize = mindMapFontSizeForDepth(depth)
      let touched = false
      if (data.fontSize !== fontSize) {
        data.fontSize = fontSize
        touched = true
      }
      if (!auto) {
        data[MIND_MAP_LEVEL_FONT_MARK] = true
        touched = true
      }
      if (touched) {
        const uid = typeof data.uid === 'string' ? data.uid : ''
        if (uid) changed.push(uid)
      }
    }
    ;(node.children || []).forEach((child) => walk(child, depth + 1))
  }
  walk(root, 0)
  return changed
}

export const MIND_MAP_LINE_WIDTHS = [1, 2, 3, 4, 5, 6, 8]

export type MindMapTextAlign = 'left' | 'center' | 'right'

export const MIND_MAP_TEXT_ALIGNS = [
  { value: 'left', labelKey: 'mindmap.presets.textAlign.left' },
  { value: 'center', labelKey: 'mindmap.presets.textAlign.center' },
  { value: 'right', labelKey: 'mindmap.presets.textAlign.right' },
] as const satisfies ReadonlyArray<{ value: MindMapTextAlign; labelKey: string }>

/**
 * Named corner sizes rather than a slider: XMind offers a short list, and a
 * free-running slider on a 240px panel is fiddly for a value with ~4 useful
 * settings.
 */
export const MIND_MAP_CORNER_RADII = [
  { value: '0', labelKey: 'mindmap.presets.radius.square' },
  { value: '5', labelKey: 'mindmap.presets.radius.small' },
  { value: '12', labelKey: 'mindmap.presets.radius.medium' },
  { value: '30', labelKey: 'mindmap.presets.radius.large' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: string }>

/** Line-thickness names matching XMind's 细/中等/粗 wording. */
export const MIND_MAP_LINE_WEIGHTS: Array<{ value: string; label: string }> = [
  { value: '1', label: '细' },
  { value: '2', label: '中等' },
  { value: '3', label: '粗' },
  { value: '5', label: '特粗' },
]

/** Palette offered by the colour pickers, aligned with the app's ink palette. */
export const MIND_MAP_SWATCHES = [
  'transparent',
  '#ffffff',
  '#f5f5f5',
  '#d9d9d9',
  '#8c8c8c',
  '#434343',
  '#000000',
  '#549688',
  '#22a06b',
  '#3b82f6',
  '#1d4ed8',
  '#7c3aed',
  '#db2777',
  '#e11d48',
  '#f97316',
  '#f5c518',
  '#0e9aa7',
  '#94a3b8',
]

export const RAINBOW_LINE_PRESETS = [
  {
    id: 'classic',
    labelKey: 'mindmap.presets.rainbow.classic',
    colors: [
      'rgb(255, 213, 73)',
      'rgb(255, 136, 126)',
      'rgb(107, 225, 141)',
      'rgb(151, 171, 255)',
      'rgb(129, 220, 242)',
      'rgb(255, 163, 125)',
      'rgb(152, 132, 234)',
    ],
  },
  {
    id: 'macaron',
    labelKey: 'mindmap.presets.rainbow.macaron',
    colors: ['#f7b7a3', '#f5d6a0', '#c3e8bd', '#a8dadc', '#bdb2ff', '#ffc6ff', '#fdffb6'],
  },
  {
    id: 'ink',
    labelKey: 'mindmap.presets.rainbow.ink',
    colors: ['#2f4858', '#33658a', '#86bbd8', '#758e4f', '#f6ae2d', '#f26419', '#a44a3f'],
  },
  {
    id: 'neon',
    labelKey: 'mindmap.presets.rainbow.neon',
    colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8ac926', '#3a86ff', '#8338ec', '#06d6a0'],
  },
] as const satisfies ReadonlyArray<{ id: string; labelKey: string; colors: readonly string[] }>

export function rainbowPresetColors(id: string): string[] {
  return [...(RAINBOW_LINE_PRESETS.find((item) => item.id === id) || RAINBOW_LINE_PRESETS[0]).colors]
}

/** Subset of the theme schema a preset is allowed to set. */
export type MindMapThemeConfig = Record<string, unknown>

type ThemeSeed = {
  line: string
  background: string
  rootFill: string
  rootText: string
  secondFill: string
  secondText: string
  secondBorder: string
  nodeText: string
  nodeFill?: string
  nodeBorder?: string
  /** Nodes drawn as an underline instead of a filled box. */
  underline?: boolean
  lineStyle?: MindMapLineStyle
  lineWidth?: number
  rootShape?: MindMapShape
  secondShape?: MindMapShape
}

/**
 * Themes are stored as partial configs and deep-merged over the library default
 * by `setThemeConfig`, so a preset only needs to name the properties it changes.
 */
function buildTheme(seed: ThemeSeed): MindMapThemeConfig {
  return {
    lineColor: seed.line,
    lineWidth: seed.lineWidth ?? 1,
    lineStyle: seed.lineStyle ?? 'straight',
    backgroundColor: seed.background,
    nodeUseLineStyle: !!seed.underline,
    generalizationLineColor: seed.line,
    associativeLineColor: seed.line,
    associativeLineTextColor: seed.secondText,
    root: {
      shape: seed.rootShape ?? 'rectangle',
      fillColor: seed.rootFill,
      color: seed.rootText,
      borderColor: 'transparent',
      borderWidth: 0,
      fontSize: MIND_MAP_LEVEL_FONT_SIZES[0],
      fontWeight: 'bold',
    },
    second: {
      shape: seed.secondShape ?? 'rectangle',
      fillColor: seed.secondFill,
      color: seed.secondText,
      borderColor: seed.secondBorder,
      borderWidth: 1,
      fontSize: MIND_MAP_LEVEL_FONT_SIZES[1],
      fontWeight: 'normal',
    },
    node: {
      shape: 'rectangle',
      fillColor: seed.nodeFill ?? 'transparent',
      color: seed.nodeText,
      borderColor: seed.nodeBorder ?? 'transparent',
      borderWidth: seed.nodeBorder ? 1 : 0,
      fontSize: MIND_MAP_LEVEL_FONT_SIZES[2],
      fontWeight: 'normal',
    },
    generalization: {
      fillColor: seed.secondFill,
      color: seed.secondText,
      borderColor: seed.secondBorder,
    },
  }
}

/**
 * Colours the theme picker needs to draw a miniature of the actual map. Kept as
 * a flat struct (rather than re-reading the merged theme config) so the preview
 * never has to reproduce the library's layered style-resolution rules.
 */
export type MindMapThemePreview = {
  background: string
  line: string
  rootFill: string
  rootText: string
  rootBorder: string
  secondFill: string
  secondText: string
  secondBorder: string
  nodeText: string
  nodeFill: string
  nodeBorder: string
  /** Leaf nodes drawn as an underline rather than a box. */
  underline: boolean
  radius: number
}

export type MindMapThemePreset = {
  id: string
  nameKey: string
  /** Everything the picker needs to render a faithful thumbnail. */
  preview: MindMapThemePreview
  config: MindMapThemeConfig
  /**
   * Night-time face of the same theme. The map is a *content* surface, so it
   * keeps its own colours — but it still has to sit on the editor's dark desk
   * without glowing. Every preset therefore carries a dark seed; themes that
   * are dark to begin with (`midnight`) simply reuse their light one.
   */
  darkPreview: MindMapThemePreview
  darkConfig: MindMapThemeConfig
}

/** Which face of the theme applies, given the app's resolved light/dark mode. */
export type MindMapThemeMode = 'light' | 'dark'

/**
 * Single source of truth for "should the map use its dark face?". The picker
 * thumbnails and the canvas both call this, so what the user previews is what
 * they get.
 */
export function resolveThemeMode(followAppearance: boolean, appearance: MindMapThemeMode): MindMapThemeMode {
  return followAppearance && appearance === 'dark' ? 'dark' : 'light'
}

/** Preview colours derived from the same seed as the config, so they can't drift. */
function buildPreview(seed: ThemeSeed): MindMapThemePreview {
  const rounded = seed.rootShape === 'roundedRectangle' || seed.secondShape === 'roundedRectangle'
  return {
    background: seed.background,
    line: seed.line,
    rootFill: seed.rootFill,
    rootText: seed.rootText,
    rootBorder: seed.rootFill === 'transparent' ? seed.secondText : seed.rootFill,
    secondFill: seed.secondFill,
    secondText: seed.secondText,
    secondBorder: seed.secondBorder,
    nodeText: seed.nodeText,
    nodeFill: seed.nodeFill ?? 'transparent',
    nodeBorder: seed.nodeBorder ?? 'transparent',
    underline: !!seed.underline,
    radius: rounded ? 5 : 2,
  }
}

function preset<K extends string>(id: string, nameKey: K, seed: ThemeSeed, darkSeed?: ThemeSeed): MindMapThemePreset & { nameKey: K } {
  const dark = darkSeed ?? seed
  return {
    id,
    nameKey,
    preview: buildPreview(seed),
    config: buildTheme(seed),
    darkPreview: buildPreview(dark),
    darkConfig: buildTheme(dark),
  }
}

export const MIND_MAP_THEMES = [
  preset('default', 'mindmap.presets.theme.default', {
    line: '#549688',
    background: '#fafafa',
    rootFill: '#549688',
    rootText: '#ffffff',
    secondFill: '#ffffff',
    secondText: '#565656',
    secondBorder: '#549688',
    nodeText: '#6a6d6c',
  }, {
    line: '#5fa89a',
    background: '#252b29',
    rootFill: '#4f9c8d',
    rootText: '#ffffff',
    secondFill: '#303735',
    secondText: '#e3e8e7',
    secondBorder: '#445652',
    nodeText: '#a8b5b2',
  }),
  preset('sky', 'mindmap.presets.theme.sky', {
    line: '#79aee4',
    background: '#f2f7fd',
    rootFill: '#2b7fd4',
    rootText: '#ffffff',
    secondFill: '#ffffff',
    secondText: '#20486e',
    secondBorder: '#79aee4',
    nodeText: '#3d5c78',
    lineStyle: 'curve',
  }, {
    line: '#6ba3dd',
    background: '#212932',
    rootFill: '#3d8ee0',
    rootText: '#ffffff',
    secondFill: '#2c3540',
    secondText: '#dce7f3',
    secondBorder: '#3a5a7a',
    nodeText: '#9db4ca',
    lineStyle: 'curve',
  }),
  preset('midnight', 'mindmap.presets.theme.midnight', {
    line: '#4a5266',
    background: '#171a21',
    rootFill: '#5b8cff',
    rootText: '#ffffff',
    secondFill: '#232733',
    secondText: '#e2e6ef',
    secondBorder: '#3a4256',
    nodeText: '#b8c0d0',
    lineWidth: 2,
  }, {
    line: '#4a5266',
    background: '#232832',
    rootFill: '#5b8cff',
    rootText: '#ffffff',
    secondFill: '#2c323e',
    secondText: '#e2e6ef',
    secondBorder: '#454e64',
    nodeText: '#b8c0d0',
    lineWidth: 2,
  }),
  preset('ink', 'mindmap.presets.theme.ink', {
    line: '#8d8a87',
    background: '#f6f4ef',
    rootFill: '#2b2b2b',
    rootText: '#f6f4ef',
    secondFill: 'transparent',
    secondText: '#2b2b2b',
    secondBorder: '#2b2b2b',
    nodeText: '#4a4740',
    underline: true,
  }, {
    line: '#8d8a87',
    background: '#2b2826',
    rootFill: '#e8e4dc',
    rootText: '#1a1918',
    secondFill: 'transparent',
    secondText: '#e8e4dc',
    secondBorder: '#8d8a87',
    nodeText: '#b0aca4',
    underline: true,
  }),
  preset('blossom', 'mindmap.presets.theme.blossom', {
    line: '#f0a6c3',
    background: '#fdf3f7',
    rootFill: '#e0629a',
    rootText: '#ffffff',
    secondFill: '#ffffff',
    secondText: '#8c3159',
    secondBorder: '#f0a6c3',
    nodeText: '#7a5568',
    lineStyle: 'curve',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
  }, {
    line: '#e082a8',
    background: '#2c2327',
    rootFill: '#d4669a',
    rootText: '#ffffff',
    secondFill: '#392f35',
    secondText: '#f0dce5',
    secondBorder: '#584049',
    nodeText: '#c4a3b2',
    lineStyle: 'curve',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
  }),
  preset('citrus', 'mindmap.presets.theme.citrus', {
    line: '#f5a960',
    background: '#fffaf3',
    rootFill: '#ea7317',
    rootText: '#ffffff',
    secondFill: '#fff2e0',
    secondText: '#8a4508',
    secondBorder: '#f5a960',
    nodeText: '#7c5637',
  }, {
    line: '#d98f4a',
    background: '#2c261f',
    rootFill: '#e07a28',
    rootText: '#ffffff',
    secondFill: '#392f28',
    secondText: '#f0e0cd',
    secondBorder: '#5a4630',
    nodeText: '#c4a88b',
  }),
  preset('violet', 'mindmap.presets.theme.violet', {
    line: '#a98be0',
    background: '#f7f4fd',
    rootFill: '#6f42c1',
    rootText: '#ffffff',
    secondFill: '#ffffff',
    secondText: '#42286f',
    secondBorder: '#a98be0',
    nodeText: '#5b4a76',
    lineStyle: 'curve',
  }, {
    line: '#9d84d8',
    background: '#272231',
    rootFill: '#7d5cd0',
    rootText: '#ffffff',
    secondFill: '#342f3f',
    secondText: '#e4dcf3',
    secondBorder: '#4a3f63',
    nodeText: '#b2a3cc',
    lineStyle: 'curve',
  }),
  preset('forest', 'mindmap.presets.theme.forest', {
    line: '#7aa98c',
    background: '#f3f7f3',
    rootFill: '#2f6f4e',
    rootText: '#ffffff',
    secondFill: '#e6efe7',
    secondText: '#24503a',
    secondBorder: '#7aa98c',
    nodeText: '#41604d',
  }, {
    line: '#6d9c82',
    background: '#232b28',
    rootFill: '#3d8a62',
    rootText: '#ffffff',
    secondFill: '#2e3733',
    secondText: '#dbe8e0',
    secondBorder: '#3a584a',
    nodeText: '#9cb5a6',
  }),
  preset('outline', 'mindmap.presets.theme.outline', {
    line: '#bfbfbf',
    background: '#ffffff',
    rootFill: 'transparent',
    rootText: '#1f1f1f',
    secondFill: 'transparent',
    secondText: '#333333',
    secondBorder: 'transparent',
    nodeText: '#595959',
    underline: true,
  }, {
    line: '#5a5a5a',
    background: '#262626',
    rootFill: 'transparent',
    rootText: '#f0f0f0',
    secondFill: 'transparent',
    secondText: '#e0e0e0',
    secondBorder: '#565656',
    nodeText: '#a0a0a0',
    underline: true,
  }),
  preset('card', 'mindmap.presets.theme.card', {
    line: '#c3ccd9',
    background: '#f4f6fa',
    rootFill: '#1f6feb',
    rootText: '#ffffff',
    secondFill: '#ffffff',
    secondText: '#24292f',
    secondBorder: '#d2d9e2',
    nodeText: '#3b4652',
    nodeFill: '#ffffff',
    nodeBorder: '#e2e7ee',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
  }, {
    line: '#5c6f85',
    background: '#222931',
    rootFill: '#3b82f6',
    rootText: '#ffffff',
    secondFill: '#2d353e',
    secondText: '#e6ebf2',
    secondBorder: '#3a4655',
    nodeText: '#9aa8b8',
    nodeFill: '#2e3741',
    nodeBorder: '#3d4855',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
  }),
  preset('cobalt-editorial', 'mindmap.presets.theme.cobaltEditorial', {
    line: '#8DA8E8',
    background: '#F7F9FC',
    rootFill: '#356AE6',
    rootText: '#FFFFFF',
    secondFill: '#FFFFFF',
    secondText: '#172033',
    secondBorder: '#AFC1EA',
    nodeText: '#536078',
    nodeFill: '#FFFFFF',
    nodeBorder: '#D9E2F2',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
    lineStyle: 'curve',
  }, {
    line: '#5f7ec4',
    background: '#202738',
    rootFill: '#4a7df0',
    rootText: '#FFFFFF',
    secondFill: '#2b3244',
    secondText: '#dfe6f5',
    secondBorder: '#384a6b',
    nodeText: '#9aabc7',
    nodeFill: '#272f42',
    nodeBorder: '#35476a',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
    lineStyle: 'curve',
  }),
  preset('jade-modern', 'mindmap.presets.theme.jadeModern', {
    line: '#7FA99F',
    background: '#F5F7F3',
    rootFill: '#25766A',
    rootText: '#FFFFFF',
    secondFill: '#FCFDF9',
    secondText: '#21332F',
    secondBorder: '#9DBDB5',
    nodeText: '#546B64',
    underline: true,
    lineStyle: 'curve',
  }, {
    line: '#6a9a90',
    background: '#222a26',
    rootFill: '#2f8a7c',
    rootText: '#FFFFFF',
    secondFill: '#2d3632',
    secondText: '#dbe6e2',
    secondBorder: '#3a544d',
    nodeText: '#9cb2ab',
    underline: true,
    lineStyle: 'curve',
  }),
  preset('morandi', 'mindmap.presets.theme.morandi', {
    line: '#A8AEB1',
    background: '#F5F3F1',
    rootFill: '#7D8F9B',
    rootText: '#FFFFFF',
    secondFill: '#FCFBFA',
    secondText: '#4F5153',
    secondBorder: '#C9C5C1',
    nodeText: '#6E6965',
    nodeFill: '#F9F7F5',
    nodeBorder: '#DED9D5',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
  }, {
    line: '#7d8a92',
    background: '#282a2d',
    rootFill: '#8b9ca8',
    rootText: '#151719',
    secondFill: '#333538',
    secondText: '#dedfe0',
    secondBorder: '#464b50',
    nodeText: '#a8a9ab',
    nodeFill: '#2e3135',
    nodeBorder: '#3f4346',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
  }),
  preset('dopamine', 'mindmap.presets.theme.dopamine', {
    line: '#8D80EA',
    background: '#FFFDF4',
    rootFill: '#FF4D8D',
    rootText: '#FFFFFF',
    secondFill: '#FFF2A8',
    secondText: '#342441',
    secondBorder: '#FF9F1C',
    nodeText: '#3E3650',
    nodeFill: '#FFFFFF',
    nodeBorder: '#6C5CE7',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
    lineStyle: 'curve',
    lineWidth: 2,
  }, {
    line: '#8D80EA',
    background: '#272132',
    rootFill: '#ff5f9c',
    rootText: '#FFFFFF',
    secondFill: '#342e40',
    secondText: '#f0e9ff',
    secondBorder: '#665490',
    nodeText: '#c9bfe0',
    nodeFill: '#322c3e',
    nodeBorder: '#6C5CE7',
    rootShape: 'roundedRectangle',
    secondShape: 'roundedRectangle',
    lineStyle: 'curve',
    lineWidth: 2,
  }),
]

export const DEFAULT_MIND_MAP_THEME_ID = 'default'

export function findThemePreset(id: unknown): MindMapThemePreset {
  return (
    MIND_MAP_THEMES.find((item) => item.id === id) ||
    MIND_MAP_THEMES[0]
  )
}

/** Base-style keys the inspector may override on top of the active preset. */
export type MindMapBaseStyle = {
  backgroundColor?: string
  lineColor?: string
  lineWidth?: number
  lineStyle?: MindMapLineStyle
  lineDasharray?: string
  lineRadius?: number
  showLineMarker?: boolean
  nodeUseLineStyle?: boolean
}

/**
 * Merge a preset with the user's base-style overrides into one theme config.
 * `mode` picks the light or dark face; base-style overrides win over both, so a
 * background the user picked by hand survives a day/night switch.
 */
export function resolveThemeConfig(
  themeId: unknown,
  base: MindMapBaseStyle,
  mode: MindMapThemeMode = 'light',
): MindMapThemeConfig {
  const preset = findThemePreset(themeId)
  const config: MindMapThemeConfig = { ...(mode === 'dark' ? preset.darkConfig : preset.config) }
  Object.entries(base).forEach(([key, value]) => {
    if (value !== undefined) config[key] = value
  })
  return config
}
