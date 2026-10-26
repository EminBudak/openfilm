---
"@openfilm/desktop": patch
"openfilm": patch
---

Find the agent programs bundled with OpenCode and GitHub Copilot on Windows, and DeepSeek Harness installed in a custom folder. Recognize registered desktop apps outside their default folders, including MiniMax's icon-only registration, so an installed editor is distinguished from a missing command-line agent. Choosing the DeepSeek Harness, OpenCode, or GitHub Copilot desktop executable now locates its bundled or app-managed agent. Find MiniMax's Windows CLI at its install root and keep its own launcher so native SQLite uses the correct Node runtime. An agent that cannot be found is no longer described as not installed.
