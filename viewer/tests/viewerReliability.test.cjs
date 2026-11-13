const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');const memo=new Map();
function load(target){
 if(!path.extname(target))target+=fs.existsSync(target+'.ts')?'.ts':'.json';
 if(target.endsWith('.json'))return JSON.parse(fs.readFileSync(target,'utf8'));
 if(memo.has(target))return memo.get(target).exports;
 const module={exports:{}};memo.set(target,module);
 const code=ts.transpileModule(fs.readFileSync(target,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const local=id=>id.startsWith('@/')?load(path.resolve(__dirname,'../src',id.slice(2))):id.startsWith('.')?load(path.resolve(path.dirname(target),id)):require(id);
 new Function('require','module','exports',code)(local,module,module.exports);return module.exports;
}
const source=file=>load(path.resolve(__dirname,'../src',file));
const {boundedRegion,validRegion,normalizeContig,contigLength}=source('lib/reference.ts');
const {parseViewerUrl,serializeViewerState}=source('lib/viewerState.ts');const {useViewport}=source('stores/viewport.ts');
const {pixelToGenomic,genomicToPixel}=source('lib/coordinates.ts');const {gcWindow,finiteExtent}=source('lib/quantitative.ts');
test('assembly boundaries, aliases, single bases and contig ends',()=>{
 assert.equal(contigLength('hg38','chr1'),248956422);assert.equal(contigLength('hg37','chr1'),249250621);
 assert.equal(contigLength('hg38','chrY'),57227415);assert.equal(contigLength('hg37','chrY'),59373566);
 assert.equal(normalizeContig('MT'),'chrM');assert.equal(normalizeContig('x'),'chrX');
 assert(validRegion('hg38','chrM',16569,16569));assert(!validRegion('hg38','chrM',16569,16570));
 for(const args of [['chr1',0,1],['chr1',2,1],['chr23',1,2],['chr1',NaN,2]])assert(!validRegion('hg38',...args));
 assert.deepEqual(boundedRegion('hg38','chrM',16560,16659),{chr:'chrM',start:16470,end:16569,width:100});
});
test('pan/zoom stay bounded and preserve exact widths on both builds',()=>{
 for(const build of ['hg38','hg37'])for(const chr of ['chr1','chrY','chrM']){
  useViewport.setState({build});useViewport.getState().setRegion(chr,contigLength(build,chr)-9,contigLength(build,chr));
  useViewport.getState().panRight();assert.equal(useViewport.getState().end,contigLength(build,chr));assert.equal(useViewport.getState().width,10);
  useViewport.getState().zoomIn();assert.equal(useViewport.getState().width,5);useViewport.getState().zoomOut();assert.equal(useViewport.getState().width,10);
  useViewport.getState().setRegion(chr,-100,-91);assert.equal(useViewport.getState().start,1);assert.equal(useViewport.getState().width,10);
 }
});
test('URL roundtrip retains empty lists, flags, context, order and legacy defaults',()=>{
 const state=parseViewerUrl('/genomics/view/hg38/chr17:7668421-7687490','?layers=&showGC=0&showStability=1&showContext=0&cells=&motifs=TATA+Box');
 assert.deepEqual(state.activeLayers,[]);assert.equal(state.showGC,false);assert.equal(state.showStability,true);assert.equal(state.showContext,false);assert.deepEqual(state.visibleCellTypes,[]);
 const [p,q]=serializeViewerState(state).split('?');assert.deepEqual(parseViewerUrl(p,q),state);
 assert.deepEqual(parseViewerUrl('/genomics/view/hg37/chrX:1-1','?layers=b,a').activeLayers,['b','a']);
 const legacy=parseViewerUrl('/genomics/view/hg38/chr1:1-1','');assert.equal(legacy.showGC,true);assert.equal(legacy.showStability,false);
});
test('invalid loci and unknown state versions fail rather than silently substituting',()=>{
 for(const [p,q] of [['/genomics/view/hg38/chr1:0-1',''],['/genomics/view/hg38/chrM:1-16570',''],['/genomics/view/CHM13/chr1:1-2',''],['/genomics/view/hg38/chr1:1-2','?v=2'],['/genomics/view/hg38/chr1:1-2','?showGC=oops']])assert.throws(()=>parseViewerUrl(p,q));
});
test('pixel hit testing includes both edges without reporting end+1',()=>{
 assert.equal(pixelToGenomic(0,100,199,1000),100);assert.equal(pixelToGenomic(1000,100,199,1000),199);
 for(let p=100;p<=199;p++)assert.equal(pixelToGenomic(genomicToPixel(p,100,199,1000)+5,100,199,1000),p);
});
test('missing quantitative values differ from zero and constant series',()=>{
 assert.equal(gcWindow('NNN',0,3),null);assert.equal(gcWindow('AATT',0,4),0);assert.equal(gcWindow('GCNN',0,4),1);
 assert.equal(finiteExtent([null,undefined,NaN]),null);assert.deepEqual(finiteExtent([0,0,null]),{min:0,max:0,count:2});
});

test('dense display bins preserve extrema and missingness while reducing alternating noise to the mean',()=>{
 const {displaySeries}=source('lib/quantitative.ts');
 const starts=Array.from({length:1000},(_,i)=>i+1), ends=starts.map(p=>p+1);
 const values=starts.map((_,i)=>i%2===0?-2:0);
 const series=displaySeries(values,starts,ends,1,1001,300);
 assert(series.points.length<=100);assert(series.aggregated);assert.equal(series.rawMin,-2);assert.equal(series.rawMax,0);
 assert(series.extent.max-series.extent.min<.3);assert.equal(series.count,1000);
 const gaps=displaySeries([0,null,2],[1,50,100],[1,50,100],1,100,300);
 assert.equal(gaps.points[0].value,0);assert.equal(gaps.points[49],null);assert.equal(gaps.points[99].value,2);
});

test('coding projection skips UTR/introns and preserves split codons on both strands',()=>{
 const {codingTranscripts,visibleCodingCodons,readCodingCodon}=source('lib/coding.ts');
 function featureSet(strand,records){return {class:'GRanges',n:records.length,seqnames:records.map(()=>'chr1'),strand:records.map(()=>strand),ranges:{start:records.map(r=>r[1]),end:records.map(r=>r[2]),width:records.map(r=>r[2]-r[1]+1)},mcols:{feature_type:records.map(r=>r[0]),transcript_id:records.map(()=>'TX.1'),gene_symbol:records.map(()=>'TEST')}};}
 const plus=codingTranscripts(featureSet('+',[['exon',1,20],['UTR',1,9],['cds',10,13],['cds',30,34],['start_codon',10,12]]))[0];
 assert(plus.anchored);assert.equal(plus.length,9);
 const codons=visibleCodingCodons(plus,10,34);assert.deepEqual(codons.map(c=>c.positions),[[10,11,12],[13,30,31],[32,33,34]]);
 assert.deepEqual(visibleCodingCodons(plus,14,29),[]);
 const sequence=new Map([[10,'A'],[11,'T'],[12,'G'],[13,'G'],[30,'C'],[31,'C'],[32,'G'],[33,'C'],[34,'T']]);
 assert.equal(readCodingCodon(plus,codons[0],sequence).aa,'M');
 assert.equal(readCodingCodon(plus,codons[1],sequence).aa,'A');assert.equal(readCodingCodon(plus,codons[1],sequence).color,readCodingCodon(plus,codons[2],sequence).color);
 const minus=codingTranscripts(featureSet('-',[['cds',30,33],['cds',10,14],['start_codon',31,33]]))[0];
 const minusCodons=visibleCodingCodons(minus,10,33);assert.deepEqual(minusCodons.map(c=>c.positions),[[33,32,31],[30,14,13],[12,11,10]]);
 assert.equal(readCodingCodon(minus,minusCodons[0],new Map([[33,'T'],[32,'A'],[31,'C']])).sequence,'ATG');
 const unknown=codingTranscripts(featureSet('+',[['exon',10,50],['cds',10,20]]))[0];assert.equal(unknown.anchored,false);assert.deepEqual(visibleCodingCodons(unknown,10,20),[]);
});
