---
"openfilm": patch
---

Studio: layers inside a page can be deleted, not only hidden. Use the bin on a row of the Layers panel, Delete in the layer's menu (one layer or several), or Delete / Backspace while a layer is selected and no text field has focus. The page file is not changed: the clip gets a `display: none` override for the layer. Its other changes, the changes of the layers inside it and the component properties made from them are removed in the same step. One undo brings everything back. The deleted layer no longer appears in the Layers panel.
