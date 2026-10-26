---
"openfilm": patch
---

Studio: a mask can have a stroke. In the inspector's Mask section, add one and pick its color, its width and where it lies against the mask's edge: inside, center or outside. It follows every shape, inverted ones too, scales with the clip or layer, and shows the same in the preview and the export. It is plain CSS: an SVG filter that draws the stroke, plus one mask layer for the part past the edge. Safari does not load this kind of filter, so a preview in Safari shows no stroke. For a center or outside stroke, the extra mask layer still applies there: the band past the mask's edge where the stroke would be shows the picture instead. The desktop app, Chrome and exports draw the stroke.
