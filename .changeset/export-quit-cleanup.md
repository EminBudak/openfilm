---
"openfilm": patch
---

Quitting Studio while an export runs no longer leaves half-made files behind. Studio now waits a few seconds for the export to stop and clean up after itself. If Studio was ended outright (forced to quit, a crash, the computer shutting down), the next export cleans up what was left: hidden half-made files beside your exports and drafts, and scratch in the project's cache, which could be gigabytes.
