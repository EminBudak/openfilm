---
"openfilm": patch
---

Footage the browser cannot play (ProRes, and other codecs it has no decoder for) placed whole, without a trim, plays and exports: its length and picture size come from ffprobe when the browser cannot read them. The film stopped with "no length to trim against" in Studio's preview, in every export and in `openfilm render`.
