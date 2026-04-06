'use client';

import { useState, useEffect } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { fetchLayerSummary } from '@/lib/api';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE } from '@/config/theme';

interface DataSource {
  name: string;
  version: string;
  license: string;
  citation: string;
  url: string;
}

interface SourceCategory {
  category: string;
  sources: DataSource[];
}

const DATA_SOURCES: SourceCategory[] = [
  {
    category: 'Sequence & Assembly',
    sources: [
      { name: 'GRCh38 / hg38', version: 'GCA_000001405.15', license: 'Public Domain', citation: 'Genome Reference Consortium', url: 'https://www.ncbi.nlm.nih.gov/grc/human' },
      { name: 'GRCh37 / hg37', version: 'GCA_000001405.1', license: 'Public Domain', citation: 'Genome Reference Consortium', url: 'https://www.ncbi.nlm.nih.gov/grc/human' },
      { name: 'UCSC Genome Browser', version: '2024', license: 'Free for non-commercial use', citation: 'Kent et al., Genome Res 2002', url: 'https://genome.ucsc.edu' },
    ],
  },
  {
    category: 'Gene Annotation',
    sources: [
      { name: 'GENCODE', version: 'v44', license: 'CC0 1.0', citation: 'Frankish et al., Nucleic Acids Res 2021', url: 'https://www.gencodegenes.org' },
      { name: 'RefSeq', version: 'GCF_000001405.40', license: 'Public Domain', citation: 'O\'Leary et al., Nucleic Acids Res 2016', url: 'https://www.ncbi.nlm.nih.gov/refseq/' },
    ],
  },
  {
    category: 'Methylation & CpG',
    sources: [
      { name: 'Illumina EPIC v2 Manifest', version: 'v2.0', license: 'Illumina proprietary (free to use)', citation: 'Illumina Inc.', url: 'https://www.illumina.com' },
      { name: 'Illumina EPIC v1 Manifest', version: 'v1.0', license: 'Illumina proprietary (free to use)', citation: 'Pidsley et al., Genome Biol 2016', url: 'https://www.illumina.com' },
      { name: 'Illumina 450K Manifest', version: 'v1.2', license: 'Illumina proprietary (free to use)', citation: 'Bibikova et al., Genomics 2011', url: 'https://www.illumina.com' },
      { name: 'UCSC CpG Islands', version: 'hg38', license: 'Free for non-commercial use', citation: 'Gardiner-Garden & Frommer 1987', url: 'https://genome.ucsc.edu' },
    ],
  },
  {
    category: 'Expression',
    sources: [
      { name: 'GTEx', version: 'v10', license: 'dbGaP (summary statistics: open access)', citation: 'GTEx Consortium, Science 2020', url: 'https://gtexportal.org' },
      { name: 'Human Protein Atlas', version: 'v23', license: 'CC BY-SA 3.0', citation: 'Uhlén et al., Science 2015', url: 'https://www.proteinatlas.org' },
      { name: 'PaxDb', version: 'v5.0', license: 'CC BY 4.0', citation: 'Wang et al., Mol Cell Proteomics 2015', url: 'https://pax-db.org' },
    ],
  },
  {
    category: 'Constraint & Variation',
    sources: [
      { name: 'gnomAD Constraint', version: 'v4.1', license: 'ODC-ODbL 1.0', citation: 'Chen et al., Nature 2024', url: 'https://gnomad.broadinstitute.org' },
      { name: 'gnomAD Structural Variants', version: 'v4.1', license: 'ODC-ODbL 1.0', citation: 'Collins et al., Nature 2020', url: 'https://gnomad.broadinstitute.org' },
      { name: 'ClinVar', version: '2024-09', license: 'Public Domain', citation: 'Landrum et al., Nucleic Acids Res 2020', url: 'https://www.ncbi.nlm.nih.gov/clinvar/' },
    ],
  },
  {
    category: 'Pathways & Gene Sets',
    sources: [
      { name: 'Reactome', version: 'v88', license: 'CC BY 4.0', citation: 'Gillespie et al., Nucleic Acids Res 2022', url: 'https://reactome.org' },
      { name: 'MSigDB Hallmark', version: 'v2024.1', license: 'CC BY 4.0', citation: 'Liberzon et al., Cell Syst 2015', url: 'https://www.gsea-msigdb.org' },
    ],
  },
  {
    category: 'Chromatin & Epigenomics',
    sources: [
      { name: 'ENCODE cCREs', version: 'v4', license: 'CC BY 4.0', citation: 'ENCODE Consortium, Nature 2012', url: 'https://www.encodeproject.org' },
      { name: 'ENCODE Histone Peaks', version: 'v3', license: 'CC BY 4.0', citation: 'ENCODE Consortium, Nature 2012', url: 'https://www.encodeproject.org' },
      { name: 'ENCODE TF Binding Sites', version: 'v3', license: 'CC BY 4.0', citation: 'ENCODE Consortium, Nature 2020', url: 'https://www.encodeproject.org' },
      { name: 'ENCODE Accessibility Signal', version: 'v3', license: 'CC BY 4.0', citation: 'ENCODE Consortium, Nature 2020', url: 'https://www.encodeproject.org' },
      { name: 'ChromHMM 15-state Model', version: '2012', license: 'Public Domain (NIH)', citation: 'Ernst & Kellis, Nat Methods 2012', url: 'https://compbio.mit.edu/ChromHMM/' },
      { name: 'Roadmap Epigenomics', version: '2015', license: 'Public Domain (NIH)', citation: 'Roadmap Consortium, Nature 2015', url: 'https://egg2.wustl.edu/roadmap/' },
    ],
  },
  {
    category: '3D Genome',
    sources: [
      { name: 'ENCODE TAD Domains', version: 'Arrowhead', license: 'CC BY 4.0', citation: 'Rao et al., Cell 2014', url: 'https://www.encodeproject.org' },
      { name: 'Hi-C A/B Compartments', version: 'v1', license: 'CC BY 4.0', citation: 'Lieberman-Aiden et al., Science 2009', url: 'https://www.encodeproject.org' },
      { name: 'Insulation Score', version: 'v1', license: 'CC BY 4.0', citation: 'Crane et al., Nature 2015', url: 'https://www.encodeproject.org' },
      { name: 'LADs', version: 'Meuleman 2013', license: 'Published literature', citation: 'Meuleman et al., Genome Res 2013', url: 'https://doi.org/10.1101/gr.141028.112' },
      { name: 'NADs', version: 'v1', license: 'Published literature', citation: 'Nemeth et al., PLoS Genet 2010', url: 'https://doi.org/10.1371/journal.pgen.1000889' },
    ],
  },
  {
    category: 'Biophysics & Thermodynamics',
    sources: [
      { name: 'SantaLucia NN Parameters', version: '1998/2004', license: 'Published literature', citation: 'SantaLucia, Proc Natl Acad Sci 1998; SantaLucia & Hicks, Annu Rev Biophys 2004', url: 'https://doi.org/10.1073/pnas.95.4.1460' },
      { name: 'Sugimoto RNA/DNA Parameters', version: '1995', license: 'Published literature', citation: 'Sugimoto et al., Biochemistry 1995', url: 'https://doi.org/10.1021/bi00035a029' },
      { name: 'Xia RNA Parameters', version: '1998', license: 'Published literature', citation: 'Xia et al., Biochemistry 1998', url: 'https://doi.org/10.1021/bi9809425' },
    ],
  },
  {
    category: 'Epigenetic Clocks',
    sources: [
      { name: 'Horvath Clock', version: '2013', license: 'Published literature', citation: 'Horvath, Genome Biol 2013', url: 'https://doi.org/10.1186/gb-2013-14-10-r115' },
      { name: 'Hannum Clock', version: '2013', license: 'Published literature', citation: 'Hannum et al., Mol Cell 2013', url: 'https://doi.org/10.1016/j.molcel.2012.10.016' },
      { name: 'PhenoAge', version: '2018', license: 'Published literature', citation: 'Levine et al., Aging 2018', url: 'https://doi.org/10.18632/aging.101414' },
      { name: 'GrimAge', version: '2019', license: 'Published literature', citation: 'Lu et al., Aging 2019', url: 'https://doi.org/10.18632/aging.101684' },
      { name: 'DunedinPACE', version: '2022', license: 'Published literature', citation: 'Belsky et al., eLife 2022', url: 'https://doi.org/10.7554/eLife.73420' },
    ],
  },
  {
    category: 'Mutations',
    sources: [
      { name: 'COSMIC SBS Signatures', version: 'v3.4', license: 'Free for non-commercial use', citation: 'Alexandrov et al., Nature 2020', url: 'https://cancer.sanger.ac.uk/signatures/' },
    ],
  },
  {
    category: 'Conservation & Evolution',
    sources: [
      { name: 'PhyloP 100-way', version: '2024', license: 'Free for non-commercial use', citation: 'Pollard et al., Genome Res 2010', url: 'https://genome.ucsc.edu' },
      { name: 'PhastCons 100-way', version: '2024', license: 'Free for non-commercial use', citation: 'Siepel et al., Genome Res 2005', url: 'https://genome.ucsc.edu' },
      { name: 'Ensembl Compara', version: 'v112', license: 'Apache 2.0', citation: 'Herrero et al., Database 2016', url: 'https://www.ensembl.org/info/genome/compara/' },
      { name: 'Ultraconserved Elements', version: 'Bejerano 2004', license: 'Published literature', citation: 'Bejerano et al., Science 2004', url: 'https://doi.org/10.1126/science.1098119' },
      { name: 'Human Accelerated Regions', version: 'v1', license: 'Published literature', citation: 'Pollard et al., Nature 2006', url: 'https://doi.org/10.1038/nature05113' },
      { name: 'Archaic Introgression', version: 'Vernot 2016', license: 'Published literature', citation: 'Vernot et al., Science 2016', url: 'https://doi.org/10.1126/science.aad9416' },
      { name: 'Selection Sweeps', version: 'v1', license: 'Published literature', citation: 'Sabeti et al., Nature 2007', url: 'https://doi.org/10.1038/nature06250' },
    ],
  },
  {
    category: 'Repeat Elements & Transposons',
    sources: [
      { name: 'RepeatMasker', version: 'v4.1.5', license: 'Free for non-commercial use via UCSC; Open Source', citation: 'Smit, Hubley & Green, RepeatMasker Open-4.0', url: 'https://www.repeatmasker.org' },
      { name: 'Telescope HERV Loci', version: 'v2', license: 'MIT', citation: 'Bendall et al., PLoS Comput Biol 2019', url: 'https://doi.org/10.1371/journal.pcbi.1006453' },
      { name: 'TE Exaptation Catalog', version: 'v1', license: 'CC BY 4.0', citation: 'Chuong et al., Nat Rev Genet 2017', url: 'https://doi.org/10.1038/nrg.2016.139' },
    ],
  },
  {
    category: 'GWAS',
    sources: [
      { name: 'EBI GWAS Catalog', version: 'v1.0.4', license: 'CC0 1.0', citation: 'Buniello et al., Nucleic Acids Res 2019', url: 'https://www.ebi.ac.uk/gwas/' },
    ],
  },
  {
    category: 'Cell-Type Methylation',
    sources: [
      { name: 'FlowSorted.Blood.EPIC', version: '2018', license: 'Artistic License 2.0', citation: 'Salas et al., Genome Biol 2018', url: 'https://bioconductor.org/packages/FlowSorted.Blood.EPIC/' },
      { name: 'WGBS Hematopoietic', version: 'BLUEPRINT', license: 'CC BY 4.0', citation: 'Stunnenberg et al., Cell 2016', url: 'https://doi.org/10.1016/j.cell.2016.10.026' },
      { name: 'Archaic Methylation', version: 'v1', license: 'Published literature', citation: 'Gokhman et al., Science 2014', url: 'https://doi.org/10.1126/science.1250368' },
    ],
  },
  {
    category: 'Protein Properties & Turnover',
    sources: [
      { name: 'UniProt', version: '2024_05', license: 'CC BY 4.0', citation: 'UniProt Consortium, Nucleic Acids Res 2023', url: 'https://www.uniprot.org' },
      { name: 'Protein Half-Lives', version: '2018', license: 'Published literature', citation: 'Mathieson et al., Nat Commun 2018', url: 'https://doi.org/10.1038/s41467-018-03106-1' },
    ],
  },
  {
    category: 'QTLs',
    sources: [
      { name: 'GTEx eQTLs', version: 'v8', license: 'dbGaP (summary statistics: open access)', citation: 'GTEx Consortium, Science 2020', url: 'https://gtexportal.org' },
      { name: 'GoDMC meQTLs', version: 'v1', license: 'Published literature', citation: 'Min et al., Nat Genet 2021', url: 'https://doi.org/10.1038/s41588-021-00969-x' },
    ],
  },
  {
    category: 'Regulatory Elements',
    sources: [
      { name: 'ABC Enhancer-Gene Links', version: 'v1', license: 'CC BY 4.0', citation: 'Fulco et al., Nat Genet 2019', url: 'https://doi.org/10.1038/s41588-019-0538-0' },
      { name: 'dbSUPER Super-Enhancers', version: 'v1', license: 'Published literature', citation: 'Khan & Zhang, Nucleic Acids Res 2016', url: 'https://doi.org/10.1093/nar/gkv1002' },
      { name: 'DNA Methylation Valleys', version: 'v1', license: 'Published literature', citation: 'Jeong et al., Genome Res 2014', url: 'https://doi.org/10.1101/gr.169219.113' },
    ],
  },
  {
    category: 'Recombination',
    sources: [
      { name: 'Crossover Hotspots', version: 'Palsson 2025', license: 'Published literature', citation: 'Palsson et al., Science 2025', url: 'https://doi.org/10.1126/science.adq0700' },
      { name: 'DMC1 Meiotic Hotspots', version: 'Pratto 2014', license: 'Published literature', citation: 'Pratto et al., Science 2014', url: 'https://doi.org/10.1126/science.1256442' },
    ],
  },
  {
    category: 'Structural DNA & Fragility',
    sources: [
      { name: 'Non-B DNA Structures', version: 'v1', license: 'MIT', citation: 'Polymer Genomics — G4, Z-DNA, cruciform, triplex, R-loop predictions', url: 'https://polymerbio.org' },
      { name: 'Fragility Composite Score', version: 'v1', license: 'MIT', citation: 'Polymer Genomics — integrated from non-B, stacking, curvature', url: 'https://polymerbio.org' },
      { name: 'COSMIC Breakpoints', version: 'v99', license: 'Free for non-commercial use', citation: 'Forbes et al., Nucleic Acids Res 2017', url: 'https://cancer.sanger.ac.uk/cosmic' },
    ],
  },
  {
    category: 'HLA',
    sources: [
      { name: 'IPD-IMGT/HLA Database', version: '3.55', license: 'CC BY 4.0', citation: 'Robinson et al., Nucleic Acids Res 2020', url: 'https://www.ebi.ac.uk/ipd/imgt/hla/' },
    ],
  },
  {
    category: 'Mutation Density',
    sources: [
      { name: 'PCAWG Mutation Rates', version: 'v1', license: 'CC BY 4.0', citation: 'ICGC/TCGA Pan-Cancer Analysis of Whole Genomes Consortium, Nature 2020', url: 'https://dcc.icgc.org/pcawg' },
    ],
  },
  {
    category: 'Computed Tracks',
    sources: [
      { name: 'Polymer Evolution Layer 0', version: 'v1.0', license: 'MIT', citation: 'Polymer Genomics — computed from SantaLucia/published parameters', url: 'https://polymerbio.org' },
    ],
  },
];

