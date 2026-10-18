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
/** Rotate once the live file would pass this many bytes. Default 5 MiB. */
export declare const DEFAULT_AUDIT_MAX_BYTES: number;
/** The one rotated generation kept beside the live file. */
export declare function rotatedPath(path: string): string;
/**
 * Append one JSON line to the audit trail, rotating first when it is full.
 *
 * @param path - the live audit file.
 * @param entry - the judgment to record; a `time` stamp is added in front.
 * @param maxBytes - rotation threshold; `0` or less disables rotation.
 */
export declare function appendAudit(path: string, entry: Record<string, unknown>, maxBytes: number): void;
