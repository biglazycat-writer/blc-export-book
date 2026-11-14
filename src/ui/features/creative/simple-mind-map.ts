import MindMap from 'simple-mind-map'
import Export from 'simple-mind-map/src/plugins/Export.js'
import RainbowLines from 'simple-mind-map/src/plugins/RainbowLines.js'
import AssociativeLine from 'simple-mind-map/src/plugins/AssociativeLine.js'
const ConfiguredMindMap=MindMap as typeof MindMap & {usePlugin(plugin:unknown):typeof ConfiguredMindMap}
ConfiguredMindMap.usePlugin(Export).usePlugin(RainbowLines).usePlugin(AssociativeLine)
export default ConfiguredMindMap
