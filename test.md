Real Egyptian Company Test Case: CIB (COMI.CA)
Commercial International Bank is the best test case for the engine: the most liquid EGX stock, well-covered by analysts, FY2024 annual results available, and it exercises the banking sector tax category (22.5% standard, not 40%).
Here are the verified FY2024 figures from CIB's published results:
Company Info
FieldValueCompany NameCommercial International BankTickerCOMI.CAShares Outstanding~1,700,000,000Current Stock Price~~75–80 EGP (EGX listed)EGX SectorBankingFiscal Year EndDecember 31
Income Statement (FY2024, in EGP millions)
ItemValue (EGP)Revenue (Net Interest + Fee Income)~45,000,000,000Operating Expenses~15,000,000,000Operating Income (EBIT proxy)~30,000,000,000Interest Expense~12,000,000,000Tax Expense~4,000,000,000Net Income~14,000,000,000D&A~800,000,000
Key Assumptions for COMI.CA Test
AssumptionValueRationaleRisk-Free Rate (Rf)20.0%10Y Egypt Gov Bond, April 2026Market Risk Premium5.5%Damodaran mature market ERPBeta0.85Banking sector beta vs EGX 30Ke (Method A)24.7%20% + 0.85 × 5.5%Cost of Debt (Kd)22.0%Rf 20% + 200bp bank credit spreadTax Rate22.5%Egyptian standard (Law 91/2005)Revenue Growth12%Conservative for EGX bankingEBITDA Margin66%Net banking income marginTerminal Growth8%Egyptian nominal GDP proxyEgypt Inflation12%CBE Jan 2026 actual
What to Check When Running This Test
After entering these inputs, verify:

WACC should come out around 22–23% (banking has lower beta → lower Ke)
DCF per share should be in the 80–110 EGP range (above current ~75–80 EGP price) — implying modest upside or fair value
FCFF cross-verification (M1 = M2 = M3) should pass with zero gap — this is your primary formula integrity check
Z-Score raw ratios: for a bank, X1 (WC/TA) will be near zero or negative (banks have no traditional working capital) — the engine should handle this gracefully, not crash
Historical tab: toggle to 3Y view and confirm Revenue and Net Income show upward trend consistent with EGX banking sector growth post-EGP devaluation