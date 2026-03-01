"""
WOLF Valuation Engine — Document Section Builders (Updated)
Helper module for generate_full_overview.py
Reflects actual source code values as of Feb 2026.
"""

def build_title_page(doc, Pt, RGBColor, WD_ALIGN_PARAGRAPH):
    doc.add_paragraph()
    doc.add_paragraph()
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run('WOLF Valuation Engine')
    r.bold = True
    r.font.size = Pt(28)
    r.font.color.rgb = RGBColor(0x1a, 0x1a, 0x2e)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = subtitle.add_run('Complete Engine Overview & Developer Reference')
    r.font.size = Pt(16)
    r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    doc.add_paragraph()
    ver = doc.add_paragraph()
    ver.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = ver.add_run('Engine Version 4.0  |  February 2026')
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

    doc.add_paragraph()
    desc = doc.add_paragraph()
    desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = desc.add_run(
        'CFA-grade equity valuation platform built with React 19, TypeScript 5.9, and Vite 7.\n'
        'Supports DCF (FCFF-based), DDM (3 models), Comparable Company Analysis, Monte Carlo, and more.\n'
        'Dual-market support: USA (NYSE/NASDAQ) and Egypt (EGX).\n'
        'EAS / IFRS compliant with 3-way FCFF verification and confidence scoring.'
    )
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
    doc.add_page_break()


def build_toc(doc, Pt):
    doc.add_heading('Table of Contents', level=1)
    toc_items = [
        '1. Executive Summary',
        '2. Technology Stack & Architecture',
        '3. Project Structure & File Map',
        '4. Data Models & TypeScript Interfaces (465 lines, 55+ types)',
        '5. Core Valuation Engine (1,098 lines)',
        '   5.1 WACC Calculation (Dual CAPM — Method A / Method B)',
        '   5.2 FCFF Three-Way Cross-Verification',
        '   5.3 DCF Projections (Revenue -> EBITDA -> EBIT -> NOPAT -> FCFF)',
        '   5.4 DCF Valuation (Terminal Value + EV-to-Equity Bridge)',
        '   5.5 Dividend Discount Models (Gordon Growth, Two-Stage, H-Model)',
        '   5.6 Comparable Company Valuation (P/E, EV/EBITDA, P/S, P/B)',
        '   5.7 Blended Valuation & Recommendations',
        '   5.8 Financial Ratios (30+ ratios including Altman Z-Score)',
        '   5.9 Sensitivity Analysis (5x5 Dynamic Matrix)',
        '   5.10 Scenario Analysis (Bear/Base/Bull with Probability Weighting)',
        '   5.11 Reverse DCF (Binary Search — 100 iterations)',
        '   5.12 Auto-Calculate Assumptions from API Data',
        '   5.13 Input Validation (Inline, 20+ checks)',
        '6. Advanced Analysis Module (advancedAnalysis.ts)',
        '   6.1 Monte Carlo Simulation (5,000 iterations, Web Worker)',
        '   6.2 Sector Benchmarking (10 metrics)',
        '   6.3 Quality Scorecard (4 categories, A+ through F)',
        '7. EAS / IFRS Compliance Module (easModules.ts)',
        '   7.1 EAS 48 (IFRS 16) — Lease Adjustments (ROU Asset)',
        '   7.2 EAS 31 (IAS 1) — Normalized Earnings (Non-Recurring Add-Backs)',
        '   7.3 EAS 12 (IAS 12) — Deferred Tax in EV Bridge',
        '   7.4 EAS 23 (IAS 33) — Basic & Diluted EPS (Anti-Dilution)',
        '8. Model Confidence Scoring (0-100, Three-Pillar)',
        '9. Input Validation Engine (Hard Blocks / Warnings / Edge Cases)',
        '10. Market Region Support (USA & Egypt)',
        '   10.1 Egyptian Tax Categories (6 types)',
        '   10.2 Egyptian Industry Multiples (8 sectors with weights)',
        '   10.3 US Industry Multiples (6 sectors)',
        '   10.4 Egyptian Peer Groups',
        '11. API Services (FMP & Yahoo Finance)',
        '12. Valuation Styles & Scenario Presets',
        '13. State Management & Hooks',
        '14. Export Capabilities (PDF, Excel, Excel Pro, JSON)',
        '15. UI Components & Tabs (40+ Components, 15 Valuation Sections)',
        '16. Formatting & Utility Functions',
        '17. Web Worker (Monte Carlo)',
        '18. Configuration & Build',
        '19. Known Issues & Future Development',
        '',
        '═══ PART II: FORENSIC AUDIT RESULTS ═══',
        '',
        '20. Sector-Specific Valuation Modes (Planned)',
        '21. Edge Case Handling (14 scenarios)',
        '22. Verification Test (80-Point — Spec Test Case)',
        '23. Production Deployment Checklist (26 items)',
        '24. TechCorp Audit Test Case (Revenue = 5B EGP)',
        '   24.1 Complete Test Inputs (30+ fields)',
        '   24.2 WACC Verification (7 components)',
        '   24.3 DCF Projections (50 cells verified)',
        '   24.4 FCFF Three-Way Reconciliation',
        '   24.5 DDM Verification (3 models)',
        '   24.6 Comparable Company Verification (4 methods)',
        '   24.7 Blended Valuation',
        '   24.8 Financial Ratios (30+ all verified)',
        '   24.9 Altman Z-Score (5.39 — Safe Zone)',
        '   24.10 DuPont Decomposition (3 & 5 factor)',
        '25. Critical Bugs Identified (3 WACC sync issues)',
        '26. Prioritized Improvements (20+ items, 4 priority tiers)',
        '27. Egyptian Market Compliance Verification',
        '   27.1 Tax Rates, 27.2 Rf Source, 27.3 CAPM Verification',
        '   27.4 EAS-IFRS Mapping, 27.5 EGX Multiples, 27.6 Terminal Growth',
        '28. Agent Development Prompt — Key Rules',
    ]
    for item in toc_items:
        p = doc.add_paragraph(item)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(0)
    doc.add_page_break()


