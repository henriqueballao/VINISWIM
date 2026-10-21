#!/usr/bin/env python3
"""Package the reviewed source for Supabase CLI without out-of-directory imports.
No network, credentials, database writes or deployment. A manifest hashes every file.
"""
import argparse,hashlib,json,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--functions-dir',required=True)
args=parser.parse_args();out=Path(args.functions_dir).resolve()
if out==root or root in out.parents:raise SystemExit('Output must be separate from source tree')
manifest=[]
def emit(relative,raw,source):
 path=out/relative;path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists() and path.read_bytes()!=raw:raise SystemExit('Refusing to overwrite different artifact: '+str(path))
 path.write_bytes(raw);manifest.append({'path':relative,'source':source,'sha256':hashlib.sha256(raw).hexdigest()})
function=root/'commercial/supabase/functions/official-import-runner'
entry=(function/'index.ts').read_text()
old="../../../packages/official-worker/src/"
if entry.count(old)!=2:raise SystemExit('Unexpected entrypoint import layout')
entry=entry.replace(old,'../_shared/official-worker/src/')
emit('official-import-runner/index.ts',entry.encode(),'commercial/supabase/functions/official-import-runner/index.ts (relative import paths relocated only)')
for name in ['deno.json','deno.lock']:emit('official-import-runner/'+name,(function/name).read_bytes(),str((function/name).relative_to(root)))
for package in ['official-worker','import-v2']:
 for source in sorted((root/'commercial/packages'/package/'src').glob('*.mjs')):
  if source.name.endswith('.test.mjs'):continue
  emit('_shared/'+package+'/src/'+source.name,source.read_bytes(),str(source.relative_to(root)))
(out/'official-import-runner/package-manifest.json').write_text(json.dumps({'mode':'source-package-only-no-deploy','files':manifest},indent=2)+'\n')
print('Packaged',len(manifest),'reviewed files; no network or deploy')
