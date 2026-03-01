"""
WOLF Valuation Engine — Audit Section Builders
Adds: TechCorp 5B test case, critical bugs, improvements, Egyptian compliance, agent prompt.
Based on Feb 28 2026 forensic audit.
"""

def build_audit_header(doc, add_table, bullets):
    doc.add_heading('PART II: FORENSIC AUDIT RESULTS', level=1)
    doc.add_paragraph(
        'Full forensic audit performed February 28, 2026 using TechCorp Industries (EGX) '
        'as the verification test case. Every formula, ratio, and output independently recalculated. '
        'All engine calculations verified as mathematically correct. '
        'Three critical export-level bugs identified (WACC sync).'
    )


def build_audit_test_inputs(doc, add_table, bullets):
    doc.add_heading('24. TechCorp Audit Test Case (Revenue = 5B EGP)', level=1)
    doc.add_heading('24.1 Complete Test Inputs', level=2)

    add_table(['Item', 'Value', 'Item', 'Value'], [
        ['Revenue', '5,000M EGP', 'Cash', '800M EGP'],
        ['COGS', '2,000M', 'AR', '600M'],
        ['Gross Profit', '3,000M', 'Inventory', '400M'],
        ['Operating Expenses', '1,500M', 'Total Current Assets', '1,800M'],
        ['EBIT', '1,500M', 'PP&E', '2,000M'],
        ['D&A', '250M (Dep 200M + Amort 50M)', 'Intangibles', '500M'],
        ['Interest Expense', '100M', 'Total Assets', '4,300M'],
        ['Tax Expense', '294M', 'AP', '300M'],
        ['Net Income', '1,106M', 'Short-term Debt', '200M'],
        ['OCF', '1,400M', 'Total Current Liabilities', '500M'],
        ['CapEx', '300M', 'Long-term Debt', '1,000M'],
        ['FCF (OCF-CapEx)', '1,100M', 'Total Liabilities', '1,500M'],
        ['Dividends Paid', '200M', 'Total Equity', '2,800M'],
        ['Shares Outstanding', '100M', 'Stock Price', '45.00 EGP'],
    ])

    add_table(['Assumption', 'Value', 'Assumption', 'Value'], [
        ['Rf', '22.00%', 'EBITDA Margin (proj)', '30%'],
        ['ERP', '5.50%', 'D&A / Revenue', '8%'],
        ['Beta', '1.20', 'CapEx / Revenue', '10%'],
        ['Cost of Debt (pre-tax)', '20.00%', 'DeltaWC / DeltaRev', '20%'],
        ['Tax Rate', '22.50%', 'Terminal Growth', '8%'],
        ['Revenue Growth', '15.00%', 'Projection Years', '5'],
        ['CAPM Method', 'A (Local)', 'Discounting', 'End-of-Year'],
        ['Terminal Method', 'Gordon Growth', 'Valuation Style', 'Moderate'],
    ])


def build_audit_wacc(doc, add_table, bullets):
    doc.add_heading('24.2 WACC Verification', level=2)
    add_table(['Component', 'Formula', 'Expected', 'Engine', 'Status'], [
        ['Cost of Equity (Ke)', 'Rf + Beta * ERP = 22% + 1.2*5.5%', '28.600%', '28.60%', 'PASS'],
        ['After-tax Kd', 'Kd * (1-t) = 20% * 0.775', '15.500%', '15.50%', 'PASS'],
        ['Market Cap', 'Shares * Price = 100M * 45', '4,500M', '4.50B', 'PASS'],
        ['Total Debt', 'ST + LT = 200M + 1,000M', '1,200M', '1.20B', 'PASS'],
        ['Equity Weight (We)', 'MCap/V = 4,500/5,700', '78.947%', '78.95%', 'PASS'],
        ['Debt Weight (Wd)', 'Debt/V = 1,200/5,700', '21.053%', '21.05%', 'PASS'],
        ['WACC', 'We*Ke + Wd*Kd(AT)', '25.842%', '25.84%', 'PASS'],
    ])


