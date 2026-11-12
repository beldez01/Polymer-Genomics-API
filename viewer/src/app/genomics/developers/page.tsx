import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { CodeBlock, InlineCode } from '@/components/docs/CodeBlock';
import { MCP_CONFIG, PYTHON_INSTALL, PYTHON_QUICKSTART, REST_QUICKSTART } from '@/config/developerQuickstart';

export const metadata: Metadata = {
  title: 'Developer quickstart — Polymer',
  description: 'Connect to Polymer through REST, the Python SDK, or a local MCP server.',
  alternates: { canonical: '/genomics/developers' },
};

export default function DevelopersPage() {
  return <main className="platform-page">
    <BrandBar sticky />
    <header className="platform-shell platform-intro">
      <p className="platform-eyebrow">Developers / REST · Python · MCP</p>
      <h1>Build with Polymer</h1>
      <p className="platform-deck">Use the same genomic reference data in your scripts, notebooks, and compatible AI agents.</p>
      <nav className="platform-button-row" aria-label="Developer quickstart sections">
        <a className="platform-text-link" href="#rest">REST request ↓</a>
        <a className="platform-text-link" href="#python">Python SDK ↓</a>
        <a className="platform-text-link" href="#mcp">MCP setup ↓</a>
      </nav>
    </header>
    <div className="platform-shell platform-developer-content">
      <section id="authentication" className="platform-section" aria-labelledby="auth-title">
        <p className="platform-eyebrow">Before you start</p><h2 id="auth-title">API access</h2>
        <p className="platform-prose">Set your API key as <InlineCode>POLYMER_API_KEY</InlineCode> in your environment. REST requests send it in the <InlineCode>X-API-Key</InlineCode> header. To request access, <a href="mailto:polymergenomics@gmail.com?subject=Polymer%20API%20access">contact Polymer</a>.</p>
        <p className="platform-prose">Examples use GRCh38 / hg38 and 1-based, inclusive coordinates. GRCh37 / hg19 is exposed as <InlineCode>hg37</InlineCode> in the API. Layer availability depends on the assembly; check <Link href="/genomics/data-sources">data sources</Link> before switching builds. Changing the build parameter does not convert coordinates.</p>
      </section>
      <section id="rest" className="platform-section" aria-labelledby="rest-title">
        <p className="platform-eyebrow">01 / REST</p><h2 id="rest-title">Make a region request</h2>
        <p className="platform-prose">Fetch CpG-site annotations for an interval around TP53. Inspect the response for coordinate conventions, data versions, and resolved layers.</p>
        <CodeBlock language="bash" code={REST_QUICKSTART} />
        <p className="platform-prose"><Link href="/genomics/docs#endpoints">Browse the endpoint reference →</Link></p>
      </section>
      <section id="python" className="platform-section" aria-labelledby="python-title">
        <p className="platform-eyebrow">02 / Python</p><h2 id="python-title">Bring a region into your notebook</h2>
        <p className="platform-prose">Install the Python client, then make the same request. The client returns dictionaries; inspect the response before selecting fields.</p>
        <CodeBlock language="bash" code={PYTHON_INSTALL} />
        <div className="platform-code-gap"><CodeBlock language="python" code={PYTHON_QUICKSTART} /></div>
        <p className="platform-prose"><a href="https://github.com/beldez01/Polymer-Genomics-API/tree/main/sdk/python">Python SDK source and examples ↗</a></p>
      </section>
      <section id="mcp" className="platform-section" aria-labelledby="mcp-title">
        <p className="platform-eyebrow">03 / MCP</p><h2 id="mcp-title">Connect a compatible agent</h2>
        <p className="platform-prose">Install <a href="https://docs.astral.sh/uv/getting-started/installation/">uv</a> first; its <InlineCode>uvx</InlineCode> command runs the Polymer MCP package. Copy the local stdio configuration into a client that accepts <InlineCode>mcpServers</InlineCode> entries.</p>
        <CodeBlock language="json" code={MCP_CONFIG} />
        <p className="platform-prose">Merge this entry into your client’s MCP configuration, replace <InlineCode>YOUR_API_KEY</InlineCode> with your key, then reload the client. Confirm that the Polymer tools appear before making requests. Client configuration formats may differ.</p>
        <p className="platform-prose"><Link href="/genomics/docs#mcp">Explore the MCP tool reference →</Link></p>
      </section>
    </div>
    <Footer />
  </main>;
}
