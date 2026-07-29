var globalThis = this;
var global = this;
function __skpm_run (key, context) {
  globalThis.context = context;
  try {

var exports;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/transform.js"
/*!**************************!*\
  !*** ./src/transform.js ***!
  \**************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   project: () => (/* binding */ project)
/* harmony export */ });
/* harmony import */ var sketch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sketch */ "sketch");
/* harmony import */ var sketch__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(sketch__WEBPACK_IMPORTED_MODULE_0__);

var TAN_30 = Math.tan(Math.PI / 6);

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
var PROJECTIONS = {
  top: {
    rotation: 45,
    scaleX: 1,
    scaleY: TAN_30,
    finalRotation: 0
  },
  left: {
    rotation: -45,
    scaleX: TAN_30,
    scaleY: 1,
    finalRotation: 30
  },
  front: {
    rotation: 45,
    scaleX: TAN_30,
    scaleY: 1,
    finalRotation: -30
  }
};

/**
 * Sketch 2026 moved the layer flattener into the SketchControllers framework as
 * a Swift class, so it no longer resolves under the bare `MSLayerFlattener`
 * symbol that older Sketch versions exposed.
 */
var FLATTENER_CLASS = 'SketchControllers.MSLayerFlattener';

/** Flatten path geometry only; leave styles, fills and effects intact. */
var FLATTEN_GEOMETRY_ONLY = 2;

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
function project(face) {
  var projection = PROJECTIONS[face];
  if (!projection) {
    throw new Error("Unknown isometric face '".concat(face, "'."));
  }
  var document = sketch__WEBPACK_IMPORTED_MODULE_0___default().getSelectedDocument();
  if (!document) {
    sketch__WEBPACK_IMPORTED_MODULE_0___default().UI.message('Isometry needs an open document.');
    return;
  }
  var selection = document.selectedLayers;
  var layers = selection.layers;
  if (layers.length === 0) {
    sketch__WEBPACK_IMPORTED_MODULE_0___default().UI.message('Please select a layer.');
    return;
  }
  var flattenerClass = NSClassFromString(FLATTENER_CLASS);
  if (!flattenerClass) {
    sketch__WEBPACK_IMPORTED_MODULE_0___default().UI.message('Isometry is not compatible with this version of Sketch.');
    return;
  }
  var flattener = flattenerClass.alloc().init();
  var scene = document.sketchObject.documentData();

  // Captured before grouping, because the layers are about to be moved into the
  // scaffolding group and will report that group as their parent instead.
  var parent = layers[0].parent;
  var skipped = 0;
  var fittedArtboards = 0;
  withUndoGrouping(document, "Create ".concat(face, " isometric projection"), function () {
    // The group is scaffolding: it gives the whole selection a single frame to
    // rotate and stretch, and is dissolved again before returning.
    var group = new (sketch__WEBPACK_IMPORTED_MODULE_0___default().Group)({
      parent: parent,
      layers: layers
    });
    group.adjustToFit();
    var native = group.sketchObject;
    rotate(native, projection.rotation);
    skipped = bakeTransforms(native, flattener, scene);
    stretch(native, projection.scaleX, projection.scaleY);
    if (projection.finalRotation !== 0) {
      rotate(native, projection.finalRotation);
      bakeTransforms(native, flattener, scene);
    }
    var projected = childrenOf(native);
    selection.clear();
    projected.forEach(function (layer) {
      return layer.select_byExtendingSelection(true, true);
    });
    native.ungroup();
    fittedArtboards = fitArtboards(projected, parent);
  });
  var notes = [];
  if (skipped > 0) {
    notes.push("".concat(skipped, " layer").concat(skipped === 1 ? '' : 's', " had no path geometry and could not be projected."));
  }
  if (fittedArtboards === 1) {
    notes.push('Artboard resized to fit the projection.');
  } else if (fittedArtboards > 1) {
    notes.push("".concat(fittedArtboards, " artboards resized to fit the projection."));
  }
  if (notes.length > 0) {
    sketch__WEBPACK_IMPORTED_MODULE_0___default().UI.message(notes.join(' '));
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
  var boards = [];
  var seen = {};
  function consider(layer) {
    var board = enclosingArtboard(layer);
    if (!board) return;
    var id = String(board.id);
    if (seen[id]) return;
    seen[id] = true;
    boards.push(board);
  }
  projected.forEach(function (native) {
    try {
      consider(sketch__WEBPACK_IMPORTED_MODULE_0___default().fromNative(native));
    } catch (e) {
      // A layer the JS API cannot wrap cannot be an artboard either.
    }
  });
  consider(parent);
  var fitted = 0;
  boards.forEach(function (board) {
    if (!contentOverflows(board)) return;
    board.adjustToFit();
    fitted += 1;
  });
  return fitted;
}

/** The artboard `layer` sits in, or `layer` itself when it is one. */
function enclosingArtboard(layer) {
  var node = layer;
  while (node && node.type !== 'Artboard') {
    node = node.type === 'Page' ? null : node.parent;
  }
  return node || null;
}

/** Half a point — below this, an overhang is rounding noise, not clipping. */
var OVERFLOW_TOLERANCE = 0.5;
function contentOverflows(artboard) {
  var bounds = contentBounds(artboard);
  if (!bounds) return false;
  return bounds.minX < -OVERFLOW_TOLERANCE || bounds.minY < -OVERFLOW_TOLERANCE || bounds.maxX > artboard.frame.width + OVERFLOW_TOLERANCE || bounds.maxY > artboard.frame.height + OVERFLOW_TOLERANCE;
}

/**
 * The true visual bounds of everything inside `container`, in its own
 * coordinates. A layer's `frame` ignores its rotation, so rotated layers have to
 * be measured through the accumulated transform of every ancestor instead.
 *
 * Returns null for an empty container.
 */
function contentBounds(container) {
  var minX = Infinity;
  var minY = Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;
  function measure(layer, inherited) {
    var combined = multiply(inherited, layerTransform(layer));
    if (layer.layers && layer.layers.length > 0) {
      layer.layers.forEach(function (child) {
        return measure(child, combined);
      });
      return;
    }
    var _layer$frame = layer.frame,
      width = _layer$frame.width,
      height = _layer$frame.height;
    var corners = [[0, 0], [width, 0], [width, height], [0, height]];
    corners.forEach(function (corner) {
      var point = transformPoint(combined, corner);
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    });
  }
  var IDENTITY = [1, 0, 0, 1, 0, 0];
  container.layers.forEach(function (child) {
    return measure(child, IDENTITY);
  });
  return Number.isFinite(minX) ? {
    minX: minX,
    minY: minY,
    maxX: maxX,
    maxY: maxY
  } : null;
}

// Affine transforms as [a, b, c, d, tx, ty], mapping (x, y) to
// (a·x + c·y + tx, b·x + d·y + ty).

function multiply(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
function transformPoint(m, point) {
  var x = point[0];
  var y = point[1];
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** A layer's placement in its parent: rotation about its own centre, then offset. */
function layerTransform(layer) {
  var _layer$frame2 = layer.frame,
    x = _layer$frame2.x,
    y = _layer$frame2.y,
    width = _layer$frame2.width,
    height = _layer$frame2.height;
  var degrees = layer.transform.rotation || 0;
  var radians = degrees * Math.PI / 180;
  var cos = Math.cos(radians);
  var sin = Math.sin(radians);
  var rotation = [cos, -sin, sin, cos, 0, 0];
  return multiply([1, 0, 0, 1, x + width / 2, y + height / 2], multiply(rotation, [1, 0, 0, 1, -width / 2, -height / 2]));
}

/**
 * Bakes every rotation at or below `native` into the path geometry itself, so
 * that the layers end up axis-aligned while looking unchanged on the canvas.
 *
 * Returns the number of layers that had no path geometry and so were left as
 * they were.
 */
function bakeTransforms(native, flattener, scene) {
  var kind = String(native.class());
  if (kind === 'MSLayerGroup' || kind === 'MSShapeGroup') {
    // Push the group's own rotation onto its children, then bake each of them.
    native.moveTransformsToChildren();
    return childrenOf(native).reduce(function (skipped, child) {
      return skipped + bakeTransforms(child, flattener, scene);
    }, 0);
  }
  if (kind === 'MSTextLayer') {
    // Sketch swaps the text layer for its outlines in place, so the returned
    // layers are already parented and the text layer is already detached.
    var outlines = childrenOfArray(native.layersByConvertingToOutlines());
    if (outlines.length === 0) return 1;
    return outlines.reduce(function (skipped, outline) {
      return skipped + bakeTransforms(outline, flattener, scene);
    }, 0);
  }

  // Ask the layer whether it can produce a path rather than matching against a
  // list of shape class names, so shape types added by future Sketch versions
  // keep working.
  if (!native.respondsToSelector(NSSelectorFromString('flattenedLayer'))) {
    return 1;
  }
  var flattened = native.flattenedLayer();
  flattener.flattenLayer_inScene_options(flattened, scene, FLATTEN_GEOMETRY_ONLY);
  replaceLayer(native, flattened);
  return 0;
}
function rotate(native, degrees) {
  native.setRotation(native.rotation() + degrees);
}
function stretch(native, scaleX, scaleY) {
  var frame = native.frame();
  frame.setConstrainProportions(false);
  frame.setWidth(frame.width() * scaleX);
  frame.setHeight(frame.height() * scaleY);
}

/** Swaps `original` for `replacement` at the same position in its parent. */
function replaceLayer(original, replacement) {
  var parent = original.parentGroup();
  parent.insertLayer_afterLayer(replacement, original);
  parent.removeLayer(original);
}

/**
 * Snapshots a layer's children into a plain array. Baking replaces layers
 * inside their parent, so iterating the live collection would skip siblings.
 */
function childrenOf(native) {
  return childrenOfArray(native.containedLayers());
}
function childrenOfArray(nativeArray) {
  if (!nativeArray) return [];
  var children = [];
  for (var i = 0; i < Number(nativeArray.count()); i += 1) {
    children.push(nativeArray.objectAtIndex(i));
  }
  return children;
}

/**
 * Runs `work` so the user can undo the whole projection in one step. Documents
 * opened without a window have no undo manager, in which case `work` still runs.
 */
function withUndoGrouping(document, actionName, work) {
  var undoManager = document.sketchObject.undoManager();
  if (!undoManager) {
    work();
    return;
  }
  undoManager.beginUndoGrouping();
  try {
    work();
    undoManager.setActionName(actionName);
  } finally {
    undoManager.endUndoGrouping();
  }
}

/***/ },

/***/ "sketch"
/*!*************************!*\
  !*** external "sketch" ***!
  \*************************/
(module) {

module.exports = require("sketch");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			const getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***********************!*\
  !*** ./src/plugin.js ***!
  \***********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   onCreateFront: () => (/* binding */ onCreateFront),
/* harmony export */   onCreateLeft: () => (/* binding */ onCreateLeft),
/* harmony export */   onCreateTop: () => (/* binding */ onCreateTop)
/* harmony export */ });
/* harmony import */ var _transform__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./transform */ "./src/transform.js");

