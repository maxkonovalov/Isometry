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

Note that projecting inside an artboard resizes that artboard. A projection is always
larger than the artwork it came from — an 800×604 artboard's contents become 566×820 — and
artboards clip whatever sticks out, so the enclosing artboard is grown to fit rather than
letting the result be silently cut off. Artboards that already fit are left alone.

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
inside a tight artboard, an image that cannot be projected, and an empty selection.

Your own open documents are left alone: each fixture creates its own document, tagged by
naming its page `ISOMETRY-TEST`, and only tagged documents are ever closed. Each fixture
also checks that its test document is frontmost before running a command, and aborts if it
isn't, so the plugin can't be pointed at a document the suite didn't create.

## License

`Isometry` is available under the MIT license. See the LICENSE file for more info.
