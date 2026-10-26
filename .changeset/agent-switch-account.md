---
"@openfilm/desktop": patch
"openfilm": patch
---

Switch account for the chat's agents. Claude Code keeps its own sign-in, apart from the Claude app's, so switching accounts in the Claude app did not change the one OpenFilm used. Settings → Agents now has Switch account: Claude Code, Cursor and MiniMax Code sign out with their own command and open their sign-in for another account, and their chats carry on with the new one; the other agents say where they switch (the Codex app, the DeepSeek Harness app, or the agent itself). A turn that fails for its account (signed out, an expired or refused sign-in, an organization that turned off Claude subscription access) offers Switch account and names the account signed in. Cursor's row shows its account's email.
