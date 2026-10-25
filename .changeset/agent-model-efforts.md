---
"@openfilm/desktop": patch
---

Enable Cursor's parameterized model picker and refresh agent options for the selected model before the first message. Show native effort choices, including Default, apply them to the conversation, and update the menu when the agent reports new options.

Reset model-specific settings on a model switch and hide the old model's speed and effort choices while the new options load. Reassert Cursor's selected model before applying only the parameters it currently supports, and show the rejected setting when configuration fails.
