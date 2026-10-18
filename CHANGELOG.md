# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-10-18

### Added

- Support for DeepSeek Harness **0.2.x** (0.2.0 and 0.2.1) alongside the
  existing 0.1.5-rc.x line. The two Harness API differences that affect this
  plugin are handled:
  - 0.2 removed the shared `{ kind: 'plugin', plugin }` message source. The
    plugin now declares its own `dsh-jev-loop` kind on `MessageSourceMap`,
    which both lines accept and label the same way in the chat UI.
  - 0.2 removed the `tool-result` content block; tool results are now
    `role: 'tool'` messages carrying `isError`. Transcript rendering matches
    the 0.1 block by shape and renders 0.2 tool-role errors as
    `tool error: …`.
- Audit-log rotation: `jev-loop.jsonl` rotates to `jev-loop.jsonl.1` when the
  next append would take it past the new optional `auditMaxBytes` setting
  (default 5 MiB; `0` disables rotation). Only one rotated file is kept, the
  rotation is a single atomic rename, and any audit I/O failure is swallowed so
  logging never breaks a gate.
- README data-flow warning: gated tool arguments, tool outputs, and transcript
  excerpts are sent to the third-party TypeSafe API (`api.typesafe.ai`), with
  the settings that keep that data local. Plus a compatibility section.

### Changed

- `peerDependencies` name the supported Harness lines
  (`^0.1.5-rc.3 || ^0.2.0-rc.0 || ^0.2.1-rc.0`, cordis `^4.0.2`, schemastery
  `^3.18.2`) instead of `*`. CI typechecks against dsh 0.1.5-rc.3, 0.2.0-rc.2,
  and 0.2.1-rc.2.
- `ctx.inject` is typed against Cordis's own `Context.inject` instead of an
  `as unknown` cast.

## [0.1.2] - 2026-10-01

### Fixed

- Cleared the outstanding Sonar findings: the profile installer's path guard,
  absolute interpreter paths, the retry-loop split, and smoke-test cleanups.

[0.1.3]: https://github.com/JWE24-code/dsh-jev-loop/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JWE24-code/dsh-jev-loop/releases/tag/v0.1.2
