---
"@openfilm/desktop": patch
---

The desktop app's network library, undici, is updated to 8.12.2 for its security fixes: a server can no longer crash the app by renegotiating TLS, and certificate checks are no longer skipped when connection options are dropped.
