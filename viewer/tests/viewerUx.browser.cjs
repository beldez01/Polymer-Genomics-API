const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:3125';const output=process.env.VIEWER_TEST_OUTPUT||'/private/tmp/polymer-viewer-ux';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 const page=await browser.newPage({viewport:{width:1100,height:430}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let computeRequests=0,delay=0;
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p.endsWith('/v1/layers'))return route.fulfill({json:{data:{layers:[{layer_key:'cpg_sites',name:'CpG Sites',build:'hg38',version:'fixture'}]}}});
  if(p.includes('/layers/summary'))return route.fulfill({json:{data:{layer_counts:{},gene_features:{}}}});
  if(p.includes('/biophysics/')){
   computeRequests++;if(delay)await new Promise(r=>setTimeout(r,delay));
   const [start,end]=p.split(':')[1].split('-').map(Number), n=end-start;
   const starts=Array.from({length:n},(_,i)=>start+i);
   return route.fulfill({json:{data:{n_steps:n,sequence_length:n+1,seqnames:starts.map(()=>'chr17'),ranges:{start:starts,end:starts.map(s=>s+1)},strand:starts.map(()=>'*'),summaries:{},mcols:{delta_g_37:starts.map((_,i)=>i%2?-2:0),curvature_curvature:starts.map((_,i)=>1+.25*Math.sin(i/100)),structural_deformability:starts.map((_,i)=>i%2?0:43)}}}});
  }
  if(delay)await new Promise(r=>setTimeout(r,delay));
  return route.fulfill({json:{data:{},layers_resolved:[]}});
 });
 await page.goto(base+'/genomics/view/hg38/chr17:100000-119999?layers=cpg_sites&showStability=1&showStructure=1');
 const pane=page.getByTestId('viewer-track-scroll');const structure=page.locator('[data-track-id="Structure"]');
 await page.getByRole('img',{name:/Wedge-model curvature/}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('button[title="Export viewport as PNG"]').disabled);
 await pane.evaluate(el=>{const row=el.querySelector('[data-track-id="Structure"]');el.scrollTop=row.offsetTop-25;});await page.waitForTimeout(80);
 const before=await pane.evaluate(el=>({scroll:el.scrollTop,offset:el.querySelector('[data-track-id="Structure"]').getBoundingClientRect().top-el.getBoundingClientRect().top}));
 assert(before.scroll>0);
 const copyLines=await page.locator('.viewer-track-copy').evaluateAll(elements=>elements.map(el=>({height:el.clientHeight,lineHeight:parseFloat(getComputedStyle(el).lineHeight),nowrap:getComputedStyle(el).whiteSpace})));
 assert(copyLines.every(el=>el.nowrap==='nowrap'));assert(copyLines.every(el=>!Number.isFinite(el.lineHeight)||el.height<=el.lineHeight+2));
 const coverage=await page.getByRole('img',{name:/DNA duplex formation/}).evaluate(canvas=>{const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);let blue=0;for(let i=0;i<data.length;i+=4)if(data[i]<60&&data[i+1]<160&&data[i+2]>200&&data[i+3]>200)blue++;return blue/(canvas.width*canvas.height);});assert(coverage<.15,`saturated dense plot ${coverage}`);
 delay=450;
 const immediate=await page.getByRole('button',{name:'Zoom out',exact:true}).evaluate(button=>{const t=performance.now();button.click();return {path:location.pathname,ms:performance.now()-t};});
 assert(decodeURIComponent(immediate.path).includes('90000-129999'));console.log('Navigation commit ms:',immediate.ms,'dense blue coverage:',coverage);
 await page.waitForTimeout(90);const during=await pane.evaluate(el=>el.scrollTop);assert(Math.abs(during-before.scroll)<3,`loading reset ${before.scroll} -> ${during}`);
 await page.waitForFunction(()=>!document.querySelector('button[title="Export viewport as PNG"]').disabled);
 const after=await pane.evaluate(el=>({scroll:el.scrollTop,offset:el.querySelector('[data-track-id="Structure"]').getBoundingClientRect().top-el.getBoundingClientRect().top}));
 assert(after.scroll>0);assert(Math.abs(after.offset-before.offset)<8,`track anchor changed ${before.offset} -> ${after.offset}`);
 delay=0;const requestsBefore=computeRequests;await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(120);assert.equal(computeRequests,requestsBefore,'recent-locus cache missed');
 await page.screenshot({path:output+'/dense-and-scrolled.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: single-line metadata, unsaturated dense plots, immediate zoom, scroll through loading, visible-track anchor and cached revisit.');
})().catch(e=>{console.error(e);process.exit(1)});
