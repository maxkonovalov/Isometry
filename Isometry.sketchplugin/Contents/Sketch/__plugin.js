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
  var skipped = 0;
  withUndoGrouping(document, "Create ".concat(face, " isometric projection"), function () {
    // The group is scaffolding: it gives the whole selection a single frame to
    // rotate and stretch, and is dissolved again before returning.
    var group = new (sketch__WEBPACK_IMPORTED_MODULE_0___default().Group)({
      parent: layers[0].parent,
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
  });
  if (skipped > 0) {
    sketch__WEBPACK_IMPORTED_MODULE_0___default().UI.message("".concat(skipped, " layer").concat(skipped === 1 ? '' : 's', " had no path geometry and could not be projected."));
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