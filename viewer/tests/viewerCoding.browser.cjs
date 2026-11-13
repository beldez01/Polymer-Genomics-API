const {chromium}=require('playwright');const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:3126';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let reverse=false,missingStart=false;
 function features(){const records=reverse?[['cds',10,14],['cds',30,33],['start_codon',31,33]]:[['exon',1,13],['UTR',1,9],['cds',10,13],['cds',30,34],['start_codon',10,12]];
  const rows=records.filter(r=>!missingStart||r[0]!=='start_codon');return {class:'GRanges',n:rows.length,seqnames:rows.map(()=>'chr1'),strand:rows.map(()=>reverse?'-':'+'),ranges:{start:rows.map(r=>r[1]),end:rows.map(r=>r[2]),width:rows.map(r=>r[2]-r[1]+1)},mcols:{transcript_id:rows.map(()=>'TX.1'),gene_symbol:rows.map(()=>'TEST'),feature_type:rows.map(r=>r[0])}};
 }
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p.endsWith('/v1/layers'))return route.fulfill({json:{data:{layers:[{layer_key:'gencode_v44',name:'GENCODE',version:'fixture',build:'hg38'}]}}});
  if(p.includes('/layers/summary'))return route.fulfill({json:{data:{layer_counts:{},gene_features:{}}}});
  if(p.includes('/genes/'))return route.fulfill({json:{data:features()}});
  if(p.includes('/sequence/')){
   const [start,end]=p.split(':')[1].split('-').map(Number);
   const sequence=reverse?{33:'T',32:'A',31:'C',30:'C',14:'G',13:'G',12:'C',11:'G',10:'A'}:{10:'A',11:'T',12:'G',13:'G',30:'C',31:'C',32:'G',33:'C',34:'T'};
   return route.fulfill({json:{data:{sequence:Array.from({length:end-start+1},(_,i)=>sequence[start+i]||'A').join('')}}});
  }
  return route.fulfill({json:{data:{gencode_v44:features()},layers_resolved:[]}});
 });
 const open=()=>page.goto(base+'/genomics/view/hg38/chr1:1-40?layers=gencode_v44&showCodons=1');
 await open();const track=page.locator('[data-track-id="Codons"]');
 await track.locator('[data-codon="ATG"]').waitFor();assert.deepEqual(await track.locator('[data-aa]').evaluateAll(es=>es.map(e=>e.dataset.aa)),['M','A','A']);
 const colors=await track.locator('[data-aa="A"] rect').evaluateAll(es=>es.map(e=>e.getAttribute('fill')));assert(colors.every(c=>c===colors[0]));
 assert.equal(await track.locator('[data-aa]').count(),3);assert.equal(await track.locator('rect').count(),4,'split codon must have separate exon segments');
 const lane=await page.locator('.viewer-sequence-direction').boundingBox(),sequence=await page.getByRole('img',{name:/Forward reference sequence/}).boundingBox();assert(lane.y+lane.height<=sequence.y+.5);
 const title=await page.locator('.viewer-biophysics-title').boundingBox(),provenance=await page.locator('.viewer-layer-provenance summary').boundingBox();assert(Math.abs(title.y-provenance.y)<8,'provenance is not inline');
 await page.getByLabel('Coding transcript',{exact:true}).selectOption('TX.1');assert.equal(new URL(page.url()).searchParams.get('transcript'),'TX.1');await page.reload();await track.locator('[data-codon="ATG"]').waitFor();assert.equal(await page.getByLabel('Coding transcript',{exact:true}).inputValue(),'TX.1');
 reverse=true;await open();await track.locator('[data-codon="ATG"]').waitFor();assert.equal(await track.locator('[data-aa]').first().getAttribute('data-aa'),'M');
 missingStart=true;await open();await page.getByText('Reading phase unavailable:',{exact:false}).waitFor();assert.equal(await track.locator('[data-aa]').count(),0);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: inline provenance, separated strand labels, CDS-only amino acids, split codons, reverse complement, stable colors, transcript sharing and unknown phase.');
})().catch(e=>{console.error(e);process.exit(1)});
