import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlignTable,
} from "docx"
import type { DocxStyleTemplate } from "./docx-templates"
import { figureCaptionLabel } from "./figure-caption"
import { COLLAPSIBLE_DEFAULT_SUMMARY, calloutStyle } from "./rich-blocks"
import { isMermaidCodeBlock } from "./mermaid-inline"
import type { MermaidPng } from "./mermaid-render"
import { docxImageBox, imagePixelSize, imageTypeFromBytes } from "./image-size"

/** 合集导出时，公式以预渲染 PNG 的形式进入 Word；键由 src 与 display 共同决定。 */
export interface DocxFormulaImage {
  data: Uint8Array
  width: number
  height: number
  display: boolean
}

export interface DocxBookRenderContext {
  /** 卷标题占一级时，章内标题整体下移。 */
  headingOffset?: number
  /** 版心宽度（px），图片不能超过它。 */
  maxImageWidth?: number
  formulas?: Map<string, DocxFormulaImage>
}

let docxBookRenderContext: DocxBookRenderContext = {}

/**
 * 合集导出用同步的模块上下文，而不是给整条渲染链路加参数：
 * 渲染函数在列表、表格、提示块里层层递归，透传一个只影响全书导出的选项会把
 * 章级导出的签名也一起搅乱。调用方保证同一时刻只导出一次即可。
 */
export function withDocxBookRenderContext<T>(context: DocxBookRenderContext, render: () => T): T {
  const previous = docxBookRenderContext
  docxBookRenderContext = context
  try {
    return render()
  } finally {
    docxBookRenderContext = previous
  }
}

export function docxFormulaKey(latex: string, display: boolean): string {
  return `${display ? "block" : "inline"}:${latex}`
}

function textColorFromMark(mark: any, fallback?: string): string | undefined {
  const color = mark?.attrs?.color;
  if (typeof color !== "string") return fallback;
  // 通过 toDocxHex 统一转换，避免 color(srgb ...) / rgb() 等 CSS 颜色函数
  // 直接传入 docx 库导致 "unsupported color function" 报错。
  const hex = toDocxHex(color);
  return hex || fallback;
}

function sizeFromMark(mark: any, fallback: number): number {
  const fontSize = mark?.attrs?.fontSize;
  if (typeof fontSize !== "string") return fallback;
  const px = Number.parseFloat(fontSize);
  if (!Number.isFinite(px) || px <= 0) return fallback;
  return Math.round(px * 1.5);
}

