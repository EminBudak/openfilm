---
"openfilm": patch
---

CLI: `openfilm get` ends with its own exit status on Windows with Node 24.17. It used to print what it got and then abort (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, exit status 127), so an agent read a good answer as a failure.
