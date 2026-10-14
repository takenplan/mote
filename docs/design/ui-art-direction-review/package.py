"""Package exact allowlisted review files, omitting product data and browser notes."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import json,hashlib
repo=Path(__file__).resolve().parents[3]
folder=repo/'.mote/ui-art-direction-review'
m=json.loads((folder/'manifest.json').read_text())
assert m['generatedOnly']
files=['index.html','review.css','review.js','manifest.js','manifest.json','README.md','design.md','evaluation.md','criteria.md']+[a['src'] for a in m['assets']]
with ZipFile(folder.with_suffix('.zip'),'w',compression=ZIP_DEFLATED) as z:
    for f in files:
        (folder/f).resolve().relative_to(folder.resolve())
        z.write(folder/f,folder.name+'/'+f)
with ZipFile(folder.with_suffix('.zip')) as z:
    assert z.testzip() is None
    for a in m['assets']:assert hashlib.sha256(z.read(folder.name+'/'+a['src'])).hexdigest()==a['sha256']
print('Packaged',len(files),'allowlisted files:',folder.with_suffix('.zip'))
