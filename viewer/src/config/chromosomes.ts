export interface ChromosomeInfo {
  name: string;
  length: number;
  centromereStart: number;
  centromereEnd: number;
}

export const CHROMOSOMES: ChromosomeInfo[] = [
  { name: 'chr1',  length: 248956422,  centromereStart: 122026460, centromereEnd: 124932724 },
  { name: 'chr2',  length: 242193529,  centromereStart: 92188146,  centromereEnd: 94090557 },
  { name: 'chr3',  length: 198295559,  centromereStart: 90772459,  centromereEnd: 93655574 },
  { name: 'chr4',  length: 190214555,  centromereStart: 49708101,  centromereEnd: 51743951 },
  { name: 'chr5',  length: 181538259,  centromereStart: 46485901,  centromereEnd: 50059807 },
  { name: 'chr6',  length: 170805979,  centromereStart: 58553889,  centromereEnd: 59829934 },
  { name: 'chr7',  length: 159345973,  centromereStart: 58169654,  centromereEnd: 60828234 },
  { name: 'chr8',  length: 145138636,  centromereStart: 44033745,  centromereEnd: 45338887 },
  { name: 'chr9',  length: 138394717,  centromereStart: 43236168,  centromereEnd: 45518558 },
  { name: 'chr10', length: 133797422,  centromereStart: 39686683,  centromereEnd: 41593521 },
  { name: 'chr11', length: 135086622,  centromereStart: 51078349,  centromereEnd: 54425074 },
  { name: 'chr12', length: 133275309,  centromereStart: 34769408,  centromereEnd: 37185252 },
  { name: 'chr13', length: 114364328,  centromereStart: 16000000,  centromereEnd: 18051248 },
  { name: 'chr14', length: 107043718,  centromereStart: 16000000,  centromereEnd: 18173523 },
  { name: 'chr15', length: 101991189,  centromereStart: 17083675,  centromereEnd: 19725254 },
  { name: 'chr16', length: 90338345,   centromereStart: 36311159,  centromereEnd: 38265669 },
  { name: 'chr17', length: 83257441,   centromereStart: 22813680,  centromereEnd: 26616164 },
  { name: 'chr18', length: 80373285,   centromereStart: 15460900,  centromereEnd: 20861206 },
  { name: 'chr19', length: 58617616,   centromereStart: 24498981,  centromereEnd: 27190874 },
  { name: 'chr20', length: 64444167,   centromereStart: 26436233,  centromereEnd: 30038348 },
  { name: 'chr21', length: 46709983,   centromereStart: 10864561,  centromereEnd: 12915808 },
  { name: 'chr22', length: 50818468,   centromereStart: 12954789,  centromereEnd: 15054318 },
  { name: 'chrX',  length: 156040895,  centromereStart: 58605580,  centromereEnd: 62412542 },
  { name: 'chrY',  length: 57227415,   centromereStart: 10316945,  centromereEnd: 10544039 },
  { name: 'chrM',  length: 16569,      centromereStart: 0,         centromereEnd: 0 },
];

export const GENOME_LENGTH = CHROMOSOMES.reduce((sum, chr) => sum + chr.length, 0);

export function getChromosomeByName(name: string): ChromosomeInfo | undefined {
  return CHROMOSOMES.find(c => c.name === name);
}