function onCreateTop() {
  (0,_transform__WEBPACK_IMPORTED_MODULE_0__.project)('top');
}
function onCreateLeft() {
  ;(0,_transform__WEBPACK_IMPORTED_MODULE_0__.project)('left');
}
function onCreateFront() {
  ;(0,_transform__WEBPACK_IMPORTED_MODULE_0__.project)('front');
}
})();

exports = __webpack_exports__;
/******/ })()
;
    if (key === 'default' && typeof exports === 'function') {
      exports(context);
    } else if (typeof exports[key] !== 'function') {
      throw new Error('Missing export named "' + key + '". Your command should contain something like `export function " + key +"() {}`.');
    } else {
      exports[key](context);
    }
  } catch (err) {
    if (typeof process !== 'undefined' && process.listenerCount && process.listenerCount('uncaughtException')) {
      process.emit("uncaughtException", err, "uncaughtException");
    } else {
      throw err
    }
  }
}
globalThis['onCreateTop'] = __skpm_run.bind(this, 'onCreateTop');
globalThis['onRun'] = __skpm_run.bind(this, 'default');
globalThis['onCreateLeft'] = __skpm_run.bind(this, 'onCreateLeft');
globalThis['onCreateFront'] = __skpm_run.bind(this, 'onCreateFront')

//# sourceMappingURL=__plugin.js.map