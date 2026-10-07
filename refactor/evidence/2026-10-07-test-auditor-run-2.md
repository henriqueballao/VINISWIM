# Test Auditor — Run 2

Workflow run: 37634970417
Result: FAILURE

The independent runner again rejected Gates 0/1: 5 passed, 3 failed.

Root causes isolated from runner evidence:
- fixture athlete name begins lowercase after normalization boundary, while parser header required uppercase;
- compact labels contain no space between distance and stroke / stroke and Final;
- registration is legitimately concatenated with birth year, so rejecting a digit immediately after external_id rejects the correct athlete row.

Parser Engineer correction v2.3 removes those format assumptions while preserving left-side registration boundary and exact external_id lookup.

Gate remains rejected until a fresh independent run passes.