def build_audit_dcf(doc, add_table, bullets):
    doc.add_heading('24.3 DCF Projections Verification (WACC = 25.84%)', level=2)
    add_table(['Item', 'Yr 1 (2027)', 'Yr 2 (2028)', 'Yr 3 (2029)', 'Yr 4 (2030)', 'Yr 5 (2031)'], [
        ['Revenue (M)', '5,750.0', '6,612.5', '7,604.4', '8,745.0', '10,056.8'],
        ['EBITDA (30%)', '1,725.0', '1,983.8', '2,281.3', '2,623.5', '3,017.0'],
        ['D&A (8%)', '460.0', '529.0', '608.4', '699.6', '804.5'],
        ['EBIT', '1,265.0', '1,454.8', '1,672.9', '1,923.9', '2,212.5'],
        ['NOPAT (x0.775)', '980.4', '1,127.4', '1,296.5', '1,491.0', '1,714.7'],
        ['CapEx (10%)', '575.0', '661.3', '760.4', '874.5', '1,005.7'],
        ['DeltaWC (20%)', '150.0', '172.5', '198.4', '228.1', '262.4'],
        ['FCFF', '715.4', '822.7', '946.1', '1,088.0', '1,251.2'],
        ['DF @25.84%', '1.258', '1.584', '1.993', '2.508', '3.156'],
        ['PV', '568.5', '519.5', '474.8', '433.9', '396.5'],
    ])
    doc.add_paragraph('All 50 cells independently verified. PASS ✅')

    doc.add_heading('Terminal Value & EV Bridge', level=3)
    add_table(['Item', 'Formula', 'Value (M)', 'Status'], [
        ['Terminal Value', 'FCFF5*(1+g)/(WACC-g) = 1,251.2*1.08/0.1784', '~7,575', 'PASS'],
        ['PV(Terminal Value)', 'TV / (1.2584)^5', '~2,400', 'PASS'],
        ['Sum PV(FCFFs)', 'Sum of PV Yr1-5', '2,393', 'PASS'],
        ['Enterprise Value', 'Sum PV + PV(TV)', '4,793', 'PASS'],
        ['Less: Total Debt', '', '-1,200', 'PASS'],
        ['Plus: Cash', '', '+800', 'PASS'],
        ['Equity Value', 'EV - Debt + Cash', '4,393', 'PASS'],
        ['Fair Value/Share', 'Equity / Shares', '43.93 EGP', 'PASS'],
        ['Upside vs 45 EGP', '(43.93-45)/45', '-2.4%', 'PASS'],
    ])


def build_audit_fcff_reconciliation(doc, add_table, bullets):
    doc.add_heading('24.4 FCFF Three-Way Reconciliation', level=2)
    add_table(['Method', 'Formula', 'Result (M)', 'Status'], [
        ['1: NOPAT', 'EBIT*(1-t) + D&A - CapEx - DeltaWC = 1500*0.775+250-300-0', '1,112.5', 'PASS'],
        ['2: EBITDA', 'EBITDA*(1-t) + D&A*t - CapEx - DeltaWC = 1750*0.775+250*0.225-300', '1,112.5', 'PASS'],
        ['3: Net Income', 'NI + Int*(1-t) + D&A - CapEx - DeltaWC = 1106+100*0.775+250-300', '1,133.5', 'NOTE'],
    ])
    doc.add_paragraph(
        'M1 = M2 exactly (both use statutory tax rate 22.5%). M3 differs by 21M because it starts from '
        'reported Net Income which reflects effective tax rate (21.0%, not 22.5%). '
        'Reconciling difference = EBT * (statutory - effective) = 1,400M * 1.5% = 21.0M. '
        'Engine correctly explains this discrepancy. ✅'
    )


