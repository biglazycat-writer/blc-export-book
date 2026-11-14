/**
 * 图片尺寸：只读文件头，不解码像素、不碰 DOM。
 *
 * 章节 docx 导出拿不到「编辑器里这张图显示多大」：TipTap 的 image 节点只有用户
 * 手动拖过缩放手柄才有 width/height 属性，没拖过的图两个属性都是 null。以前导出
 * 用 0.62 的固定比例兜底，于是所有没拖过的图都被压成同一个 1.61:1 的方块 ——
 * 宽表格截图变成一竖条一竖条，长图被压扁。尺寸必须回到图片自己的像素比上。
 */

export interface ImagePixelSize {
  width: number
  height: number
}

const UNKNOWN: ImagePixelSize = { width: 0, height: 0 }

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  )
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readInt32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
}

function startsWith(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

function pngSize(bytes: Uint8Array): ImagePixelSize {
  // IHDR 固定紧跟 8 字节签名 + 4 字节长度 + 4 字节类型。
  if (bytes.length < 24) return UNKNOWN
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) }
}

function gifSize(bytes: Uint8Array): ImagePixelSize {
  if (bytes.length < 10) return UNKNOWN
  return { width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) }
}

function bmpSize(bytes: Uint8Array): ImagePixelSize {
  if (bytes.length < 26) return UNKNOWN
  // BMP 的宽高是有符号 32 位；高度为负表示自上而下存，取绝对值即可。
  return { width: Math.abs(readInt32LE(bytes, 18)), height: Math.abs(readInt32LE(bytes, 22)) }
}

function jpegSize(bytes: Uint8Array): ImagePixelSize {
  // 逐段扫到 SOF：只有 SOF 段里带真实像素尺寸，DHT/DQT 之类都不带。
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = readUint16BE(bytes, offset + 2)
    if (length < 2) return UNKNOWN
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: readUint16BE(bytes, offset + 7), height: readUint16BE(bytes, offset + 5) }
    }
    offset += 2 + length
  }
  return UNKNOWN
}

function webpSize(bytes: Uint8Array): ImagePixelSize {
  if (bytes.length < 30) return UNKNOWN
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (chunk === 'VP8X') {
    // VP8X 的宽高按 24 位小端存，且是「值 - 1」。
    return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 }
  }
  if (chunk === 'VP8L') {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8 ') {
    // 有损帧头：3 字节帧标签 + 3 字节起始码之后是 14 位宽、14 位高。
    return { width: readUint16LE(bytes, 26) & 0x3fff, height: readUint16LE(bytes, 28) & 0x3fff }
  }
  return UNKNOWN
}

/** 读图片文件头里的像素尺寸；格式不认识或数据不完整时返回 `{ width: 0, height: 0 }`。 */
export function imagePixelSize(bytes: Uint8Array | null | undefined): ImagePixelSize {
  // 只够认出签名就行，各格式自己在下面检查自己的最小长度。
  if (!bytes || bytes.length < 8) return UNKNOWN
  if (startsWith(bytes, 0, '\x89PNG')) return pngSize(bytes)
  if (startsWith(bytes, 0, 'GIF8')) return gifSize(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes)
  if (startsWith(bytes, 0, 'BM')) return bmpSize(bytes)
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return webpSize(bytes)
  return UNKNOWN
}

export type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp'

/**
 * 按字节判断真实格式。扩展名会骗人（资源 URL 常常根本没有扩展名，有的还是
 * `?v=2` 这种尾巴），而 Word 只认真正的容器格式。
 */
export function imageTypeFromBytes(bytes: Uint8Array | null | undefined): DocxImageType | null {
  if (!bytes || bytes.length < 4) return null
  if (startsWith(bytes, 0, '\x89PNG')) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  if (startsWith(bytes, 0, 'GIF8')) return 'gif'
  if (startsWith(bytes, 0, 'BM')) return 'bmp'
  return null
}

export interface DocxImageBoxInput {
  /** 编辑器里手动缩放后的显示尺寸（TipTap image 节点的 width / height 属性）。 */
  attrWidth?: number
  attrHeight?: number
  /** 图片文件本身的像素尺寸。 */
  intrinsic: ImagePixelSize
  /** 可用宽度上限（px）。 */
  limit: number
  /** 一点尺寸都拿不到时的兜底比例（高 / 宽）。 */
  fallbackRatio?: number
}

/**
 * 算出 Word 里的显示尺寸：宽度不超过可用宽度，高度永远跟着同一个宽高比走。
 *
 * 比例优先级：手动缩放的属性 > 图片自身像素比 > 兜底值。只要拿到前两个之一，
 * 图就不会变形 —— 这是这一整块唯一要保证的事。
 *
 * 高度不设上限：图在 Word 里高过一页时会被裁掉，但为了塞进一页而把长截图缩成
 * 一条，等于换一种方式毁掉内容。尺寸跟编辑器一致，剩下的交给用户自己裁。
 */
export function docxImageBox(input: DocxImageBoxInput): ImagePixelSize {
  const limit = Math.max(1, Math.round(input.limit))
  const attrWidth = positive(input.attrWidth)
  const attrHeight = positive(input.attrHeight)
  const intrinsicWidth = positive(input.intrinsic.width)
  const intrinsicHeight = positive(input.intrinsic.height)

  const ratio =
    attrWidth > 0 && attrHeight > 0
      ? attrHeight / attrWidth
      : intrinsicWidth > 0 && intrinsicHeight > 0
        ? intrinsicHeight / intrinsicWidth
        : input.fallbackRatio ?? 0.62

  // 没有缩放属性时，图片按原始像素宽参与排版；超过可用宽度才收窄。
  const naturalWidth = attrWidth > 0 ? attrWidth : intrinsicWidth > 0 ? intrinsicWidth : limit
  const width = Math.max(1, Math.min(Math.round(naturalWidth), limit))
  return { width, height: Math.max(1, Math.round(width * ratio)) }
}

function positive(value: number | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}
