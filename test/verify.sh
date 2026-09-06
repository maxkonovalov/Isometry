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
# Your own open documents are left alone. Each fixture creates its own document,
# tagged by naming its page ISOMETRY-TEST, and only documents carrying that tag
# are ever closed. Before running a command, each fixture checks that its test
# document is the frontmost one and aborts if it is not, so the plugin can never
# be pointed at a document it did not create.

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

runcmd() { "$SKETCHTOOL" run "$BUNDLE" "$1" 2>&1; }

# Runs a fixture and aborts the whole suite unless it reports itself ready,
# which it only does once its own document is frontmost.
setup() {
  local out
  out="$(runscript "$1")"
  case "$out" in
    *ready*) return 0 ;;
    *) printf "\n\033[31mABORTED\033[0m  fixture %s: %s\n" "$(basename "$1")" "$out"; exit 1 ;;
  esac
}

# ------------------------------------------------------- shared JS prelude ---

cat > "$TMP/prelude.js" <<'JS'
var sketch = require('sketch')
var TAG = 'ISOMETRY-TEST'
function closeTestDocuments() {
  sketch.getDocuments().forEach(function (d) {
    try {
      if (d.pages.length && String(d.pages[0].name) === TAG) d.sketchObject.close()
    } catch (e) {}
  })
}
function newTestDocument() {
  closeTestDocuments()
  var doc = new sketch.Document()
  doc.pages[0].name = TAG
  return doc
}
// Only report ready when our own document is the one the plugin will act on.
function confirmFrontmost(doc) {
  var selected = sketch.getSelectedDocument()
  if (!selected || String(selected.id) !== String(doc.id)) {
    console.log('ERROR: test document is not frontmost; refusing to run')
    return false
  }
  console.log('ready')
  return true
}
JS

fixture() { cat "$TMP/prelude.js" "$1" > "$TMP/_run.js"; echo "$TMP/_run.js"; }

# ---------------------------------------------------------------- fixtures ---

cat > "$TMP/rect.body.js" <<'JS'
var doc = newTestDocument()
var rect = new sketch.ShapePath({
  parent: doc.pages[0],
  frame: { x: 0, y: 0, width: 100, height: 50 },
  shapeType: sketch.ShapePath.ShapeType.Rectangle,
})
doc.selectedLayers.clear()
rect.selected = true
confirmFrontmost(doc)
JS

cat > "$TMP/composite.body.js" <<'JS'
var doc = newTestDocument()
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
confirmFrontmost(doc)
JS

cat > "$TMP/image.body.js" <<'JS'
var doc = newTestDocument()
var page = doc.pages[0]
var img = new sketch.Image({ parent: page, image: ICON_PATH, frame: { x: 0, y: 0, width: 60, height: 60 } })
var rect = new sketch.ShapePath({ parent: page, frame: { x: 100, y: 0, width: 100, height: 50 }, shapeType: sketch.ShapePath.ShapeType.Rectangle })
doc.selectedLayers.clear()
img.selected = true
rect.selected = true
confirmFrontmost(doc)
JS
perl -pi -e "s{ICON_PATH}{'$ROOT/assets/icon.png'}" "$TMP/image.body.js"

cat > "$TMP/artboard.body.js" <<'JS'
var doc = newTestDocument()
// The artboard is sized tightly around the rectangle, so the projection — which
// is always larger than the artwork it came from — is guaranteed to overflow it.
var board = new sketch.Artboard({
  parent: doc.pages[0], name: 'Board',
  frame: { x: 0, y: 0, width: 100, height: 50 },
})
var rect = new sketch.ShapePath({
  parent: board,
  frame: { x: 0, y: 0, width: 100, height: 50 },
  shapeType: sketch.ShapePath.ShapeType.Rectangle,
})
doc.selectedLayers.clear()
rect.selected = true
confirmFrontmost(doc)
JS

