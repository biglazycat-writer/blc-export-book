import { escapeXml, xhtmlPage } from './epub-xhtml'

export interface EpubNavEntry {
  title: string
  href: string
  children?: EpubNavEntry[]
}

export interface EpubManifestItem {
  id: string
  href: string
  mediaType: string
  properties?: string
}

export interface EpubSpineItem {
  id: string
  linear?: boolean
}

export interface EpubGuideReference {
  type: 'cover' | 'toc' | 'text'
  title: string
  href: string
}

export interface EpubPackageMetadata {
  identifier: string
  title: string
  subtitle?: string
  author?: string
  language: string
  publisher?: string
  date?: string
  description?: string
  subjects?: string[]
  rights?: string
  modified: string
}

export interface EpubPackageInput {
  metadata: EpubPackageMetadata
  manifest: EpubManifestItem[]
  spine: EpubSpineItem[]
  coverImageId?: string
  navId: string
  ncxId: string
  guide?: EpubGuideReference[]
}

export function buildContainerXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    '  </rootfiles>',
    '</container>',
  ].join('\n')
}

function metadataXml(metadata: EpubPackageMetadata): string {
  const lines = [`    <dc:identifier id="book-id">${escapeXml(metadata.identifier)}</dc:identifier>`]
  lines.push(`    <dc:title id="title">${escapeXml(metadata.title)}</dc:title>`)
  if (metadata.subtitle?.trim()) {
    lines.push(`    <dc:title id="subtitle">${escapeXml(metadata.subtitle)}</dc:title>`)
    lines.push('    <meta refines="#subtitle" property="title-type">subtitle</meta>')
  }
  if (metadata.author?.trim()) {
    lines.push(`    <dc:creator id="creator">${escapeXml(metadata.author)}</dc:creator>`)
  }
  lines.push(`    <dc:language>${escapeXml(metadata.language)}</dc:language>`)
  if (metadata.publisher?.trim()) {
    lines.push(`    <dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>`)
  }
  if (metadata.date?.trim()) {
    lines.push(`    <dc:date>${escapeXml(metadata.date)}</dc:date>`)
  }
  if (metadata.description?.trim()) {
    lines.push(`    <dc:description>${escapeXml(metadata.description)}</dc:description>`)
  }
  for (const subject of metadata.subjects || []) {
    if (subject.trim()) lines.push(`    <dc:subject>${escapeXml(subject)}</dc:subject>`)
  }
  if (metadata.rights?.trim()) {
    lines.push(`    <dc:rights>${escapeXml(metadata.rights)}</dc:rights>`)
  }
  lines.push(`    <meta property="dcterms:modified">${escapeXml(metadata.modified)}</meta>`)
  return lines.join('\n')
}

export function buildContentOpf(input: EpubPackageInput): string {
  const { metadata } = input
  const manifest = input.manifest
    .map((item) => {
      const properties = item.properties ? ` properties="${escapeXml(item.properties)}"` : ''
      return `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${properties}/>`
    })
    .join('\n')
  const spine = input.spine
    .map((item) => {
      const linear = item.linear === false ? ' linear="no"' : ''
      return `    <itemref idref="${escapeXml(item.id)}"${linear}/>`
    })
    .join('\n')
  const coverMeta = input.coverImageId
    ? [`    <meta name="cover" content="${escapeXml(input.coverImageId)}"/>`]
    : []
  const guide = input.guide?.length
    ? [
        '  <guide>',
        ...input.guide.map(
          (reference) =>
            `    <reference type="${escapeXml(reference.type)}" title="${escapeXml(reference.title)}" href="${escapeXml(reference.href)}"/>`,
        ),
        '  </guide>',
      ]
    : []

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(metadata.language)}">`,
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    metadataXml(metadata),
    ...coverMeta,
    '  </metadata>',
    '  <manifest>',
    manifest,
    '  </manifest>',
    `  <spine toc="${escapeXml(input.ncxId)}">`,
    spine,
    '  </spine>',
    ...guide,
    '</package>',
  ].join('\n')
}

function navList(entries: EpubNavEntry[]): string {
  if (entries.length === 0) return ''
  const items = entries
    .map((entry) => {
      const child = entry.children && entry.children.length > 0 ? navList(entry.children) : ''
      return `      <li><a href="${escapeXml(entry.href)}">${escapeXml(entry.title)}</a>${child}</li>`
    })
    .join('\n')
  return `\n    <ol>\n${items}\n    </ol>\n  `
}

export function renderNavList(entries: EpubNavEntry[]): string {
  return navList(entries)
}

export interface NavOptions {
  lang: string
  title?: string
  landmarks?: { type: string; href: string; title: string }[]
}

export function buildNavXhtml(entries: EpubNavEntry[], options: NavOptions): string {
  const title = options.title || '目录'
  const landmarkItems = (options.landmarks || [])
    .map(
      (item) =>
        `      <li><a epub:type="${escapeXml(item.type)}" href="${escapeXml(item.href)}">${escapeXml(item.title)}</a></li>`,
    )
    .join('\n')
  const landmarks = landmarkItems
    ? `\n  <nav epub:type="landmarks" id="landmarks" hidden="hidden">\n    <ol>\n${landmarkItems}\n    </ol>\n  </nav>`
    : ''
  const body = `<nav epub:type="toc" id="toc">\n  <h1 class="toc-title">${escapeXml(title)}</h1>${navList(entries)}\n</nav>${landmarks}`
  return xhtmlPage({ title, lang: options.lang, body, bodyClass: 'toc-page' })
}

export function buildTocPageXhtml(entries: EpubNavEntry[], lang: string): string {
  const body = `<nav epub:type="toc" id="toc">\n  <h1 class="toc-title">目录</h1>${navList(entries)}\n</nav>`
  return xhtmlPage({ title: '目录', lang, body, bodyClass: 'toc-page' })
}

function navDepth(entries: EpubNavEntry[]): number {
  let depth = 0
  for (const entry of entries) {
    depth = Math.max(depth, 1 + navDepth(entry.children || []))
  }
  return depth
}

export interface NcxInput {
  identifier: string
  title: string
  author?: string
  language: string
  entries: EpubNavEntry[]
}

export function buildTocNcx(input: NcxInput): string {
  let order = 0
  let point = 0
  const walk = (entries: EpubNavEntry[], indent: string): string => {
    return entries
      .map((entry) => {
        order += 1
        point += 1
        const playOrder = order
        const id = `navPoint-${point}`
        const children = entry.children?.length ? `\n${walk(entry.children, `${indent}  `)}\n${indent}` : ''
        return `${indent}<navPoint id="${id}" playOrder="${playOrder}">\n${indent}  <navLabel><text>${escapeXml(entry.title)}</text></navLabel>\n${indent}  <content src="${escapeXml(entry.href)}"/>${children}</navPoint>`
      })
      .join('\n')
  }
  const navMap = walk(input.entries, '    ')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(input.language)}">`,
    '  <head>',
    `    <meta name="dtb:uid" content="${escapeXml(input.identifier)}"/>`,
    `    <meta name="dtb:depth" content="${Math.max(1, navDepth(input.entries))}"/>`,
    '    <meta name="dtb:totalPageCount" content="0"/>',
    '    <meta name="dtb:maxPageNumber" content="0"/>',
    '  </head>',
    `  <docTitle><text>${escapeXml(input.title)}</text></docTitle>`,
    input.author?.trim() ? `  <docAuthor><text>${escapeXml(input.author)}</text></docAuthor>` : '',
    '  <navMap>',
    navMap,
    '  </navMap>',
    '</ncx>',
  ]
    .filter((line) => line !== '')
    .join('\n')
}
