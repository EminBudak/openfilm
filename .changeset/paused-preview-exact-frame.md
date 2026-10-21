---
"openfilm": patch
---

The paused preview shows the exact frame of a video, as an export draws it. The browser sometimes decodes a frame and never puts it on screen, so the picture could stay a few frames behind after you stepped or stopped. Studio now checks the frame on screen and seeks again if it is not there yet. Scrubbing stays as fast as before.
