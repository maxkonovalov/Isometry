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
 * A projection is taller than the artwork it came from, so projecting inside an
 * artboard would push the result past the artboard's edge, where it would be
 * clipped. The enclosing artboard is resized to fit whenever that would happen.
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

  // Captured before grouping, because the layers are about to be moved into the
  // scaffolding group and will report that group as their parent instead.
  const parent = layers[0].parent

  let skipped = 0
  let fittedArtboards = 0

  withUndoGrouping(document, `Create ${face} isometric projection`, () => {
    // The group is scaffolding: it gives the whole selection a single frame to
    // rotate and stretch, and is dissolved again before returning.
    const group = new sketch.Group({ parent, layers })
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

    fittedArtboards = fitArtboards(projected, parent)
  })

  const notes = []
  if (skipped > 0) {
    notes.push(
      `${skipped} layer${skipped === 1 ? '' : 's'} had no path geometry and could not be projected.`
    )
  }
  if (fittedArtboards === 1) {
    notes.push('Artboard resized to fit the projection.')
  } else if (fittedArtboards > 1) {
    notes.push(`${fittedArtboards} artboards resized to fit the projection.`)
  }
  if (notes.length > 0) {
    sketch.UI.message(notes.join(' '))
  }
}

/**
 * Artboards clip whatever sticks out of them, and an isometric projection is
 * taller than the artwork it came from — so a projection touching an artboard
 * would be silently cut off at its edge. Resizes every artboard involved that no
 * longer contains its own contents.
 *
 * The fit is exact, so a dimension that was not overflowing can come out smaller
 * than the user left it. That is deliberate: it keeps the artboard tight to its
 * contents, the same as Sketch's own resize-to-fit.
 *
 * An artboard can be involved two ways, and both have to be checked: the
 * projection can happen *inside* it (so it is an ancestor of the layers), or the
 * artboard itself can be part of the selection and be projected directly. Only
 * checking ancestors misses the second case entirely, because the selection's
 * parent is then the page.
 *
 * `projected` are the resulting native layers and `parent` is the container they
 * were placed in. Returns how many artboards were resized, so the caller can say
 * so; artboards that still fit are left exactly as the user sized them.
 */
function fitArtboards(projected, parent) {
  const boards = []
  const seen = {}

  function consider(layer) {
    const board = enclosingArtboard(layer)
    if (!board) return
    const id = String(board.id)
    if (seen[id]) return
    seen[id] = true
    boards.push(board)
  }

  projected.forEach(native => {
    try {
      consider(sketch.fromNative(native))
    } catch (e) {
      // A layer the JS API cannot wrap cannot be an artboard either.
    }
  })
  consider(parent)

  let fitted = 0
  boards.forEach(board => {
    if (!contentOverflows(board)) return
    board.adjustToFit()
    fitted += 1
  })
  return fitted
}

/** The artboard `layer` sits in, or `layer` itself when it is one. */
function enclosingArtboard(layer) {
  let node = layer
  while (node && node.type !== 'Artboard') {
    node = node.type === 'Page' ? null : node.parent
  }
  return node || null
}

/** Half a point — below this, an overhang is rounding noise, not clipping. */
const OVERFLOW_TOLERANCE = 0.5

function contentOverflows(artboard) {
  const bounds = contentBounds(artboard)
  if (!bounds) return false
  return (
    bounds.minX < -OVERFLOW_TOLERANCE ||
    bounds.minY < -OVERFLOW_TOLERANCE ||
    bounds.maxX > artboard.frame.width + OVERFLOW_TOLERANCE ||
    bounds.maxY > artboard.frame.height + OVERFLOW_TOLERANCE
  )
}

/**
 * The true visual bounds of everything inside `container`, in its own
 * coordinates. A layer's `frame` ignores its rotation, so rotated layers have to
 * be measured through the accumulated transform of every ancestor instead.
 *
 * Returns null for an empty container.
 */
function contentBounds(container) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  function measure(layer, inherited) {
    const combined = multiply(inherited, layerTransform(layer))
    if (layer.layers && layer.layers.length > 0) {
      layer.layers.forEach(child => measure(child, combined))
      return
    }
    const { width, height } = layer.frame
    const corners = [[0, 0], [width, 0], [width, height], [0, height]]
    corners.forEach(corner => {
      const point = transformPoint(combined, corner)
      minX = Math.min(minX, point[0])
      minY = Math.min(minY, point[1])
      maxX = Math.max(maxX, point[0])
      maxY = Math.max(maxY, point[1])
    })
  }

  const IDENTITY = [1, 0, 0, 1, 0, 0]
  container.layers.forEach(child => measure(child, IDENTITY))
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}

// Affine transforms as [a, b, c, d, tx, ty], mapping (x, y) to
// (a·x + c·y + tx, b·x + d·y + ty).

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function transformPoint(m, point) {
  const x = point[0]
  const y = point[1]
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** A layer's placement in its parent: rotation about its own centre, then offset. */
function layerTransform(layer) {
  const { x, y, width, height } = layer.frame
  const degrees = layer.transform.rotation || 0
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const rotation = [cos, -sin, sin, cos, 0, 0]
  return multiply(
    [1, 0, 0, 1, x + width / 2, y + height / 2],
    multiply(rotation, [1, 0, 0, 1, -width / 2, -height / 2])
  )
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
