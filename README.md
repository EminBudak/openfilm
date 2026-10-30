# Samples for the Wiro provider pull request

What Wiro made through `openfilm get` on a Studio built from `studio/wiro-provider`, on 2026-10-29.

| File | Made by | Command |
| --- | --- | --- |
| `intro.mp3`, `intro.vtt` | Eleven v4, its transcript from the word times Wiro returns | `openfilm get tts --via wiro --out intro --text "OpenFilm cuts your film together, one page at a time." --voice alice` |
| `theme.mp3` | ElevenLabs Music v2, 15 s | `openfilm get music --via wiro --out theme --prompt "warm lo-fi beat with soft rhodes keys, instrumental" --sec 15` |
| `whoosh.mp3` | Stable Audio 3 Small SFX, 2 s | `openfilm get sfx --via wiro --out whoosh --prompt "a fast whoosh, swish past the camera" --sec 2` |
| `hero.jpg` | Nano Banana 2 | `openfilm get image --via wiro --out hero --prompt "a brass key on dark green velvet, soft studio light, close-up" --ratio 16:9` |
| `logo.png` | Nano Banana 2, cut out by wiro/remove-background | `openfilm get image --via wiro --out logo --prompt "a flat round logo of a film reel, orange and white, centered, plain background" --ratio 1:1 --transparent` |
| `shot-frames.mp4` | Veo 3.1 Fast, from a first and a last frame | `openfilm get video --via wiro --yes --out shot-frames --prompt "the camera rises from a close-up of the key to a top-down view" --duration 4 --first-frame assets/image/hero.jpg --last-frame assets/image/frame-end.png` |
| `shot-frames-first-last-check.jpg` | Left: the first and last frames given; right: the clip's first and last frames | |