# The artboard itself is selected, rather than layers inside it. The plugin then
# projects the artboard directly, and its parent is the page — so an artboard-fit
# that only inspects ancestors finds nothing and the result is clipped.
cat > "$TMP/artboard-selected.body.js" <<'JS'
var doc = newTestDocument()
var board = new sketch.Artboard({
  parent: doc.pages[0], name: 'Board',
  frame: { x: 0, y: 0, width: 100, height: 50 },
})
new sketch.ShapePath({
  parent: board,
  frame: { x: 0, y: 0, width: 100, height: 50 },
  shapeType: sketch.ShapePath.ShapeType.Rectangle,
})
doc.selectedLayers.clear()
board.selected = true
confirmFrontmost(doc)
JS

# Two artboards, one layer selected in each. Grouping them together would carry a layer out
# of its artboard, and — because Sketch's grouping does not remap frames between coordinate
# spaces — stack both at the same local coordinates.
cat > "$TMP/two-artboards.body.js" <<'JS'
var doc = newTestDocument()
var a = new sketch.Artboard({ parent: doc.pages[0], name: 'A', frame: { x: 0, y: 0, width: 200, height: 200 } })
var b = new sketch.Artboard({ parent: doc.pages[0], name: 'B', frame: { x: 400, y: 0, width: 200, height: 200 } })
var ra = new sketch.ShapePath({ parent: a, name: 'inA', frame: { x: 20, y: 20, width: 100, height: 50 } })
var rb = new sketch.ShapePath({ parent: b, name: 'inB', frame: { x: 20, y: 20, width: 100, height: 50 } })
doc.selectedLayers.clear()
ra.selected = true
rb.selected = true
confirmFrontmost(doc)
JS

# Two sibling groups inside one artboard, one layer selected from each. Same stacking
# hazard, without crossing an artboard boundary.
cat > "$TMP/two-groups.body.js" <<'JS'
var doc = newTestDocument()
var ab = new sketch.Artboard({ parent: doc.pages[0], name: 'A', frame: { x: 0, y: 0, width: 400, height: 400 } })
var r1 = new sketch.ShapePath({ name: 'r1', frame: { x: 20, y: 20, width: 100, height: 50 } })
var r2 = new sketch.ShapePath({ name: 'r2', frame: { x: 200, y: 20, width: 100, height: 50 } })
var g1 = new sketch.Group({ parent: ab, name: 'G1', layers: [r1] }); g1.adjustToFit()
var g2 = new sketch.Group({ parent: ab, name: 'G2', layers: [r2] }); g2.adjustToFit()
doc.selectedLayers.clear()
r1.selected = true
r2.selected = true
confirmFrontmost(doc)
JS

# Reports every leaf as "name@absX,absY" so a test can assert both that nothing moved
# container and that no two layers ended up on the same spot.
cat > "$TMP/placement.body.js" <<'JS'
var doc = sketch.getSelectedDocument()
var leaves = []
function walk(layers, ox, oy, container) {
  layers.forEach(function (l) {
    var ax = ox + l.frame.x, ay = oy + l.frame.y
    if (l.layers && l.layers.length) { walk(l.layers, ax, ay, l.name); return }
    if (l.type === 'Artboard' || l.type === 'Group') return   // empty container, not a leaf
    leaves.push({ name: String(l.name), container: String(container), x: Math.round(ax), y: Math.round(ay) })
  })
}
doc.pages[0].layers.forEach(function (top) { walk([top], 0, 0, 'page') })
console.log(JSON.stringify(leaves))
JS

cat > "$TMP/empty.body.js" <<'JS'
var doc = newTestDocument()
doc.selectedLayers.clear()
confirmFrontmost(doc)
JS

cat > "$TMP/teardown.body.js" <<'JS'
closeTestDocuments()
console.log('ready')
JS

# ------------------------------------------------------------- inspectors ---

cat > "$TMP/dump.body.js" <<'JS'
var doc = sketch.getSelectedDocument()
function walk(layer) {
  var node = { type: layer.type, rotation: layer.transform.rotation }
  try { if (layer.getSVGPath) node.path = layer.getSVGPath() } catch (e) {}
  if (layer.layers) node.layers = layer.layers.map(walk)
  return node
}
console.log(JSON.stringify(doc.pages[0].layers.map(walk)))
JS