/* ── Layer key map: source name → API layer_counts key ── */

const LAYER_KEY_MAP: Record<string, string> = {
  'GRCh38 / hg38': 'genome_assembly',
  'GENCODE': 'gencode_v44',
  'Illumina EPIC v2 Manifest': 'probe_epic_v2',
  'Illumina EPIC v1 Manifest': 'probe_epic_v1',
  'Illumina 450K Manifest': 'probe_450k',
  'UCSC CpG Islands': 'cpg_islands',
  'GTEx': 'gtex_v10',
  'gnomAD Constraint': 'gene_constraint_v1',
  'gnomAD Structural Variants': 'gnomad_sv_v4',
  'ClinVar': 'clinvar_v1',
  'Reactome': 'reactome_pathways_v1',
  'MSigDB Hallmark': 'msigdb_hallmark_v1',
  'RepeatMasker': 'repeatmasker_v1',
  'Telescope HERV Loci': 'herv_loci_v1',
  'TE Exaptation Catalog': 'te_exaptation_encode_v1',
  'Horvath Clock': 'clock_horvath',
  'Hannum Clock': 'clock_hannum',
  'PhenoAge': 'clock_phenoage',
  'GrimAge': 'clock_grimage',
  'DunedinPACE': 'clock_dunedinpace',
  'COSMIC SBS Signatures': 'sbs_mutation_thermo_v1',
  'PhyloP 100-way': 'phylop_phastcons_100way',
  'PhastCons 100-way': 'phylop_phastcons_100way',
  'Ultraconserved Elements': 'ultraconserved_v1',
  'EBI GWAS Catalog': 'gwas_catalog_ebi_v1',
  'Human Protein Atlas': 'protein_atlas_v1',
  'PaxDb': 'protein_abundance_v1',
  'ENCODE cCREs': 'encode_ccre_v4',
  'ENCODE Histone Peaks': 'histone_peaks_encode_v1',
  'ENCODE TF Binding Sites': 'encode_tfbs_v1',
  'ENCODE Accessibility Signal': 'accessibility_signal',
  'ChromHMM 15-state Model': 'chromhmm_15state_v1',
  'ENCODE TAD Domains': 'tad_domain',
  'Hi-C A/B Compartments': 'hic_compartment',
  'Insulation Score': 'insulation_score',
  'LADs': 'lads_meuleman_v1',
  'ABC Enhancer-Gene Links': 'abc_enhancer_gene_v1',
  'dbSUPER Super-Enhancers': 'super_enhancers_dbsuper_v1',
  'GTEx eQTLs': 'gtex_eqtl_v8',
  'GoDMC meQTLs': 'godmc_meqtl_v1',
  'Non-B DNA Structures': 'nonb_dna',
  'Fragility Composite Score': 'fragility_composite',
  'COSMIC Breakpoints': 'breakpoints',
  'Crossover Hotspots': 'onco_events_v1',
  'DMC1 Meiotic Hotspots': 'dmc1_hotspots_v1',
  'WGBS Hematopoietic': 'wgbs_hematopoietic',
  'IPD-IMGT/HLA Database': 'hla_allele_features',
  'PCAWG Mutation Rates': 'mutation_density_pcawg',
  'Polymer Evolution Layer 0': 'sequence_biophysics_l0',
};

function formatRowCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const cellStyle = {
  padding: `${SPACE[2]}px ${SPACE[3]}px`,
  borderBottom: `1px solid ${COLOR.border.subtle}`,
  color: COLOR.text.secondary,
  fontSize: TYPE.sm.fontSize,
  fontFamily: FONT_FAMILY,
  lineHeight: 1.5,
  verticalAlign: 'top' as const,
};

const headerCellStyle = {
  ...cellStyle,
  color: COLOR.text.primary,
  fontWeight: WEIGHT.bold,
  borderBottom: `1px solid ${COLOR.border.strong}`,
  fontSize: TYPE.sm.fontSize,
  letterSpacing: '0.03em',
};

export default function DataSourcesPage() {
  const [layerCounts, setLayerCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const summary = await fetchLayerSummary('hg38');
        setLayerCounts(summary.layer_counts ?? {});
      } catch {
        // Keep empty — rows column will show "—"
      }
    })();
  }, []);

  return (
    <div style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandBar />

      <main style={{
        flex: 1,
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[10]}px ${SPACE[6]}px`,
        width: '100%',
      }}>
        <h1 style={{
          color: COLOR.accent.teal,
          fontSize: TYPE['2xl'].fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.08em',
          marginBottom: SPACE[2],
        }}>
          DATA SOURCES
        </h1>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.7,
          marginBottom: SPACE[4],
          maxWidth: 640,
        }}>
          Polymer Genomics aggregates data from the following public databases and published literature.
          Each source retains its original license. Please cite the original data providers when using
          their data in publications.
        </p>

        <div style={{
          backgroundColor: COLOR.bg.elevated,
          border: `1px solid ${COLOR.border.default}`,
          padding: SPACE[4],
          marginBottom: SPACE[10],
          lineHeight: 1.6,
        }}>
          <p style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            margin: 0,
            marginBottom: SPACE[3],
          }}>
            <strong style={{ color: COLOR.text.primary }}>Note on licenses:</strong>{' '}
            Human Protein Atlas data is licensed under CC BY-SA 3.0 (ShareAlike). Any derivative
            works incorporating HPA data must be shared under the same license.
            GTEx data served here consists of summary statistics (median TPM by tissue) and does
            not include individual-level data, which requires dbGaP authorization.
          </p>
          <p style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            margin: 0,
            marginBottom: SPACE[3],
          }}>
            <strong style={{ color: COLOR.text.primary }}>Non-commercial restrictions:</strong>{' '}
            Data sourced from UCSC Genome Browser (including PhyloP, PhastCons, RepeatMasker, and CpG Islands)
            carries a non-commercial use restriction. COSMIC SBS Signatures are also restricted to non-commercial use.
            gnomAD data is licensed under ODC-ODbL 1.0, which requires derivative databases to remain open.
          </p>
          <p style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            margin: 0,
          }}>
            <strong style={{ color: COLOR.text.primary }}>Epigenetic clock IP:</strong>{' '}
            Some epigenetic clocks are protected by patents (e.g., GrimAge: US Patent 10,706,957).
            DunedinPACE may have separate intellectual property protections.
            Clock probe annotations served here are for informational and reference purposes only.
            Computation of epigenetic age using these coefficients may require separate licensing
            from the respective intellectual property holders.
          </p>
        </div>

        {DATA_SOURCES.map((cat) => (
          <div key={cat.category} style={{ marginBottom: SPACE[10] }}>
            <h2 style={{
              color: COLOR.text.primary,
              fontSize: TYPE.md.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.bold,
              marginBottom: SPACE[4],
              letterSpacing: '0.02em',
            }}>
              {cat.category}
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}>
                <thead>
                  <tr>
                    <th style={{ ...headerCellStyle, width: '20%', textAlign: 'left' }}>Source</th>
                    <th style={{ ...headerCellStyle, width: '10%', textAlign: 'left' }}>Version</th>
                    <th style={{ ...headerCellStyle, width: '10%', textAlign: 'right' }}>Rows</th>
                    <th style={{ ...headerCellStyle, width: '18%', textAlign: 'left' }}>License</th>
                    <th style={{ ...headerCellStyle, width: '42%', textAlign: 'left' }}>Citation</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.sources.map((src) => (
                    <tr key={src.name}>
                      <td style={cellStyle}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: COLOR.accent.teal, textDecoration: 'none' }}
                        >
                          {src.name}
                        </a>
                      </td>
                      <td style={cellStyle}>{src.version}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {(() => {
                          const key = LAYER_KEY_MAP[src.name];
                          if (!key) return '\u2014';
                          const count = layerCounts[key];
                          return count != null ? formatRowCount(count) : '\u2014';
                        })()}
                      </td>
                      <td style={cellStyle}>{src.license}</td>
                      <td style={cellStyle}>{src.citation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </main>

      <Footer />
    </div>
  );
}
