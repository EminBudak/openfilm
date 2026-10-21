---
"@openfilm/desktop": patch
---

The app's own ffmpeg is FFmpeg 8.1.2 on a Mac and 9.0.2 on Windows (was 6.0 and 6.1.1). FFmpeg 6 wrote ProRes 4444 whose transparency editors read as opaque, so rendered pages came into 剪映 and other editors on black.
