import tablerIconSetRaw from '@iconify-json/tabler/icons.json?raw'

export type IconCategory =
  | '常用' | '箭头' | '文件' | '编辑' | '通讯' | '人物' | '媒体' | '自然'
  | '地点' | '时间' | '商业' | '科技' | '状态' | '图形' | '品牌' | '其他'

export interface IconDefinition {
  id: string
  /** Tabler 图标名，用于查找 SVG 内容。 */
  name: string
  label: string
  category: IconCategory
  symbol: string
  body: string
  search: string
}

export interface CuratedIcon {
  id: string
  name: string
  label: string
  category: IconCategory
  symbol: string
  keywords?: readonly string[]
}

interface IconifySet {
  icons: Record<string, { body: string }>
  aliases?: Record<string, { parent: string }>
}

const TOKEN_LABELS: Record<string, string> = {
  arrow: '箭头', arrows: '箭头', chevron: '折角', chevrons: '双折角', caret: '三角', corner: '转角',
  up: '上', down: '下', left: '左', right: '右', top: '顶', bottom: '底', start: '开始', end: '结束',
  north: '北', south: '南', east: '东', west: '西', diagonal: '斜向', horizontal: '水平', vertical: '垂直',
  circle: '圆形', square: '方形', triangle: '三角', hexagon: '六边形', octagon: '八边形',
  rectangle: '矩形', diamond: '菱形', rhombus: '菱形', oval: '椭圆', wave: '波浪', waves: '波浪',
  plus: '加号', minus: '减号', x: '叉号', check: '对勾', checks: '对勾', exclamation: '感叹号',
  question: '问号', info: '信息', alert: '警告', warning: '警告', error: '错误', forbidden: '禁止',
  ban: '禁止', disabled: '禁用', lock: '锁', unlock: '解锁', key: '钥匙', shield: '盾牌', eye: '眼睛',
  bell: '铃铛', notification: '通知', activity: '活动', heartbeat: '心跳',
  mood: '表情', smile: '微笑', sad: '悲伤', angry: '生气', happy: '开心', neutral: '平静',
  user: '用户', users: '用户组', friend: '朋友', friends: '朋友', contact: '联系人', id: '证件',
  phone: '电话', call: '通话', mobile: '手机', smartphone: '手机', tablet: '平板', laptop: '笔记本',
  desktop: '桌面', monitor: '显示器', keyboard: '键盘', mouse: '鼠标', printer: '打印机',
  mail: '邮件', message: '消息', messages: '消息', chat: '聊天', comment: '评论', send: '发送',
  inbox: '收件箱', share: '分享', broadcast: '广播', antenna: '天线', rss: '订阅', at: '艾特',
  speakerphone: '免提', headphones: '耳机', headset: '耳麦', microphone: '麦克风', mic: '麦克风',
  volume: '音量', speaker: '扬声器', music: '音乐', note: '音符', notes: '笔记', playlist: '播放列表',
  play: '播放', pause: '暂停', stop: '停止', record: '录制', player: '播放器', movie: '电影',
  video: '视频', camera: '相机', photo: '照片', picture: '图片', image: '图片', images: '图片',
  album: '相册', aperture: '光圈', lens: '镜头', zoom: '缩放', focus: '对焦', palette: '调色板',
  brush: '画笔', pen: '钢笔', pencil: '铅笔', edit: '编辑', eraser: '橡皮擦', ruler: '标尺',
  scissors: '剪刀', cut: '剪切', copy: '复制', paste: '粘贴', clipboard: '剪贴板', trash: '删除',
  delete: '删除', save: '保存', floppy: '软盘', download: '下载', upload: '上传', file: '文件',
  files: '文件', folder: '文件夹', folders: '文件夹', archive: '归档', paperclip: '附件',
  book: '书', books: '书', notebook: '笔记本', bookmark: '书签', license: '许可证',
  certificate: '证书', report: '报告', script: '脚本', markdown: 'Markdown', pdf: 'PDF',
  json: 'JSON', csv: 'CSV', zip: '压缩包', code: '代码', terminal: '终端', database: '数据库',
  server: '服务器', cpu: '处理器', chip: '芯片', memory: '内存', network: '网络', wifi: '无线网络',
  bluetooth: '蓝牙', battery: '电池', plug: '插头', usb: 'USB', sim: 'SIM 卡', router: '路由器',
  cloud: '云', computing: '计算', data: '数据', vector: '矢量', binary: '二进制', bug: '漏洞',
  api: '接口', robot: '机器人', brain: '智能', rocket: '火箭', satellite: '卫星', radar: '雷达',
  web: '网页', browser: '浏览器', window: '窗口', layout: '布局', grid: '网格', list: '列表',
  menu: '菜单', dashboard: '仪表盘', template: '模板', app: '应用', qrcode: '二维码',
  barcode: '条码', fingerprint: '指纹', scan: '扫描', sensor: '传感器', gps: '定位',
  home: '主页', house: '房屋', building: '建筑', store: '商店', shop: '商店', bank: '银行',
  hospital: '医院', school: '学校', church: '教堂', castle: '城堡', factory: '工厂',
  warehouse: '仓库', garage: '车库', hotel: '酒店', stadium: '体育场', bridge: '桥',
  map: '地图', pin: '图钉', location: '位置', navigation: '导航', route: '路线', road: '道路',
  compass: '指南针', world: '世界', globe: '地球', earth: '地球', planet: '星球',
  car: '汽车', bus: '公交', train: '火车', plane: '飞机', flight: '航班', bike: '自行车',
  scooter: '滑板车', motorbike: '摩托车', ship: '轮船', boat: '小船', anchor: '锚',
  parking: '停车', traffic: '交通', taxi: '出租车', ambulance: '救护车', truck: '卡车',
  tractor: '拖拉机', crane: '吊车', tent: '帐篷', camp: '露营', luggage: '行李',
  calendar: '日历', event: '事件', clock: '时钟', time: '时间', alarm: '闹钟', timer: '计时器',
  stopwatch: '秒表', hourglass: '沙漏', watch: '手表', history: '历史', hour: '小时',
  minute: '分钟', second: '秒', month: '月', week: '周', day: '日', year: '年',
  sun: '太阳', sunny: '晴天', moon: '月亮', star: '星星', stars: '星星', sparkles: '闪光',
  rain: '雨', snow: '雪', snowflake: '雪花', storm: '暴风雨', wind: '风',
  tornado: '龙卷风', umbrella: '雨伞', temperature: '温度', droplet: '水滴', flame: '火焰',
  fire: '火', leaf: '叶子', tree: '树', plant: '植物', flower: '花', seed: '种子',
  mountain: '山', sunrise: '日出', sunset: '日落', rainbow: '彩虹', fog: '雾', mist: '薄雾',
  weather: '天气', butterfly: '蝴蝶', fish: '鱼', cat: '猫', dog: '狗', paw: '爪印',
  feather: '羽毛', egg: '蛋', bone: '骨头', mushroom: '蘑菇', cactus: '仙人掌',
  shopping: '购物', cart: '购物车', bag: '包', wallet: '钱包', cash: '现金', coin: '硬币',
  coins: '硬币', currency: '货币', money: '钱', credit: '信用', card: '卡', receipt: '收据',
  invoice: '发票', discount: '折扣', coupon: '优惠券', ticket: '票', gift: '礼物',
  package: '包裹', box: '箱子', briefcase: '公文包', chart: '图表', graph: '图表',
  trend: '趋势', analytics: '分析', calculator: '计算器', percentage: '百分比', percent: '百分比',
  businessplan: '商业计划', finance: '财务', pig: '存钱罐', atm: '取款机', trophy: '奖杯',
  award: '奖项', medal: '奖牌', crown: '皇冠', gem: '宝石',
  news: '新闻', article: '文章', quote: '引用', checkbox: '复选框',
  filter: '筛选', sort: '排序', search: '搜索', settings: '设置', adjustments: '调整',
  tool: '工具', tools: '工具', wrench: '扳手', hammer: '锤子', screwdriver: '螺丝刀',
  refresh: '刷新', reload: '重载', rotate: '旋转', repeat: '重复', loop: '循环',
  external: '外部', link: '链接', unlink: '取消链接', transfer: '转换',
  swap: '交换', exchange: '交换', switch: '切换', login: '登录', logout: '退出',
  eyes: '查看', drag: '拖动', move: '移动',
  hand: '手', pointer: '指针', cursor: '光标', click: '点击', select: '选择',
  command: '命令', ctrl: '控制键', shift: '切换键', alt: '替换键',
  device: '设备', devices: '设备', hardware: '硬件', chipset: '芯片组', motherboard: '主板',
  gamepad: '手柄', joystick: '摇杆', tv: '电视', radio: '收音机',
  signal: '信号', access: '访问', point: '点', hotspot: '热点',
  ai: '智能', machine: '机器', learning: '学习', neural: '神经',
  vaccine: '疫苗', virus: '病毒', bacteria: '细菌', test: '测试', flask: '烧瓶',
  atom: '原子', dna: 'DNA', heart: '心', stethoscope: '听诊器',
  first: '第一', aid: '急救', kit: '工具包', pill: '药丸', medicine: '药',
  dumbbell: '哑铃', weight: '重量', run: '跑步', walk: '步行', swim: '游泳',
  ball: '球', basketball: '篮球', football: '足球', tennis: '网球', golf: '高尔夫',
  chess: '国际象棋', dice: '骰子', cards: '纸牌', puzzle: '拼图', game: '游戏',
  cake: '蛋糕', cup: '杯子', coffee: '咖啡', tea: '茶', pizza: '披萨', apple: '苹果',
  food: '食物', drink: '饮料', bottle: '瓶子', chef: '厨师', barbecue: '烧烤',
  baby: '宝宝', kid: '儿童', man: '男人', woman: '女人', gender: '性别',
  brand: '品牌', github: 'GitHub', google: 'Google', microsoft: '微软',
  android: 'Android', windows: 'Windows', chrome: 'Chrome', facebook: 'Facebook',
  twitter: 'Twitter', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube',
  tiktok: 'TikTok', wechat: '微信', qq: 'QQ', alipay: '支付宝', taobao: '淘宝',
  paypal: 'PayPal', slack: 'Slack', discord: 'Discord', figma: 'Figma', notion: 'Notion',
  docker: 'Docker', react: 'React', vue: 'Vue', angular: 'Angular', nodejs: 'Node.js',
  python: 'Python', rust: 'Rust', golang: 'Go', java: 'Java', php: 'PHP', swift: 'Swift',
  kotlin: 'Kotlin', html: 'HTML', css: 'CSS', javascript: 'JavaScript', typescript: 'TypeScript',
}