# Reports the artboard's size and whether anything inside it is clipped,
# measured through accumulated transforms so rotation is accounted for.
cat > "$TMP/artboard-state.body.js" <<'JS'
var doc = sketch.getSelectedDocument()
function rotM(d){var r=d*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [c,-s,s,c,0,0]}
function tM(x,y){return [1,0,0,1,x,y]}
function mul(m,n){return [m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],
  m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]]}
function ap(m,p){return [m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]]}
function l2p(l){var f=l.frame
  return mul(tM(f.x+f.width/2,f.y+f.height/2),mul(rotM(l.transform.rotation||0),tM(-f.width/2,-f.height/2)))}
var board = doc.pages[0].layers.filter(function (l) { return l.type === 'Artboard' })[0]
if (!board) { console.log(JSON.stringify({ error: 'no artboard' })) } else {
  var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }
  ;(function walk(l, M) {
    var L = mul(M, l2p(l))
    if (l.layers && l.layers.length) { l.layers.forEach(function (c) { walk(c, L) }); return }
    var f = l.frame
    ;[[0,0],[f.width,0],[f.width,f.height],[0,f.height]].forEach(function (p) {
      var q = ap(L, p)
      b.x0 = Math.min(b.x0, q[0]); b.y0 = Math.min(b.y0, q[1])
      b.x1 = Math.max(b.x1, q[0]); b.y1 = Math.max(b.y1, q[1])
    })
  })({ layers: board.layers, frame: { x: 0, y: 0, width: 0, height: 0 }, transform: { rotation: 0 } }, [1,0,0,1,0,0])
  console.log(JSON.stringify({
    width: board.frame.width, height: board.frame.height,
    clipped: b.x0 < -0.5 || b.y0 < -0.5 ||
             b.x1 > board.frame.width + 0.5 || b.y1 > board.frame.height + 0.5,
  }))
}
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
  setup "$(fixture "$TMP/rect.body.js")"
  err="$(runcmd "create-$face")"
  if [ -n "$err" ]; then bad "$face: plugin reported: $err"; continue; fi

  path="$(runscript "$(fixture "$TMP/dump.body.js")" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const layers = JSON.parse(s.trim());
      const shape = layers.find(l => l.path);
      if (!shape) { console.log(""); return }
      if (shape.rotation !== 0) { console.log("ROT:" + shape.rotation); return }
      console.log(shape.path);
    })')"

  case "$path" in
    "")    bad "$face: no path geometry in result" ;;
    ROT:*) bad "$face: rotation not baked into geometry (${path#ROT:} deg)" ;;
    *)     result="$(node "$TMP/check.js" "$face" "$path")"
           [ "$result" = "OK" ] && ok "$face" || bad "$face: $result" ;;
  esac
done

info "Composite — nested groups, a bezier oval and a text layer"
setup "$(fixture "$TMP/composite.body.js")"
err="$(runcmd create-left)"
if [ -n "$err" ]; then
  bad "composite: plugin reported: $err"
else
  read -r paths rotated text <<<"$(runscript "$(fixture "$TMP/dump.body.js")" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const layers = JSON.parse(s.trim());
      let paths = 0, rotated = 0, text = 0;
      (function walk(ns) { ns.forEach(n => {
        if (n.type === "Text") text++;
        if (n.path) paths++;
        if (Math.abs(n.rotation) > 1e-6) rotated++;
        if (n.layers) walk(n.layers);
      })})(layers);
      console.log(paths, rotated, text);
    })')"
  [ "${paths:-0}" -ge 3 ]   && ok "composite: $paths paths produced"       || bad "composite: only ${paths:-0} paths"
  [ "${rotated:-1}" -eq 0 ] && ok "composite: all rotations baked to 0"    || bad "composite: $rotated layers still rotated"
  [ "${text:-1}" -eq 0 ]    && ok "composite: text converted to outlines"  || bad "composite: $text text layers survived"
fi

