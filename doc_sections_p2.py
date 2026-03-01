"""
WOLF Valuation Engine — Section Builders Part 2
Adds spec-driven sections: 80-pt test, Excel tabs, JSON schema, sector modes, etc.
"""

def build_excel_workbook_spec(doc, add_table, bullets):
    doc.add_heading('14.3 Excel Workbook Structure (11 Required Tabs)', level=2)
    doc.add_paragraph('Per spec Section 4: Every cell must contain a live formula. Zero hard-coded values outside Inputs.')
    add_table(['Tab #', 'Name', 'Content', 'Key Formulas'], [
        ['1', 'Inputs', 'All user inputs (blue cells)', 'Raw data only; Gross Profit=Revenue-COGS'],
        ['2', 'WACC Model', 'CAPM build-up + capital structure', 'Rf, Beta, adjBeta, Ke, Kd(AT), We, Wd, WACC'],
        ['3', 'DCF Model', '5yr projections + TV + EV bridge', 'FCFF=NOPAT+DA-CapEx-DeltaWC; Gordon/Exit'],
        ['4', 'FCFF Check', '3-method reconciliation', 'M1,M2,M3; red if diff >0.01'],
        ['5', 'DDM', 'Gordon Growth, Two-Stage, H-Model', 'Discount at Ke from WACC tab (NOT WACC)'],
        ['6', 'Multiples', '12 multiples + peer comparison', 'EV from market data, not DCF EV'],
        ['7', 'Ratios', 'DuPont, Altman Z, CCC, ROIC', 'ROIC=NOPAT/(Equity+Debt-Cash)'],
        ['8', 'Sensitivity', '7x7 WACC x g matrix + tornado', 'Dynamic formulas, not pasted values'],
        ['9', 'Scenarios', 'Bull/Base/Bear + probability', 'Auto-validate scenario g < scenario WACC'],
        ['10', 'Dashboard', 'Executive summary', 'References all other tabs'],
        ['11', 'Instructions', 'Usage guide', 'Static text; currency = EGP'],
    ])

    doc.add_heading('WACC Model Tab — Row-by-Row Build-Up', level=3)
    add_table(['Row', 'Item', 'Formula', 'Note'], [
        ['3', 'Risk-Free Rate (Rf)', '=Inputs![rfRate]/100', '10yr Egyptian bond with date'],
        ['4', 'Beta (Raw)', '=Inputs![beta]', 'vs EGX 30 Total Return'],
        ['5', 'Adjusted Beta', '=(2/3)*B4+(1/3)*1', 'Bloomberg adjustment'],
        ['6', 'Beta Used', '=IF(betaType="adjusted",B5,B4)', 'Toggle raw vs adjusted'],
        ['7', 'Mature Market ERP', '=Inputs![erp]/100', 'Damodaran, 5.50%'],
        ['8', 'Cost of Equity (Ke)', '=B3+B6*B7', 'Local CAPM: no CRP'],
        ['9', 'Pre-tax Kd', '=Inputs![costOfDebt]/100', ''],
        ['10', 'Tax Rate', '=Inputs![taxRate]/100', ''],
        ['11', 'After-tax Kd', '=B9*(1-B10)', ''],
        ['12', 'Market Cap', '=Inputs![shares]*Inputs![price]', ''],
        ['13', 'Total Debt', '=Inputs![stDebt]+Inputs![ltDebt]', ''],
        ['14', 'Total Capital (V)', '=B12+B13', ''],
        ['15', 'Equity Weight (We)', '=B12/B14', 'Market-based, NOT book'],
        ['16', 'Debt Weight (Wd)', '=B13/B14', ''],
        ['17', 'WACC', '=B15*B8+B16*B11', 'Used in all DCF cells'],
    ])


