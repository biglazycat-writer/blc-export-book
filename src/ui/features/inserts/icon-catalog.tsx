import type { CSSProperties, ReactNode } from 'react'
import { buildIconCatalog, type CuratedIcon, type IconCategory, type IconDefinition } from './icon-library'

export type { IconCategory, IconDefinition }

export interface IconSelection {
  id: string
  label: string
  symbol: string
  color: string
  svg: string
}

const CURATED: readonly CuratedIcon[] = [
  { id: 'check', name: 'check', label: '完成', category: '常用', symbol: '✓', keywords: ['对勾', '成功', 'ok'] },
  { id: 'plus', name: 'plus', label: '添加', category: '常用', symbol: '＋', keywords: ['新建', '增加'] },
  { id: 'star', name: 'star', label: '星标', category: '常用', symbol: '★', keywords: ['收藏', '重点'] },
  { id: 'heart', name: 'heart', label: '喜欢', category: '常用', symbol: '♥', keywords: ['爱', '收藏'] },
  { id: 'sparkles', name: 'sparkles', label: '亮点', category: '常用', symbol: '✦', keywords: ['灵感', '魔法', 'AI'] },
  { id: 'lightbulb', name: 'bulb', label: '想法', category: '常用', symbol: '💡', keywords: ['灯泡', '灵感', '创意'] },
  { id: 'target', name: 'target', label: '目标', category: '常用', symbol: '◎', keywords: ['靶心', '目的'] },
  { id: 'flag', name: 'flag', label: '旗帜', category: '常用', symbol: '⚑', keywords: ['标记', '里程碑'] },
  { id: 'alert', name: 'alert-triangle', label: '警告', category: '状态', symbol: '⚠', keywords: ['注意', '风险'] },
  { id: 'info', name: 'info-circle', label: '信息', category: '状态', symbol: 'ⓘ', keywords: ['说明', '提示'] },
  { id: 'help', name: 'help-circle', label: '帮助', category: '状态', symbol: '?', keywords: ['问号', '疑问'] },
  { id: 'zap', name: 'bolt', label: '闪电', category: '状态', symbol: 'ϟ', keywords: ['能量', '快速', '效率'] },
  { id: 'message', name: 'message-circle', label: '消息', category: '通讯', symbol: '▣', keywords: ['聊天', '对话'] },
  { id: 'mail', name: 'mail', label: '邮件', category: '通讯', symbol: '✉', keywords: ['信件', '邮箱'] },
  { id: 'bell', name: 'bell', label: '提醒', category: '通讯', symbol: '♢', keywords: ['通知', '铃声'] },
  { id: 'thumbs-up', name: 'thumb-up', label: '赞', category: '通讯', symbol: '👍', keywords: ['点赞', '喜欢'] },
  { id: 'link', name: 'link', label: '链接', category: '通讯', symbol: '🔗', keywords: ['网址', '引用'] },
  { id: 'arrow-right', name: 'arrow-right', label: '向右', category: '箭头', symbol: '→', keywords: ['箭头', '下一步'] },
  { id: 'home', name: 'home', label: '主页', category: '地点', symbol: '⌂', keywords: ['首页', '房子'] },
  { id: 'user', name: 'user', label: '用户', category: '人物', symbol: '♙', keywords: ['人物', '账号'] },
  { id: 'calendar', name: 'calendar', label: '日历', category: '时间', symbol: '▦', keywords: ['日期', '日程'] },
  { id: 'clock', name: 'clock', label: '时间', category: '时间', symbol: '◷', keywords: ['时钟', '几点'] },
  { id: 'location', name: 'map-pin', label: '位置', category: '地点', symbol: '⌖', keywords: ['地点', '定位'] },
  { id: 'book', name: 'book', label: '文档', category: '文件', symbol: '▤', keywords: ['书', '章节'] },
  { id: 'download', name: 'download', label: '下载', category: '文件', symbol: '⇩', keywords: ['导出', '保存'] },
  { id: 'settings', name: 'settings', label: '设置', category: '编辑', symbol: '⚙', keywords: ['配置', '齿轮'] },
  { id: 'search', name: 'search', label: '搜索', category: '编辑', symbol: '⌕', keywords: ['查找', '放大镜'] },
  { id: 'cloud', name: 'cloud', label: '云端', category: '科技', symbol: '☁', keywords: ['云', '同步'] },
  { id: 'circle-check', name: 'circle-check', label: '成功', category: '状态', symbol: '✅', keywords: ['完成', '通过'] },
  { id: 'circle-x', name: 'circle-x', label: '失败', category: '状态', symbol: '❌', keywords: ['关闭', '错误'] },
  { id: 'alert-circle', name: 'alert-circle', label: '错误', category: '状态', symbol: '❗', keywords: ['异常', '注意'] },
  { id: 'refresh', name: 'refresh', label: '刷新', category: '状态', symbol: '↻', keywords: ['重载', '同步'] },
  { id: 'upload', name: 'upload', label: '上传', category: '文件', symbol: '⇧', keywords: ['导入', '发布'] },
  { id: 'folder', name: 'folder', label: '文件夹', category: '文件', symbol: '📁', keywords: ['目录', '分类'] },
  { id: 'file-text', name: 'file-text', label: '文件', category: '文件', symbol: '📄', keywords: ['文档', '稿件'] },
  { id: 'notebook', name: 'notebook', label: '笔记', category: '文件', symbol: '📓', keywords: ['本子', '记录'] },
  { id: 'archive', name: 'archive', label: '归档', category: '文件', symbol: '🗄', keywords: ['收纳', '存档'] },
  { id: 'trash', name: 'trash', label: '删除', category: '编辑', symbol: '🗑', keywords: ['垃圾桶', '移除'] },
  { id: 'edit', name: 'edit', label: '编辑', category: '编辑', symbol: '✎', keywords: ['修改', '写作'] },
  { id: 'copy', name: 'copy', label: '复制', category: '编辑', symbol: '⧉', keywords: ['副本', '拷贝'] },
  { id: 'save', name: 'device-floppy', label: '保存', category: '编辑', symbol: '💾', keywords: ['存储', '软盘'] },
  { id: 'printer', name: 'printer', label: '打印', category: '编辑', symbol: '⎙', keywords: ['输出', '纸张'] },
  { id: 'image', name: 'photo', label: '图片', category: '媒体', symbol: '🖼', keywords: ['照片', '插图'] },
  { id: 'camera', name: 'camera', label: '相机', category: '媒体', symbol: '📷', keywords: ['拍照', '摄影'] },
  { id: 'video', name: 'video', label: '视频', category: '媒体', symbol: '🎬', keywords: ['影片', '剪辑'] },
  { id: 'music', name: 'music', label: '音乐', category: '媒体', symbol: '♪', keywords: ['歌曲', '音频'] },
  { id: 'microphone', name: 'microphone', label: '麦克风', category: '媒体', symbol: '🎤', keywords: ['录音', '语音'] },
  { id: 'phone', name: 'phone', label: '电话', category: '通讯', symbol: '☎', keywords: ['通话', '联系'] },
  { id: 'send', name: 'send', label: '发送', category: '通讯', symbol: '➤', keywords: ['提交', '消息'] },
  { id: 'users', name: 'users', label: '团队', category: '人物', symbol: '👥', keywords: ['成员', '协作'] },
  { id: 'lock', name: 'lock', label: '锁定', category: '状态', symbol: '🔒', keywords: ['私密', '安全'] },
  { id: 'key', name: 'key', label: '钥匙', category: '状态', symbol: '🔑', keywords: ['密码', '权限'] },
  { id: 'eye', name: 'eye', label: '查看', category: '状态', symbol: '👁', keywords: ['预览', '可见'] },
  { id: 'shield-check', name: 'shield-check', label: '安全', category: '状态', symbol: '🛡', keywords: ['防护', '隐私'] },
  { id: 'chart-bar', name: 'chart-bar', label: '柱状图', category: '商业', symbol: '📊', keywords: ['数据', '统计'] },
  { id: 'chart-line', name: 'chart-line', label: '增长', category: '商业', symbol: '📈', keywords: ['趋势', '曲线'] },
  { id: 'calculator', name: 'calculator', label: '计算', category: '商业', symbol: '🧮', keywords: ['算术', '数字'] },
  { id: 'credit-card', name: 'credit-card', label: '银行卡', category: '商业', symbol: '💳', keywords: ['支付', '付款'] },
  { id: 'shopping-cart', name: 'shopping-cart', label: '购物车', category: '商业', symbol: '🛒', keywords: ['购买', '清单'] },
  { id: 'gift', name: 'gift', label: '礼物', category: '商业', symbol: '🎁', keywords: ['赠送', '惊喜'] },
  { id: 'package', name: 'package', label: '包裹', category: '商业', symbol: '📦', keywords: ['物流', '快递'] },
  { id: 'rocket', name: 'rocket', label: '火箭', category: '地点', symbol: '🚀', keywords: ['发布', '启动'] },
  { id: 'brain', name: 'brain', label: '智能', category: '科技', symbol: '🧠', keywords: ['大脑', 'AI'] },
  { id: 'code', name: 'code', label: '代码', category: '科技', symbol: '</>', keywords: ['开发', '程序'] },
  { id: 'database', name: 'database', label: '数据库', category: '科技', symbol: '⛁', keywords: ['数据', '存储'] },
  { id: 'server', name: 'server', label: '服务器', category: '科技', symbol: '🖥', keywords: ['后端', '机房'] },
  { id: 'cpu', name: 'cpu', label: '处理器', category: '科技', symbol: '▩', keywords: ['芯片', '性能'] },
  { id: 'wifi', name: 'wifi', label: '网络', category: '科技', symbol: '📶', keywords: ['无线', '信号'] },
  { id: 'battery', name: 'battery', label: '电量', category: '科技', symbol: '🔋', keywords: ['电池', '续航'] },
  { id: 'globe', name: 'world', label: '世界', category: '自然', symbol: '🌐', keywords: ['全球', '地球'] },
  { id: 'map', name: 'map', label: '地图', category: '地点', symbol: '🗺', keywords: ['地点', '路线'] },
  { id: 'navigation', name: 'navigation', label: '导航', category: '地点', symbol: '➹', keywords: ['方向', '指路'] },
  { id: 'car', name: 'car', label: '汽车', category: '地点', symbol: '🚗', keywords: ['出行', '驾驶'] },
  { id: 'plane', name: 'plane', label: '飞机', category: '地点', symbol: '✈', keywords: ['旅行', '航班'] },
  { id: 'train', name: 'train', label: '火车', category: '地点', symbol: '🚆', keywords: ['高铁', '出行'] },
  { id: 'building', name: 'building', label: '建筑', category: '地点', symbol: '🏢', keywords: ['公司', '办公楼'] },
  { id: 'school', name: 'school', label: '学校', category: '地点', symbol: '🏫', keywords: ['学习', '教育'] },
  { id: 'hospital', name: 'hospital', label: '医院', category: '地点', symbol: '🏥', keywords: ['医疗', '健康'] },
  { id: 'coffee', name: 'coffee', label: '咖啡', category: '自然', symbol: '☕', keywords: ['饮品', '休息'] },
  { id: 'sun', name: 'sun', label: '晴天', category: '自然', symbol: '☀', keywords: ['太阳', '白天'] },
  { id: 'moon', name: 'moon', label: '夜晚', category: '自然', symbol: '☾', keywords: ['月亮', '夜间'] },
  { id: 'cloud-rain', name: 'cloud-rain', label: '下雨', category: '自然', symbol: '🌧', keywords: ['雨天', '天气'] },
  { id: 'snowflake', name: 'snowflake', label: '雪花', category: '自然', symbol: '❄', keywords: ['冬天', '寒冷'] },
  { id: 'flame', name: 'flame', label: '火焰', category: '自然', symbol: '🔥', keywords: ['热门', '燃烧'] },
  { id: 'leaf', name: 'leaf', label: '叶子', category: '自然', symbol: '🍃', keywords: ['植物', '绿色'] },
  { id: 'tree', name: 'tree', label: '树木', category: '自然', symbol: '🌳', keywords: ['森林', '植物'] },
  { id: 'flower', name: 'flower', label: '花朵', category: '自然', symbol: '🌸', keywords: ['鲜花', '春天'] },
  { id: 'paw', name: 'paw', label: '宠物', category: '自然', symbol: '🐾', keywords: ['动物', '脚印'] },
  { id: 'palette', name: 'palette', label: '配色', category: '编辑', symbol: '🎨', keywords: ['调色板', '设计'] },
  { id: 'brush', name: 'brush', label: '画笔', category: '编辑', symbol: '🖌', keywords: ['绘画', '设计'] },
  { id: 'scissors', name: 'scissors', label: '剪切', category: '编辑', symbol: '✂', keywords: ['裁剪', '剪刀'] },
  { id: 'pin', name: 'pin', label: '置顶', category: '编辑', symbol: '📌', keywords: ['图钉', '固定'] },
  { id: 'bookmark', name: 'bookmark', label: '书签', category: '文件', symbol: '🔖', keywords: ['收藏', '标记'] },
  { id: 'tag', name: 'tag', label: '标签', category: '商业', symbol: '🏷', keywords: ['分类', '价格'] },
  { id: 'calendar-event', name: 'calendar-event', label: '日程', category: '时间', symbol: '📅', keywords: ['安排', '计划'] },
  { id: 'alarm', name: 'alarm', label: '闹钟', category: '时间', symbol: '⏰', keywords: ['提醒', '定时'] },
  { id: 'hourglass', name: 'hourglass', label: '等待', category: '时间', symbol: '⌛', keywords: ['沙漏', '耗时'] },
  { id: 'history', name: 'history', label: '历史', category: '时间', symbol: '↺', keywords: ['记录', '回溯'] },
  { id: 'external-link', name: 'external-link', label: '外链', category: '通讯', symbol: '↗', keywords: ['跳转', '链接'] },
  { id: 'share', name: 'share', label: '分享', category: '通讯', symbol: '⇗', keywords: ['转发', '共享'] },
  { id: 'quote', name: 'quote', label: '引用', category: '编辑', symbol: '❝', keywords: ['引号', '摘录'] },
  { id: 'list-check', name: 'list-check', label: '清单', category: '编辑', symbol: '☑', keywords: ['待办', '检查'] },
  { id: 'list', name: 'list', label: '列表', category: '编辑', symbol: '☰', keywords: ['项目', '条目'] },
  { id: 'layout', name: 'layout', label: '布局', category: '编辑', symbol: '▥', keywords: ['排版', '页面'] },
  { id: 'grid', name: 'layout-grid', label: '网格', category: '编辑', symbol: '⊞', keywords: ['宫格', '矩阵'] },
  { id: 'move', name: 'arrows-move', label: '移动', category: '箭头', symbol: '✥', keywords: ['拖动', '方向'] },
  { id: 'rotate', name: 'rotate', label: '旋转', category: '编辑', symbol: '⟳', keywords: ['转动', '刷新'] },
  { id: 'zoom-in', name: 'zoom-in', label: '放大', category: '编辑', symbol: '⊕', keywords: ['缩放', '查看'] },
  { id: 'zoom-out', name: 'zoom-out', label: '缩小', category: '编辑', symbol: '⊖', keywords: ['缩放', '查看'] },
  { id: 'filter', name: 'filter', label: '筛选', category: '编辑', symbol: '▽', keywords: ['过滤', '条件'] },
  { id: 'sort', name: 'arrows-sort', label: '排序', category: '箭头', symbol: '↕', keywords: ['升序', '降序'] },
  { id: 'play', name: 'play', label: '播放', category: '媒体', symbol: '▶', keywords: ['开始', '视频'] },
  { id: 'pause', name: 'pause', label: '暂停', category: '媒体', symbol: '⏸', keywords: ['停止', '视频'] },
  { id: 'stop', name: 'player-stop', label: '停止', category: '媒体', symbol: '⏹', keywords: ['结束', '播放'] },
  { id: 'volume', name: 'volume', label: '音量', category: '媒体', symbol: '🔊', keywords: ['声音', '喇叭'] },
  { id: 'headphones', name: 'headphones', label: '耳机', category: '媒体', symbol: '🎧', keywords: ['听歌', '音频'] },
  { id: 'book-open', name: 'book-2', label: '阅读', category: '文件', symbol: '📖', keywords: ['打开书', '学习'] },
  { id: 'certificate', name: 'certificate', label: '证书', category: '文件', symbol: '📜', keywords: ['认证', '毕业'] },
  { id: 'trophy', name: 'trophy', label: '奖杯', category: '商业', symbol: '🏆', keywords: ['成就', '冠军'] },
  { id: 'briefcase', name: 'briefcase', label: '工作', category: '商业', symbol: '💼', keywords: ['公文包', '职业'] },
  { id: 'building-bank', name: 'building-bank', label: '银行', category: '商业', symbol: '🏦', keywords: ['金融', '存款'] },
  { id: 'receipt', name: 'receipt', label: '账单', category: '商业', symbol: '🧾', keywords: ['票据', '消费'] },
  { id: 'wallet', name: 'wallet', label: '钱包', category: '商业', symbol: '👛', keywords: ['余额', '支付'] },
  { id: 'coin', name: 'coin', label: '金币', category: '商业', symbol: '🪙', keywords: ['货币', '财富'] },
  { id: 'qrcode', name: 'qrcode', label: '二维码', category: '科技', symbol: '▧', keywords: ['扫码', '链接'] },
  { id: 'virus', name: 'virus', label: '病毒', category: '自然', symbol: '🦠', keywords: ['微生物', '感染'] },
  { id: 'vaccine', name: 'vaccine', label: '疫苗', category: '自然', symbol: '💉', keywords: ['医疗', '注射'] },
  { id: 'first-aid-kit', name: 'first-aid-kit', label: '急救', category: '自然', symbol: '🩹', keywords: ['医疗', '药箱'] },
  { id: 'activity', name: 'activity', label: '活动', category: '状态', symbol: '∿', keywords: ['心率', '动态'] },
  { id: 'dumbbell', name: 'dumbbell', label: '健身', category: '自然', symbol: '🏋', keywords: ['运动', '锻炼'] },
  { id: 'run', name: 'run', label: '跑步', category: '自然', symbol: '🏃', keywords: ['运动', '锻炼'] },
  { id: 'bike', name: 'bike', label: '骑行', category: '地点', symbol: '🚴', keywords: ['自行车', '运动'] },
  { id: 'basketball', name: 'ball-basketball', label: '篮球', category: '自然', symbol: '🏀', keywords: ['球', '运动'] },
  { id: 'football', name: 'ball-football', label: '足球', category: '自然', symbol: '⚽', keywords: ['球', '运动'] },
  { id: 'tent', name: 'tent', label: '露营', category: '地点', symbol: '⛺', keywords: ['帐篷', '户外'] },
  { id: 'mountain', name: 'mountain', label: '山', category: '自然', symbol: '⛰', keywords: ['登山', '户外'] },
  { id: 'wave', name: 'ripple', label: '水波', category: '自然', symbol: '🌊', keywords: ['海浪', '波动'] },
  { id: 'anchor', name: 'anchor', label: '锚', category: '地点', symbol: '⚓', keywords: ['港口', '稳定'] },
  { id: 'compass', name: 'compass', label: '指南针', category: '地点', symbol: '🧭', keywords: ['方向', '探索'] },
  { id: 'telescope', name: 'telescope', label: '探索', category: '自然', symbol: '🔭', keywords: ['望远镜', '发现'] },
  { id: 'flask', name: 'flask', label: '实验', category: '自然', symbol: '🧪', keywords: ['化学', '试管'] },
  { id: 'atom', name: 'atom', label: '原子', category: '科技', symbol: '⚛', keywords: ['科学', '物理'] },
  { id: 'math', name: 'math', label: '数学', category: '图形', symbol: '∑', keywords: ['计算', '公式'] },
  { id: 'ruler', name: 'ruler', label: '标尺', category: '编辑', symbol: '📏', keywords: ['测量', '尺寸'] },
  { id: 'puzzle', name: 'puzzle', label: '拼图', category: '编辑', symbol: '🧩', keywords: ['组合', '谜题'] },
  { id: 'dice', name: 'dice', label: '骰子', category: '媒体', symbol: '🎲', keywords: ['随机', '游戏'] },
  { id: 'chess', name: 'chess', label: '棋', category: '媒体', symbol: '♟', keywords: ['策略', '国际象棋'] },
  { id: 'cards', name: 'cards', label: '扑克', category: '媒体', symbol: '♠', keywords: ['卡牌', '游戏'] },
  { id: 'cake', name: 'cake', label: '蛋糕', category: '自然', symbol: '🎂', keywords: ['生日', '甜点'] },
  { id: 'cup', name: 'cup', label: '杯子', category: '自然', symbol: '🥤', keywords: ['饮料', '喝水'] },
  { id: 'pizza', name: 'pizza', label: '披萨', category: '自然', symbol: '🍕', keywords: ['食物', '快餐'] },
  { id: 'apple', name: 'apple', label: '苹果', category: '自然', symbol: '🍎', keywords: ['水果', '食物'] },
  { id: 'cat', name: 'cat', label: '猫', category: '自然', symbol: '🐱', keywords: ['宠物', '动物'] },
  { id: 'dog', name: 'dog', label: '狗', category: '自然', symbol: '🐶', keywords: ['宠物', '动物'] },
  { id: 'baby', name: 'mood-kid', label: '宝宝', category: '人物', symbol: '👶', keywords: ['儿童', '家庭'] },
  { id: 'mood-smile', name: 'mood-smile', label: '微笑', category: '人物', symbol: '☺', keywords: ['表情', '开心'] },
  { id: 'bubble-text', name: 'bubble-text', label: '气泡文字', category: '通讯', symbol: '💬', keywords: ['台词', '对话'] },
  { id: 'message-dots', name: 'message-dots', label: '聊天中', category: '通讯', symbol: '…', keywords: ['消息', '输入'] },
]