info "Artboard — projection must not be clipped by the enclosing artboard"
setup "$(fixture "$TMP/artboard.body.js")"
before="$(runscript "$(fixture "$TMP/artboard-state.body.js")")"
err="$(runcmd create-top)"
if [ -n "$err" ]; then
  bad "artboard: plugin reported: $err"
else
  after="$(runscript "$(fixture "$TMP/artboard-state.body.js")")"
  read -r w h clipped <<<"$(printf '%s' "$after" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const o = JSON.parse(s.trim());
      console.log(Math.round(o.width), Math.round(o.height), o.clipped);
    })')"
  grew=false
  { [ "$w" -gt 100 ] || [ "$h" -gt 50 ]; } && grew=true
  if [ "$clipped" != "false" ]; then
    bad "artboard: content still clipped (board ${w}x${h})"
  elif [ "$grew" != "true" ]; then
    bad "artboard: board never resized (${w}x${h}) — the overflow case was not exercised"
  else
    ok "artboard: resized 100x50 -> ${w}x${h}, content no longer clipped"
  fi
fi

info "Artboard selected directly — the artboard itself is the projected layer"
setup "$(fixture "$TMP/artboard-selected.body.js")"
err="$(runcmd create-left)"
if [ -n "$err" ]; then
  bad "artboard-selected: plugin reported: $err"
else
  read -r w h clipped <<<"$(runscript "$(fixture "$TMP/artboard-state.body.js")" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const o = JSON.parse(s.trim());
      console.log(Math.round(o.width), Math.round(o.height), o.clipped);
    })')"
  [ "$clipped" = "false" ] && ok "artboard-selected: resized 100x50 -> ${w}x${h}, content not clipped" \
                           || bad "artboard-selected: content clipped (board ${w}x${h})"
fi

# Asserts each named layer is still in its expected container, and that no two leaves share
# a position (which is what grouping across parents does to them).
assert_placement() {
  local label="$1" expected="$2"
  local actual
  actual="$(runscript "$(fixture "$TMP/placement.body.js")" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const ls = JSON.parse(s.trim());
      const where = ls.map(l => l.name + " in " + l.container).sort().join("; ");
      const spots = ls.map(l => l.x + "," + l.y);
      const stacked = new Set(spots).size !== spots.length;
      console.log(JSON.stringify({ where, stacked, n: ls.length }));
    })')"
  local where stacked
  where="$(printf '%s' "$actual" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).where))')"
  stacked="$(printf '%s' "$actual" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).stacked))')"

  [ "$where" = "$expected" ] && ok "$label: layers stayed put — $where" \
                             || bad "$label: expected [$expected], got [$where]"
  [ "$stacked" = "false" ] && ok "$label: no two layers landed on the same spot" \
                           || bad "$label: layers were stacked at identical coordinates"
}

info "Two artboards — a layer selected in each must not leave its artboard"
setup "$(fixture "$TMP/two-artboards.body.js")"
err="$(runcmd create-left)"
if [ -n "$err" ]; then bad "two-artboards: plugin reported: $err"
else assert_placement "two-artboards" "inA in A; inB in B"; fi

info "Two groups in one artboard — layers must not be pulled into one group"
setup "$(fixture "$TMP/two-groups.body.js")"
err="$(runcmd create-top)"
if [ -n "$err" ]; then bad "two-groups: plugin reported: $err"
else assert_placement "two-groups" "r1 in G1; r2 in G2"; fi

info "Unprojectable layers — an image alongside a shape"
setup "$(fixture "$TMP/image.body.js")"
err="$(runcmd create-front)"
[ -z "$err" ] && ok "image: completed without error (shape projected, image reported to the user)" \
              || bad "image: plugin reported: $err"

info "Empty selection"
setup "$(fixture "$TMP/empty.body.js")"
err="$(runcmd create-top)"
[ -z "$err" ] && ok "empty selection: message shown, no throw" || bad "empty selection: $err"

# ---------------------------------------------------------------- teardown ---

runscript "$(fixture "$TMP/teardown.body.js")" >/dev/null 2>&1

printf "\n\033[1m%d passed, %d failed\033[0m\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
