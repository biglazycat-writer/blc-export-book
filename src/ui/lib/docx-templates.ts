/**
 * Word DOCX export style templates.
 * Provides pre-defined style configurations for different export looks.
 */

export interface DocxStyleTemplate {
  id: string;
  name: string;
  description: string;
  /** Font for headings. */
  headingFont: string;
  /** Font for body text. */
  bodyFont: string;
  /** Heading sizes in half-points (1pt = 2 half-points). */
  headingSizes: { h1: number; h2: number; h3: number };
  /** Body text size in half-points. */
  bodySize: number;
  /** Line spacing multiplier (1.0 = single, 1.5 = 1.5x, etc.). Stored as 240ths of a line. */
  lineSpacing: number;
  /** Paragraph spacing after in twips (1 twip = 1/20 pt). */
  paragraphSpacing: number;
  /** First-line indent in twips (1 em ≈ 480 twips at 12pt). 0 = no indent. */
  firstLineIndent: number;
  /** Heading color (hex without #). */
  headingColor?: string;
  /** Body text color (hex without #). */
  bodyColor?: string;
}

export const DOCX_STYLE_TEMPLATES: Record<string, DocxStyleTemplate> = {
  default: {
    id: "default",
    name: "默认风格",
    description: "标准排版，无首行缩进",
    headingFont: "微软雅黑",
    bodyFont: "微软雅黑",
    headingSizes: { h1: 36, h2: 28, h3: 24 },
    bodySize: 22, // 11pt
    lineSpacing: 360, // 1.5x line spacing in 240ths
    paragraphSpacing: 120, // 6pt spacing after
    firstLineIndent: 0,
  },
  publish: {
    id: "publish",
    name: "出版风格",
    description: "宋体排版，首行缩进2字符",
    headingFont: "黑体",
    bodyFont: "宋体",
    headingSizes: { h1: 36, h2: 28, h3: 24 },
    bodySize: 24, // 12pt
    lineSpacing: 456, // ~1.9x line spacing
    paragraphSpacing: 0,
    firstLineIndent: 480, // 2em indent at 12pt
    bodyColor: "333333",
  },
  modern: {
    id: "modern",
    name: "现代风格",
    description: "雅黑排版，宽松行距，无缩进",
    headingFont: "微软雅黑",
    bodyFont: "微软雅黑",
    headingSizes: { h1: 40, h2: 32, h3: 26 },
    bodySize: 22, // 11pt
    lineSpacing: 360,
    paragraphSpacing: 200, // 10pt spacing after
    firstLineIndent: 0,
  },
};

export function getDocxTemplate(id: string): DocxStyleTemplate {
  return DOCX_STYLE_TEMPLATES[id] || DOCX_STYLE_TEMPLATES.default;
}

export function getDocxTemplateList(): DocxStyleTemplate[] {
  return Object.values(DOCX_STYLE_TEMPLATES);
}