def build_json_schema_spec(doc, add_table, bullets):
    doc.add_heading('14.5 JSON Export Schema (Complete Specification)', level=2)
    doc.add_paragraph('Per spec Section 5: All rates stored as decimals (0.2356, not 23.56). Currency: EGP. No null values for required fields.')
    add_table(['Section', 'Key Fields'], [
        ['metadata', 'engine ("Wolf Valuation Engine"), version ("4.0.0"), generated (ISO8601), currency ("EGP"), scale ("millions"), accounting_standard ("EAS"), capm_method, discount_convention'],
        ['inputs', 'All user inputs as-entered'],
        ['calculations.wacc', 'cost_of_equity, cost_of_debt_pretax, cost_of_debt_aftertax, equity_weight_market, debt_weight_market, equity_weight_book, wacc'],
        ['calculations.fcff', 'base_year (method_1/2/3, status), projected[] (year, revenue, ebitda, ebit, nopat, da, capex, dwc, fcff, pv), terminal_value, terminal_growth_used, tv_method'],
        ['calculations.present_values', 'pv_fcff[], sum_pv_fcff, pv_terminal_value, tv_pct_of_ev'],
        ['calculations.valuation', 'enterprise_value, minus_total_debt, plus_cash, equity_value, intrinsic_value_per_share, market_price, upside_downside_pct, verdict'],
        ['calculations.ddm', 'gordon_growth, two_stage, h_model'],
        ['calculations.multiples', 'pe, ev_ebitda, ev_ebit, pb, ps, div_yield'],
        ['calculations.financial_health', 'roic, roe, roa, altman_z, altman_zone, current_ratio, quick_ratio, ccc, dso, dio, dpo'],
        ['calculations.scenarios', 'bull/base/bear (wacc_delta, growth_delta, margin_delta, terminal_growth_delta, value_per_share), weighted_value'],
        ['calculations.sensitivity', 'wacc_range[7], growth_range[7], matrix[7x7]'],
    ])
    doc.add_paragraph('VALIDATION: Before export, assert calculations.fcff.terminal_growth_used === inputs.assumptions.terminal_growth (BUG-1 fix).')


def build_ev_bridge_spec(doc, add_table, bullets):
    doc.add_heading('EV-to-Equity Bridge (Full — Per Spec Section 6.3)', level=3)
    doc.add_paragraph('The complete EV-to-Equity bridge includes all adjustments:')
    bridge = [
        'Enterprise Value (from DCF)',
        '- Total Debt (Short-term + Long-term)',
        '+ Cash & Equivalents',
        '- Minority Interest (EAS / IFRS 10)',
        '- Preferred Stock (if applicable)',
        '- Net DTL  OR  + Net DTA (EAS 12 / IAS 12, if DTA is likely realizable)',
        '- Lease Liabilities (if not already in Total Debt, per EAS 48 / IFRS 16)',
        '+ Associates / JV Value (equity method investments)',
        '= Equity Value',
    ]
    for item in bridge:
        doc.add_paragraph(item, style='List Bullet')


def build_sector_modes(doc, add_table, bullets):
    doc.add_heading('Planned: Sector-Specific Valuation Modes', level=2)
    add_table(['Sector', 'Primary Methods', 'Additional Inputs', 'Key Ratios'], [
        ['General (Default)', 'DCF (FCFF), DDM', 'Standard IS/BS/CF', 'All standard ratios'],
        ['Banking', 'Excess Return Model, DDM, Justified P/B', 'NII, Non-Int Income, Loans, Deposits, NPLs, CAR', 'NIM, NPL ratio, LDR, CAR (min 12.5%), Cost-to-Income'],
        ['Real Estate', 'RNAV', 'Land bank FV, contracted sales, investment properties', 'P/RNAV, delivery ratio, backlog/revenue'],
        ['Telecom', 'DCF (FCFF), EV/EBITDA', 'ARPU, subscribers, churn', 'CapEx intensity, EBITDA/subscriber'],
    ])
    doc.add_paragraph('Banking formulas:')
    bullets([
        'Excess Return Model: equityValue = bookEquity0 + Sum[PV((ROE_t - Ke) * bookEquity_t)]',
        'Justified P/B = (ROE - g) / (Ke - g)',
        'Implied price = Justified P/B * Book Value per Share',
    ])


