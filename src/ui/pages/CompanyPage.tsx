/** Company data: header fields (price date and valuation date mandatory) and statements for up to five years. */
import { useRef } from 'react';
import type { CompanyData, FinancialYear } from '../../domain/company';
import { MAX_HISTORICAL_YEARS } from '../../domain/company';
import { IS_LINES, BS_LINES, CF_LINES, TOTAL_FIELDS, type Line } from '../../domain/lines';
import { companyChecks, validateCompany } from '../../engine/company';
import { fmtAmount } from '../../export/format';
import { Section, Field, NumInput, TextInput } from '../components/common';
import { downloadBlob, readJsonFile } from '../state/storage';
import mopco from '../../../tests/fixtures/mopco-fy2025.json';

export const MOPCO_EXAMPLE = mopco as unknown as CompanyData;

function zeroYear(fy: number, fye: string): FinancialYear {
  const z = <T,>(lines: Line<T>[]) => Object.fromEntries(lines.map(([k]) => [k, 0])) as unknown as T;
  const income = z(IS_LINES);
  income.exportRevenue = null;
  income.epsReported = null;
  return { fiscalYear: fy, periodEnd: `${fy}-${fye}`, audited: false, income, balance: z(BS_LINES), cashFlow: z(CF_LINES) };
}

export function blankCompany(): CompanyData {
  const y = new Date().getUTCFullYear() - 1;
  return {
    schemaVersion: 1, name: '', shortName: '', ticker: '', exchange: 'EGX', country: 'EG', currency: 'EGP', fiscalYearEnd: '12-31',
    valuationDate: '', price: 0, priceDate: '', priceSource: '', shares: { basic: 0, dilutiveItems: [], note: '' },
    years: [zeroYear(y, '12-31')], segments: [], facts: [], statementsSource: { description: '', auditor: '', reportDate: '' },
  };
}

interface Props {
  company: CompanyData | null;
  onStart: (c: CompanyData) => void;
  onChange: (c: CompanyData) => void;
}

