/**
 * The JSONL audit trail, size-capped.
 *
 * Every judgment appends one line, so an uncapped file grows for as long as the
 * plugin is mounted. Before an append that would take the file past the cap,
 * the current file is renamed to `<path>.1` — replacing any older `.1` — and a
 * fresh file is started, so the trail never holds much more than twice the
 * cap on disk. The rename is one atomic filesystem operation, and every step
 * is best effort: a failed stat, rename, or append drops the line, never
 * throws into the gate that wrote it.
 * @module
 */
import { appendFileSync, renameSync, statSync } from 'node:fs';
/** Rotate once the live file would pass this many bytes. Default 5 MiB. */
export const DEFAULT_AUDIT_MAX_BYTES = 5 * 1024 * 1024;
/** The one rotated generation kept beside the live file. */
export function rotatedPath(path) {
    return `${path}.1`;
}
/**
 * Rotate `path` to {@link rotatedPath} when appending `incomingBytes` would
 * take it past `maxBytes`. An empty or missing file is never rotated, so one
 * oversized line still lands instead of rotating forever.
 */
function rotateIfFull(path, incomingBytes, maxBytes) {
    let size;
    try {
        size = statSync(path).size;
    }
    catch {
        return;
    }
    if (size === 0 || size + incomingBytes <= maxBytes)
        return;
    renameSync(path, rotatedPath(path));
}
/**
 * Append one JSON line to the audit trail, rotating first when it is full.
 *
 * @param path - the live audit file.
 * @param entry - the judgment to record; a `time` stamp is added in front.
 * @param maxBytes - rotation threshold; `0` or less disables rotation.
 */
export function appendAudit(path, entry, maxBytes) {
    try {
        const line = `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`;
        if (maxBytes > 0) {
            try {
                rotateIfFull(path, Buffer.byteLength(line), maxBytes);
            }
            catch {
                // A failed rotation still appends: an over-cap file beats a lost line.
            }
        }
        appendFileSync(path, line);
    }
    catch {
        // Best effort only: logging must never break the loop.
    }
}