def build_audit_ddm_comps(doc, add_table, bullets):
    doc.add_heading('24.5 DDM Verification (Discount at Ke = 28.6%, NOT WACC)', level=2)
    add_table(['Model', 'Formula', 'Expected', 'Engine', 'Status'], [
        ['Gordon Growth', 'DPS*(1+g)/(Ke-g) = 2*1.08/0.206', '10.49 EGP', '10.49', 'PASS'],
        ['Two-Stage', '5yr high growth + terminal', '13.24 EGP', '13.24', 'PASS'],
        ['H-Model', 'DPS*(1+gL)/(Ke-gL) + DPS*H*(gH-gL)/(Ke-gL)', '12.18 EGP', '12.18', 'PASS'],
    ])
    doc.add_paragraph(
        'DDM values (10-13 EGP) are significantly lower than DCF (43.93) because payout ratio is only 18.1%. '
        'This is expected and correct — DDM values equity based on distributed cash, while DCF values total firm cash flow.'
    )

    doc.add_heading('24.6 Comparable Company Verification', level=2)
    doc.add_paragraph('Using EGX Average multiples: P/E=7.0x, EV/EBITDA=5.0x, P/S=1.2x, P/B=1.5x. Weights: 40/35/15/10.')
    add_table(['Method', 'Formula', 'Implied Price', 'Status'], [
        ['P/E', 'EPS(11.06) * 7.0', '77.42 EGP', 'PASS'],
        ['EV/EBITDA', '(1750*5.0 - 1200 + 800) / 100', '83.50 EGP', 'PASS'],
        ['P/S', 'RevPerShare(50) * 1.2', '60.00 EGP', 'PASS'],
        ['P/B', 'BVPerShare(28) * 1.5', '42.00 EGP', 'PASS'],
        ['Weighted Avg', '0.40*77.42 + 0.35*83.50 + 0.15*60 + 0.10*42', '73.39 EGP', 'PASS'],
    ])

    doc.add_heading('24.7 Blended Valuation', level=2)
    doc.add_paragraph('Blended = 60% DCF + 40% Comps = 0.60*43.93 + 0.40*73.39 = 55.72 EGP. Upside = +23.8%. ✅')


def build_audit_ratios(doc, add_table, bullets):
    doc.add_heading('24.8 Financial Ratios Verification (30+ ratios)', level=2)
    add_table(['Ratio', 'Formula', 'Expected', 'Status'], [
        ['Gross Margin', '3,000/5,000', '60.00%', 'PASS'],
        ['EBITDA Margin', '1,750/5,000', '35.00%', 'PASS'],
        ['EBIT/Operating Margin', '1,500/5,000', '30.00%', 'PASS'],
        ['Net Margin', '1,106/5,000', '22.12%', 'PASS'],
        ['ROE', '1,106/2,800', '39.50%', 'PASS'],
        ['ROA', '1,106/4,300', '25.72%', 'PASS'],
        ['ROIC', 'NOPAT/IC = 1,162.5/3,200', '36.33%', 'PASS'],
        ['D/E (Book)', '1,200/2,800', '0.43x', 'PASS'],
        ['D/E (Market)', '1,200/4,500', '0.27x', 'PASS'],
        ['Net Debt/EBITDA', '400/1,750', '0.23x', 'PASS'],
        ['Interest Coverage', '1,500/100', '15.0x', 'PASS'],
        ['Current Ratio', '1,800/500', '3.60x', 'PASS'],
        ['Quick Ratio', '(800+600)/500', '2.80x', 'PASS'],
        ['DSO', '600*365/5,000', '43.8 days', 'PASS'],
        ['DIO', '400*365/2,000', '73.0 days', 'PASS'],
        ['DPO', '300*365/2,000', '54.8 days', 'PASS'],
        ['CCC', 'DSO+DIO-DPO', '62.0 days', 'PASS'],
        ['P/E', '45/11.06', '4.07x', 'PASS'],
        ['EV/EBITDA', '4,900/1,750', '2.80x', 'PASS'],
        ['P/S', '4,500/5,000', '0.90x', 'PASS'],
        ['P/B', '4,500/2,800', '1.61x', 'PASS'],
        ['FCF Yield', '1,100/4,500', '24.44%', 'PASS'],
        ['Dividend Yield (Gross)', '2.00/45', '4.44%', 'PASS'],
        ['Dividend Yield (Net, -10% WHT)', '4.44%*0.90', '4.00%', 'PASS'],
        ['Payout Ratio', '2.00/11.06', '18.08%', 'PASS'],
        ['Earnings Yield', '11.06/45', '24.58%', 'PASS'],
    ])

    doc.add_heading('24.9 Altman Z-Score Verification', level=2)
    add_table(['Factor', 'Formula', 'Value', 'Weighted'], [
        ['X1 (WC/TA)', '1,300/4,300', '0.302', '1.2*0.302 = 0.363'],
        ['X2 (RE/TA)', '2,800/4,300', '0.651', '1.4*0.651 = 0.912'],
        ['X3 (EBIT/TA)', '1,500/4,300', '0.349', '3.3*0.349 = 1.151'],
        ['X4 (MCap/TL)', '4,500/1,500', '3.000', '0.6*3.000 = 1.800'],
        ['X5 (Rev/TA)', '5,000/4,300', '1.163', '1.0*1.163 = 1.163'],
    ])
    doc.add_paragraph('Z-Score = 0.363 + 0.912 + 1.151 + 1.800 + 1.163 = 5.39  (Safe Zone: Z > 2.99). ✅')

    doc.add_heading('24.10 DuPont Decomposition', level=2)
    doc.add_paragraph('3-Factor: Net Margin (22.12%) * Asset Turnover (1.163x) * Equity Mult (1.536x) = 39.50% ROE ✅')
    doc.add_paragraph(
        '5-Factor: Tax Burden (79%) * Interest Burden (93.33%) * Op Margin (30%) * '
        'Asset Turnover (1.163x) * Equity Mult (1.536x) = 39.50% ROE ✅'
    )