export function CompanyPage({ company, onStart, onChange }: Props) {
  const file = useRef<HTMLInputElement>(null);
  if (!company) {
    return (
      <Section title="Start a valuation">
        <p>Enter company data or load the audited MOPCO FY2025 example. Company data stays in this browser.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" data-testid="load-mopco" onClick={() => onStart(structuredClone(MOPCO_EXAMPLE))}>Load MOPCO FY2025 example</button>
          <button className="btn" onClick={() => onStart(blankCompany())}>New company</button>
          <button className="btn" onClick={() => file.current?.click()}>Import company JSON</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onStart(await readJsonFile<CompanyData>(f)); }} />
        </div>
      </Section>
    );
  }
  const c = company;
  const set = (patch: Partial<CompanyData>) => onChange({ ...c, ...patch });
  const issues = validateCompany(c);
  const checks = companyChecks(c);
  const setLine = (yi: number, part: 'income' | 'balance' | 'cashFlow', field: string, v: number | null) => {
    const years = c.years.map((y, i) => (i === yi ? { ...y, [part]: { ...y[part], [field]: v } } : y));
    onChange({ ...c, years });
  };
  const addYear = () => {
    if (c.years.length >= MAX_HISTORICAL_YEARS) return;
    const first = c.years[0];
    onChange({ ...c, years: [zeroYear(first.fiscalYear - 1, c.fiscalYearEnd), ...c.years] });
  };
  const removeYear = (i: number) => c.years.length > 1 && onChange({ ...c, years: c.years.filter((_, k) => k !== i) });

  const table = (title: string, part: 'income' | 'balance' | 'cashFlow', lines: Line<any>[]) => (
    <Section title={title}>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>EGP</th>
              {c.years.map((y, i) => (
                <th key={y.fiscalYear} className="num">
                  FY{y.fiscalYear}{c.years.length > 1 && part === 'income' && <button className="btn" style={{ marginLeft: 6, padding: '0 6px' }} onClick={() => removeYear(i)} aria-label={`Remove FY${y.fiscalYear}`}>Remove</button>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(([field, label]) => (
              <tr key={field} className={TOTAL_FIELDS.has(field) ? 'total' : ''}>
                <td>{label}</td>
                {c.years.map((y, i) => (
                  <td key={y.fiscalYear} style={{ minWidth: 150 }}>
                    <NumInput value={(y[part] as unknown as Record<string, number | null>)[field]} nullable={field === 'exportRevenue' || field === 'epsReported'} onChange={(v) => setLine(i, part, field, v)} ariaLabel={`${label} FY${y.fiscalYear}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  return (
    <div>
      <Section title="Company" right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => downloadBlob(JSON.stringify(c, null, 2), `${c.shortName || 'company'}_data.json`, 'application/json')}>Export company JSON</button>
        </div>
      }>
        <Field label="Company name"><TextInput value={c.name} onChange={(v) => set({ name: v })} ariaLabel="Company name" /></Field>
        <Field label="Short name"><TextInput value={c.shortName} onChange={(v) => set({ shortName: v })} ariaLabel="Short name" /></Field>
        <Field label="Ticker"><TextInput value={c.ticker} onChange={(v) => set({ ticker: v })} ariaLabel="Ticker" /></Field>
        <Field label="Country (ISO code)" hint="EG enables Egypt-specific defaults"><TextInput value={c.country} onChange={(v) => set({ country: v.toUpperCase() })} ariaLabel="Country" /></Field>
        <Field label="Fiscal year end (MM-DD)"><TextInput value={c.fiscalYearEnd} onChange={(v) => set({ fiscalYearEnd: v })} ariaLabel="Fiscal year end" /></Field>
        <Field label="Valuation date" hint="Mandatory"><TextInput type="date" value={c.valuationDate} onChange={(v) => set({ valuationDate: v })} ariaLabel="Valuation date" /></Field>
        <Field label="Share price (EGP)" hint="User input. EGX has no free official price feed."><NumInput value={c.price} onChange={(v) => set({ price: v ?? 0 })} ariaLabel="Share price" /></Field>
        <Field label="Price date" hint="Mandatory"><TextInput type="date" value={c.priceDate} onChange={(v) => set({ priceDate: v })} ariaLabel="Price date" /></Field>
        <Field label="Price source"><TextInput value={c.priceSource} onChange={(v) => set({ priceSource: v })} ariaLabel="Price source" /></Field>
        <Field label="Basic shares"><NumInput value={c.shares.basic} onChange={(v) => set({ shares: { ...c.shares, basic: v ?? 0 } })} ariaLabel="Basic shares" /></Field>
        <Field label="Dilutive shares (options, convertibles)"><NumInput value={c.shares.dilutiveItems.reduce((s, d) => s + d.shares, 0)} onChange={(v) => set({ shares: { ...c.shares, dilutiveItems: v ? [{ label: 'Dilutive items', shares: v }] : [] } })} ariaLabel="Dilutive shares" /></Field>
        <Field label="Statements source"><TextInput value={c.statementsSource.description} onChange={(v) => set({ statementsSource: { ...c.statementsSource, description: v } })} ariaLabel="Statements source" /></Field>
        <Field label="Auditor"><TextInput value={c.statementsSource.auditor} onChange={(v) => set({ statementsSource: { ...c.statementsSource, auditor: v } })} ariaLabel="Auditor" /></Field>
        {issues.map((i) => <div key={i.field + i.text} className="msg error"><span className="neg">Required</span>: {i.text}</div>)}
      </Section>

      <Section title="Statement checks" right={c.years.length < MAX_HISTORICAL_YEARS ? <button className="btn" onClick={addYear}>Add earlier year</button> : null}>
        <table className="tbl">
          <thead><tr><th>Check</th><th className="num">Stated</th><th className="num">Computed</th><th className="num">Difference</th><th>Result</th></tr></thead>
          <tbody>
            {checks.map((k) => (
              <tr key={k.id}>
                <td>{k.label}</td>
                <td className="num">{fmtAmount(k.expected)}</td>
                <td className="num">{fmtAmount(k.computed)}</td>
                <td className="num">{fmtAmount(k.computed - k.expected)}</td>
                <td className={k.pass ? 'pos' : 'neg'}>{k.pass ? 'Ties' : 'Does not tie'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12 }}>Costs, charges and cash outflows are entered as negative numbers, as reported. Depreciation and amortization from the notes are positive.</p>
      </Section>
      {table('Income statement', 'income', IS_LINES)}
      {table('Balance sheet', 'balance', BS_LINES)}
      {table('Cash flow statement', 'cashFlow', CF_LINES)}
    </div>
  );
}
