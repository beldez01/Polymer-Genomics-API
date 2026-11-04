import type { Metadata } from 'next';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { Cta, SectionHeader, contentShell, sectionRule } from '@/components/company/Primitives';
import { COLOR, FONT_FAMILY_MONO, SPACE, TYPE } from '@/config/theme';

export const metadata: Metadata = {
  title: 'About — Polymer',
  description: 'The mission and people behind Polymer: making genomic reference data easier to explore, understand, and access programmatically.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About — Polymer', description: 'Making genomic reference data easier to explore, understand, and access programmatically.', url: '/about' },
};

export default function About() {
  return (
    <main className="platform-page">
      <BrandBar sticky />
      <header className="platform-shell platform-intro">
        <p className="platform-eyebrow">About Polymer</p>
        <h1>Making the genome easier to explore.</h1>
        <p className="platform-deck">Polymer brings genomic reference data and analysis tools into a shared interface, helping researchers move from whole-genome exploration to individual regions and programmatic analysis.</p>
      </header>
      <section className="platform-shell platform-section">
        <SectionHeader index="01" label="Mission" title="Connected data. Accessible tools." />
        <p className="platform-prose">Genomic research spans many scales, from the structure of a chromosome to the properties of a sequence. Polymer connects these perspectives through a genome browser, a digital karyotype, and tools for working with genomic data.</p>
        <p className="platform-prose">The same platform supports exploration in the browser and programmatic access through the API, with documentation and data sources close at hand.</p>
      </section>
      <section id="founder" style={{ ...contentShell, ...sectionRule }}>
        <SectionHeader
          index="02"
          label="Founder"
          title="Zachary Belden, MD"
          body="Board-certified clinical pathologist and fellowship-trained molecular genetic pathologist, with laboratory and computational experience across assay development and genomics."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: SPACE[4],
        }}>
          {([
            ['Clinical', 'Clinical pathology · molecular genetic pathology'],
            ['Laboratory', 'Assay development and validation'],
            ['Computational', 'Genomics infrastructure and tooling'],
          ] as [string, string][]).map(([heading, detail]) => (
            <div key={heading} style={{
              padding: SPACE[5],
              borderTop: `2px solid ${COLOR.primary.base}`,
              backgroundColor: COLOR.bg.elevated,
            }}>
              <div style={{
                color: COLOR.text.faint,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: SPACE[3],
              }}>
                {heading}
              </div>
              <div style={{
                color: COLOR.text.secondary,
                fontSize: TYPE.base.fontSize,
                lineHeight: TYPE.base.lineHeight,
              }}>
                {detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="platform-shell platform-section">
        <SectionHeader index="03" label="Contact" title="Get in touch" body="Questions, feedback, or ideas for collaboration? We'd like to hear from you." />
        <Cta href="mailto:polymergenomics@gmail.com?subject=Polymer%20inquiry" primary>polymergenomics@gmail.com</Cta>
      </section>
      <Footer />
    </main>
  );
}
