/** Methodology (renders docs/METHODOLOGY.md), Data sources (renders the registry) and About. */
import { useMemo, useState } from 'react';
import { marked } from 'marked';
import methodology from '../../../docs/METHODOLOGY.md?raw';
import type { RatesRegistry } from '../../domain/rates';
import { Section } from '../components/common';
import { RegistryTable } from './RatesPage';
import { clearAllLocalData } from '../state/storage';

export function MethodologyPage() {
  const html = useMemo(() => marked.parse(methodology, { async: false }) as string, []);
  return <Section title="Methodology"><div className="markdown" dangerouslySetInnerHTML={{ __html: html }} /></Section>;
}

export function DataSourcesPage({ registry, originText }: { registry: RatesRegistry; originText: string }) {
  return (
    <Section title="Data sources">
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{originText}. Company financial statements are entered by the user or loaded from the bundled MOPCO FY2025 audited statements (Crowe - Dr. A. M. Hegazy &amp; Co., report dated 09-Mar-2026).</p>
      <RegistryTable entries={registry.entries} today={new Date().toISOString().slice(0, 10)} />
    </Section>
  );
}

export function AboutPage({ onCleared }: { onCleared: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <Section title="About">
        <p>WOLF Valuation Engine. Built by <a href="https://ahmedwael.pages.dev" target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>Ahmed Wael Metwally</a>, Cairo, Egypt. FMVA® Certified.</p>
        <p>The engine values EGX-listed companies with a discounted cash flow model, dividend discount model and relative-valuation cross-checks. Formulas are documented under Methodology; every macro input is listed under Data sources with its date and status.</p>
        <p>Output is analytical only. It is not investment advice and not a research publication licensed by the Financial Regulatory Authority (FRA) of Egypt.</p>
      </Section>
      <Section title="Privacy and local data">
        <p>Company financial data, assumptions and saved valuations are stored only in this browser (IndexedDB). They are never sent to a server. The only network request the application makes is to <code>/api/rates</code>, which returns public macro data (policy rates, yields, inflation, Damodaran estimates).</p>
        <p>Stored in this browser: saved valuations (until you delete them), the theme choice. Not stored anywhere else: company data, assumptions, results, exports (Excel and PDF files are generated in the browser and downloaded directly).</p>
        <button className="btn" onClick={async () => { await clearAllLocalData(); setDone(true); onCleared(); }}>Clear all local data</button>
        {done && <p className="pos">Local data cleared.</p>}
      </Section>
    </div>
  );
}
