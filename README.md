# dsh-jev-loop

Jev ([TypeSafe](https://typesafe.ai) System One) judgments at the DeepSeek
Harness agent-loop gates. No UI dependency: mount it in any Harness
composition, headless or otherwise.

This is the core of the Jev loop for moqi. The optional `/JevLoop` control panel
ships separately as
[`moqi-jev-loop`](https://github.com/JWE24-code/moqi-jev-loop), and depends only
on the `jevLoop` service this package provides.

> **Data flow: your tool calls leave the machine.** Every enabled gate sends a
> slice of the session to the third-party TypeSafe API (`api.typesafe.ai`, or
> whatever `baseUrl` you set) for judgment. That includes **each gated tool
> call's name and arguments** (pre-execute), **each successful tool call's
> output** (post-execute) — both alongside your latest prompt — and the
> **recent transcript** — your prompts, the
> model's replies, and tool results — for the pre-step and turn-stopping
> gates, capped at `maxStateChars` characters per request. File contents a tool
> read, command output, and anything secret that appears in them go along.
> Disable a gate (`*Enabled: false`), or list sensitive tools in
> `preExecuteSkip`, to keep that data local.

Published to npm as
[`dsh-jev-loop`](https://www.npmjs.com/package/dsh-jev-loop). This repository
carries the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic — the
whole of the [dshfind](https://dshfind.com) listing mechanism: the marketplace
indexes public repositories by that topic and syncs daily, so there is no
listing step per release.

## Compatibility

Supported Harness lines: **0.1.5-rc.x** and **0.2.0 / 0.2.1** (CI typechecks
against `@deepseek-ai/dsh@0.1.5-rc.3`, `0.2.0-rc.2`, and `0.2.1-rc.2`). The
`peerDependencies` ranges say exactly that; a newer line is untested until it
is added to the CI matrix.

## Install

```bash
dsh plugin --profile <profile> add dsh-jev-loop
```

Then give it a key: set `TYPESAFE_API_KEY` (or `TYPESAFE_APIKEY`) in the
environment, or store one in the Harness credential store under
`TYPESAFE_API_KEY`. The gates fail open — no key, timeout, 429, or bad JSON
never blocks the loop.

## The gates

| Gate | Event | What Jev judges | Decision |
|---|---|---|---|
| Pre-step | `agent/pre-step` | is the request underspecified? | inject an "ask before guessing" instruction |
| Pre-execute | `tools/pre-execute` | destructive · exfiltration · off-task | `log` / `ask` / `deny` |
| Post-execute | `tools/post-execute` | did a successful call silently miss? | `log` / `block` with corrective feedback |
| Turn-stopping | `agent/turn-stopping` | "is the request actually done?" | `nudge` the turn onward, or pass |

All four are automatic. Jev supplies a calibrated probability; this package owns
the thresholds and decisions, and every failure — no key, timeout, 429, bad
JSON — **fails open**, so a judgment service that is down never blocks the loop.

Configure them on the `dsh-jev-loop` row in a profile's `cordis.patch.yml` (see
this package's [`cordis.patch.yml`](cordis.patch.yml)), or in a profile's own
patch layer. The `*Enabled` defaults can also be overridden at runtime from
moqi's `/JevLoop` panel, which persists to `$DSH_HOME/jev-loop.json`.

## Cost envelope

- One `POST /v1/systemone` per judgment; pre-execute asks its three hazards in a
  single call.
- State is capped (`maxStateChars`); the transcript gates only send the last
  `turnStoppingMaxMessages` messages.
- Answers are cached by a SHA-256 of the exact request body, so an unchanged
  judgment is free.
- Every judgment is appended to `$DSH_HOME/jev-loop.jsonl` with probabilities,
  cache hit/miss, latency, and token usage. Past `auditMaxBytes` (default
  5 MiB) the file is rotated to `jev-loop.jsonl.1`, replacing the previous
  rotation, so the trail stays bounded at roughly twice the cap.

## Config

Set on the `dsh-jev-loop` row in a bundle patch, or in a profile's own patch
layer.

| Field | Default | Meaning |
|---|---|---|
| `apiKey` | — | literal key; prefer `apiKeyEnv` so no secret is in a config file |
| `apiKeyEnv` | `TYPESAFE_API_KEY` | env var read for the key; `TYPESAFE_APIKEY` is also read |
| `model` | `jev-latest` | TypeSafe model alias |
| `baseUrl` | `https://api.typesafe.ai/v1/systemone` | evaluation endpoint |
| `timeoutMs` | `3000` | per-request timeout |
| `maxRetries` | `2` | retries on 429/529, network errors, timeouts |
| `maxStateChars` | `24000` | hard cap on state sent to Jev |
| `cacheEntries` | `500` | in-memory cache entries |
| `auditPath` | `$DSH_HOME/jev-loop.jsonl` | JSONL audit trail |
| `auditMaxBytes` | `5242880` (5 MiB) | rotate the trail to `<auditPath>.1` past this size; `0` never rotates |
| `statePath` | `$DSH_HOME/jev-loop.json` | persisted gate toggles |
| `preStepEnabled` | `false` | judge the request before the first step |
| `preStepThreshold` | `0.7` | clarification probability that injects a question |
| `preExecuteEnabled` | `true` | judge tool calls before dispatch |
| `preExecuteMode` | `log` | `log` observes, `ask` requests approval, `deny` refuses |
| `preExecuteThreshold` | `0.7` | hazard probability that flags a call |
| `preExecuteSkip` | `[]` | tool names to ignore |
| `postExecuteEnabled` | `true` | check a successful tool result |
| `postExecuteMode` | `log` | `log` observes, `block` turns feedback into an error |
| `postExecuteThreshold` | `0.7` | miss probability that blocks a result |
| `turnStoppingEnabled` | `true` | check the turn before it closes |
| `turnStoppingThreshold` | `0.5` | completion probability below which to nudge |
| `turnStoppingMaxSteers` | `2` | nudges per turn, so a wrong judgment cannot loop |
| `turnStoppingMaxMessages` | `14` | transcript messages fed to the completion judgment |

## Test it

```bash
npm install            # typescript + @types/node
npm run link-harness   # symlink the installed harness's @deepseek-ai packages
npm run build
npm test               # gates, keyring, loop, audit, render — no Harness, no network
npm run install-profile -- jev-core   # throwaway profile with just this bundle
TYPESAFE_APIKEY=… dsh --profile jev-core
```

`~/.dsh/jev-loop.jsonl` records every judgment.

To exercise the Harness-only build inside your own profile, list just the core
bundle:

```yaml
bundles: ['@deepseek-ai/dsh-base', 'dsh-jev-loop']
```

## Layout

```
src/gates.ts   the four judgments and their copy, as pure functions
src/keyring.ts key resolution order, storing, probing, clearing
src/loop.ts    JevLoop: state assembly, per-turn budgets, audit, one method per gate
src/jev.ts     the TypeSafe client: a Judger port and its live adapter
src/render.ts  derived session messages -> plain text (0.1.x and 0.2.x shapes)
src/audit.ts   the size-capped JSONL audit trail
src/index.ts   the Cordis adapter: config, event wiring, effects
tests/         the modules above, driven directly
scripts/       harness linking and the throwaway profile installer
```

## Docs

The module boundaries, the seams, and the generated whiteboard are documented in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

[![SonarQube Cloud](https://sonarcloud.io/images/project_badges/sonarcloud-highlight.svg)](https://sonarcloud.io/summary/new_code?id=JWE24-code_dsh-jev-loop)
