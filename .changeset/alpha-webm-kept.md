---
"openfilm": patch
---

Render: a video with an alpha keeps it. A WebM (VP9) or Apple HEVC with an alpha whose key frames are far apart was given a copy without its alpha for a render, which then showed what lay under the alpha (often a solid color) in the export, and in Studio's picture once the copy was made. An HEVC with an alpha that the browser does not decode now gets a copy with its alpha.
