import type { GRanges } from './api';
import { CODON_TABLE } from '../components/atlas/GeneProfileData';

export interface CodingBlock { start: number; end: number; offset: number; }
export interface CodingTranscript { id: string; gene: string; chr: string; strand: '+' | '-'; blocks: CodingBlock[]; length: number; anchored: boolean; }
export interface CodingCodon { index: number; positions: number[]; }
export const AMINO_ACID_COLORS: Record<string, string> = Object.fromEntries(
  [...'ACDEFGHIKLMNPQRSTVWY*X'].map((aa, i) => [aa, `hsl(${(i * 137.508) % 360} 55% 85%)`]),
);
export function codingPosition(tx: CodingTranscript, offset: number): number | null {
  const block = tx.blocks.find(b => offset >= b.offset && offset < b.offset + b.end - b.start + 1);
  return block ? tx.strand === '+' ? block.start + offset - block.offset : block.end - (offset - block.offset) : null;
}
/** Only CDS features participate. A complete annotated start anchors the phase. */
export function codingTranscripts(data: GRanges): CodingTranscript[] {
  const groups = new Map<string, { tx: CodingTranscript; cds: {start:number;end:number}[]; starts:Set<number> }>();
  for (let i=0; i<data.n; i++) {
    const id=data.mcols.transcript_id?.[i], strand=data.strand[i];
    if (typeof id !== 'string' || !['+','-'].includes(strand)) continue;
    let group=groups.get(id);
    if (!group) {
      group={tx:{id,gene:String(data.mcols.gene_symbol?.[i]??''),chr:data.seqnames[i],strand:strand as '+'|'-',blocks:[],length:0,anchored:false},cds:[],starts:new Set()};groups.set(id,group);
    }
    const type=String(data.mcols.feature_type?.[i]??'').toLowerCase(), start=data.ranges.start[i],end=data.ranges.end[i];
    if (type==='cds') group.cds.push({start,end});
    if (type==='start_codon' && end-start<3) for(let p=start;p<=end;p++) group.starts.add(p);
  }
  const result: CodingTranscript[]=[];
  for(const {tx,cds,starts} of groups.values()) {
    const unique=[...new Map(cds.map(b=>[`${b.start}:${b.end}`,b])).values()].sort((a,b)=>tx.strand==='+'?a.start-b.start:b.end-a.end);
    if(!unique.length)continue;
    // Overlapping CDS blocks within one transcript are not a valid linear projection.
    const genomic=[...unique].sort((a,b)=>a.start-b.start);
    if(genomic.some((b,i)=>i>0&&b.start<=genomic[i-1].end))continue;
    for(const block of unique){tx.blocks.push({...block,offset:tx.length});tx.length+=block.end-block.start+1;}
    tx.anchored=[0,1,2].every(offset=>starts.has(codingPosition(tx,offset)??-1));
    result.push(tx);
  }
  return result.sort((a,b)=>b.length-a.length||a.id.localeCompare(b.id));
}
export function visibleCodingCodons(tx: CodingTranscript, start: number, end: number): CodingCodon[] {
  if(!tx.anchored)return [];
  const indexes=new Set<number>();
  for(const block of tx.blocks){
    const lo=Math.max(start,block.start),hi=Math.min(end,block.end);if(lo>hi)continue;
    const first=block.offset+(tx.strand==='+'?lo-block.start:block.end-hi);
    const last=block.offset+(tx.strand==='+'?hi-block.start:block.end-lo);
    for(let i=Math.floor(first/3);i<=Math.floor(last/3);i++)indexes.add(i);
  }
  return [...indexes].sort((a,b)=>a-b).flatMap(index=>{
    const positions=[0,1,2].map(i=>codingPosition(tx,index*3+i));
    return positions.every(p=>p!==null)?[{index,positions:positions as number[]}]:[];
  });
}
export function readCodingCodon(tx: CodingTranscript, codon: CodingCodon, bases: Map<number,string>) {
  const complement:Record<string,string>={A:'T',T:'A',G:'C',C:'G',N:'N'};
  const sequence=codon.positions.map(p=>{const base=bases.get(p)?.toUpperCase();return base?(tx.strand==='-'?complement[base]??'N':base):'?';}).join('');
  const mitochondrial:Record<string,string>={ATA:'M',TGA:'W',AGA:'*',AGG:'*'};
  const aa=sequence.includes('?')?'?':(tx.chr==='chrM'?mitochondrial[sequence]:undefined)??CODON_TABLE[sequence]??'X';
  return {sequence,aa,color:AMINO_ACID_COLORS[aa]??'#e4e4e7'};
}
