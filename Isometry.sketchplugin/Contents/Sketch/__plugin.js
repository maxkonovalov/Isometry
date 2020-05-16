var globalThis = this;
var global = this;
function __skpm_run (key, context) {
  globalThis.context = context;
  try {

var exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/plugin.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/plugin.js":
/*!***********************!*\
  !*** ./src/plugin.js ***!
  \***********************/
/*! exports provided: onCreateTop, onCreateLeft, onCreateFront */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "onCreateTop", function() { return onCreateTop; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "onCreateLeft", function() { return onCreateLeft; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "onCreateFront", function() { return onCreateFront; });
/* harmony import */ var _transform__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./transform */ "./src/transform.js");

var tan30 = Math.tan(Math.PI / 6);
function onCreateTop(context) {
  Object(_transform__WEBPACK_IMPORTED_MODULE_0__["applyTransform"])(context.selection, 45, 1, tan30, 0);
}
function onCreateLeft(context) {
  Object(_transform__WEBPACK_IMPORTED_MODULE_0__["applyTransform"])(context.selection, -45, tan30, 1, 30);
}
function onCreateFront(context) {
  Object(_transform__WEBPACK_IMPORTED_MODULE_0__["applyTransform"])(context.selection, 45, tan30, 1, -30);
}

/***/ }),

/***/ "./src/transform.js":
/*!**************************!*\
  !*** ./src/transform.js ***!
  \**************************/
/*! exports provided: applyTransform */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "applyTransform", function() { return applyTransform; });
/* harmony import */ var sketch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sketch */ "sketch");
/* harmony import */ var sketch__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(sketch__WEBPACK_IMPORTED_MODULE_0__);

function applyTransform(layers, angle1, scaleX, scaleY, angle2) {
  if (layers.count() == 0) {
    sketch__WEBPACK_IMPORTED_MODULE_0___default.a.UI.message("Please select a layer");
    return;
  }

  var layerArray = MSLayerArray.arrayWithLayers(layers);
  var group = MSLayerGroup.groupWithLayers(layerArray);
  rotate(group, angle1);
  flatten(group);
  scale(group, scaleX, scaleY);

  if (angle2 != 0.0) {
    rotate(group, angle2);
    flatten(group);
  }

  group.containedLayers().forEach(function (layer) {
    return layer.select_byExtendingSelection(true, true);
  });
  group.ungroup();
}

function rotate(layer, angle) {
  var rotation = layer.rotation() + angle;
  layer.setRotation(rotation);
}

function scale(layer, scaleX, scaleY) {
  var frame = layer.frame();
  frame.setConstrainProportions(false);
  frame.setWidth(frame.width() * scaleX);
  frame.setHeight(frame.height() * scaleY);
}

function flatten(layer) {
  switch (String(layer.class())) {
    case "MSLayerGroup":
    case "MSShapeGroup":
      layer.moveTransformsToChildren();
      layer.fixGeometryWithOptions(1);
      layer.containedLayers().forEach(function (child) {
        return flatten(child);
      });
      break;

    case "MSRectangleShape":
    case "MSOvalShape":
    case "MSShapePathLayer":
    case "MSTriangleShape":
    case "MSStarShape":
    case "MSPolygonShape":
      var flattened = layer.flattenedLayer();
      var flattener = MSLayerFlattener.alloc().init();
      flattener.flattenLayer_options(flattened, 2);
      var parent = layer.parentGroup();
      parent.insertLayer_afterLayer(flattened, layer);
      parent.removeLayer(layer);
      break;

    case "MSTextLayer":
      var outlineLayer = layer.layersByConvertingToOutlines()[0];
      flatten(outlineLayer);
      break;

    default:
      console.log("Default");
      break;
  }
}

/***/ }),

/***/ "sketch":
/*!*************************!*\
  !*** external "sketch" ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("sketch");

/***/ })

/******/ });
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