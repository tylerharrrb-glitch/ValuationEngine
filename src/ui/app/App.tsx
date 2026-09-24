/** WOLF v2 application shell: tabs, session, exports. The engine does every calculation. */
import { useState } from 'react';
import { AuditProvider } from '../components/common';
import { useRates } from '../hooks/useRates';
import { useSession } from '../state/session';
import { CompanyPage } from '../pages/CompanyPage';
import { AssumptionsPage } from '../pages/AssumptionsPage';
import { ValuationPage } from '../pages/ValuationPage';
import { AnalysisPage } from '../pages/AnalysisPage';
import { RelativePage } from '../pages/RelativePage';
import { HistoricalPage } from '../pages/HistoricalPage';
import { RatesPage } from '../pages/RatesPage';
import { MethodologyPage, DataSourcesPage, AboutPage } from '../pages/DocsPages';
import { SavedPage } from '../pages/SavedPage';
import { downloadBlob } from '../state/storage';
import { fmtDate, fmtPerShare } from '../../export/format';

type Tab = 'company' | 'assumptions' | 'valuation' | 'analysis' | 'relative' | 'historical' | 'rates' | 'methodology' | 'sources' | 'saved' | 'about';
const TABS: { id: Tab; label: string; needsResult?: boolean; needsSession?: boolean }[] = [
  { id: 'company', label: 'Company data' },
  { id: 'assumptions', label: 'Assumptions', needsSession: true },
  { id: 'valuation', label: 'Valuation', needsResult: true },
  { id: 'analysis', label: 'Analysis', needsResult: true },
  { id: 'relative', label: 'Relative', needsSession: true },
  { id: 'historical', label: 'Historical', needsResult: true },
  { id: 'rates', label: 'Rates' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'sources', label: 'Data sources' },
  { id: 'saved', label: 'Saved' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const rates = useRates();
  const s = useSession();
  const [tab, setTab] = useState<Tab>('company');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [light, setLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.setItem('wolf-theme', next ? 'light' : 'dark');
    } catch {
      /* storage unavailable */
    }
  };

  const session = s.session;
  const result = s.result;

  const exportExcel = async () => {
    if (!session || !result) return;
    setExporting('excel');
    setExportError(null);
    try {
      const { workbookBuffer, workbookFileName } = await import('../../export/excel/build');
      const buf = await workbookBuffer({ company: session.company, assumptions: session.assumptions, snapshot: session.snapshot, result });
      downloadBlob(buf, workbookFileName(session.company, session.assumptions.valuationDate), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };
  const exportPdf = async () => {
    if (!session || !result) return;
    setExporting('pdf');
    setExportError(null);
    try {
      const { pdfBytes, pdfFileName } = await import('../../export/pdf/build');
      downloadBlob(pdfBytes({ company: session.company, assumptions: session.assumptions, snapshot: session.snapshot, result }), pdfFileName(session.company, session.assumptions.valuationDate), 'application/pdf');
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  const available = (t: (typeof TABS)[number]) => (t.needsResult ? !!result : t.needsSession ? !!session : true);

  return (
    <AuditProvider>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="display" style={{ fontSize: 22, letterSpacing: '0.12em' }}>WOLF</div>
          <div className="muted" style={{ fontSize: 12 }}>Valuation Engine</div>
          {session && (
            <div style={{ fontSize: 13 }}>
              <strong>{session.company.name || 'New company'}</strong> {session.company.ticker && <span className="muted">({session.company.ticker})</span>}
              {' '}<span className="muted">Price {fmtPerShare(session.company.price)} on {session.company.priceDate ? fmtDate(session.company.priceDate) : 'n/a'}</span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          {s.running && <span className="muted" style={{ fontSize: 12 }} data-testid="running">Calculating</span>}
          <span className="muted" style={{ fontSize: 12 }}>{rates.originText}</span>
          {session && <button className="btn" onClick={() => { s.close(); setTab('company'); }}>Close valuation</button>}
          <button className="btn" onClick={toggleTheme} aria-label="Toggle light and dark theme">{light ? 'Dark theme' : 'Light theme'}</button>
        </div>
        <nav style={{ maxWidth: 1400, margin: '0 auto', padding: '0 8px', display: 'flex', overflowX: 'auto' }} aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} disabled={!available(t)} style={!available(t) ? { opacity: 0.4 } : undefined} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}>{t.label}</button>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 16 }}>
        {s.error && <div className="msg error"><span className="neg">Error</span>: {s.error}</div>}
        {exportError && <div className="msg error"><span className="neg">Export failed</span>: {exportError}</div>}
        {tab === 'company' && (
          <CompanyPage
            company={session?.company ?? null}
            onStart={(c) => { s.start(c, rates.registry); }}
            onChange={(c) => { s.setCompany(c); s.setAssumptions((a) => ({ ...a, valuationDate: c.valuationDate })); }}
          />
        )}
        {tab === 'assumptions' && session && (
          <AssumptionsPage company={session.company} a={session.assumptions} snapshot={session.snapshot} result={result} set={s.setAssumptions} rebuildDefaults={s.rebuildDefaults} />
        )}
        {tab === 'valuation' && result && <ValuationPage v={result} onExportExcel={exportExcel} onExportPdf={exportPdf} exporting={exporting} />}
        {tab === 'analysis' && result && <AnalysisPage v={result} />}
        {tab === 'relative' && session && <RelativePage s={session.secondary} set={s.setSecondary} v={result} today={new Date().toISOString().slice(0, 10)} />}
        {tab === 'historical' && result && <HistoricalPage v={result} />}
        {tab === 'rates' && <RatesPage registry={rates.registry} originText={rates.originText} loading={rates.loading} refresh={rates.refresh} snapshot={session?.snapshot ?? null} diff={s.pendingRateUpdate} apply={s.applyRateUpdate} />}
        {tab === 'methodology' && <MethodologyPage />}
        {tab === 'sources' && <DataSourcesPage registry={rates.registry} originText={rates.originText} />}
        {tab === 'saved' && <SavedPage session={session} onOpen={(x) => { s.open(x); setTab('valuation'); }} />}
        {tab === 'about' && <AboutPage onCleared={() => undefined} />}
        {session && !result && !s.error && tab !== 'company' && <p className="muted">Calculating.</p>}
      </main>
      <footer style={{ maxWidth: 1400, margin: '24px auto', padding: '12px 16px', borderTop: '1px solid var(--border)' }} className="muted">
        <span style={{ fontSize: 12 }}>Analytical only. Not investment advice. Company data stays in this browser.</span>
      </footer>
    </AuditProvider>
  );
}
