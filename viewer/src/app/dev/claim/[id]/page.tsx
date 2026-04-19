/**
 * Dev-only single-claim visualizer (M1.1).
 *
 * Reads a FormalClaim fixture from internal/epistemic_os/fixtures/ on disk
 * and renders all 5 panels. Dev-only; 404s in production.
 *
 * Route: /dev/claim/[id]
 *   • /dev/claim/exp17 → loads exp17_formal_claim.json (convenience alias)
 *   • /dev/claim/<any-fixture-basename-sans-ext> → loads that file
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';

import { FormalClaimView } from '@/components/FormalClaim/FormalClaimView';
import type { FormalClaim } from '@/config/formal_claims';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';   // always re-read the fixture on refresh
export const revalidate = 0;

const ALIASES: Record<string, string> = {
  exp17: 'exp17_formal_claim',
};

function repoRoot(): string {
  // viewer/ is the cwd under `next dev`; repo root is one level up.
  return path.resolve(process.cwd(), '..');
}

function legacyFixturesDir(): string {
  return path.join(repoRoot(), 'internal', 'epistemic_os', 'fixtures');
}

function inSilicoRoot(): string {
  return path.join(repoRoot(), 'internal', 'InSilico');
}

/** Recursively collect every `.json` under a topic folder's `claims/` subdir. */
async function walkInSilicoClaims(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const root = inSilicoRoot();

  async function recurse(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'claims') {
          const claimEntries = await fs.readdir(full, { withFileTypes: true });
          for (const c of claimEntries) {
            if (c.isFile() && c.name.endsWith('.json')) {
              const basename = c.name.slice(0, -'.json'.length);
              if (!out.has(basename)) {
                out.set(basename, path.join(full, c.name));
              }
            }
          }
        } else {
          await recurse(full);
        }
      }
    }
  }

  await recurse(root);
  return out;
}

async function loadFixture(id: string): Promise<{ claim: FormalClaim; absPath: string; relPath: string }> {
  const basename = ALIASES[id] ?? id;
  const safe = basename.replace(/[^a-zA-Z0-9_-]/g, '');
  if (safe !== basename) throw new Error(`Invalid fixture id: ${id}`);

  // 1. Legacy fixtures dir takes precedence (preserves /dev/claim/exp17 behavior).
  const legacyPath = path.join(legacyFixturesDir(), `${safe}.json`);
  let absPath: string;
  try {
    await fs.access(legacyPath);
    absPath = legacyPath;
  } catch {
    // 2. Otherwise walk InSilico/**/claims/<basename>.json.
    const index = await walkInSilicoClaims();
    const found = index.get(safe);
    if (!found) throw new Error(`No fixture found for id=${safe} in legacy or InSilico claims/`);
    absPath = found;
  }

  const raw = await fs.readFile(absPath, 'utf-8');
  const claim = JSON.parse(raw) as FormalClaim;
  const relPath = path.relative(repoRoot(), absPath);
  return { claim, absPath, relPath };
}

export default async function FormalClaimDevPage({ params }: PageProps) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { id } = await params;

  let payload: { claim: FormalClaim; relPath: string };
  try {
    const loaded = await loadFixture(id);
    payload = { claim: loaded.claim, relPath: loaded.relPath };
  } catch (err) {
    console.error(`[dev/claim] failed to load fixture id=${id}:`, err);
    notFound();
  }

  return <FormalClaimView claim={payload.claim} fixturePath={payload.relPath} />;
}
