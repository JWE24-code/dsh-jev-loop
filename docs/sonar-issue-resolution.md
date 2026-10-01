# Sonar issue resolution plan — dsh-jev-loop

All **20 unresolved SonarCloud findings** for project `JWE24-code_dsh-jev-loop`.
Unlike `moqi`, this repository has no `sonar-issues` workflow, so none of them
were mirrored to GitHub issues; this is the tracker's whole backlog for the
project.

## Triage

| Rule | Sev / type | Location(s) | Verdict |
|---|---|---|---|
| `jssecurity:S8707` | MAJOR VULN | `scripts/install-profile.mjs` ×5 | **Real** — guard blocks `/` and `\` but not `..` |
| `javascript:S4036` | MINOR VULN | `scripts/harness-root.mjs:35`, `scripts/install-profile.mjs:103` | Real hardening — bare `sh` from PATH |
| `javascript:S3403` | MAJOR BUG | `lib/loop.js:19` | Duplicate of the `S6606` below in compiled output |
| `typescript:S6606` | MINOR SMELL | `src/loop.ts:131` | Real — `text ?? String(value)` |
| `typescript:S3776` | CRITICAL SMELL | `src/jev.ts:206` | Real — `request()` complexity 18 |
| `javascript:S3776` | CRITICAL SMELL | `lib/jev.js:89` | Compiled copy of the same function |
| `typescript:S7787` | MINOR SMELL | `src/index.ts:27,31` | Deliberate TS idiom — suppress with reason |
| `typescript:S7503` | MINOR SMELL | `tests/keyring-smoke.ts` ×4, `tests/loop-smoke.ts` ×1 | Test doubles needlessly `async` |
| `typescript:S3358` | MAJOR SMELL | `tests/loop-smoke.ts:77,79` | Nested ternary in a test helper |

## Fixes

- **S8707 (path traversal).** `profileName` (argv) becomes a directory under
  `~/.dsh/profiles`, and the old guard only rejected `/` and `\`. A `..` name
  therefore escaped one level. Replaced with a flat, dotless allowlist:
  `/^[A-Za-z0-9][A-Za-z0-9_-]*$/`.
- **S4036 (PATH).** The two `execFileSync('sh', …)` calls now use `/bin/sh`, so
  the interpreter is not located through the caller's PATH.
- **S6606 + S3403.** `text === undefined ? String(value) : text` becomes
  `text ?? String(value)`. Identical for `JSON.stringify` (which returns a
  string or undefined), and the compiled `lib/loop.js` no longer holds the
  `===` that JavaScript analysis flagged as always-false.
- **S3776.** The retry loop moved into `attempt()` returning an
  `answer`/`retry`/`stop` outcome, leaving `request()` a short loop over it.
  Behaviour is unchanged: overloads and transient errors retry until
  `maxRetries`, cancellation and malformed answers stop.
- **S7503.** The in-memory judger/credential-store doubles drop `async` and
  return `Promise.resolve(...)`.
- **S3358.** The `modeFor` test helper uses `if` statements instead of nested
  ternaries.
- **S7787.** `import type {} from '@deepseek-ai/dsh-agent'` / `-dsh-tools` is
  the empty-import declaration-merging idiom (it types `exec.agent`); removing
  it breaks the build, so it carries `// NOSONAR` with the reason.

`lib/` is rebuilt with the source.
