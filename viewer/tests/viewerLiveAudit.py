"""Record public layer availability at representative loci/scales; not sequence validation."""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
BASE = 'https://polymerbio.org/api/v1'
OUT = Path(__file__).resolve().parents[1] / 'docs/verification/viewer-reliability/live-layer-audit.json'
def get(path):
    start=time.monotonic()
    try:
        with urllib.request.urlopen(BASE+path,timeout=30) as response:
            return {'http':response.status,'elapsed_ms':round((time.monotonic()-start)*1000),'body':json.load(response)}
    except Exception as error:
        return {'http':getattr(error,'code',None),'elapsed_ms':round((time.monotonic()-start)*1000),'error':str(error)}
report={'retrieved_at':datetime.now(timezone.utc).isoformat(),'scope':'Public endpoint sample, not all-locus coverage, reference verification, or P95 benchmark','builds':{}}
requests=[]
for build in ['hg38','hg37']:
    layers=get('/layers?build='+build)
    body=layers.pop('body',{})
    inventory=body.get('data',{}).get('layers',[])
    report['builds'][build]={'inventory':inventory,'inventory_request':layers,'samples':[]}
    keys=','.join(layer['layer_key'] for layer in inventory)
    for width in [100,1000,100000,1000000]:
        region=f'chr17:7668421-{7668421+width-1}'
        resolution=1 if width<=200 else 1000 if width<=50000 else 10000 if width<=500000 else 100000
        path=f'/regions/{build}/{region}' if resolution==1 else f'/tiles/{build}/chr17/tile/{resolution}/{(7668421-1)//resolution}'
        requests.append((build,width,path+'?'+urllib.parse.urlencode({'layers':keys})))
def sample(item):
    build,width,path=item; result=get(path); body=result.pop('body',{})
    result.update({'viewport_width':width,'path':path,'sample_kind':'direct region' if width==100 else 'one representative tile, not the full viewport','layer_counts':{key:value.get('n') for key,value in body.get('data',{}).items() if isinstance(value,dict)},'layers_resolved':body.get('layers_resolved',[])})
    return build,result
with ThreadPoolExecutor(max_workers=3) as pool:
    for build,result in pool.map(sample,requests): report['builds'][build]['samples'].append(result)
OUT.write_text(json.dumps(report,indent=2)+'\n')
for build,value in report['builds'].items():
    print(build,len(value['inventory']),'layers;',[(s['viewport_width'],s['http']) for s in value['samples']])
print('Saved',OUT)