def build_audit_bugs(doc, add_table, bullets):
    doc.add_heading('25. Critical Bugs Identified', level=1)
    doc.add_paragraph(
        'Three critical bugs found. All relate to WACC synchronization between the live engine and exports. '
        'The engine calculation logic itself is 100% correct.'
    )

    doc.add_heading('BUG #1 (CRITICAL): PDF/Excel WACC Desync', level=2)
    doc.add_paragraph(
        'The PDF and Excel exports use a STALE WACC (23.56%) while the live engine correctly displays '
        'the auto-calculated WACC (25.84%). This produces a 16.9% difference in DCF fair value '
        '(Engine: 43.93 EGP vs PDF: 51.35 EGP). The WACC Breakdown section in the PDF correctly shows '
        '25.84%, making the PDF internally inconsistent.'
    )
    doc.add_paragraph('Root Cause: Export functions pull WACC from assumptions.discountRate (user-editable input) '
                      'instead of waccResult.wacc (auto-calculated output).')
    doc.add_paragraph('Fix: In pdfExport.ts, excelExport.ts, excelExportPro.ts, and jsonExport.ts — '
                      'always use waccResult.wacc. Auto-sync assumptions.discountRate when WACC is recalculated.')

    doc.add_heading('BUG #2 (CRITICAL): Mixed WACC in Sensitivity Tables', level=2)
    doc.add_paragraph(
        'Within a SINGLE PDF export, two sensitivity tables use different WACC values: '
        '"WACC vs Terminal Growth" uses 23.56% (base=51.35), while "Revenue Growth vs Margin" '
        'uses 25.84% (base=43.93). Same root cause as BUG #1.'
    )

    doc.add_heading('BUG #3 (CRITICAL): Scenario WACC Desync', level=2)
    doc.add_paragraph(
        'Scenario deltas are applied to different base WACC values. '
        'Engine Bear: 25.84%+2.5%=28.34% -> 19.26 EGP. '
        'PDF Bear: 23.56%+2.5%=26.06% -> 21.58 EGP. Same root cause as BUG #1.'
    )

    doc.add_heading('Required Fix (All 3 Bugs — Single Root Cause)', level=2)
    bullets([
        'In ALL export functions, WACC MUST come from waccResult.wacc, NOT assumptions.discountRate',
        'When CAPM inputs change, auto-update assumptions.discountRate = waccResult.wacc',
        'Before any export, assert: abs(assumptions.discountRate - waccResult.wacc) < 0.001',
        'If user manually overrides WACC, use that override consistently everywhere',
        'Files: pdfExport.ts, excelExport.ts, excelExportPro.ts, jsonExport.ts, useFinancialData.ts',
    ])

    doc.add_heading('Audit Accuracy Summary', level=2)
    add_table(['Component', 'Accuracy', 'Note'], [
        ['WACC Calculation', '100% ✅', 'All components verified'],
        ['FCFF 3-Way Reconciliation', '100% ✅', 'M1=M2, M3 diff explained'],
        ['DCF Projections (5 years)', '100% ✅', 'All 50 cells verified'],
        ['Terminal Value', '100% ✅', 'Gordon Growth correct'],
        ['EV-to-Equity Bridge', '100% ✅', 'EV - Debt + Cash'],
        ['DDM (3 models)', '100% ✅', 'All discount at Ke'],
        ['Comparable Valuation', '100% ✅', 'All 4 methods correct'],
        ['Blended Valuation', '100% ✅', '60/40 DCF/Comps'],
        ['Financial Ratios (30+)', '100% ✅', 'All individually verified'],
        ['Altman Z-Score', '100% ✅', '5.39 Safe Zone'],
        ['DuPont (3 & 5 factor)', '100% ✅', 'Both decompositions verified'],
        ['EAS Compliance', '100% ✅', 'All EAS-IFRS mappings correct'],
        ['Egyptian Tax Rates', '100% ✅', 'All 6 categories verified'],
        ['Market Defaults', '95% ✅', 'Reasonable, update regularly'],
        ['PDF/Excel Export', 'FAIL ❌', 'WACC desync — BUG #1/2/3'],
    ])
    doc.add_page_break()