const ALL_ICONS = buildIconCatalog(CURATED)
export const COMMON_ICONS = ALL_ICONS.slice(0, CURATED.length)
export const ICON_CATALOG = ALL_ICONS
export const ICON_CATEGORIES: ReadonlyArray<{ name: IconCategory; count: number }> = (() => {
  const order: IconCategory[] = ['常用', '箭头', '文件', '编辑', '通讯', '人物', '媒体', '自然', '地点', '时间', '商业', '科技', '状态', '图形', '品牌', '其他']
  const counts = new Map<IconCategory, number>()
  for (const icon of COMMON_ICONS) counts.set(icon.category, (counts.get(icon.category) || 0) + 1)
  return order.filter((name) => counts.has(name)).map((name) => ({ name, count: counts.get(name) || 0 }))
})()

const BY_ID = new Map<string, IconDefinition>()
for (const icon of ALL_ICONS) {
  if (!BY_ID.has(icon.id)) BY_ID.set(icon.id, icon)
  if (!BY_ID.has(icon.name)) BY_ID.set(icon.name, icon)
}

export function iconDefinition(id: string): IconDefinition | undefined {
  return BY_ID.get(id.replace(/^(lucide|tabler):/, ''))
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function iconBodyMarkup(body: string, color: string, strokeWidth: number, filled: boolean): string {
  return body
    .replace(/currentColor/g, () => escapeXml(color))
    .replace(/stroke-width="2"/g, `stroke-width="${strokeWidth}"`)
    .replace(/fill="none"/g, filled ? `fill="${escapeXml(color)}"` : 'fill="none"')
}

export function renderIconSvg(definition: IconDefinition, color = '#356AE6', options: { size?: number; strokeWidth?: number; filled?: boolean } = {}): string {
  const size = options.size ?? 128
  const strokeWidth = options.strokeWidth ?? 1.8
  const safeColor = escapeXml(color)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${safeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" color="${safeColor}"><g>${iconBodyMarkup(definition.body, color, strokeWidth, options.filled === true)}</g></svg>`
}

export function iconToDataUrl(selection: Pick<IconSelection, 'svg'>): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(selection.svg)}`
}

/** React 端的图标渲染：与 `renderIconSvg` 用同一份 Tabler 路径。 */
export function IconGlyph({ definition, size = 24, color = '#356AE6', strokeWidth = 1.8, filled = false, className, style, title }: {
  definition: IconDefinition
  size?: number | string
  color?: string
  strokeWidth?: number
  filled?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}): ReactNode {
  return <svg
    className={className}
    style={style}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    color={color}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  ><g dangerouslySetInnerHTML={{ __html: iconBodyMarkup(definition.body, color, strokeWidth, filled) }} /></svg>
}
