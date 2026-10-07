# Test Auditor — Run 3

Workflow run: 37635524696
Result: FAILURE

Progress improved from 5/8 to 6/8. ResultList now passes. Remaining failures are both ProgressionDetails and share one root cause: the compact PDF appends ranking/percentage digits immediately after the result token, so the parser's word-boundary assertion rejects otherwise valid tokens (for example 1:52.82622...). Parser Engineer v2.4 removes only that invalid boundary assumption; event anchoring and placement prefix remain mandatory.

Gate remains rejected until a fresh independent run passes.
