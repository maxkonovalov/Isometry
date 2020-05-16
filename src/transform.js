import sketch from 'sketch'

export function applyTransform(layers, angle1, scaleX, scaleY, angle2) {
    if (layers.count() == 0) {
        sketch.UI.message("Please select a layer")
        return
    }

    var layerArray = MSLayerArray.arrayWithLayers(layers);
    var group = MSLayerGroup.groupWithLayers(layerArray)

    rotate(group, angle1)

    flatten(group)

    scale(group, scaleX, scaleY)

    if (angle2 != 0.0) {
        rotate(group, angle2)
        flatten(group)
    }

    group.containedLayers().forEach(layer => layer.select_byExtendingSelection(true, true))
    group.ungroup()
}

function rotate(layer, angle) {
    var rotation = layer.rotation() + angle
    layer.setRotation(rotation)
}

function scale(layer, scaleX, scaleY) {
    var frame = layer.frame()
    frame.setConstrainProportions(false)
    frame.setWidth(frame.width() * scaleX)
    frame.setHeight(frame.height() * scaleY)
}

function flatten(layer) {
    switch (String(layer.class())) {
        case "MSLayerGroup":
        case "MSShapeGroup":
            layer.moveTransformsToChildren()
            layer.fixGeometryWithOptions(1)
            layer.containedLayers().forEach(child => flatten(child))
            break
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
            break
        case "MSTextLayer":
            var outlineLayer = layer.layersByConvertingToOutlines()[0]
            flatten(outlineLayer)
            break
        default:
            console.log("Default")
            break
    }
}
