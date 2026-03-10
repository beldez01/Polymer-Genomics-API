'use client';

import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE } from '@/config/theme';

const sectionStyle = {
  marginBottom: SPACE[8],
};

const headingStyle = {
  color: COLOR.text.primary,
  fontSize: TYPE.md.fontSize,
  fontFamily: FONT_FAMILY,
  fontWeight: WEIGHT.bold,
  marginBottom: SPACE[3],
  letterSpacing: '0.02em',
};

const bodyStyle = {
  color: COLOR.text.secondary,
  fontSize: TYPE.base.fontSize,
  fontFamily: FONT_FAMILY,
  lineHeight: 1.7,
  marginBottom: SPACE[3],
};

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandBar />

      <main style={{
        flex: 1,
        maxWidth: 720,
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
          TERMS OF SERVICE
        </h1>
        <p style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[10],
        }}>
          Last updated: March 2026
        </p>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Research Use Only</h2>
          <p style={bodyStyle}>
            Polymer Genomics is provided exclusively for research, educational, and informational purposes.
            This platform is <strong style={{ color: COLOR.text.primary }}>not intended for clinical or diagnostic use</strong>.
            It is not a medical device and has not been reviewed, approved, or cleared by the U.S. Food and Drug Administration
            (FDA) or any other regulatory agency.
          </p>
          <p style={bodyStyle}>
            Do not use data from this platform as a substitute for professional medical advice, diagnosis, or treatment.
            Reference assembly coordinates may differ from clinical-grade annotations.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>No Warranty</h2>
          <p style={bodyStyle}>
            This platform and all data served through it are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
            without warranty of any kind, express or implied, including but not limited to the warranties of merchantability,
            fitness for a particular purpose, accuracy, completeness, or non-infringement.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Data and Redistribution</h2>
          <p style={bodyStyle}>
            Polymer Genomics aggregates data from multiple public genomic databases, each with its own license.
            Users may query and use results for research purposes. Bulk redistribution of data obtained from this
            platform requires compliance with all upstream data licenses. See the{' '}
            <a href="/data-sources" style={{ color: COLOR.accent.teal, textDecoration: 'none' }}>Data Sources</a>{' '}
            page for a complete list of sources and their license terms.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Fair Use and Rate Limiting</h2>
          <p style={bodyStyle}>
            Access to the API is subject to rate limiting to ensure availability for all users.
            Automated scraping, bulk downloading, or any activity that degrades service performance is prohibited
            without prior written authorization. We reserve the right to throttle or block access that
            violates fair use.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Service Availability</h2>
          <p style={bodyStyle}>
            We reserve the right to modify, suspend, or discontinue the service (or any part thereof)
            at any time, with or without notice. We shall not be liable to you or any third party for
            any modification, suspension, or discontinuance of the service.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Indemnification</h2>
          <p style={bodyStyle}>
            You agree to indemnify, defend, and hold harmless Polymer Genomics, its operators, and contributors
            from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your
            use of the platform or violation of these terms.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Governing Law</h2>
          <p style={bodyStyle}>
            These terms shall be governed by and construed in accordance with the laws of the State of California,
            United States, without regard to conflict of law principles.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Changes to Terms</h2>
          <p style={bodyStyle}>
            We may update these terms from time to time. Continued use of the platform constitutes acceptance
            of any revised terms. Material changes will be noted by updating the date at the top of this page.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
