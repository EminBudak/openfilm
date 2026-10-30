---
"openfilm": patch
---

Wiro makes pictures, video, music, sound effects, voice-over, transcripts and subtitle translations with your own key: connect a Wiro project in Studio (the OpenFilm logo at the top left → Providers), with its API secret too when the project uses signature-based authentication, or set `WIRO_API_KEY` (and `WIRO_API_SECRET`). Then choose Wiro for a kind of media, or run `openfilm get video --via wiro --out shot --prompt "…"`. Pictures come from Nano Banana 2, Nano Banana Pro, GPT Image 2 or FLUX.2 [pro], cut out of their background for `--transparent`; video from Veo 3.1 Fast, Veo 3.1, Kling 3.0 or Seedance 2.0; music from ElevenLabs Music v2, Lyria 3 Pro or Stable Audio 3 Medium, and sound effects from Stable Audio 3 Small SFX; voice-over from Eleven v4, timed word by word for subtitles, or Gemini 3.1 Flash TTS; transcripts from Parakeet TDT 0.6B v3, timed word by word, or ElevenLabs Scribe; subtitle translation from GPT-6 Luna or GPT-6.1 Sol.
