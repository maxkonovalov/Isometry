#!/usr/bin/env bash
#
# End-to-end verification for Isometry against a real Sketch install.
#
# Drives Sketch through `sketchtool`: builds a throwaway document, runs the
# plugin's own commands against it, reads the resulting path geometry back out,
# and compares it to the isometric matrix R(theta2).S(sx,sy).R(theta1).
#
# Usage:  ./test/verify.sh          (uses /Applications/Sketch.app)
#         SKETCH_APP=/path/to/Sketch.app ./test/verify.sh
#
# Sketch will be launched and brought to the front. Any open documents are
# closed first, so save your work before running this.

set -uo pipefail

SKETCH_APP="${SKETCH_APP:-/Applications/Sketch.app}"
SKETCHTOOL="$SKETCH_APP/Contents/MacOS/sketchtool"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE="$ROOT/Isometry.sketchplugin"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

ok()   { printf "  \033[32mPASS\033[0m  %s\n" "$1"; pass=$((pass + 1)); }
bad()  { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; fail=$((fail + 1)); }
info() { printf "\n\033[1m%s\033[0m\n" "$1"; }

[ -x "$SKETCHTOOL" ] || { echo "sketchtool not found at $SKETCHTOOL"; exit 1; }
[ -d "$BUNDLE" ]     || { echo "plugin bundle not built; run: npm run build"; exit 1; }

# sketchtool prints console.log output as a single-quoted string with escaped
# newlines. Unwrap it back into plain text.
runscript() {
  "$SKETCHTOOL" run-script "$(cat "$1")" 2>&1 \
    | sed -e "s/^'//" -e "s/'\$//" \
    | perl -pe 's/\\n/\n/g'
}

runcmd() {
  "$SKETCHTOOL" run "$BUNDLE" "$1" 2>&1
}

# ---------------------------------------------------------------- fixtures ---

cat > "$TMP/dump.js" <<'JS'
var sketch = require('sketch')
var doc = sketch.getSelectedDocument()
function walk(layer) {
  var node = { type: layer.type, rotation: layer.transform.rotation }
  try { if (layer.getSVGPath) node.path = layer.getSVGPath() } catch (e) {}
  if (layer.layers) node.layers = layer.layers.map(walk)
  return node
}
console.log(JSON.stringify(doc.pages[0].layers.map(walk)))
JS

cat > "$TMP/rect.js" <<'JS'
var sketch = require('sketch')
sketch.getDocuments().forEach(function (d) { try { d.sketchObject.close() } catch (e) {} })
var doc = new sketch.Document()
var rect = new sketch.ShapePath({
  parent: doc.pages[0],
  frame: { x: 0, y: 0, width: 100, height: 50 },
  shapeType: sketch.ShapePath.ShapeType.Rectangle,
})
doc.selectedLayers.clear()
rect.selected = true
console.log('ready')
JS

cat > "$TMP/composite.js" <<'JS'
var sketch = require('sketch')
sketch.getDocuments().forEach(function (d) { try { d.sketchObject.close() } catch (e) {} })
var doc = new sketch.Document()
var page = doc.pages[0]
var r1 = new sketch.ShapePath({ frame: { x: 0, y: 0, width: 100, height: 50 }, shapeType: sketch.ShapePath.ShapeType.Rectangle })
var r2 = new sketch.ShapePath({ frame: { x: 10, y: 10, width: 30, height: 30 }, shapeType: sketch.ShapePath.ShapeType.Oval })
var inner = new sketch.Group({ parent: page, layers: [r1, r2], name: 'inner' })
inner.adjustToFit()
var text = new sketch.Text({ parent: page, text: 'Iso', frame: { x: 0, y: 80, width: 80, height: 30 } })
var outer = new sketch.Group({ parent: page, layers: [inner, text], name: 'outer' })
outer.adjustToFit()
doc.selectedLayers.clear()
outer.selected = true
console.log('ready')
JS

cat > "$TMP/image.js" <<'JS'
var sketch = require('sketch')
sketch.getDocuments().forEach(function (d) { try { d.sketchObject.close() } catch (e) {} })
var doc = new sketch.Document()
var page = doc.pages[0]
var img = new sketch.Image({ parent: page, image: ICON_PATH, frame: { x: 0, y: 0, width: 60, height: 60 } })
var rect = new sketch.ShapePath({ parent: page, frame: { x: 100, y: 0, width: 100, height: 50 }, shapeType: sketch.ShapePath.ShapeType.Rectangle })
doc.selectedLayers.clear()
img.selected = true
rect.selected = true
console.log('ready')
JS
# inject the icon path without embedding an absolute path in the heredoc
perl -pi -e "s{ICON_PATH}{'$ROOT/assets/icon.png'}" "$TMP/image.js"

cat > "$TMP/empty.js" <<'JS'
var sketch = require('sketch')
sketch.getDocuments().forEach(function (d) { try { d.sketchObject.close() } catch (e) {} })
var doc = new sketch.Document()
doc.selectedLayers.clear()
console.log('ready')
JS

# ------------------------------------------------------------- geometry ------