function paragraphAlignment(node: any) {
  const textAlign = node.attrs?.textAlign;
  if (textAlign === "center") return AlignmentType.CENTER;
  if (textAlign === "right") return AlignmentType.RIGHT;
  if (textAlign === "justify") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function renderDocxRuns(node: any, template: DocxStyleTemplate, options?: { italics?: boolean; size?: number; color?: string }): Array<TextRun | ImageRun> {
  const runs: Array<TextRun | ImageRun> = [];

  node.descendants((child: any) => {
    if (child.isText) {
      const marks = child.marks || [];
      const markNames = marks.map((m: any) => m.type.name);
      const textStyle = marks.find((m: any) => m.type.name === "textStyle");
      const link = marks.find((m: any) => m.type.name === "link");

      runs.push(
        new TextRun({
          text: child.text || "",
          bold: markNames.includes("bold"),
          italics: options?.italics || markNames.includes("italic"),
          underline: markNames.includes("underline") || link ? {} : undefined,
          strike: markNames.includes("strike"),
          superScript: markNames.includes("superscript"),
          subScript: markNames.includes("subscript"),
          font: template.bodyFont,
          size: sizeFromMark(textStyle, options?.size || template.bodySize),
          color: link ? "1677FF" : textColorFromMark(textStyle, options?.color || template.bodyColor),
          shading: markNames.includes("highlight")
            ? { type: ShadingType.CLEAR, fill: "FFF3BF" }
            : undefined,
        })
      );
      return false;
    }

    if (child.type.name === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
      return false;
    }

    if (child.type.name === "formula") {
      const latex = String(child.attrs?.latex || "");
      const display = Boolean(child.attrs?.displayMode);
      const formula = docxBookRenderContext.formulas?.get(docxFormulaKey(latex, display));
      if (formula) {
        const ceiling = docxBookRenderContext.maxImageWidth ?? 520;
        const naturalWidth = Math.max(1, Math.round(formula.width / 2));
        const naturalHeight = Math.max(1, Math.round(formula.height / 2));
        const width = Math.min(naturalWidth, ceiling);
        const height = Math.max(1, Math.round(naturalHeight * (width / naturalWidth)));
        runs.push(new ImageRun({ data: formula.data, transformation: { width, height }, type: "png" }));
      } else if (latex) {
        // 公式没转成图片时保留可读原文，不能悄悄丢掉内容。
        runs.push(
          new TextRun({
            text: display ? `$$${latex}$$` : `$${latex}$`,
            italics: true,
            font: template.bodyFont,
            size: options?.size || template.bodySize,
            color: options?.color || template.bodyColor,
          })
        );
      }
      return false;
    }

    return true;
  });

  return runs;
}

function isSingleDisplayFormula(node: any): boolean {
  if (node.childCount !== 1) return false;
  const only = node.firstChild;
  return only?.type?.name === "formula" && Boolean(only.attrs?.displayMode);
}

function renderParagraph(node: any, template: DocxStyleTemplate, options?: { bullet?: { level: number }; numbering?: { reference: string; level: number }; italics?: boolean; size?: number; color?: string }): Paragraph {
  const runs = renderDocxRuns(node, template, options);
  const indent = node.attrs?.indent
    ? { firstLine: Number(node.attrs.indent) * 480 }
    : template.firstLineIndent > 0 && !options?.bullet && !options?.numbering
      ? { firstLine: template.firstLineIndent }
      : undefined;

  return new Paragraph({
    children: runs.length > 0
      ? runs
      : [new TextRun({ text: "", font: template.bodyFont, size: options?.size || template.bodySize })],
    alignment: isSingleDisplayFormula(node) ? AlignmentType.CENTER : paragraphAlignment(node),
    spacing: { line: template.lineSpacing, after: template.paragraphSpacing },
    indent,
    bullet: options?.bullet,
    numbering: options?.numbering,
  });
}

function renderHeading(node: any, template: DocxStyleTemplate): Paragraph {
  const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 1) + (docxBookRenderContext.headingOffset || 0)));
  const headingLevelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
  const headingSizeMap: Record<number, number> = {
    1: template.headingSizes.h1,
    2: template.headingSizes.h2,
    3: template.headingSizes.h3,
    4: template.headingSizes.h3,
    5: template.headingSizes.h3,
    6: template.headingSizes.h3,
  };

  return new Paragraph({
    children: renderDocxRuns(node, template, {
      size: headingSizeMap[level] || template.headingSizes.h3,
      color: template.headingColor || template.bodyColor,
    }),
    heading: headingLevelMap[level] || HeadingLevel.HEADING_1,
    alignment: paragraphAlignment(node),
    spacing: { before: 240, after: 160 },
  });
}

function renderListItems(
  node: any,
  template: DocxStyleTemplate,
  imageMap: Map<string, Uint8Array>,
  ordered: boolean,
  figureNumbers: Map<unknown, number>,
  mermaidPngs: Map<string, MermaidPng>,
  depth = 0
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  node.forEach((itemNode: any) => {
    itemNode.forEach((child: any) => {
      if (child.type.name === "paragraph") {
        paragraphs.push(renderParagraph(child, template, ordered
          ? { numbering: { reference: "default-numbering", level: Math.min(depth, 2) } }
          : { bullet: { level: Math.min(depth, 2) } }
        ));
      } else if (child.type.name === "bulletList") {
        paragraphs.push(...renderListItems(child, template, imageMap, false, figureNumbers, mermaidPngs, depth + 1));
      } else if (child.type.name === "orderedList") {
        paragraphs.push(...renderListItems(child, template, imageMap, true, figureNumbers, mermaidPngs, depth + 1));
      } else {
        paragraphs.push(...renderDocxBlock(child, template, imageMap, figureNumbers, mermaidPngs).filter((item): item is Paragraph => item instanceof Paragraph));
      }
    });
  });
  return paragraphs;
}

