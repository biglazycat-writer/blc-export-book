import type {CanvasElement,Rect} from '../domain/types'
export function worldBounds(element: CanvasElement): Rect {
  const width = element.bounds.width * element.transform.scale_x, height = element.bounds.height * element.transform.scale_y
  const radians = element.transform.rotation * Math.PI / 180
  const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))
  const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))
  return { x: element.transform.x - (rotatedWidth - width) / 2, y: element.transform.y - (rotatedHeight - height) / 2, width: rotatedWidth, height: rotatedHeight }
}
