---
"openfilm": patch
---

Exports on Windows: when Vulkan doesn't show video, OpenFilm now asks for Direct3D by name. Before, it fell back to Chromium's default, which on Windows draws on the CPU. And when a film's video frames never show in the browser drawing it, though the check made at startup passed, the export is drawn again in browsers that show video another way, instead of running for hours to make a black video. The export tray keeps the time left in view when its line is too long.
