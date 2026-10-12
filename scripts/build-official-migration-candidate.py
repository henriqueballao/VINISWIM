#!/usr/bin/env python3
"""Build a reviewable atomic candidate, without DB access or activation."""
import argparse, hashlib, json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--global-fence-already-applied', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
names = [
 'official-event-integrity', 'manual-meet-entry', 'official-entry-read-model',
 'official-result-timeline', 'official-worker-leases', 'official-worker-context',
 'official-worker-outcomes', 'official-batch-transaction',
 'official-request-cancellation', 'official-monitoring',
 'official-legacy-writer-fence', 'official-targeted-request',
 'official-catalog-discovery', 'official-catalog-automation',
 'official-progress-view', 'official-finalization-trigger',
 'official-personal-best-concurrency', 'official-scheduler-auth',
]
if not args.global_fence_already_applied:
 names.append('official-global-cutover-fence')
parts = ['-- REVIEW CANDIDATE ONLY. No cron activation, hold removal or sporting INSERTs.\nBEGIN;\n']
manifest = []
for name in names:
 path = Path('commercial/supabase/proposals') / (name + '.sql')
 text = (root / path).read_text()
 lines = text.splitlines()
 if sum(line.strip() == 'BEGIN;' for line in lines) != 1 or sum(line.strip() == 'COMMIT;' for line in lines) != 1:
  raise SystemExit('Unexpected transaction wrapper: ' + str(path))
 parts.append('-- SOURCE: ' + str(path) + '\n' + '\n'.join(line for line in lines if line.strip() not in ('BEGIN;', 'COMMIT;')) + '\n')
 manifest.append({'path': str(path), 'sha256': hashlib.sha256(text.encode()).hexdigest()})
parts.append("SELECT pg_notify('pgrst','reload schema');\nCOMMIT;\n")
out = Path(args.output)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('\n'.join(parts))
out.with_suffix('.manifest.json').write_text(json.dumps({
 'mode': 'candidate-not-applied', 'globalFenceAlreadyApplied': args.global_fence_already_applied,
 'cronActivated': False, 'cleanupHoldsRemoved': False, 'files': manifest,
 'bundleSha256': hashlib.sha256(out.read_bytes()).hexdigest()
}, indent=2) + '\n')
print(json.dumps({'output': str(out), 'sourceFiles': len(manifest), 'databaseWrites': 0}))