cat > "$TMP/check.js" <<'JS'
// Compares an observed projected rectangle against the isometric matrix.
// Sketch's rotation convention (verified empirically):
//   x' = x cos + y sin ;  y' = -x sin + y cos
const TAN30 = Math.tan(Math.PI / 6)
const FACES = {
  top:   { rotation: 45,  scaleX: 1,     scaleY: TAN30, finalRotation: 0 },
  left:  { rotation: -45, scaleX: TAN30, scaleY: 1,     finalRotation: 30 },
  front: { rotation: 45,  scaleX: TAN30, scaleY: 1,     finalRotation: -30 },
}
const R = a => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, -s, s, c] }
const S = (x, y) => [x, 0, 0, y]
const mul = (A, B) => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
]
const apply = (M, p) => [M[0] * p[0] + M[2] * p[1], M[1] * p[0] + M[3] * p[1]]

const [face, path] = [process.argv[2], process.argv[3]]
const f = FACES[face]
let M = mul(S(f.scaleX, f.scaleY), R(f.rotation))
if (f.finalRotation !== 0) M = mul(R(f.finalRotation), M)

const source = [[0, 0], [100, 0], [100, 50], [0, 50]].map(p => apply(M, p))
const nums = path.match(/-?\d+(\.\d+)?([eE][-+]?\d+)?/g).map(Number)
if (nums.length < 8) { console.log('FAIL not a polygon: ' + path); process.exit(1) }
const observed = [0, 1, 2, 3].map(i => [nums[i * 2], nums[i * 2 + 1]])

const edge = (pts, i) => [pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]]
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3
const neg = v => [-v[0], -v[1]]

const [eu, ev] = [edge(source, 1), edge(source, 3)]
const [ou, ov] = [edge(observed, 1), edge(observed, 3)]
// A parallelogram is unchanged by reversing an edge or swapping the two edges,
// so accept any of those framings of the same shape.
const same = (u, v) =>
  (near(ou, u) && (near(ov, v) || near(ov, neg(v)))) ||
  (near(ou, neg(u)) && (near(ov, v) || near(ov, neg(v))))
const match = same(eu, ev) || same(ev, eu)

const fmt = v => `(${v[0].toFixed(3)}, ${v[1].toFixed(3)})`
console.log(match ? 'OK' : `FAIL expected u=${fmt(eu)} v=${fmt(ev)} got u=${fmt(ou)} v=${fmt(ov)}`)
JS

# ---------------------------------------------------------------- tests ------

info "Geometry — a 100x50 rectangle projected onto each face"
for face in top left front; do
  runscript "$TMP/rect.js" >/dev/null
  err="$(runcmd "create-$face")"
  if [ -n "$err" ]; then bad "$face: plugin reported: $err"; continue; fi

  json="$(runscript "$TMP/dump.js")"
  path="$(printf '%s' "$json" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const layers = JSON.parse(s.trim());
      const shape = layers.find(l => l.path);
      if (!shape) { console.log(""); return }
      if (shape.rotation !== 0) { console.log("ROT:" + shape.rotation); return }
      console.log(shape.path);
    })')"

  case "$path" in
    "")      bad "$face: no path geometry in result" ;;
    ROT:*)   bad "$face: rotation not baked into geometry (${path#ROT:} deg)" ;;
    *)       result="$(node "$TMP/check.js" "$face" "$path")"
             [ "$result" = "OK" ] && ok "$face" || bad "$face: $result" ;;
  esac
done

info "Composite — nested groups, a bezier oval and a text layer"
runscript "$TMP/composite.js" >/dev/null
err="$(runcmd create-left)"
if [ -n "$err" ]; then
  bad "composite: plugin reported: $err"
else
  summary="$(runscript "$TMP/dump.js" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const layers = JSON.parse(s.trim());
      let paths = 0, rotated = 0, text = 0;
      (function walk(ns) { ns.forEach(n => {
        if (n.type === "Text") text++;
        if (n.path) paths++;
        if (Math.abs(n.rotation) > 1e-6) rotated++;
        if (n.layers) walk(n.layers);
      })})(layers);
      console.log(JSON.stringify({ paths, rotated, text }));
    })')"
  read -r paths rotated text <<<"$(printf '%s' "$summary" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(o.paths,o.rotated,o.text)})')"
  [ "$paths" -ge 3 ]  && ok "composite: $paths paths produced"      || bad "composite: only $paths paths"
  [ "$rotated" -eq 0 ] && ok "composite: all rotations baked to 0"  || bad "composite: $rotated layers still rotated"
  [ "$text" -eq 0 ]    && ok "composite: text converted to outlines" || bad "composite: $text text layers survived"
fi

info "Unprojectable layers — an image alongside a shape"
runscript "$TMP/image.js" >/dev/null
err="$(runcmd create-front)"
if [ -n "$err" ]; then
  bad "image: plugin reported: $err"
else
  ok "image: completed without error (shape projected, image reported to the user)"
fi

info "Empty selection"
runscript "$TMP/empty.js" >/dev/null
err="$(runcmd create-top)"
[ -z "$err" ] && ok "empty selection: message shown, no throw" || bad "empty selection: $err"

# ---------------------------------------------------------------- teardown ---

runscript "$TMP/empty.js" >/dev/null 2>&1

printf "\n\033[1m%d passed, %d failed\033[0m\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
