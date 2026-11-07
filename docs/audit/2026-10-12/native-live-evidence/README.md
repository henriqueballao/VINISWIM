# Capturas oficiais da execução 38200529145

Estes são documentos públicos capturados ao vivo em 2026-10-12, não seeds de resultados. Consulte manifest.json para URL, horário e hash, e viniswim-native-proof.json para persistência local.

Restaurar cada PDF e conferir bytes:

```python
import base64, gzip, hashlib, json
from pathlib import Path
root = Path(__file__).parent
manifest = json.loads((root / "manifest.json").read_text())
for item in manifest["documents"]:
    raw = gzip.decompress(base64.b64decode((root / (item["file"] + ".gz.b64")).read_bytes(), validate=False))
    assert len(raw) == item["bytes"]
    assert hashlib.sha256(raw).hexdigest() == item["rawHash"]
    (root / item["file"]).write_bytes(raw)
```

Uso posterior como fixture não comprova uma nova importação ao vivo. Não carregar estas linhas/arquivos como resultados em produção.
