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

export default function PrivacyPage() {
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
          PRIVACY POLICY
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
          <h2 style={headingStyle}>Data Controller</h2>
          <p style={bodyStyle}>
            Polymer Genomics is the data controller for personal data processed through this platform.
            For data protection inquiries, contact:{' '}
            <a href="mailto:polymergenomics@gmail.com" style={{ color: COLOR.accent.teal, textDecoration: 'none' }}>
              polymergenomics@gmail.com
            </a>
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>What We Collect</h2>
          <p style={bodyStyle}>
            Polymer Genomics collects minimal data necessary to operate the service:
          </p>
          <ul style={{ ...bodyStyle, paddingLeft: SPACE[6], marginTop: 0 }}>
            <li style={{ marginBottom: SPACE[2] }}>
              <strong style={{ color: COLOR.text.primary }}>Server logs:</strong> IP address, request path, timestamp,
              and HTTP status code. These are retained for operational monitoring and abuse prevention.
            </li>
            <li style={{ marginBottom: SPACE[2] }}>
              <strong style={{ color: COLOR.text.primary }}>API keys:</strong> If you use an API key for authenticated access,
              the key and associated usage metadata are stored.
            </li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>What We Do Not Collect</h2>
          <p style={bodyStyle}>
            We do not store individual-level genomic data. This platform serves only publicly available
            reference annotations. No user-uploaded genomic data is processed or retained.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Cookies</h2>
          <p style={bodyStyle}>
            We do not use tracking or advertising cookies. The Vercel hosting platform may set strictly
            necessary cookies for load balancing and security. No third-party analytics are deployed.
            No data is shared with third parties for marketing or advertising purposes.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>GDPR (European Users)</h2>
          <p style={bodyStyle}>
            Our lawful bases for processing personal data are: (a) server logs — legitimate interest in
            maintaining service security and availability; (b) API key management — contract performance;
            (c) abuse prevention — legitimate interest. Under the GDPR, you have the right to:
          </p>
          <ul style={{ ...bodyStyle, paddingLeft: SPACE[6], marginTop: 0 }}>
            <li style={{ marginBottom: SPACE[2] }}>Access the personal data we hold about you</li>
            <li style={{ marginBottom: SPACE[2] }}>Request erasure of your data</li>
            <li style={{ marginBottom: SPACE[2] }}>Object to processing of your data</li>
            <li style={{ marginBottom: SPACE[2] }}>Request data portability</li>
          </ul>
          <p style={bodyStyle}>
            To exercise these rights, contact us at the address below.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>CCPA (California Users)</h2>
          <p style={bodyStyle}>
            Under the California Consumer Privacy Act, California residents have the right to know what
            personal information is collected, request deletion, and opt out of the sale of personal information.
            We do not sell personal information. To submit a request, contact us at the address below.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Cross-Border Data Transfer</h2>
          <p style={bodyStyle}>
            Our servers are located in the United States (Virginia). If you access the service from the
            EU/EEA/UK, your data is transferred to the US. We rely on Standard Contractual Clauses (SCCs)
            as the legal mechanism for such transfers.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Children</h2>
          <p style={bodyStyle}>
            This service is not directed at individuals under the age of 16. We do not knowingly collect
            personal data from children. If you believe we have inadvertently collected data from a child
            under 16, please contact us and we will promptly delete it.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Data Retention</h2>
          <p style={bodyStyle}>
            Server logs are retained for up to 90 days for operational purposes and then automatically deleted.
            Error logs are retained for 30 days. Database query logs are not retained beyond server logs.
            Computed analysis sessions (MCP) are retained until user requests deletion or 30 days of inactivity.
            API key records are retained for the duration of the key&rsquo;s active use and deleted upon request.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Contact</h2>
          <p style={bodyStyle}>
            For privacy-related requests or questions, contact:{' '}
            <a href="mailto:polymergenomics@gmail.com" style={{ color: COLOR.accent.teal, textDecoration: 'none' }}>
              polymergenomics@gmail.com
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
