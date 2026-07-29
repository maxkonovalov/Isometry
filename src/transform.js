import sketch from 'sketch'

const TAN_30 = Math.tan(Math.PI / 6)

/**
 * Each face is described by the only sequence Sketch can actually perform:
 * rotate the group, bake that rotation into the path geometry, stretch the
 * (now axis-aligned) bounding box, then optionally rotate and bake once more.
 *
 * The bake between the rotate and the stretch is what turns this into a shear
 * instead of a rotated resize. Sketch resizes a group along its *unrotated*
 * axes, so the rotation has to become real path geometry before the
 * non-proportional scale is applied.
 *
 * `finalRotation: 0` means the face is complete after the stretch.
 */
const PROJECTIONS = {
  top: { rotation: 45, scaleX: 1, scaleY: TAN_30, finalRotation: 0 },
  left: { rotation: -45, scaleX: TAN_30, scaleY: 1, finalRotation: 30 },
  front: { rotation: 45, scaleX: TAN_30, scaleY: 1, finalRotation: -30 },
}

/**
 * Sketch 2026 moved the layer flattener into the SketchControllers framework as
 * a Swift class, so it no longer resolves under the bare `MSLayerFlattener`
 * symbol that older Sketch versions exposed.
 */
const FLATTENER_CLASS = 'SketchControllers.MSLayerFlattener'

/** Flatten path geometry only; leave styles, fills and effects intact. */
const FLATTEN_GEOMETRY_ONLY = 2

/**
 * Replaces the current selection with its isometric projection onto one face of
 * a cube, and leaves the resulting layers selected.
 *
 * `face` is one of 'top', 'left' or 'front'. Callers do not need to know the
 * angles, scale factors, or the order Sketch requires them to be applied in —
 * that is the one design decision this module exists to hide.
 *
 * The projection is destructive and is registered as a single undo step:
 * source layers are consumed, and any text is converted to outlines because a
 * sheared glyph can no longer be represented as editable text.
 *
 * Layers with no path geometry (images, symbol instances) cannot be sheared.
 * They are still rotated and scaled along with the rest of the selection but
 * keep their own shape, so the result is only a partial projection. Their
 * number is reported to the user rather than silently looking wrong.
 *
 * Does nothing but show a message when there is no open document or nothing is
 * selected.
 */
export function project(face) {
  const projection = PROJECTIONS[face]
  if (!projection) {
    throw new Error(`Unknown isometric face '${face}'.`)
  }

  const document = sketch.getSelectedDocument()
  if (!document) {
    sketch.UI.message('Isometry needs an open document.')
    return
  }

  const selection = document.selectedLayers
  const layers = selection.layers
  if (layers.length === 0) {
    sketch.UI.message('Please select a layer.')
    return
  }

  const flattenerClass = NSClassFromString(FLATTENER_CLASS)
  if (!flattenerClass) {
    sketch.UI.message('Isometry is not compatible with this version of Sketch.')
    return
  }
  const flattener = flattenerClass.alloc().init()
  const scene = document.sketchObject.documentData()

  let skipped = 0

  withUndoGrouping(document, `Create ${face} isometric projection`, () => {
    // The group is scaffolding: it gives the whole selection a single frame to
    // rotate and stretch, and is dissolved again before returning.
    const group = new sketch.Group({ parent: layers[0].parent, layers })
    group.adjustToFit()
    const native = group.sketchObject

    rotate(native, projection.rotation)
    skipped = bakeTransforms(native, flattener, scene)

    stretch(native, projection.scaleX, projection.scaleY)

    if (projection.finalRotation !== 0) {
      rotate(native, projection.finalRotation)
      bakeTransforms(native, flattener, scene)
    }

    const projected = childrenOf(native)
    selection.clear()
    projected.forEach(layer => layer.select_byExtendingSelection(true, true))
    native.ungroup()
  })

  if (skipped > 0) {
    sketch.UI.message(
      `${skipped} layer${skipped === 1 ? '' : 's'} had no path geometry and could not be projected.`
    )
  }
}

/**
 * Bakes every rotation at or below `native` into the path geometry itself, so
 * that the layers end up axis-aligned while looking unchanged on the canvas.
 *
 * Returns the number of layers that had no path geometry and so were left as
 * they were.
 */
function bakeTransforms(native, flattener, scene) {
  const kind = String(native.class())

  if (kind === 'MSLayerGroup' || kind === 'MSShapeGroup') {
    // Push the group's own rotation onto its children, then bake each of them.
    native.moveTransformsToChildren()
    return childrenOf(native).reduce(
      (skipped, child) => skipped + bakeTransforms(child, flattener, scene),
      0
    )
  }

  if (kind === 'MSTextLayer') {
    // Sketch swaps the text layer for its outlines in place, so the returned
    // layers are already parented and the text layer is already detached.
    const outlines = childrenOfArray(native.layersByConvertingToOutlines())
    if (outlines.length === 0) return 1
    return outlines.reduce(
      (skipped, outline) => skipped + bakeTransforms(outline, flattener, scene),
      0
    )
  }

  // Ask the layer whether it can produce a path rather than matching against a
  // list of shape class names, so shape types added by future Sketch versions
  // keep working.
  if (!native.respondsToSelector(NSSelectorFromString('flattenedLayer'))) {
    return 1
  }

  const flattened = native.flattenedLayer()
  flattener.flattenLayer_inScene_options(flattened, scene, FLATTEN_GEOMETRY_ONLY)
  replaceLayer(native, flattened)
  return 0
}

function rotate(native, degrees) {
  native.setRotation(native.rotation() + degrees)
}

function stretch(native, scaleX, scaleY) {
  const frame = native.frame()
  frame.setConstrainProportions(false)
  frame.setWidth(frame.width() * scaleX)
  frame.setHeight(frame.height() * scaleY)
}

/** Swaps `original` for `replacement` at the same position in its parent. */
function replaceLayer(original, replacement) {
  const parent = original.parentGroup()
  parent.insertLayer_afterLayer(replacement, original)
  parent.removeLayer(original)
}

/**
 * Snapshots a layer's children into a plain array. Baking replaces layers
 * inside their parent, so iterating the live collection would skip siblings.
 */
function childrenOf(native) {
  return childrenOfArray(native.containedLayers())
}

function childrenOfArray(nativeArray) {
  if (!nativeArray) return []
  const children = []
  for (let i = 0; i < Number(nativeArray.count()); i += 1) {
    children.push(nativeArray.objectAtIndex(i))
  }
  return children
}

/**
 * Runs `work` so the user can undo the whole projection in one step. Documents
 * opened without a window have no undo manager, in which case `work` still runs.
 */
function withUndoGrouping(document, actionName, work) {
  const undoManager = document.sketchObject.undoManager()
  if (!undoManager) {
    work()
    return
  }
  undoManager.beginUndoGrouping()
  try {
    work()
    undoManager.setActionName(actionName)
  } finally {
    undoManager.endUndoGrouping()
  }
}