def build_verification_test(doc, add_table, bullets):
    doc.add_heading('80-Point Verification Test Case', level=1)
    doc.add_paragraph('WOLF Spec Section 9: TechCorp Egypt EGP test. Tolerance: +/-0.01 EGP currency, +/-0.001% percentages.')

    doc.add_heading('Test Inputs', level=2)
    add_table(['Field', 'Value', 'Field', 'Value'], [
        ['Revenue', 'EGP 1,000M', 'Current Assets', 'EGP 300M'],
        ['EBITDA', 'EGP 300M', 'Current Liabilities', 'EGP 200M'],
        ['EBIT', 'EGP 220M', 'Total Liabilities', 'EGP 700M'],
        ['Net Income', 'EGP 93M', 'Retained Earnings', 'EGP 250M'],
        ['D&A', 'EGP 80M', 'Inventory', 'EGP 100M'],
        ['Interest Expense', 'EGP 100M', 'COGS', 'EGP 600M'],
        ['CapEx', 'EGP 100M', 'Accounts Receivable', 'EGP 120M'],
        ['Delta WC', 'EGP 30M', 'Accounts Payable', 'EGP 90M'],
        ['Total Debt', 'EGP 500M', 'Share Price', 'EGP 8.00'],
        ['Cash', 'EGP 50M', 'Shares Outstanding', '100M'],
        ['Book Equity', 'EGP 400M', 'DPS', 'EGP 0.50'],
        ['Total Assets', 'EGP 1,100M', 'Beta (EGX 30)', '1.20'],
        ['Risk-Free Rate', '22.00%', 'Revenue Growth', '15.00%'],
        ['Mature Market ERP', '5.50%', 'Terminal Growth', '8.00%'],
        ['Pre-tax Cost of Debt', '20.00%', 'EBITDA Margin', '30%'],
        ['Tax Rate', '22.50%', 'D&A/Revenue', '8%'],
        ['CAPM Method', 'A (Local)', 'CapEx/Revenue', '10%'],
        ['Projection Years', '5', 'DeltaWC/DeltaRev', '20%'],
        ['Discounting', 'End-of-Year', 'Terminal Method', 'Gordon Growth'],
    ])

    doc.add_heading('Expected Outputs (Groups 1-4: Core, DDM, Multiples, Ratios)', level=2)
    add_table(['#', 'Test Item', 'Expected Value'], [
        ['1', 'Cost of Equity (Ke)', '28.600%'],
        ['2', 'After-tax Cost of Debt', '15.500%'],
        ['3', 'Equity Weight (We)', '61.538%'],
        ['4', 'Debt Weight (Wd)', '38.462%'],
        ['5', 'WACC', '23.562%'],
        ['6', 'Base FCFF (3 methods)', '120.500M each'],
        ['7-11', 'FCFF Years 1-5', '143.075 / 164.536 / 189.216 / 217.599 / 250.239M'],
        ['12', 'Terminal Value', '1,736.72M'],
        ['13-17', 'PV Years 1-5', '115.793 / 107.773 / 100.303 / 93.365 / 86.907M'],
        ['18', 'Sum PV(FCFF)', '504.141M'],
        ['19', 'PV(Terminal Value)', '603.160M'],
        ['20', 'Enterprise Value', '1,107.301M'],
        ['21', 'Net Debt', '450.000M'],
        ['22', 'Equity Value', '657.301M'],
        ['23', 'Intrinsic Value/Share', 'EGP 6.57'],
        ['24', 'Upside/Downside', '-17.9%'],
        ['25', 'Verdict', 'OVERVALUED'],
        ['26', 'DDM Gordon Growth', 'EGP 2.62'],
        ['27', 'DDM Two-Stage', 'EGP 3.31'],
        ['28-33', 'P/E, EV/EBITDA, EV/EBIT, P/B, P/S', '8.60x, 4.17x, 5.68x, 2.00x, 0.80x'],
        ['34', 'Dividend Yield', '6.25%'],
        ['35', 'Payout Ratio', '53.76%'],
        ['36-38', 'Margins (EBITDA/EBIT/Net)', '30.00% / 22.00% / 9.30%'],
        ['39-41', 'ROE / ROA / ROIC', '23.25% / 8.45% / 20.06%'],
        ['42-44', 'D/E Book, D/E Mkt, Net Debt/EBITDA', '1.25x, 0.625x, 1.50x'],
        ['45-47', 'Interest Coverage, Current, Quick', '2.20x, 1.50x, 1.00x'],
    ])

    doc.add_heading('Expected Outputs (Groups 5-8: Z-Score, DuPont, Efficiency, Sensitivity)', level=2)
    add_table(['#', 'Test Item', 'Expected Value'], [
        ['48', 'Altman Z-Score', '2.682'],
        ['49', 'Z-Score Zone', 'Grey (1.81-2.99)'],
        ['50-53', 'DuPont: Net Margin / Asset Turnover / Equity Mult / ROE', '9.30% / 0.9091x / 2.750x / 23.25%'],
        ['54-57', 'DIO / DSO / DPO / CCC', '60.83 / 43.80 / 54.75 / 49.88 days'],
        ['58', 'Sensitivity (WACC=23.56%, g=8%)', 'EGP 6.57'],
        ['59', 'Sensitivity (WACC=21.56%, g=10%)', '~EGP 10.77'],
        ['60', 'Sensitivity (WACC=25.56%, g=6%)', '~EGP 4.15'],
    ])

    doc.add_heading('Validation & Edge Cases (Group 9)', level=2)
    add_table(['#', 'Action', 'Expected Behavior'], [
        ['61', 'Set Terminal g=25%', 'Hard block with error'],
        ['62', 'Set Terminal g=23.56% (=WACC)', 'Hard block'],
        ['63', 'Set EBITDA=-50M', 'Allow + yellow warning'],
        ['64', 'Set DPS=0', 'DDM shows N/A'],
        ['65', 'Set Beta=0', 'Ke = Rf = 22.00%'],
        ['66', 'Set Beta=-0.5', 'Allow + warning'],
        ['67', 'Cash=600, Debt=500', 'Net Debt=-100, Equity > EV'],
        ['68', 'Set Total Debt=0', 'WACC=Ke, Wd=0%'],
        ['69', 'Set Share Price=0', 'Multiples show N/A'],
        ['70', 'Set Revenue=0', 'Block with error'],
        ['71', 'Set Beta=3.0', 'Ke=38.5%, warning shown'],
        ['72', 'Set Terminal g=13%', 'Warning: exceeds Egypt GDP'],
    ])

    doc.add_heading('Export Consistency (Group 10)', level=2)
    add_table(['#', 'Check', 'How to Verify'], [
        ['73', 'JSON g = PDF g', 'Compare JSON assumption vs PDF assumptions page'],
        ['74', 'Excel WACC = JSON WACC', 'Excel WACC Model!B17 vs JSON wacc.wacc'],
        ['75', 'Excel FCFF Y1 = PDF FCFF Y1', 'Excel DCF Model vs PDF projections'],
        ['76', 'Excel intrinsic = JSON per_share', 'Excel DCF!B31 vs JSON valuation'],
        ['77', 'Excel has LIVE FORMULAS', 'Click any output cell -> formula bar'],
        ['78', 'PDF matches JSON', 'Every number in PDF matches JSON'],
        ['79', 'All currency = EGP in Excel', 'Check every header and label'],
        ['80', 'All currency = EGP in PDF', 'Check all displays'],
    ])


