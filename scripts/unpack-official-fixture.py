"""Reproduce immutable original fixtures without expiring Actions artifacts.
Never connects to a database. Caller must pass a separate test output directory.
"""
import hashlib,json,pathlib,stat,sys,zipfile
root=pathlib.Path('commercial/packages/import-v2/fixtures/official-originals')
key,out=sys.argv[1:]
meta=json.loads((root/'manifest.json').read_text())['archives'][key]
archive=root/meta['file'];data=archive.read_bytes()
if len(data)!=meta['bytes'] or hashlib.sha256(data).hexdigest()!=meta['sha256']:raise SystemExit('Original archive byte/hash mismatch')
target=pathlib.Path(out).resolve()
if target==root.resolve() or root.resolve() in target.parents:raise SystemExit('Never overwrite original fixtures')
with zipfile.ZipFile(archive) as z:
 if sum(i.file_size for i in z.infolist())>64*1024*1024:raise SystemExit('Fixture archive exceeds size limit')
 for i in z.infolist():
  p=pathlib.PurePosixPath(i.filename)
  if p.is_absolute() or '..' in p.parts or stat.S_ISLNK(i.external_attr>>16):raise SystemExit('Unsafe fixture path')
 z.extractall(target)
print(json.dumps({'mode':'original-fixture-replay-not-live-import','archive':meta['file'],'sha256':meta['sha256'],'productionWrites':0}))
