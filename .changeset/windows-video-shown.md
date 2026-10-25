---
"openfilm": patch
---

Exports on Windows: on some computers with an NVIDIA GPU, Vulkan never showed the video frame a seek asked for. Video clips came out black, or an export drew one frame every five seconds, as with HEVC footage such as DJI cameras record. OpenFilm now checks once that an H.264 and an HEVC frame show as sought. If one doesn't, it uses the same GPU through Direct3D, or keeps Vulkan and decodes video on the CPU.
