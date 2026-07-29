![Isometry](images/logo.png?raw=true)

**`Isometry`** is a [Sketch](https://sketchapp.com) plugin that allows to create isometric projections from layers easily.

## Requirements

Sketch **2026.2.1** or later.

## Features

The plugin can generate 3 types of isometric projections from your source layers. All kinds of shape layers, as well as text layers are supported.

![Isometric Projections](images/projections.png)

### Create Top Isometric Projection

![Top Isometric Projection](images/projection-top.png)

### Create Left Isometric Projection

![Left Isometric Projection](images/projection-left.png)

### Create Front Isometric Projection

![Front Isometric Projection](images/projection-front.png)

## Usage

Select one or more layers, then choose **Plugins → Isometry** and pick a projection.

Note that projecting an artboard, or anything inside one, resizes that artboard. A
projection is always larger than the artwork it came from — an 800×604 artboard's contents
become 566×820 — and artboards clip whatever sticks out, so the artboard is resized to fit
rather than letting the result be silently cut off. This applies whether you select layers
inside the artboard or select the artboard itself. The fit is exact, so a dimension that
wasn't overflowing can end up smaller. Artboards that already fit are left alone.

Text layers are converted to outlines, since a sheared glyph can no longer be represented
as editable text. Images and symbol instances have no path geometry and cannot be sheared;
they are rotated and scaled with the rest of the selection but keep their own shape, and
the plugin reports how many layers were affected.

## Installation

- [Download](https://github.com/maxkonovalov/Isometry/releases/latest/download/Isometry.sketchplugin.zip) the latest release of the plugin
- Un-zip
- Double-click on `Isometry.sketchplugin`

## Development

```bash
npm install          # builds and symlinks the plugin into Sketch
npm run build        # build once
npm run watch        # rebuild on change
npm test             # end-to-end verification against a real Sketch install
```

`npm test` drives your Sketch install through `sketchtool`: it builds a throwaway
document, runs the plugin's commands against it, reads the resulting path geometry back
out, and compares it to the isometric matrix `R(θ₂)·S(sx,sy)·R(θ₁)`. It covers the three
faces on a rectangle, nested groups with a bezier oval and a text layer, a projection
inside a tight artboard, a projection of an artboard selected directly, an image that
cannot be projected, and an empty selection.

Your own open documents are left alone: each fixture creates its own document, tagged by
naming its page `ISOMETRY-TEST`, and only tagged documents are ever closed. Each fixture
also checks that its test document is frontmost before running a command, and aborts if it
isn't, so the plugin can't be pointed at a document the suite didn't create.

### Sketch caches plugin code

If a rebuild doesn't seem to change anything, this is why. Sketch loads a plugin's
JavaScript once and keeps using that copy, so a fresh `npm run build` has no effect on what
the menu commands run until Sketch re-reads it — it's possible to keep looking at a bug
that's already fixed. Note that `sketchtool run` *does* pick up the current build, so
`npm test` can pass against a build the menu commands aren't using.

`npm install` runs `skpm-link`, which offers to enable Sketch's "Always Reload Scripts
Before Running" developer setting — say yes, or set it directly:

```bash
defaults write com.bohemiancoding.sketch3 AlwaysReloadScript -bool YES   # then restart Sketch
```

To see which build Sketch actually has loaded, and compare it against `"version"` in
`src/manifest.json`:

```bash
/Applications/Sketch.app/Contents/MacOS/sketchtool run-script '
var pm = AppController.sharedInstance().pluginManager();
console.log(pm.plugins().objectForKey("com.maxkonovalov.isometry").version())'
```

Turn the setting off again when you're done iterating — it makes Sketch re-read plugin code
on every invocation, for every plugin. None of this affects anyone installing a released
`.zip`; they always get fresh code.

## License

`Isometry` is available under the MIT license. See the LICENSE file for more info.