def build_improvements(doc, add_table, bullets):
    doc.add_heading('26. Prioritized Improvements', level=1)

    doc.add_heading('Priority 1 — BLOCKING (Fix Immediately)', level=2)
    bullets([
        'Fix WACC sync: exports must use auto-calculated waccResult.wacc (BUG #1/2/3)',
        'Ensure all sensitivity tables in same export use identical WACC',
        'Add pre-export assertion: assumptions.discountRate === waccResult.wacc',
    ])

    doc.add_heading('Priority 2 — HIGH (Do Next)', level=2)
    bullets([
        'Add effective vs statutory tax rate display (effective = TaxExpense/EBT)',
        'Add "Use Historical" quick button for each projection assumption',
        'Strengthen warnings when projection assumptions deviate >3pp from historical',
        'Add implied Kd calculation: IntExp / TotalDebt (show alongside user-entered Kd)',
        'Complete Piotroski F-Score (5 remaining criteria for multi-period data)',
        'Add full EV bridge with Minority Interest + Preferred Equity when non-zero',
        'Excel: Add WACC Model, FCFF Check, DDM, Scenarios tabs per spec (11 tabs total)',
    ])

    doc.add_heading('Priority 3 — ENHANCEMENT', level=2)
    bullets([
        'Add real return calculation: (1 + nominal) / (1 + inflation) - 1 for Egypt',
        'Add EGX 30 relative valuation: company multiples vs index average',
        'Add DDM sensitivity table (Ke vs growth grid)',
        'Add WACC sensitivity to capital structure table (D/E vs WACC)',
        'Add Invested Capital bridge display (Equity + Debt - Cash) with ROIC-WACC spread',
        'Add EGP inflation adjustment for long-term return estimates',
        'Expand EGX Quick Access: add FAISAL, SAIB, MOPCO, SVCE, HRHO, DOMTY',
        'PDF: Add "Executive Summary for Board" one-pager',
        'PDF: Add "Data Verification" page with checksums and reconciliation status',
    ])

    doc.add_heading('Priority 4 — FUTURE', level=2)
    bullets([
        'Banking sector: Excess Return Model + Justified P/B + bank-specific ratios',
        'Real Estate: RNAV model',
        'SOTP (Sum of Parts) for conglomerates',
        'Multi-year historical trending and charting',
        'Automated beta regression from price history',
        'Unit test suite (Vitest) using TechCorp audit test case',
        'Arabic language support',
        'NILEX support for smaller Egyptian listings',
        'GDR/ADR conversion (e.g., CIB London GDR)',
    ])
    doc.add_page_break()


