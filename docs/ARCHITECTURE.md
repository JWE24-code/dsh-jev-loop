# Architecture

One package: the feature, usable from a plain DeepSeek Harness with no UI at
all. The boundary that matters runs *between repositories* — the optional
`/JevLoop` panel lives in the separate
[`moqi-jev-loop`](https://github.com/JWE24-code/moqi-jev-loop) repository and
depends only on the `jevLoop` service this package provides.

| Package | For | Depends on |
|---|---|---|
| `dsh-jev-loop` (this repo) | any Harness composition | no host, no UI |
| [`moqi-jev-loop`](https://github.com/JWE24-code/moqi-jev-loop) | moqi | this package's `jevLoop` service and moqi's `tuiHost` |

## The core, as modules

Each row is a module with a small interface over a lot of behaviour. The map
below is the wiring; this table is the contract.

| Module | Interface | Hides |
|---|---|---|
| `gates.ts` | `decidePreStep` · `decidePreExecute` · `decidePostExecute` · `decideTurnStopping` | every threshold, mode, hazard order, and prompt word |
| `keyring.ts` | `refresh` · `refreshStored` · `set` · `clear` · `status` · `live` | resolution order, lazy client creation, probing, the store |
| `loop.ts` | `JevLoop` — one method per gate, plus the control surface | state assembly, once-per-turn, nudge budgets, audit |
| `jev.ts` | `Judger.systemOne` | retry, backoff, cache, state cap |
| `render.ts` | `renderMessages` · `renderContent` · `lastUserRequest` | derived messages to Jev text |
| `index.ts` | the Cordis plugin (`apply`) | config, event wiring, effects |

The domain modules import no Cordis: `gates.ts` is pure, and `keyring.ts` /
`loop.ts` take their dependencies as ports. `index.ts` is the only file that
knows the Harness.

![dsh-jev-loop core](whiteboards/dsh-jev-loop-core.svg)

*Editable source: [`whiteboards/dsh-jev-loop-core.excalidraw`](whiteboards/dsh-jev-loop-core.excalidraw) · data: [`whiteboards/dsh-jev-loop-core.json`](whiteboards/dsh-jev-loop-core.json).*

## Seams, and why each one exists

The design follows the dependency category of each thing the core touches:

- **TypeSafe is a true external service.** It sits behind the `Judger` port.
  Production injects `JevClient`; tests inject an in-memory judger. Two adapters
  means a real seam, not indirection.
- **The credential store is local-substitutable.** It sits behind the
  `CredentialStore` port. Production adapts `ctx.credentials`; tests pass a map.
  `index.ts#credentialStore` is the only line that mentions `ctx.credentials`.
- **The judgments are in-process.** They are pure functions over an answers
  map, so they need no seam at all.

The deletion test holds for the deepened modules: remove `JevLoop` and the
per-turn budget, nudge cap, audit, and state assembly reappear in four separate
event handlers.

## Tests

```bash
npm test   # gates, keyring, loop — no Harness and no network
```

The tests drive the same interfaces production does: `gates.ts` with answer
maps, `Keyring` with an in-memory store, and `JevLoop` with a counting judger.
They assert on returned outcomes, not internal state, so they survive refactors
inside each module.

## Regenerating the map

The map is made with [`exdraw`](https://github.com/) (Excalidraw code maps).
After a structural change:

```bash
exdraw map src --focus apply --depth 2 \
  --annotations docs/whiteboards/dsh-jev-loop-core.annotations.yaml \
  --out docs/whiteboards/dsh-jev-loop-core
```

Each function's one-line *why* comes from its JSDoc. The `*.annotations.yaml`
file adds the framing the doc comments cannot — titles and how the seams fit —
and is safe to edit; regenerating the map never overwrites it.
