/**
 * The audit trail: append, rotate at the cap, keep one old generation, and
 * never throw — all against a throwaway directory.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appendAudit, DEFAULT_AUDIT_MAX_BYTES, rotatedPath } from '../src/audit.ts'

let checks = 0
function check(label: string, condition: boolean): void {
  assert.ok(condition, label)
  checks += 1
}

const lines = (path: string): Record<string, unknown>[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>)

const dir = mkdtempSync(join(tmpdir(), 'jev-audit-'))
try {
  // Plain append: one stamped JSON line per entry.
  const plain = join(dir, 'plain.jsonl')
  appendAudit(plain, { gate: 'a', n: 1 }, DEFAULT_AUDIT_MAX_BYTES)
  appendAudit(plain, { gate: 'a', n: 2 }, DEFAULT_AUDIT_MAX_BYTES)
  const written = lines(plain)
  check('appends one line per entry', written.length === 2)
  check('stamps each line with a time', typeof written[0]?.['time'] === 'string')
  check('keeps the entry fields', written[1]?.['n'] === 2)
  check('no rotation under the cap', !existsSync(rotatedPath(plain)))

  // Rotation: a small cap forces the live file over to `.1`.
  // Lines are all the same length, so a cap of 2.5 lines holds two per file.
  const capped = join(dir, 'capped.jsonl')
  appendAudit(capped, { gate: 'b', n: 0, pad: 'x'.repeat(40) }, 0)
  const lineBytes = statSync(capped).size
  rmSync(capped)
  const cap = Math.floor(lineBytes * 2.5)
  for (let n = 0; n < 4; n += 1) appendAudit(capped, { gate: 'b', n, pad: 'x'.repeat(40) }, cap)
  check('rotates once the next line would pass the cap', existsSync(rotatedPath(capped)))
  check('the live file stays within the cap', statSync(capped).size <= cap)
  const rotatedOnce = lines(rotatedPath(capped))
  check('the rotated file holds the earlier lines', rotatedOnce.map((line) => line['n']).join() === '0,1')
  check('no line is lost across one rotation', rotatedOnce.length + lines(capped).length === 4)

  // Only one old generation is kept: a second rotation replaces `.1`.
  for (let n = 4; n < 12; n += 1) appendAudit(capped, { gate: 'b', n, pad: 'x'.repeat(40) }, cap)
  check('no second generation is kept', !existsSync(`${capped}.2`))
  check('the rotated file was replaced by newer lines', (lines(rotatedPath(capped))[0]?.['n'] as number) > 0)
  check('the newest line is in the live file', lines(capped).at(-1)?.['n'] === 11)

  // One line bigger than the cap still lands, and does not rotate an empty file.
  const huge = join(dir, 'huge.jsonl')
  appendAudit(huge, { pad: 'y'.repeat(500) }, cap)
  check('an oversized line lands in an empty file', lines(huge).length === 1)
  check('an empty file is never rotated', !existsSync(rotatedPath(huge)))

  // `0` disables rotation.
  const unbounded = join(dir, 'unbounded.jsonl')
  for (let n = 0; n < 10; n += 1) appendAudit(unbounded, { n, pad: 'z'.repeat(40) }, 0)
  check('maxBytes 0 never rotates', !existsSync(rotatedPath(unbounded)) && lines(unbounded).length === 10)

  // Failures are swallowed: an unwritable path, and a rotation that cannot rename.
  assert.doesNotThrow(() => appendAudit(join(dir, 'missing', 'x.jsonl'), { n: 1 }, cap))
  checks += 1
  const blocked = join(dir, 'blocked.jsonl')
  writeFileSync(blocked, `${'q'.repeat(300)}\n`)
  mkdirSync(join(dir, 'blocked.jsonl.1', 'occupied'), { recursive: true }) // rename onto a non-empty dir fails
  assert.doesNotThrow(() => appendAudit(blocked, { n: 1 }, cap))
  checks += 1
  check('a failed rotation still appends the line', readFileSync(blocked, 'utf8').includes('"n":1'))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(`ok - ${String(checks)} audit checks passed`)