def build_egypt_compliance(doc, add_table, bullets):
    doc.add_heading('27. Egyptian Market Compliance Verification', level=1)

    doc.add_heading('27.1 Tax Rates Verified', level=2)
    add_table(['Item', 'Engine Value', 'Status'], [
        ['Standard Corporate Tax', '22.5%', 'CORRECT (Law 91/2005 amended)'],
        ['Oil & Gas', '40.55%', 'CORRECT (petroleum concessions)'],
        ['Suez Canal / EGPC / CBE', '40.0%', 'CORRECT'],
        ['Free Zone Export', '0%', 'CORRECT'],
        ['Capital Gains (EGX listed)', '10%', 'CORRECT (active, previously suspended)'],
        ['Dividend WHT', '10%', 'CORRECT (Article 46 bis)'],
        ['Stamp Duty', '0.125% per side', 'CORRECT (total 0.25% round trip)'],
    ])

    doc.add_heading('27.2 Risk-Free Rate Source', level=2)
    doc.add_paragraph(
        'Engine correctly uses 10Y Egyptian Government Bond (~22%) as Rf, NOT the CBE overnight rate (27.25%). '
        'The distinction is critical: CBE overnight is for short-term rates, while 10Y bond is the proper Rf for CAPM. '
        'Engine displays CBE benchmark separately for informational purposes. ✅'
    )

    doc.add_heading('27.3 CAPM Method A Verification', level=2)
    doc.add_paragraph(
        'Method A (Local Currency CAPM): Ke = Rf(Egypt) + Beta * Mature_ERP. '
        'NO Country Risk Premium added because Egyptian Rf already embeds country risk. '
        'Using Damodaran mature market ERP of 5.5% is ACADEMICALLY CORRECT. ✅'
    )
    doc.add_paragraph(
        'Many practitioners incorrectly add CRP on top of Egyptian Rf, double-counting. '
        'The engine avoids this error. CRP is only used in Method B (USD Build-Up with Fisher equation).'
    )

    doc.add_heading('27.4 EAS-IFRS Mapping Verified', level=2)
    add_table(['EAS', 'IFRS Equivalent', 'Topic', 'Status'], [
        ['EAS 48', 'IFRS 16', 'Leases (ROU Asset)', 'CORRECT'],
        ['EAS 31', 'IAS 1', 'Presentation / Normalized Earnings', 'CORRECT'],
        ['EAS 12', 'IAS 12', 'Deferred Tax', 'CORRECT'],
        ['EAS 23', 'IAS 33', 'Earnings Per Share', 'CORRECT'],
        ['EAS 42', 'IAS 19', 'End of Service Benefits', 'CORRECT'],
        ['EAS 13', 'IAS 36', 'Impairment', 'CORRECT'],
        ['EAS 26', 'IFRS 9', 'Expected Credit Losses', 'CORRECT'],
    ])

    doc.add_heading('27.5 EGX Sector Multiples Assessment', level=2)
    add_table(['Sector', 'Engine P/E', 'Market Reality', 'Status'], [
        ['Banking', '5.5x', 'CIB trades ~5-7x', 'REASONABLE'],
        ['Real Estate', '8.0x', 'TMGH, PHDC in range', 'REASONABLE'],
        ['Telecom', '12.0x', 'ETEL in range', 'REASONABLE'],
        ['Consumer/FMCG', '15.0x', 'EFID, EAST range', 'REASONABLE'],
        ['Industrial', '7.0x', 'EGX industrials', 'REASONABLE'],
        ['Healthcare', '18.0x', 'Limited listings', 'APPROXIMATE'],
        ['EGX Average', '7.0x', 'EGX30 average', 'REASONABLE'],
    ])
    doc.add_paragraph('Recommendation: Update periodically from actual EGX data. Add "last updated" timestamp.')

    doc.add_heading('27.6 Terminal Growth Rate for Egypt', level=2)
    doc.add_paragraph(
        'Default 8%, max 12%. Egypt nominal GDP growth historically 15-20% (includes high inflation). '
        '8% is conservative, reflecting eventual inflation normalization. Max 12% caps at current elevated growth. '
        'Engine enforces g < WACC constraint. ✅ Reasonable but should include guidance tooltip.'
    )


