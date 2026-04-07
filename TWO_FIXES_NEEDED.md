WOLF ENGINE — TWO FIXES NEEDED

Fix 1 — egyptMarketData.ts: Update CBE rates to April 2026 actual values
The CBE rates panel currently shows the March 2024 peak rates.
Update to:
  cbeBenchmarkDepositRate: 19.00,   // Was 27.25% — CBE cut to 19% on Feb 12, 2026
  cbeLendingRate: 20.00,             // Was 28.25% — CBE lending now 20%
  mainOperationRate: 19.50,
  discountRate: 19.50,
  lastUpdated: "2026-04-02",         // CBE held unchanged on April 2, 2026
  nextMeetingNote: "Rates on hold — geopolitical uncertainty"

The 10Y Gov Bond at 20% is correct. Rf stays at 20%.
The "Apply 20% as Rf" button behavior is correct — keep it.

Fix 2 — InputTab.tsx (or wherever tab labels are rendered): 
Add subtitle text under each input sub-tab label:
  - "Income Statement" → add subtitle: "Base Year (Most Recent Fiscal Year)"
  - "Balance Sheet"    → add subtitle: "Base Year (Most Recent Fiscal Year)"
  - "Cash Flow"        → add subtitle: "Base Year (Most Recent Fiscal Year)"
  - "Historical"       → add subtitle: "Multi-Period Trends (2021–2025)"
  
This is a UI-only change. Do NOT change any calculation logic.
Display the subtitle in a smaller muted font (text-xs text-gray-400) 
below each tab name.

Verification:
- CBE Deposit panel shows 19.00%, not 27.25%
- CBE Lending panel shows 20.00%, not 28.25%
- Tab labels show subtitles on the Assumptions page and all input sub-tabs
- Build: 0 errors
- TechCorp canonical test: DCF = 43.93 EGP still passes (no calc changes)