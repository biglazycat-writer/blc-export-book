import type { JsonObject, JsonValue } from '../../domain/types'
import { COMPONENT_TYPE_PATTERN } from '../../domain/validation'
import type { ComponentDefinition, ResolvedComponent } from './types'

const UNKNOWN_TYPE = 'core.unknown'

export class ComponentRegistry {
  private readonly definitions = new Map<string, Map<number, ComponentDefinition>>()

  register(definition: ComponentDefinition): () => void {
    validateDefinition(definition)
    let versions = this.definitions.get(definition.type)
    if (!versions) {
      versions = new Map()
      this.definitions.set(definition.type, versions)
    }
    if (versions.has(definition.version)) {
      throw new Error(`component ${definition.type}@${definition.version} is already registered`)
    }
    versions.set(definition.version, definition)
    return () => {
      const current = this.definitions.get(definition.type)
      current?.delete(definition.version)
      if (current?.size === 0) this.definitions.delete(definition.type)
    }
  }

  get(type: string, version?: number): ComponentDefinition | undefined {
    const versions = this.definitions.get(type)
    if (!versions) return undefined
    if (version !== undefined) return versions.get(version)
    return latestDefinition(versions)
  }

  list(): ComponentDefinition[] {
    return [...this.definitions.values()]
      .map(latestDefinition)
      .filter((definition): definition is ComponentDefinition => definition !== undefined)
      .sort((left, right) => left.type.localeCompare(right.type))
  }

  resolve(type: string, version: number, props: JsonObject): ResolvedComponent {
    const exact = this.get(type, version)
    if (exact) return resolved(exact, version, props, false, false)

    const current = this.get(type)
    if (!current) return this.resolveUnknown(type, version, props)
    if (version > current.version) return this.resolveUnknown(type, version, props)
    if (!current.migrate) throw new Error(`component ${type}@${version} has no migration to @${current.version}`)

    let migratedVersion = version
    let migratedProps = clone(props)
    const seen = new Set<number>()
    while (migratedVersion < current.version) {
      if (seen.has(migratedVersion)) throw new Error(`component ${type} migration did not advance`)
      seen.add(migratedVersion)
      const result = current.migrate(migratedVersion, migratedProps)
      if (!Number.isInteger(result.version) || result.version <= migratedVersion || result.version > current.version) {
        throw new Error(`component ${type} migration returned invalid version ${result.version}`)
      }
      migratedVersion = result.version
      migratedProps = result.props
    }
    return resolved(current, migratedVersion, migratedProps, true, false)
  }

  validate(type: string, version: number, props: JsonObject): readonly string[] {
    try {
      const result = this.resolve(type, version, props)
      if (result.unknown) return [`unknown component ${type}@${version}`]
      return result.definition.validate?.(result.props) ?? []
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)]
    }
  }

  private resolveUnknown(type: string, version: number, props: JsonObject): ResolvedComponent {
    const definition = createUnknownDefinition(type, version)
    return { definition, version, props: clone(props), migrated: false, unknown: true }
  }
}

function resolved(
  definition: ComponentDefinition,
  version: number,
  props: JsonObject,
  migrated: boolean,
  unknown: boolean,
): ResolvedComponent {
  if (!definition.schema.validate(props)) {
    throw new Error(`component ${definition.type}@${definition.version} props do not match schema ${definition.schema.name}`)
  }
  const errors = definition.validate?.(props) ?? []
  if (errors.length > 0) throw new Error(errors.join('; '))
  return { definition, version, props, migrated, unknown }
}

function latestDefinition(versions: Map<number, ComponentDefinition>): ComponentDefinition | undefined {
  let result: ComponentDefinition | undefined
  for (const definition of versions.values()) {
    if (!result || definition.version > result.version) result = definition
  }
  return result
}

function validateDefinition(definition: ComponentDefinition): void {
  if (!COMPONENT_TYPE_PATTERN.test(definition.type)) throw new Error(`invalid component type ${definition.type}`)
  if (definition.type === UNKNOWN_TYPE) throw new Error(`${UNKNOWN_TYPE} is reserved by the host`)
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error('component version must be positive')
  if (!definition.displayName.trim()) throw new Error('component display name is required')
  const defaults = definition.defaultProps()
  if (!definition.schema.validate(defaults)) throw new Error(`default props do not match schema ${definition.schema.name}`)
  for (const mode of ['interactive', 'readonly', 'thumbnail', 'print'] as const) {
    if (typeof definition.renderers[mode] !== 'function') throw new Error(`component ${definition.type} must provide a ${mode} renderer`)
  }
}

function createUnknownDefinition(originalType: string, originalVersion: number): ComponentDefinition {
  return {
    type: UNKNOWN_TYPE,
    version: 1,
    displayName: `Unknown: ${originalType}`,
    schema: { name: 'unknown-component-props', validate: isJsonObject },
    defaultProps: () => ({}),
    capabilities: { resizable: true, rotatable: true, printable: true },
    size: { default: { width: 240, height: 120 }, min: { width: 120, height: 64 } },
    renderers: {
      readonly: () => `Unsupported component ${originalType}@${originalVersion}`,
      interactive: () => `Unsupported component ${originalType}@${originalVersion}`,
      thumbnail: () => `Unsupported component ${originalType}@${originalVersion}`,
      print: () => `Unsupported component ${originalType}@${originalVersion}`,
    },
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