def build_agent_prompt_reference(doc, add_table, bullets):
    doc.add_heading('28. Agent Development Prompt — Key Rules', level=1)
    doc.add_paragraph(
        'The following rules MUST be followed by any AI agent or developer working on the WOLF engine. '
        'Extracted from the full agent prompt (WOLF_Agent_Prompt_V9_Audit5.md).'
    )

    doc.add_heading('Calculation Rules (Non-Negotiable)', level=2)
    bullets([
        'FCFF must NEVER subtract Interest Expense directly — interest is handled through WACC',
        'DDM discounts at Ke (cost of equity), NOT WACC — DDM values equity directly',
        'WACC uses Market Cap weights (NOT book equity) for E/V',
        'Equity Value = EV - Debt + Cash — NO MAX(0) floor (can be negative for distressed firms)',
        'ROIC = NOPAT / (Equity + Debt - Cash) — cash deducted from invested capital',
        'Method A CAPM: NO CRP added to Rf — Egyptian Rf already embeds country risk',
        'Bloomberg beta adjustment: Adjusted = (2/3)*Raw + (1/3)*1.0',
        'Terminal growth MUST be < WACC — engine must hard-block if violated',
        'Scenario bull case terminal g auto-clamped to WACC - 1% if it would exceed WACC',
    ])

    doc.add_heading('Egyptian Market Rules', level=2)
    bullets([
        'WACC 20-35% for Egypt is NORMAL — do NOT warn about "high WACC"',
        'Terminal growth 8% for Egypt is NORMAL — reflects nominal GDP, not aggressive',
        'All currency must display "EGP" (not $ or LE) when Egypt market selected',
        'Reference EAS (Egyptian Accounting Standards) or IFRS, never US GAAP',
        'Include FRA disclaimer: "Not approved by the Financial Regulatory Authority of Egypt"',
        'Dividend WHT 10%, Capital Gains 10%, Stamp Duty 0.125% per side',
    ])

    doc.add_heading('Export Rules', level=2)
    bullets([
        'ALL exports must use waccResult.wacc, not assumptions.discountRate',
        'Pre-export assertion: abs(discountRate - waccResult.wacc) < 0.001',
        'Excel must have LIVE FORMULAS — no hard-coded values outside Inputs tab',
        'JSON rates stored as decimals (0.2584, not 25.84%)',
        'JSON must include full calculations block — no null values for required fields',
        'All sensitivity tables in same export must use identical WACC',
    ])

    doc.add_heading('Unit Test Assertions (from Audit)', level=2)
    add_table(['Test', 'Input', 'Expected Output'], [
        ['Ke (Method A)', 'Rf=22%, ERP=5.5%, Beta=1.2', '28.600%'],
        ['WACC', 'Ke=28.6%, Kd=20%, t=22.5%, MCap=4.5B, Debt=1.2B', '25.842%'],
        ['FCFF M1', 'EBIT=1.5B, t=22.5%, D&A=250M, CapEx=300M', '1,112.5M'],
        ['FCFF M3', 'NI=1.106B, Int=100M, t=22.5%, D&A=250M, CapEx=300M', '1,133.5M'],
        ['DDM Gordon', 'DPS=2, Ke=28.6%, g=8%', '10.49 EGP'],
        ['DDM Two-Stage', 'DPS=2, Ke=28.6%, gH=15%, gL=8%, n=5', '13.24 EGP'],
        ['DDM H-Model', 'DPS=2, Ke=28.6%, gH=15%, gL=8%, n=5', '12.18 EGP'],
        ['Altman Z', 'WC=1.3B, RE=2.8B, EBIT=1.5B, MCap=4.5B, TL=1.5B, Rev=5B, TA=4.3B', '5.39'],
        ['P/E Implied', 'EPS=11.06, PeerPE=7.0', '77.42 EGP'],
        ['EV/EBITDA Impl', 'EBITDA=1.75B, Mult=5.0, Debt=1.2B, Cash=800M, Shares=100M', '83.50 EGP'],
        ['Blended', '60% DCF(43.93) + 40% Comps(73.39)', '55.72 EGP'],
    ])
