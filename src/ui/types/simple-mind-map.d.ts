declare module 'simple-mind-map' {
  const MindMap: new (options: Record<string, unknown>) => any
  export default MindMap
}

declare module 'simple-mind-map/full' {
  const MindMap: new (options: Record<string, unknown>) => any
  export default MindMap
}

declare module 'simple-mind-map/dist/simpleMindMap.esm.css'

declare module 'simple-mind-map/src/plugins/*.js' {
  const plugin: any
  export default plugin
}

declare module 'simple-mind-map/src/parse/*.js' {
  const parser: any
  export default parser
}

declare module 'simple-mind-map/src/svg/*.js' {
  const icons: any
  export default icons
}
