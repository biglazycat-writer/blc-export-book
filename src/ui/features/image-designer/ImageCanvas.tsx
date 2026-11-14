import { forwardRef, type CSSProperties } from 'react'
import { IMAGE_FONTS, IMAGE_THEMES, imageHeight, type ImageDesign } from './design'

export const ImageCanvas = forwardRef<HTMLDivElement, {
  design: ImageDesign; title: string; author: string; footer: string; html: string
}>(function ImageCanvas({ design, title, author, footer, html }, ref) {
  const theme = IMAGE_THEMES[design.theme]
  const height = imageHeight(design)
  const style = {
    width: design.width, height, padding: design.inset,
    background: design.background || theme.background,
    color: theme.ink, fontFamily: IMAGE_FONTS[design.font],
    '--image-card': theme.card, '--image-accent': theme.accent,
    '--image-padding': `${design.padding}px`, '--image-radius': `${design.radius}px`,
    '--image-font-size': `${design.fontSize}px`, '--image-line-height': design.lineHeight,
  } as CSSProperties
  return (
    <div ref={ref} className={`imageDesignCanvas${height ? ' is-fixed' : ''}`} data-layout={design.layout} data-align={design.align} data-font={design.font} style={style} onClick={(event) => event.preventDefault()}>
      <article className={`imageDesignCard${design.shadow ? ' has-shadow' : ''}`} style={{ textAlign: design.align }}>
        {(design.showTitle && title.trim()) || author.trim() ? (
          <header className="imageDesignTitle">
            <span className="imageDesignAccent" />
            {design.showTitle && title.trim() ? <h1>{title}</h1> : null}
            {author.trim() ? <p>{author}</p> : null}
          </header>
        ) : null}
        <div className="imageDesignContent" dangerouslySetInnerHTML={{ __html: html }} />
        {footer.trim() ? <footer className="imageDesignFooter">{footer}</footer> : null}
      </article>
    </div>
  )
})
