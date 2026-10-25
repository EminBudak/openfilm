---
"openfilm": patch
---

On Windows, a page the system briefly had no network buffer for (`net::ERR_NO_BUFFER_SPACE`) is loaded again, in `look`, Studio's thumbnails and exports, instead of failing. A project's card no longer misses its film's poster when it is asked for at the moment the poster is being written.
