/* Start a production preview first. BASE_URL defaults to http://127.0.0.1:3122. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:3122';
const output = process.env.VIEWER_TEST_OUTPUT || '/private/tmp/polymer-viewer-reliability';
fs.mkdirSync(output, { recursive: true });
const empty = { class: 'GRanges', seqnames: [], ranges: {start: [], end: [], width: []}, strand: [], mcols: {}, n: 0 };
(async () => {
 const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
 const context = await browser.newContext({permissions:['clipboard-read','clipboard-write'], viewport:{width:1440,height:1000}});
 let delay = 0, fail = false, noLayers = false;const errors=[];
 async function fixtures(route){
  const url = new URL(route.request().url()), p=url.pathname;
  if(p.endsWith('/v1/layers'))return route.fulfill({json:{data:{layers:noLayers ? [] : [{layer_key:'cpg_sites',name:'CpG Sites',version:'fixture',build:'hg38',type:'cpg',row_count:2,is_default:true}]}}});
  if(p.includes('/layers/summary'))return route.fulfill({json:{data:{build:'hg38',layer_counts:{cpg_sites:2},gene_features:{},protein_coding_genes:0,total_genes:0}}});
  if(delay)await new Promise(r=>setTimeout(r,delay));
  if(fail)return route.fulfill({status:503,json:{error:{message:'Fixture service unavailable'}}});
  if(p.includes('/sequence/'))return route.fulfill({json:{data:{sequence:'GCGCATAT'.repeat(25),length:200}}});
  if(p.includes('/biophysics/')){
   const start=Number(p.split(':')[1].split('-')[0]);
   return route.fulfill({json:{status:'complete',data:{seqnames:['chr17','chr17'],ranges:{start:[start,start+1],end:[start+1,start+2]},strand:['*','*'],n_steps:2,sequence_length:3,summaries:{},mcols:{delta_g_37:[-1.2,-2.1],curvature_curvature:[0.5,1.5],structural_deformability:[0,20]}}}});
  }
  const build=p.includes('/hg37/')?'hg37':'hg38';
  return route.fulfill({json:{status:'complete',data:{cpg_sites:empty},layers_resolved:[{layer_key:'cpg_sites',version:`fixture-${build}`,layer_id:'test',status:'active',evidence_class:'K',content_hash:null}]}});
 }
 await context.route('**/api/**',fixtures);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const open=async(region='chr17:7668421-7687490',query='layers=cpg_sites')=>{await page.goto(`${base}/genomics/view/hg38/${region}?${query}`);await page.locator('input').first().waitFor();};
 const input=()=>page.locator('input').first();
 await open();assert.equal(await input().inputValue(),'chr17:7,668,421-7,687,490');
 await page.reload();await page.getByTitle('Copy shareable link with active layers').waitFor();assert.equal(await input().inputValue(),'chr17:7,668,421-7,687,490');
 await page.getByRole('button',{name:'Pan right',exact:true}).click();await page.waitForTimeout(350);const panned=page.url();assert.notEqual(decodeURIComponent(panned).split('?')[0],`${base}/genomics/view/hg38/chr17:7668421-7687490`);
 await page.goBack();await page.waitForTimeout(150);assert.equal(await input().inputValue(),'chr17:7,668,421-7,687,490');
 await page.goForward();await page.waitForTimeout(150);assert.equal(page.url(),panned);
 await open('chr17:7668421-7687490','layers=&showGC=0&showStability=1&showStructure=1&showContext=0&cells=&motifs=TATA+Box');
 await page.getByTitle('Copy shareable link with active layers').click();const shared=await page.evaluate(()=>navigator.clipboard.readText());
 assert.equal(new URL(shared).searchParams.get('layers'),'');assert.equal(new URL(shared).searchParams.get('showContext'),'0');
 const other=await context.newPage();await other.goto(shared);await other.getByTitle('Copy shareable link with active layers').waitFor();assert.equal(new URL(other.url()).searchParams.get('cells'),'');await other.close();
 await page.getByRole('button',{name:'hg37',exact:true}).click();await page.getByRole('region',{name:'Confirm assembly change'}).waitFor();assert(page.url().includes('/hg38/'));
 await page.getByRole('button',{name:'Cancel',exact:true}).click();assert(page.url().includes('/hg38/'));
 await page.getByRole('button',{name:'hg37',exact:true}).click();await page.getByRole('button',{name:'Use same numeric coordinates'}).click();await page.waitForTimeout(200);assert(page.url().includes('/hg37/'));
 // Delayed data must not leave previous-locus values visible during loading.
 await open('chr17:1000-1199','layers=cpg_sites&showStructure=1');await page.getByText('Wedge-model curvature', {exact:false}).waitFor();await page.waitForTimeout(200);
 delay=700;await input().fill('chr17:2000-2199');await input().press('Enter');await page.getByText('Loading this region…',{exact:true}).waitFor();assert.equal(await page.getByRole('img',{name:/Wedge-model curvature/}).count(),0);
 await page.waitForTimeout(1100);delay=0;
 await page.getByRole('img',{name:/Wedge-model curvature/}).waitFor();
 const rulerBox=await page.locator('[data-testid=viewer-ruler] canvas').boundingBox();const curveBox=await page.getByRole('img',{name:/Wedge-model curvature/}).boundingBox();assert(Math.abs(rulerBox.x-curveBox.x)<1);assert(Math.abs(rulerBox.width-curveBox.width)<1);
 // Export returns a real PNG with pixels and provenance, not just a successful click.
 await page.getByRole('button',{name:'PNG',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('button[title="Export viewport as PNG"]').disabled);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'PNG',exact:true}).click();const download=await downloadPromise;
 const filename=path.join(output,'viewer.png');await download.saveAs(filename);const bytes=fs.readFileSync(filename);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert(bytes.length>5000);assert(bytes.readUInt32BE(16)>500);console.log('PNG bytes/dimensions',bytes.length,bytes.readUInt32BE(16),bytes.readUInt32BE(20));
 // Invalid deep links are not silently rewritten to another region.
 await page.goto(`${base}/genomics/view/hg38/chrM:1-16570`);await page.getByRole('heading',{name:'Unable to open this region'}).waitFor();assert(page.url().endsWith('chrM:1-16570'));
 await open('chrM:16560-16569');await page.getByRole('button',{name:'Pan right',exact:true}).click();await page.waitForTimeout(300);assert.equal(await input().inputValue(),'chrM:16,560-16,569');
 fail=true;await input().fill('chr17:8000000-8000199');await input().press('Enter');await page.getByText('Error loading data',{exact:true}).waitFor();assert.equal(await page.getByRole('img',{name:/Wedge-model curvature/}).count(),0);fail=false;
 // Each existing resolution band and build; fixture metadata identifies the returned assembly.
 for(const build of ['hg38','hg37'])for(const width of [100,1000,100000,1000000]){
  await page.goto(`${base}/genomics/view/${build}/chr17:100000-${100000+width-1}?layers=cpg_sites`);await page.getByText('Loaded layer provenance and availability').waitFor();
  await page.locator('details').last().evaluate(el=>el.open=true);
  await page.getByText(`cpg_sites · fixture-${build}`,{exact:false}).waitFor();
  await page.screenshot({path:path.join(output,`${build}-${width}.png`),fullPage:true});
 }
 noLayers=true;await page.goto(`${base}/genomics/view/hg37/chr17:100000-100999?layers=cpg_sites`);await page.getByText('Not available in this assembly’s layer registry:',{exact:false}).waitFor();noLayers=false;
 for(const width of [768,390,360]){
  await page.setViewportSize({width,height:900});await open();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
 }
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: direct/reload/history/fresh-tab state, empty layers, build confirmation, stale-data guard, PNG, invalid links, contig end, 8 build/scale cases and responsive layouts.');
})().catch(e=>{console.error(e);process.exit(1)});