/** 把任意 CSS 颜色（#rgb/#rrggbb/rgb()/color(srgb)）转为 docx 需要的 6 位十六进制（无 #）。失败返回 null。 */
function toDocxHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const value = color.trim().toLowerCase();
  if (value === "transparent") return null;
  const hexMatch = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return hex.split("").map((c) => c + c).join("").toUpperCase();
    }
    return hex.toUpperCase();
  }
  const rgbMatch = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  // CSS color(srgb r g b[ / a]) — 现代浏览器/计算样式可能产出此格式，
  // docx 库无法直接解析，需转成 6 位十六进制。
  const srgbMatch = value.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgbMatch) {
    return [srgbMatch[1], srgbMatch[2], srgbMatch[3]]
      .map((n) => Math.max(0, Math.min(255, Math.round(parseFloat(n) * 255))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null;
}

function cellVerticalAlign(cellNode: any): (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] {
  const v = cellNode.attrs?.verticalAlign;
  if (v === "middle") return VerticalAlignTable.CENTER;
  if (v === "bottom") return VerticalAlignTable.BOTTOM;
  return VerticalAlignTable.TOP;
}

function renderTable(
  node: any,
  template: DocxStyleTemplate,
  imageMap: Map<string, Uint8Array>,
  figureNumbers: Map<unknown, number>,
  mermaidPngs: Map<string, MermaidPng>
): Table {
  const rows: TableRow[] = [];

  // 计算真实列数：取各行 colspan 之和的最大值，保证含合并单元格时列宽计算正确。
  let maxColumns = 1;
  node.forEach((rowNode: any) => {
    if (rowNode.type.name !== "tableRow") return;
    let cols = 0;
    rowNode.forEach((cellNode: any) => {
      cols += Math.max(1, Number(cellNode.attrs?.colspan) || 1);
    });
    maxColumns = Math.max(maxColumns, cols);
  });

  // 收集首个出现的每列宽度（来自 colwidth 属性），用于按比例分配列宽。
  const columnPixelWidths: (number | null)[] = new Array(maxColumns).fill(null);
  node.forEach((rowNode: any) => {
    if (rowNode.type.name !== "tableRow") return;
    let colCursor = 0;
    rowNode.forEach((cellNode: any) => {
      const span = Math.max(1, Number(cellNode.attrs?.colspan) || 1);
      const colwidth = cellNode.attrs?.colwidth as number[] | null;
      if (colwidth) {
        for (let i = 0; i < span; i += 1) {
          const target = colCursor + i;
          if (target < maxColumns && columnPixelWidths[target] == null && colwidth[i]) {
            columnPixelWidths[target] = colwidth[i];
          }
        }
      }
      colCursor += span;
    });
  });

  node.forEach((rowNode: any) => {
    if (rowNode.type.name !== "tableRow") return;
    const cells: TableCell[] = [];
    const rowHeight = Number(rowNode.attrs?.height) || 0;

    rowNode.forEach((cellNode: any) => {
      if (cellNode.type.name !== "tableCell" && cellNode.type.name !== "tableHeader") return;
      const cellChildren: Paragraph[] = [];
      cellNode.forEach((child: any) => {
        if (child.type.name === "paragraph") {
          cellChildren.push(renderParagraph(child, template, { size: Math.max(18, template.bodySize - 2) }));
        } else if (child.type.name === "heading") {
          cellChildren.push(renderHeading(child, template));
        } else {
          const rendered = renderDocxBlock(child, template, imageMap, figureNumbers, mermaidPngs).filter((item): item is Paragraph => item instanceof Paragraph);
          cellChildren.push(...rendered);
        }
      });

      const colspan = Math.max(1, Number(cellNode.attrs?.colspan) || 1);
      const rowspan = Math.max(1, Number(cellNode.attrs?.rowspan) || 1);
      const customBg = toDocxHex(cellNode.attrs?.backgroundColor);
      const fill = customBg || (cellNode.type.name === "tableHeader" ? "F3F4F6" : null);

      cells.push(
        new TableCell({
          children: cellChildren.length > 0 ? cellChildren : [new Paragraph("")],
          columnSpan: colspan > 1 ? colspan : undefined,
          rowSpan: rowspan > 1 ? rowspan : undefined,
          verticalAlign: cellVerticalAlign(cellNode),
          shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
        })
      );
    });

    rows.push(
      new TableRow({
        children: cells,
        // 行高（px→twip，1px ≈ 15twip），设为最小值以允许内容撑高。
        height: rowHeight > 0 ? { value: Math.round(rowHeight * 15), rule: "atLeast" as const } : undefined,
      })
    );
  });

  // 依据像素列宽按比例分配到 docx 的 twip 总宽（约 9000twip 对应正文可用宽度）。
  const TOTAL_TWIP = 9000;
  const knownTotal = columnPixelWidths.reduce<number>((sum, w) => sum + (w || 0), 0);
  const columnWidths = columnPixelWidths.map((w) => {
    if (knownTotal > 0 && w) {
      return Math.max(400, Math.round((w / knownTotal) * TOTAL_TWIP));
    }
    return Math.floor(TOTAL_TWIP / maxColumns);
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    layout: "fixed" as const,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
    },
  });
}

function imageRunType(src: string): "jpg" | "png" | "gif" | "bmp" {
  if (/\.jpe?g(?:[?#].*)?$/i.test(src)) return "jpg";
  if (/\.gif(?:[?#].*)?$/i.test(src)) return "gif";
  if (/\.bmp(?:[?#].*)?$/i.test(src)) return "bmp";
  return "png";
}

function renderImage(
  node: any,
  imageMap: Map<string, Uint8Array>,
  template: DocxStyleTemplate,
  figureIndex: number | null,
  /** 可用宽度上限（px）。窄列或受限区域里按原尺寸插会溢出。 */
  maxWidth = 520,
  /** 图片与图注的横向对齐；正文里的图一律居中。 */
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER
): Paragraph[] {
  const src = node.attrs?.src as string;
  const imageData = src ? imageMap.get(src) : undefined;
  if (!imageData || imageData.length === 0) return [];

  const imageCeiling = docxBookRenderContext.maxImageWidth ?? maxWidth;
  const limit = Math.max(60, Math.min(imageCeiling, Math.round(maxWidth)));
  // TipTap 的 image 节点只有手动拖过缩放手柄才带 width/height，绝大多数图两个属性都是
  // null —— 以前这里用 0.62 猜高度，于是所有没拖过的图都被压成同一个 1.61:1 的方块
  // （宽表格截图变成竖条纹）。没有属性时按图片自己的像素比走。
  const { width, height } = docxImageBox({
    attrWidth: Number(node.attrs?.width),
    attrHeight: Number(node.attrs?.height),
    intrinsic: imagePixelSize(imageData),
    limit,
  });
  const imageRun = new ImageRun({
    data: imageData,
    transformation: { width, height },
    // 资源 URL 常常没有扩展名，格式以字节为准，扩展名只作兜底。
    type: imageTypeFromBytes(imageData) ?? imageRunType(src),
  });

  const paragraphs = [
    new Paragraph({
      children: [imageRun],
      alignment,
      spacing: { before: 120, after: 120 },
    }),
  ];

  // 图注跟在图片段落后面，小一号灰字，跟图片同一个对齐——编号由调用方按全文顺序算好。
  const caption = figureCaptionLabel(node.attrs?.caption, figureIndex);
  if (caption) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: caption, size: Math.max(16, template.bodySize - 4), color: "666666" })],
        alignment,
        spacing: { before: 0, after: 160 },
      })
    );
  }

  return paragraphs;
}

/** docx 只认不带 # 的六位大写十六进制。 */
function docxHex(color: string): string {
  return (color || "").replace("#", "").toUpperCase() || "000000";
}

/**
 * 把若干块装进一个单格表格：Word 里的「带底色/边框的一块内容」只有表格能可靠表达，
 * 段落底纹一到分页处就断得很难看，而且没法给整块画左侧竖线。
 */
function renderBoxedBlock(children: Array<Paragraph | Table>, options: { fill?: string; accent: string }): Table {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
  const left = { style: BorderStyle.SINGLE, size: 18, color: options.accent } as const;
  const thin = { style: BorderStyle.SINGLE, size: 4, color: options.accent } as const;
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: children.length ? children : [new Paragraph("")],
            shading: options.fill ? { type: ShadingType.CLEAR, color: "auto", fill: options.fill } : undefined,
            // 提示框只要左边那道粗竖线（和编辑器里一致）；折叠块四边都描一条细线。
            borders: options.fill
              ? { top: none, bottom: none, right: none, left }
              : { top: thin, bottom: thin, right: thin, left: thin },
            margins: { top: 80, bottom: 80, left: 160, right: 120 },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
  });
}

/** PNG dataURL → 字节；docx 只接受字节，不认 dataURL。 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** mermaid 位图插成居中图片；宽度上限与 renderImage 一致，超宽图等比缩到页面里。 */
function renderMermaidParagraphs(png: MermaidPng): Paragraph[] {
  const limit = 520;
  const width = Math.min(png.width, limit);
  const height = Math.max(1, Math.round(png.height * (width / png.width)));
  return [
    new Paragraph({
      children: [new ImageRun({ data: dataUrlToBytes(png.dataUrl), transformation: { width, height }, type: "png" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
    }),
  ];
}

export function renderDocxBlock(node: any, template: DocxStyleTemplate, imageMap: Map<string, Uint8Array>, figureNumbers: Map<unknown, number>, mermaidPngs: Map<string, MermaidPng>): Array<Paragraph | Table> {
  if (node.type.name === "heading") return [renderHeading(node, template)];
  if (node.type.name === "paragraph") return [renderParagraph(node, template)];
  if (node.type.name === "horizontalRule") {
    return [
      new Paragraph({
        text: "————————————————",
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      }),
    ];
  }
  if (node.type.name === "codeBlock") {
    // mermaid 图表导成位图；预扫描没拿到（渲染失败）就退回代码块，源码总比空白好。
    if (isMermaidCodeBlock(node)) {
      const png = mermaidPngs.get(node.textContent.trim());
      if (png) return renderMermaidParagraphs(png);
    }
    return node.textContent.split("\n").map((line: string) =>
      new Paragraph({
        children: [new TextRun({ text: line, font: "Courier New", size: Math.max(18, template.bodySize - 2) })],
        shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
        spacing: { after: 0 },
      })
    );
  }
  if (node.type.name === "blockquote") {
    const paragraphs: Paragraph[] = [];
    node.forEach((child: any) => {
      if (child.type.name === "paragraph") {
        paragraphs.push(renderParagraph(child, template, { italics: true, color: "666666" }));
      } else {
        paragraphs.push(...renderDocxBlock(child, template, imageMap, figureNumbers, mermaidPngs).filter((item): item is Paragraph => item instanceof Paragraph));
      }
    });
    return paragraphs;
  }
  if (node.type.name === "bulletList") return renderListItems(node, template, imageMap, false, figureNumbers, mermaidPngs);
  if (node.type.name === "orderedList") return renderListItems(node, template, imageMap, true, figureNumbers, mermaidPngs);
  if (node.type.name === "table") return [renderTable(node, template, imageMap, figureNumbers, mermaidPngs)];
  if (node.type.name === "mediaRow") {
    // Legacy mediaRow: flatten cell children as sibling blocks.
    const out: Array<Paragraph | Table> = [];
    node.forEach((cell: any) => {
      cell.forEach((child: any) => {
        out.push(...renderDocxBlock(child, template, imageMap, figureNumbers, mermaidPngs));
      });
    });
    return out;
  }
  if (node.type.name === "pageBreak") return [new Paragraph({ children: [new PageBreak()] })];
  if (node.type.name === "callout") {
    const style = calloutStyle(node.attrs?.kind);
    const body: Array<Paragraph | Table> = [
      new Paragraph({
        children: [new TextRun({ text: style.label, bold: true, color: docxHex(style.accent), font: template.bodyFont, size: template.bodySize })],
        spacing: { after: 60 },
      }),
    ];
    node.forEach((child: any) => body.push(...renderDocxBlock(child, template, imageMap, figureNumbers, mermaidPngs)));
    // 用单格表格而不是给每个段落加底纹：正文可能是列表、代码块甚至排版行，
    // 逐个塞 shading 参数得给整条 renderDocxBlock 链路加透传，表格一层就把它们全兜住。
    return [renderBoxedBlock(body, { fill: style.docxFill, accent: docxHex(style.accent) })];
  }
  if (node.type.name === "collapsible") {
    const summary = node.firstChild;
    const title = (summary?.textContent || "").trim() || COLLAPSIBLE_DEFAULT_SUMMARY;
    const body: Array<Paragraph | Table> = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, font: template.bodyFont, size: template.bodySize })],
        spacing: { after: 60 },
      }),
    ];
    // Word 没有折叠：标题加粗、正文照常，整块加个边框，读者仍看得出这是一段附注。
    // 折起来的内容也照样导出——纸上没法点开，藏起来等于丢内容。
    node.forEach((child: any, _offset: number, index: number) => {
      if (index === 0) return;
      body.push(...renderDocxBlock(child, template, imageMap, figureNumbers, mermaidPngs));
    });
    return [renderBoxedBlock(body, { accent: "D9D9E3" })];
  }
  if (node.type.name === "image" || node.type.name === "resizableImage") {
    return renderImage(node, imageMap, template, figureNumbers.get(node) ?? null);
  }
  if (node.type.name === "flowCanvas") {
    return [new Paragraph({
      children: [new TextRun({ text: `[流程画布] ${node.attrs?.title || "未命名画布"}`, italics: true, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
    })];
  }
  if (node.type.name === "mindMapEmbed") {
    return [new Paragraph({
      children: [new TextRun({ text: `[思维导图] ${node.attrs?.title || "未命名思维导图"}`, italics: true, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
    })];
  }
  return [];
}