def build_executive_summary(doc, add_table):
    doc.add_heading('1. Executive Summary', level=1)
    doc.add_paragraph(
        'WOLF Valuation Engine is a CFA-grade, browser-based equity valuation platform '
        'that combines multiple valuation methodologies into a single, interactive tool. Built '
        'for financial analysts, portfolio managers, and investment professionals performing '
        'rigorous fundamental analysis on publicly traded companies.'
    )
    doc.add_paragraph(
        'The engine supports two markets: United States (NYSE/NASDAQ) and Egypt (EGX), with '
        'market-specific defaults for risk-free rates, equity risk premiums, tax rates, CAPM methods, '
        'and industry multiples. Live data is fetched from Financial Modeling Prep (FMP) API '
        'and Yahoo Finance. All FCFF calculations use a three-way cross-verification system.'
    )
    doc.add_heading('Key Capabilities', level=3)
    bullets = [
        'FCFF-based DCF with three-way cross-verification (NOPAT, EBITDA, Net Income routes)',
        'Dual CAPM: Method A (Local Currency) and Method B (USD Build-Up with Fisher equation)',
        'DCF with mid-year and end-of-year discounting convention options',
        'Terminal Value: Gordon Growth Model or Exit Multiple fallback',
        'Dividend Discount Models: Gordon Growth, Two-Stage, H-Model (all at Ke, not WACC)',
        'Comparable Company Analysis: P/E, EV/EBITDA, P/S, P/B with median peer multiples',
        'Blended valuation with adjustable DCF/Comps weighting (default 60/40)',
        'Scenario analysis (Bear/Base/Bull with user-adjustable probability weighting)',
        'Three valuation styles: Conservative (value), Moderate (GARP), Aggressive (growth)',
        'Sensitivity analysis: Dynamic 5x5 WACC vs Terminal Growth matrix',
        'Reverse DCF: Binary search (100 iterations) for implied growth rate',
        'Monte Carlo simulation: 5,000 iterations via dedicated Web Worker',
        'Sector benchmarking: 10 metrics against industry averages',
        'Quality scorecard: Economic Moat, Financial Health, Growth, Capital Allocation (A+ to F)',
        'Model Confidence Score: Three-pillar (Data Quality, Assumptions, Robustness) 0-100',
        'EAS/IFRS compliance: EAS 48 (leases), EAS 31 (normalized earnings), EAS 12 (deferred tax), EAS 23 (EPS)',
        'Input validation: 9 hard blocks, 8 soft warnings, 4 edge case auto-adjustments',
        '30+ financial ratios including Altman Z-Score and Economic Value Added (EVA)',
        'Egyptian tax categories: Standard 22.5%, Oil & Gas 40.55%, Suez Canal 40%, Free Zone 0%',
        'Export: PDF research report, Excel (standard + Pro with live formulas), CFA-grade JSON',
        'Real-time stock data via FMP Stable API + Yahoo Finance CORS proxy chain fallback',
        'Auto-calculate assumptions (beta, tax, WACC, cost of debt) from API data',
        'Undo/Redo history with debounced auto-save to localStorage',
        'Dark/Light theme, keyboard shortcuts (Ctrl+Z/Y/S), lazy-loaded tabs with ErrorBoundary',
    ]
    for b in bullets:
        doc.add_paragraph(b, style='List Bullet')
    doc.add_page_break()