const CATEGORY_RULES: ReadonlyArray<readonly [IconCategory, readonly string[]]> = [
  ['品牌', ['brand']],
  ['箭头', ['arrow', 'arrows', 'chevron', 'chevrons', 'caret', 'corner', 'direction', 'transfer', 'sort', 'switch', 'exchange', 'swap', 'drag', 'pointer', 'backspace', 'redo', 'undo', 'move', 'route', 'navigation', 'compass', 'gps']],
  ['文件', ['file', 'files', 'folder', 'folders', 'book', 'books', 'notebook', 'note', 'notes', 'clipboard', 'paperclip', 'archive', 'bookmark', 'license', 'certificate', 'report', 'script', 'markdown', 'pdf', 'json', 'csv', 'excel', 'word', 'zip']],
  ['编辑', ['edit', 'pencil', 'pen', 'brush', 'eraser', 'cut', 'scissors', 'copy', 'paste', 'trash', 'delete', 'ruler', 'crop', 'palette', 'paint', 'highlight', 'typography', 'text', 'font', 'bold', 'italic', 'underline', 'strikethrough', 'align', 'layout', 'color', 'swatch', 'adjust', 'adjustments', 'replace', 'clear', 'select', 'cursor', 'forms', 'input', 'textarea', 'tools', 'tool', 'wrench', 'hammer', 'screwdriver']],
  ['通讯', ['mail', 'message', 'messages', 'chat', 'phone', 'call', 'send', 'inbox', 'share', 'speakerphone', 'at', 'broadcast', 'antenna', 'rss', 'comment', 'quote', 'headset', 'headphones', 'microphone', 'mic']],
  ['人物', ['user', 'users', 'friends', 'friend', 'man', 'woman', 'baby', 'kid', 'mood', 'face', 'contact', 'id', 'gender']],
  ['媒体', ['photo', 'camera', 'video', 'music', 'player', 'play', 'pause', 'stop', 'record', 'movie', 'disc', 'playlist', 'radio', 'equalizer', 'waveform', 'guitar', 'piano', 'drum', 'aperture', 'lens', 'picture', 'image', 'images', 'album', 'tv', 'gamepad', 'joystick']],
  ['时间', ['clock', 'calendar', 'alarm', 'time', 'timer', 'stopwatch', 'hourglass', 'watch', 'history']],
  ['商业', ['shopping', 'cart', 'bag', 'wallet', 'cash', 'coin', 'coins', 'currency', 'credit', 'receipt', 'invoice', 'discount', 'coupon', 'ticket', 'gift', 'package', 'box', 'briefcase', 'bank', 'store', 'shop', 'chart', 'graph', 'trend', 'analytics', 'businessplan', 'calculator', 'percentage', 'percent', 'finance', 'money', 'pig', 'atm', 'qrcode', 'barcode', 'trophy', 'award', 'medal', 'crown', 'diamond', 'gem']],
  ['自然', ['sun', 'sunny', 'moon', 'star', 'stars', 'sparkles', 'cloud', 'rain', 'snow', 'snowflake', 'storm', 'wind', 'tornado', 'umbrella', 'temperature', 'droplet', 'wave', 'waves', 'flame', 'fire', 'leaf', 'tree', 'plant', 'flower', 'seed', 'mountain', 'world', 'globe', 'earth', 'planet', 'sunrise', 'sunset', 'rainbow', 'fog', 'mist', 'weather', 'butterfly', 'fish', 'cat', 'dog', 'paw', 'feather', 'egg', 'bone', 'mushroom', 'cactus']],
  ['地点', ['map', 'pin', 'location', 'home', 'house', 'building', 'hospital', 'school', 'church', 'castle', 'factory', 'warehouse', 'garage', 'hotel', 'stadium', 'bridge', 'car', 'bus', 'train', 'plane', 'flight', 'bike', 'scooter', 'motorbike', 'ship', 'boat', 'rocket', 'anchor', 'parking', 'traffic', 'taxi', 'ambulance', 'truck', 'tractor', 'crane', 'tent', 'camp', 'luggage']],
  ['科技', ['device', 'devices', 'cpu', 'server', 'router', 'wifi', 'bluetooth', 'battery', 'plug', 'keyboard', 'mouse', 'monitor', 'tablet', 'laptop', 'desktop', 'mobile', 'smartphone', 'chip', 'chipset', 'network', 'code', 'terminal', 'bug', 'git', 'branch', 'database', 'binary', 'api', 'sdk', 'computing', 'cloud-computing', 'usb', 'sim', 'memory', 'motherboard', 'hard-drive', 'floppy', 'printer', 'scanner', 'webhook', 'web', 'app', 'window', 'browser', 'brain', 'robot', 'satellite', 'radar', 'sensor', 'ai', 'machine']],
  ['状态', ['alert', 'warning', 'info', 'help', 'question', 'check', 'checks', 'x', 'ban', 'forbidden', 'disabled', 'lock', 'unlock', 'shield', 'eye', 'bell', 'notification', 'activity', 'pulse', 'heart', 'heartbeat', 'progress', 'loader', 'refresh', 'reload', 'error', 'exclamation', 'copyright', 'registered', 'trademark']],
  ['图形', ['circle', 'square', 'triangle', 'hexagon', 'rectangle', 'rhombus', 'diamond', 'star', 'point', 'line', 'shape', 'polygon', 'math', 'equal', 'plus', 'minus', 'multiply', 'divide', 'infinity', 'function', 'superscript', 'subscript', 'brackets', 'number', 'letter', 'abc', 'sum', 'sigma', 'pi', 'square-root', 'angle', 'degrees', 'vector', 'geometry', 'cylinder', 'cone', 'sphere', 'pyramid', 'cube']],
]

