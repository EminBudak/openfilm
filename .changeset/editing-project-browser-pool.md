---
"openfilm": patch
---

Export › Editing project starts its browsers once for all the pages and keeps them steady.
- One process draws every page with the same browsers. Each page opens its own tab and closes it after.
- A browser that crashes or stops answering is replaced at once, and its page is drawn again in new browsers. A page's own error still stops the export and says why.
- A browser is started again after many pages, so memory stays flat.
- Cancel still stops everything and leaves nothing behind.
- A transparent page now comes out the same to the last pixel however many browsers share it. Before, the first two frames each browser drew came out a level or two off.