def build_deployment_checklist(doc, add_table, bullets):
    doc.add_heading('Deployment Checklist (26 Items)', level=1)
    add_table(['#', 'Item', 'Priority'], [
        ['1', 'JSON terminal growth = PDF terminal growth', 'CRITICAL'],
        ['2', 'Excel FCFF: NOPAT+DA-CapEx-DeltaWC', 'CRITICAL'],
        ['3', 'All $ replaced with EGP in Excel+PDF', 'CRITICAL'],
        ['4', 'ROIC = NOPAT/(Equity+Debt-Cash)', 'CRITICAL'],
        ['5', 'Excel sensitivity: Egypt range (Base+/-3%, floor 5%)', 'CRITICAL'],
        ['6', 'Scenario bull g auto-clamped below WACC', 'CRITICAL'],
        ['7', 'PDF: EAS/IFRS (not GAAP)', 'MEDIUM'],
        ['8', 'FCFF 3-way reconciliation panel in UI', 'MEDIUM'],
        ['9', 'Excel WACC Model tab', 'MEDIUM'],
        ['10', 'Excel FCFF Check tab', 'MEDIUM'],
        ['11', 'Excel DDM tab', 'MEDIUM'],
        ['12', 'Excel Sensitivity tab with Egypt range', 'MEDIUM'],
        ['13', 'Excel Scenario tab', 'MEDIUM'],
        ['14', 'JSON calculations fully populated', 'MEDIUM'],
        ['15', 'EAS 48 lease adjustment module', 'MEDIUM'],
        ['16', 'EAS 31 normalized earnings module', 'MEDIUM'],
        ['17', 'EAS 12 deferred tax in EV bridge', 'MEDIUM'],
        ['18', 'EAS 23 Basic/Diluted EPS', 'MEDIUM'],
        ['19', 'Egyptian tax dropdown', 'MEDIUM'],
        ['20', 'Confidence Score (0-100)', 'MEDIUM'],
        ['21', 'Reverse DCF', 'MEDIUM'],
        ['22', 'Football Field chart', 'MEDIUM'],
        ['23', 'Banking sector mode', 'LOW'],
        ['24', 'Real Estate RNAV mode', 'LOW'],
        ['25', 'EAS 13 FX sensitivity', 'LOW'],
        ['26', '80/80 verification tests PASS', 'CRITICAL'],
    ])
