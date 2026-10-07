# Gate 7 — Cutover evidence

Date: 2026-10-07

## Documentary trio
Read-only documentary dry-run over the official ResultList cache produced:
- configured athlete A: 28 accepted, 0 rejected, 0 unmatched documents;
- configured athlete B: 53 accepted, 0 rejected, 0 unmatched documents;
- configured athlete C: 49 accepted, 0 rejected, 0 unmatched documents.

The production parser contains no per-athlete branch. Real-athlete documentary validation performed zero writes.

## Parser correction proven by official legacy documents
The ResultList parser was hardened for:
- athlete-row boundaries;
- compact rows;
- result documents without a clock in the header;
- N/C / disqualification rows without borrowing a neighboring swimmer time;
- percentage / point suffix variants.

Import V2 Gates, Import V2 Documentary Gates and Import V2 Live Readonly were green after these corrections.

## Gate 4 — idempotency
A synthetic official result was persisted with a canonical fingerprint and provenance. A second identical insert produced zero new rows. Production now has a unique partial index on non-null result_fingerprint and V2 also performs semantic deduplication before insert.

The synthetic account, athlete, meet, result and audit rows created by the pilot were removed after verification. Zero synthetic pilot rows remained.

## Gate 5 — failures
V2 defines distinct recoverable states for TLS, timeout, missing document, changed HTML, parser no-match, HTTP and unknown failures. Retry state is produced by the runner and does not require manual job editing.

## Gate 6 — request lifecycle
The real V2 request used four V2 jobs. The request stayed non-terminal until descendants ended and finalized only after all four jobs reached completed. Final state: completed=4, failed=0.

## Gate 7 — real E2E and cutover
A real V2 refresh completed through the isolated import_v2_jobs runtime and scheduled import-v2-runner. The frontend refresh action was then switched from request_result_refresh to request_result_refresh_v2.

Production import-v2-runner is active and scheduled once per minute. The temporary documentary audit Edge Function was disabled after the read-only audit.

## Release decision
Gate 7 is approved. The V2 path is the frontend refresh path. No athlete-specific production branch was introduced and no real result was manually corrected to satisfy a gate.