const LABEL_OVERRIDES: Record<string, string> = {
  'arrow-up': '上箭头', 'arrow-down': '下箭头', 'arrow-left': '左箭头', 'arrow-right': '右箭头',
  'arrow-up-left': '左上箭头', 'arrow-up-right': '右上箭头', 'arrow-down-left': '左下箭头', 'arrow-down-right': '右下箭头',
  'arrow-back': '返回', 'arrow-forward': '前进', 'arrow-narrow-right': '细右箭头', 'arrow-big-right': '粗右箭头',
  'circle-plus': '圆形加号', 'circle-minus': '圆形减号', 'circle-x': '圆形叉号', 'circle-check': '圆形对勾',
  'square-plus': '方形加号', 'square-x': '方形叉号', 'square-check': '方形对勾',
  'menu-2': '菜单', 'dots': '省略号', 'dots-vertical': '竖排省略号', 'layout-grid': '网格布局',
  'file-plus': '新建文件', 'file-text': '文本文件', 'folder-plus': '新建文件夹', 'folder-open': '打开文件夹',
  'device-mobile': '手机', 'device-desktop': '电脑', 'device-laptop': '笔记本', 'device-tablet': '平板',
  'brand-github': 'GitHub', 'brand-google': 'Google', 'brand-apple': 'Apple', 'brand-windows': 'Windows',
  'brand-android': 'Android', 'brand-chrome': 'Chrome', 'brand-facebook': 'Facebook', 'brand-twitter': 'Twitter',
  'brand-instagram': 'Instagram', 'brand-linkedin': 'LinkedIn', 'brand-youtube': 'YouTube', 'brand-tiktok': 'TikTok',
  'brand-wechat': '微信', 'brand-alipay': '支付宝', 'brand-taobao': '淘宝', 'brand-paypal': 'PayPal',
  'brand-slack': 'Slack', 'brand-discord': 'Discord', 'brand-figma': 'Figma', 'brand-notion': 'Notion',
  'brand-docker': 'Docker', 'brand-react': 'React', 'brand-vue': 'Vue', 'brand-angular': 'Angular',
  'brand-nodejs': 'Node.js', 'brand-python': 'Python', 'brand-rust': 'Rust', 'brand-golang': 'Go',
  'brand-java': 'Java', 'brand-php': 'PHP', 'brand-swift': 'Swift', 'brand-kotlin': 'Kotlin',
  'brand-html5': 'HTML5', 'brand-css3': 'CSS3', 'brand-javascript': 'JavaScript', 'brand-typescript': 'TypeScript',
  'mood-smile': '微笑', 'mood-sad': '难过', 'mood-angry': '生气', 'mood-happy': '开心', 'mood-neutral': '平静',
  'thumb-up': '点赞', 'thumb-down': '点踩', 'player-play': '播放', 'player-pause': '暂停', 'player-stop': '停止',
  'calendar-event': '日程', 'calendar-month': '月历', 'calendar-week': '周历', 'clock-hour': '时钟',
  'home-2': '主页', 'building-bank': '银行', 'building-store': '商店', 'building-hospital': '医院',
  'shopping-cart': '购物车', 'credit-card': '银行卡', 'map-pin': '地图标记', 'brand-safari': 'Safari',
}

