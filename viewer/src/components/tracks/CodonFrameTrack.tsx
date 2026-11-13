'use client';
import { useMemo } from 'react';
import { fetchGene, fetchSequence, type GRanges } from '@/lib/api';
import { codingTranscripts, visibleCodingCodons, readCodingCodon } from '@/lib/coding';
import { useLocusRequest } from '@/hooks/useLocusRequest';
import { useViewport } from '@/stores/viewport';
import { genomicToPixel } from '@/lib/coordinates';

export interface CodonFrameTrackProps {
  viewStart: number; viewEnd: number; canvasWidth: number; sequence?: string | null; sequenceStart?: number; features?: GRanges;
}
export function CodonFrameTrack({ viewStart, viewEnd, canvasWidth, sequence, sequenceStart, features }: CodonFrameTrackProps) {
  const build=useViewport(s=>s.build), chr=useViewport(s=>s.chr), selected=useViewport(s=>s.codonTranscript);
  const symbols=useMemo(()=>{
    const distances=new Map<string,number>(), center=(viewStart+viewEnd)/2;
    if(features)for(let i=0;i<features.n;i++){
      const symbol=features.mcols.gene_symbol?.[i];if(typeof symbol!=='string'||!symbol)continue;
      const distance=Math.max(features.ranges.start[i]-center,center-features.ranges.end[i],0);
      distances.set(symbol,Math.min(distance,distances.get(symbol)??Infinity));
    }
    return [...distances].sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0])).slice(0,4).map(([symbol])=>symbol);
  },[features,viewStart,viewEnd]);
  const {data:annotations,loading,error}=useLocusRequest(symbols.length?JSON.stringify([build,symbols]):null,
    signal=>Promise.all(symbols.map(symbol=>fetchGene(build,symbol,signal))));
  const transcripts=useMemo(()=> (annotations??[]).flatMap(response=>{
    const payload=response.data as unknown as GRanges;
    return payload.class==='GRanges'?codingTranscripts(payload):[];
  }).filter(tx=>tx.chr===chr).sort((a,b)=>Number(b.anchored)-Number(a.anchored)||b.length-a.length||a.id.localeCompare(b.id)),[annotations,chr]);
  const tx=selected?transcripts.find(tx=>tx.id===selected):transcripts[0];
  const codons=useMemo(()=>tx?visibleCodingCodons(tx,viewStart,viewEnd):[],[tx,viewStart,viewEnd]);
  const bufferedBases=useMemo(()=>{
    const result=new Map<number,string>();
    if(sequence){const origin=sequenceStart??viewStart;for(let i=0;i<sequence.length;i++)result.set(origin+i,sequence[i]);}
    return result;
  },[sequence,sequenceStart,viewStart]);
  const missing=useMemo(()=>[...new Set(codons.flatMap(c=>c.positions).filter(p=>!bufferedBases.has(p)))].sort((a,b)=>a-b),[codons,bufferedBases]);
  const missingRanges=useMemo(()=>{
    const ranges:{start:number;end:number}[]=[];
    for(const position of missing){const last=ranges[ranges.length-1];if(last&&position===last.end+1)last.end=position;else ranges.push({start:position,end:position});}
    return ranges;
  },[missing]);
  const sequenceKey=tx&&codons.length&&missing.length?JSON.stringify([build,chr,tx.id,sequence?missingRanges:[viewStart,viewEnd]]):null;
  const {data:fetchedBases,loading:sequenceLoading,error:sequenceError}=useLocusRequest(sequenceKey,async signal=>{
    const result=new Map<number,string>();
    const put=(start:number,text:string)=>{for(let i=0;i<text.length;i++)result.set(start+i,text[i]);};
    const ranges=sequence?missingRanges:[{start:viewStart,end:viewEnd},...missingRanges];
    await Promise.all(ranges.map(async range=>{
      const response=await fetchSequence(build,`${chr}:${range.start}-${range.end}`,signal);
      if(response.sequence.length!==range.end-range.start+1)throw new Error('Reference sequence length mismatch.');
      put(range.start,response.sequence);
    }));
    return result;
  });
  const bases=useMemo(()=>new Map([...bufferedBases,...(fetchedBases??new Map<number,string>())]),[bufferedBases,fetchedBases]);
  const drawableCodons=useMemo(()=>codons.filter(c=>c.positions.every(p=>bases.has(p))),[codons,bases]);
  const height=32, toX=(p:number)=>genomicToPixel(p,viewStart,viewEnd,canvasWidth);
  const message=loading?'Loading coding transcripts…':error?'Coding annotation unavailable.':!features?'Enable gene annotations to locate coding exons.':!transcripts.length?'No annotated coding transcript at this locus.':!tx?'Choose a transcript present at this locus.':!tx.anchored?'Reading phase unavailable: no complete annotated start codon.':!codons.length?'No coding exon in this interval.':!drawableCodons.length&&sequenceLoading?'Loading reference codons…':!drawableCodons.length&&sequenceError?'Codon sequence unavailable.':null;
  return <div style={{minHeight:54}}>
    {transcripts.length>0&&<div className="viewer-codon-controls">
      <label htmlFor="viewer-coding-transcript">Coding transcript</label>
      <select id="viewer-coding-transcript" value={selected??''} onChange={e=>useViewport.setState({codonTranscript:e.target.value||null})}>
        <option value="">Auto: longest complete CDS</option>
        {transcripts.map(tx=><option key={tx.id} value={tx.id}>{tx.gene} · {tx.id} ({tx.strand}){tx.anchored?'':' · phase unavailable'}</option>)}
      </select>
      {tx&&<span className="viewer-track-copy" title={`${tx.gene} · ${tx.id} · ${tx.strand} strand; CDS-only projection, standard ${tx.chr==='chrM'?'vertebrate mitochondrial':'nuclear'} genetic code. Colors identify amino acids; * is stop.`}>{tx.gene} · {tx.id} · {tx.strand} · ℹ</span>}
    </div>}
    {message?<p className="viewer-track-copy" role="status" style={{margin:'5px 6px',fontSize:11}}>{message}</p>:
      <svg width={canvasWidth} height={height} role="img" aria-label={`Annotated coding frame for ${tx?.gene} ${tx?.id}, ${tx?.strand} strand; amino acids in coding exons only.`} style={{display:'block'}}>
        {tx&&drawableCodons.map(codon=>{
          const translated=readCodingCodon(tx,codon,bases);
          const positions=[...codon.positions].sort((a,b)=>a-b);
          const segments:{start:number;end:number}[]=[];
          for(const position of positions){const last=segments[segments.length-1];if(last&&position===last.end+1)last.end=position;else segments.push({start:position,end:position});}
          const visible=segments.map(segment=>({x:Math.max(0,toX(segment.start)),right:Math.min(canvasWidth,toX(segment.end+1))})).filter(s=>s.right>s.x);
          const widest=visible.reduce<(typeof visible)[number]|null>((best,segment)=>!best||segment.right-segment.x>best.right-best.x?segment:best,null);
          return <g key={codon.index} data-aa={translated.aa} data-codon={translated.sequence}>
            <title>{`${tx.id} · codon ${codon.index+1} · ${translated.sequence} → ${translated.aa} · ${codon.positions.map(p=>p.toLocaleString()).join(', ')} · ${tx.strand} strand`}</title>
            {visible.map((segment,i)=><rect key={i} x={segment.x+.5} y={3} width={Math.max(0,segment.right-segment.x-1)} height={26} rx={2} fill={translated.color} stroke="#a1a1aa" strokeWidth={.5}/>)}
            {widest&&widest.right-widest.x>=9&&<text x={(widest.x+widest.right)/2} y={20} textAnchor="middle" fill="#27272a" fontSize={12} fontWeight={600}>{translated.aa}</text>}
          </g>;
        })}
      </svg>}
  </div>;
}
