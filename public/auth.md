# Authentication & Rate Limits — Swaraga

## Access Policy

Swaraga (`https://h3manth.com/fun/swaraga/`) is a public, zero-auth browser and agent application:

- **In-Browser / OpenJev WASM Mode**: Requires no API key (`OPENJEV LOCAL`). Automatically loads `Qwen3-0.6B` via `@wllama/wllama` in the browser.
- **TypeSafe Cloud API (BYOK)**: Optional `Bearer ts_...` key passed directly from the browser (`Authorization: Bearer <TYPESAFE_API_KEY>`) to `https://api.typesafe.ai/v1/systemone`.
- **Agent Discovery**: All `.well-known/*` manifests (`api-catalog`, `agent-card.json`, `mcp/server-card.json`, `agent-skills/index.json`) and `llms.txt` are publicly readable without authentication.