const DIRECTION_TOKENS = new Set(['up', 'down', 'left', 'right', 'top', 'bottom', 'north', 'south', 'east', 'west'])
const DIRECTION_ORDER = ['up', 'down', 'left', 'right', 'top', 'bottom', 'north', 'south', 'east', 'west']

function parseIconSet(): IconifySet {
  return JSON.parse(tablerIconSetRaw) as IconifySet
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1)
}

function translatedLabel(name: string, tokens: readonly string[]): string {
  const override = LABEL_OVERRIDES[name]
  if (override) return override
  if (name.startsWith('brand-')) {
    const brand = name.slice('brand-'.length)
    return LABEL_OVERRIDES[name] ?? brand.split('-').map(capitalize).join(' ')
  }
  const translations = tokens.map((token) => TOKEN_LABELS[token])
  const known = translations.filter((value): value is string => Boolean(value))
  if (known.length === 0) return name
  if (tokens[0] === 'arrow' && tokens.length > 1 && DIRECTION_TOKENS.has(tokens[1])) {
    const rest = tokens.slice(1).map((token) => TOKEN_LABELS[token]).filter((value): value is string => Boolean(value))
    return `${DIRECTION_ORDER.includes(tokens[1]) ? TOKEN_LABELS[tokens[1]] : ''}${rest.slice(1).join('')}箭头`
  }
  if (known.length === tokens.length) return known.join('')
  const unknown = tokens.filter((token) => !TOKEN_LABELS[token])
  return `${known.join('')} ${unknown.join(' ')}`
}

