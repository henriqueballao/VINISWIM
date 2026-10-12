"""Verify authorized original bytes and exact excerpt construction. No database."""
import hashlib,json,pathlib,subprocess,sys
root=pathlib.Path('commercial/packages/import-v2/fixtures/official-20261011')
artifact=pathlib.Path(sys.argv[1]);manifest=json.loads((root/'original-documents.json').read_text())
provenance=json.loads((root/'provenance.json').read_text());texts={};verified=[]
for document in manifest['documents']:
    file=artifact/document['file'];raw=file.read_bytes()
    assert len(raw)==document['bytes'],f"Length mismatch: {file.name}"
    assert hashlib.sha256(raw).hexdigest()==document['rawHash'],f"Original bytes changed: {file.name}"
    texts[file.name]=subprocess.check_output(['pdftotext','-layout',str(file),'-']).decode('utf8')
    verified.append({'file':file.name,'rawHash':document['rawHash'],'verified':True})
assert len(verified)==8,'Expected all eight originals'
for doc in provenance['documents']:
    actual=texts[doc['file']].split('\n');rule=provenance['excerptConstruction']
    prefix='\n'.join(actual[rule['prefixStartLine']-1:rule['prefixEndLine']])
    sections=['\n'.join(actual[r['startLine']-1:r['endLine']]) for r in doc['sourceLineRanges']]
    reconstructed=prefix+rule['prefixSeparator']+rule['sectionSeparator'].join(sections)+rule['suffix']
    fixture=(root/doc['fixture']).read_bytes()
    assert hashlib.sha256(fixture).hexdigest()==doc['textHash'],'Committed fixture changed'
    assert reconstructed.encode()==fixture,f"Excerpt differs from original PDF extraction: {doc['fixture']}"
print(json.dumps({'mode':'original-bytes-and-excerpts-only','resultsInserted':0,'documents':verified,'fixtureExcerptsVerified':2},indent=2))
