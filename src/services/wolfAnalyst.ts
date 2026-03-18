/**
 * WOLF Analyst — AI Calculation Verifier Service
 * CFA-grade financial verification via Google Gemini 2.0 Flash API.
 */
import type {
  FinancialData,
  ValuationAssumptions,
  ComparableCompany,
  DCFProjection,
  WACCResult,
  DCFResult,
  DDMResult,
  FCFFVerification,
  ScenarioAnalysis,
} from '../types/financial';

// ─── System Prompt ──────────────────────────────────────────────────────────

const WOLF_SYSTEM_PROMPT = `Be concise. Maximum 3 lines per calculation check. Use ✅ or ❌ only, no lengthy explanations unless asked.

You are WOLF Analyst, a CFA-grade financial calculation verifier for the WOLF Valuation Engine (Egyptian market / EGX).

Verify calculations using these formulas:
- WACC = (E/V)×Ke + (D/V)×Kd×(1-t) where V = MarketCap + Debt
- Ke = Rf + β×ERP (Method A: no CRP, it is in Egyptian Rf ~22%)
- FCFF = EBIT×(1-t) + D&A - CapEx - ΔWC
- TV = FCFF_N×(1+g)/(WACC-g), requires g < WACC
- EV = ΣPV(FCFF) + PV(TV), Equity = EV - Debt + Cash
- Blended = DCF×0.60 + Comps×0.40
- Upside = (Blended - Price) / Price (never multiply by 1+g)
- CCC = DSO + DIO - DPO
- ROIC = NOPAT / (Equity + Debt - Cash)
- DDM uses Ke not WACC. Gordon: P = D1/(Ke-g)

Rules: Show full math. Flag errors clearly. All values in EGP.
Scenarios must match across Engine/PDF/Excel (shared function).
Reference: DCF=43.93, Blended=55.72, WACC=25.84% for TechCorp.`;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WolfMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WolfAnalystRequest {
  mode: 'verify' | 'chat';
  userMessage: string;
  conversationHistory?: WolfMessage[];
  // Engine state for verification
  financialData?: FinancialData;
  assumptions?: ValuationAssumptions;
  comparables?: ComparableCompany[];
  dcfProjections?: DCFProjection[];
  dcfValue?: number;
  comparableValue?: number;
  blendedValue?: number;
  upside?: number;
  waccResult?: WACCResult;
  dcfResult?: DCFResult;
  ddmResult?: DDMResult;
  fcffVerification?: FCFFVerification;
  scenarioAnalysis?: ScenarioAnalysis;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

export function isWolfConfigured(): boolean {
  return Boolean(GROQ_API_KEY);
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

const lastCallTime = { value: 0 };

// ─── API Call ───────────────────────────────────────────────────────────────

export async function callWolfAnalyst(req: WolfAnalystRequest): Promise<string> {
  const now = Date.now();
  if (now - lastCallTime.value < 10000) {
    return 'Please wait 10 seconds between requests to stay within free tier limits.';
  }
  lastCallTime.value = now;

  if (!GROQ_API_KEY) {
    throw new Error(
      'WOLF Analyst is not configured. Set VITE_GROQ_API_KEY in your .env file.',
    );
  }

  const userContent =
    req.mode === 'verify' && req.financialData && req.assumptions
      ? buildVerifyPrompt(req)
      : req.userMessage;

  // Build OpenAI-compatible messages for Groq
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: WOLF_SYSTEM_PROMPT },
    ...(req.conversationHistory ?? []).slice(-4),
    { role: 'user', content: userContent },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      max_tokens: 2000,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? 'No response received from WOLF Analyst.';
}


// ─── Full Verification Prompt Builder ───────────────────────────────────────

function buildVerifyPrompt(req: WolfAnalystRequest): string {
  const fd = req.financialData!;
  const a = req.assumptions!;
  const focus = req.userMessage || 'Full audit — verify all modules';

  const is = fd.incomeStatement;
  const bs = fd.balanceSheet;
  const cf = fd.cashFlowStatement;
  const totalDebt = bs.shortTermDebt + bs.longTermDebt;
  const marketCap = fd.currentStockPrice * fd.sharesOutstanding;
  const V = marketCap + totalDebt;
  const We = V > 0 ? marketCap / V : 0;
  const Wd = V > 0 ? totalDebt / V : 0;
  const ke = a.riskFreeRate + a.beta * a.marketRiskPremium;
  const kdAt = a.costOfDebt * (1 - a.taxRate / 100);
  const wacc = We * ke + Wd * kdAt;

  const projLines = (req.dcfProjections ?? [])
    .map(
      (p, i) =>
        `- Year ${i + 1}: Revenue=${fmt(p.revenue)}, EBITDA=${fmt(p.ebitda)}, FCFF=${fmt(p.freeCashFlow)}, PV=${fmt(p.presentValue)}`,
    )
    .join('\n');

  const scenLines = req.scenarioAnalysis
    ? `- Bear: ${req.scenarioAnalysis.bear.intrinsicValue.toFixed(2)} EGP (g=${pct(req.scenarioAnalysis.bear.revenueGrowth)}, WACC=${pct(req.scenarioAnalysis.bear.wacc)})
- Base: ${req.scenarioAnalysis.base.intrinsicValue.toFixed(2)} EGP
- Bull: ${req.scenarioAnalysis.bull.intrinsicValue.toFixed(2)} EGP (g=${pct(req.scenarioAnalysis.bull.revenueGrowth)}, WACC=${pct(req.scenarioAnalysis.bull.wacc)})`
    : 'Not provided';

  const ddmLines = req.ddmResult
    ? `- Gordon: ${req.ddmResult.gordonGrowth?.toFixed(2) ?? 'N/A'} EGP
- Two-Stage: ${req.ddmResult.twoStage?.toFixed(2) ?? 'N/A'} EGP
- H-Model: ${req.ddmResult.hModel?.toFixed(2) ?? 'N/A'} EGP`
    : 'Not provided';

  return `## VERIFICATION REQUEST — ${fd.companyName} (${fd.ticker})
Generated: ${new Date().toISOString()}
Market: EGP / ${a.capmMethod === 'A' ? 'Local CAPM' : 'USD Build-Up'}
Focus: ${focus}

---

## INPUTS PROVIDED

### Financial Statements (Base Year)
- Revenue:          ${fmt(is.revenue)} EGP
- COGS:             ${fmt(is.costOfGoodsSold)} EGP
- Operating Expenses: ${fmt(is.operatingExpenses)} EGP
- EBIT:             ${fmt(is.operatingIncome)} EGP
- Interest Expense: ${fmt(is.interestExpense)} EGP
- Tax Expense:      ${fmt(is.taxExpense)} EGP
- Net Income:       ${fmt(is.netIncome)} EGP
- D&A:              ${fmt(is.depreciation)} EGP

- Cash:             ${fmt(bs.cash)} EGP
- Total Assets:     ${fmt(bs.totalAssets)} EGP
- Total Equity:     ${fmt(bs.totalEquity)} EGP
- Short-Term Debt:  ${fmt(bs.shortTermDebt)} EGP
- Long-Term Debt:   ${fmt(bs.longTermDebt)} EGP

- OCF:              ${fmt(cf.operatingCashFlow)} EGP
- CapEx:            ${fmt(cf.capitalExpenditures)} EGP
- Dividends Paid:   ${fmt(cf.dividendsPaid)} EGP

### Key Assumptions
- Current Price:    ${fd.currentStockPrice} EGP
- Shares Outstanding: ${fmt(fd.sharesOutstanding)}
- Revenue Growth:   ${pct(a.revenueGrowthRate)}
- EBITDA Margin:    ${pct(a.ebitdaMargin)}
- D&A % Revenue:    ${pct(a.daPercent)}
- CapEx % Revenue:  ${pct(a.capexPercent)}
- WC % Rev Change:  ${pct(a.deltaWCPercent)}
- WACC:             ${wacc.toFixed(4)}% (Ke=${ke.toFixed(4)}%, We=${(We * 100).toFixed(2)}%, Kd(at)=${kdAt.toFixed(4)}%, Wd=${(Wd * 100).toFixed(2)}%)
- Terminal Growth:  ${pct(a.terminalGrowthRate)}
- Tax Rate:         ${pct(a.taxRate)}
- Projection Years: ${a.projectionYears}
- Rf:               ${pct(a.riskFreeRate)}
- ERP:              ${pct(a.marketRiskPremium)}
- Beta:             ${a.beta}
- Cost of Debt:     ${pct(a.costOfDebt)}

---

## ENGINE OUTPUTS TO VERIFY

### FCFF Verification
${req.fcffVerification ? `- Method 1 (NOPAT): ${fmt(req.fcffVerification.method1)} EGP
- Method 2 (EBITDA): ${fmt(req.fcffVerification.method2)} EGP
- Method 3 (NI):    ${fmt(req.fcffVerification.method3)} EGP
- All Match: ${req.fcffVerification.allMatch ? '✅' : '❌'}` : 'Not provided'}

### DCF Projections
${projLines || 'Not provided'}

### Valuation Build-Up
${req.dcfResult ? `- Sum PV(FCFF):    ${fmt(req.dcfResult.sumOfPresentValues)} EGP
- Terminal Value:  ${fmt(req.dcfResult.terminalValue)} EGP
- PV(TV):          ${fmt(req.dcfResult.presentValueOfTerminal)} EGP
- Enterprise Value: ${fmt(req.dcfResult.enterpriseValue)} EGP
- Equity Value:    ${fmt(req.dcfResult.equityValue)} EGP
- DCF Per Share:   ${req.dcfResult.impliedSharePrice.toFixed(2)} EGP` : `- DCF Per Share: ${req.dcfValue?.toFixed(2) ?? 'N/A'} EGP`}

### Blended & Recommendation
- DCF Value:     ${req.dcfValue?.toFixed(2) ?? 'N/A'} EGP
- Comps Value:   ${req.comparableValue?.toFixed(2) ?? 'N/A'} EGP
- Blended (60/40): ${req.blendedValue?.toFixed(2) ?? 'N/A'} EGP
- Upside:          ${req.upside?.toFixed(2) ?? 'N/A'}%

### Scenarios
${scenLines}

### DDM
${ddmLines}

---

Please verify each module in order. Show full calculation for each value.
Clearly mark: ✅ Correct | ⚠️ Within tolerance | ❌ Discrepancy found.
If any discrepancy is found, identify the root cause and exact fix needed.`;
}

// ─── Quick Verify Prompt ────────────────────────────────────────────────────

export function buildQuickVerifyPrompt(
  fd: FinancialData,
  a: ValuationAssumptions,
  dcfValue: number,
  comparableValue: number,
  blendedValue: number,
  fcffY1?: number,
): string {
  const totalDebt = fd.balanceSheet.shortTermDebt + fd.balanceSheet.longTermDebt;
  const marketCap = fd.currentStockPrice * fd.sharesOutstanding;
  const V = marketCap + totalDebt;
  const ke = a.riskFreeRate + a.beta * a.marketRiskPremium;
  const kdAt = a.costOfDebt * (1 - a.taxRate / 100);
  const We = V > 0 ? marketCap / V : 0;
  const Wd = V > 0 ? totalDebt / V : 0;
  const expectedWACC = We * ke + Wd * kdAt;

  return `Quick sanity check for ${fd.companyName}:

1. Expected WACC = ${(expectedWACC).toFixed(3)}% | Engine WACC = ${a.discountRate.toFixed(3)}%
2. ${fcffY1 != null ? `FCFF Y1 = ${fmt(fcffY1)} EGP — verify against NOPAT + D&A − CapEx − ΔWC` : 'FCFF Y1: not provided'}
3. DCF Per Share = ${dcfValue.toFixed(2)} EGP
4. Blended = 0.60 × ${dcfValue.toFixed(2)} + 0.40 × ${comparableValue.toFixed(2)} = ${(0.6 * dcfValue + 0.4 * comparableValue).toFixed(2)} EGP. Engine reports ${blendedValue.toFixed(2)} EGP.

Flag any mismatch. If all correct, respond with a single line: "✅ All key metrics verified."`;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}