function categoryFor(tokens: readonly string[]): IconCategory {
  for (const [category, words] of CATEGORY_RULES) {
    if (tokens.some((token) => words.includes(token))) return category
  }
  return '其他'
}

function resolveBody(iconSet: IconifySet, name: string, seen = new Set<string>()): string {
  if (seen.has(name)) return ''
  const direct = iconSet.icons[name]
  if (direct) return direct.body
  const alias = iconSet.aliases?.[name]
  if (!alias) return ''
  seen.add(name)
  return resolveBody(iconSet, alias.parent, seen)
}

function makeDefinition(
  iconSet: IconifySet,
  source: CuratedIcon,
  aliasWords: readonly string[],
): IconDefinition {
  const search = `${source.label} ${source.name} ${source.keywords?.join(' ') || ''} ${aliasWords.join(' ')} ${source.category}`.toLowerCase()
  return {
    id: source.id,
    name: source.name,
    label: source.label,
    category: source.category,
    symbol: source.symbol,
    body: resolveBody(iconSet, source.name),
    search,
  }
}

export function buildIconCatalog(curated: readonly CuratedIcon[]): IconDefinition[] {
  const iconSet = parseIconSet()
  const curatedNames = new Set(curated.map((icon) => icon.name))
  const curatedIds = new Set(curated.map((icon) => icon.id))
  const aliasWords = new Map<string, string[]>()
  for (const [alias, entry] of Object.entries(iconSet.aliases || {})) {
    const words = aliasWords.get(entry.parent) || []
    words.push(alias)
    aliasWords.set(entry.parent, words)
  }
  const definitions = curated.map((icon) => makeDefinition(iconSet, icon, aliasWords.get(icon.name) || []))
  for (const name of Object.keys(iconSet.icons)) {
    if (curatedNames.has(name) || curatedIds.has(name)) continue
    const tokens = name.split('-')
    const label = translatedLabel(name, tokens)
    const category = categoryFor(tokens)
    const keywords = aliasWords.get(name) || []
    definitions.push({
      id: name,
      name,
      label,
      category,
      symbol: '◆',
      body: iconSet.icons[name].body,
      search: `${label} ${name} ${keywords.join(' ')} ${category}`.toLowerCase(),
    })
  }
  return definitions
}
