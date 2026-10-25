---
"openfilm": patch
---

`look` and `render` keep going when more than six videos of long files are awake at once: an open-ended read of a video is at most 2 MiB, so a paused video reads its piece to the end and holds no connection, and a frame-duration lookup given up on after ten seconds is no longer reported as a failed request.
