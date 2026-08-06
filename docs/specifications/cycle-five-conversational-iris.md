# Cycle Five Conversational IRIS

**Status:** Implemented and locally verified

Cycle Five gives the Founder a natural multi-turn typed and spoken conversation with IRIS. Recent turns are retained only inside the authenticated local session and are never promoted to canonical memory without a separate governed memory proposal.

The dialogue model receives IRIS identity guidance, a bounded state summary, at most 24 recent turns, and the current utterance. The response is strict structured data with no execution authority. Conversation may explain or propose work, but worker activation, repository mutation, publication, deployment, credentials, spending, and provider resources remain behind their existing approval paths.

The browser sends microphone-derived text, not recorded audio. The loopback gateway binds dialogue history to the HttpOnly Founder session, enforces same-origin and CSRF checks, rejects credential-like input, caps request and response sizes, and calls only the local Ollama endpoint. Ending the session deletes its conversation history.

Local verification on 2026-08-06 completed two authenticated turns through the actual `qwen3:8b` runtime. The second response recalled the first turn, both responses declared `authority: none` and `retention: ephemeral-session`, and logout consumed the session successfully.
