// THE SCHEMA: twenty-one nodes and eight marks, assembled (ADR 0054 step 7).
//
// One `Schema` for the whole admin. It is built once at module load rather than per editor,
// because a `NodeType` is compared by identity — two schemas that agree in every field still
// produce documents neither can hold, and a slice copied from one editor into another would
// throw. There has only ever been one set of rules here; now there is one object for it.
import { Schema } from 'prosemirror-model'
import { NODES } from './schema-nodes'
import { MARKS } from './schema-marks'

export const schema = new Schema({ nodes: NODES, marks: MARKS, topNode: 'doc' })

/** Every node type by name, for the places that would otherwise write `schema.nodes.x!`. */
export const nodes = schema.nodes
export const marks = schema.marks