def build_tech_stack(doc, add_table):
    doc.add_heading('2. Technology Stack & Architecture', level=1)
    doc.add_heading('Frontend Framework', level=2)
    add_table(
        ['Technology', 'Version', 'Purpose'],
        [
            ['React', '19.2.3', 'UI framework with hooks-based components'],
            ['TypeScript', '5.9.3', 'Static typing for all source files'],
            ['Vite', '7.2.4', 'Build tool and dev server (HMR)'],
            ['Tailwind CSS', '4.1.17', 'Utility-first CSS framework'],
        ]
    )
    doc.add_heading('Key Libraries', level=2)
    add_table(
        ['Library', 'Version', 'Purpose'],
        [
            ['Recharts', '3.7.0', 'Interactive charts (bar, line, area)'],
            ['Lucide React', '0.563.0', 'Icon library (feather-style)'],
            ['jsPDF + autoTable', '4.1.0 / 5.0.7', 'PDF report generation'],
            ['SheetJS (xlsx)', '0.18.5', 'Excel workbook export with formulas'],
            ['clsx + tailwind-merge', '2.1.1 / 3.4.0', 'Conditional class merging'],
            ['vite-plugin-singlefile', '2.3.0', 'Single HTML file build output'],
        ]
    )
    doc.add_heading('Architecture Pattern', level=2)
    doc.add_paragraph('The application follows a hooks-based architecture with clear separation of concerns:')
    items = [
        'App.tsx — Thin orchestrator that composes hooks and layout components.',
        'Custom Hooks (5 hooks) — All business logic and state management. Calculations memoized with useMemo.',
        'Pure Utility Functions (utils/) — All financial calculations are pure functions, no React dependencies. 13 utility files + 4 in calculations/ subdirectory.',
        'Services Layer (services/) — API integration with FMP and Yahoo Finance, error handling and data mapping.',
        'Constants Layer (constants/) — Market defaults, valuation styles, initial data as separate modules.',
        'Component Layer — 40+ presentational components organized: layout/, input/, valuation/, charts/, shared/.',
        'Lazy Loading — Tab content lazy-loaded with React.lazy() and Suspense. ErrorBoundary wraps each tab.',
        'Web Worker — Monte Carlo simulation runs in dedicated worker thread (monteCarlo.worker.ts).',
    ]
    for item in items:
        doc.add_paragraph(item, style='List Bullet')
    doc.add_page_break()
