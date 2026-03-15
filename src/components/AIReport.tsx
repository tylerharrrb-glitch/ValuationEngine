import React, { useState } from 'react';
import { Sparkles, Loader2, Copy, Check, FileText } from 'lucide-react';
import { FinancialData, ValuationAssumptions } from '../types/financial';
import { formatNumber, formatPercent, formatCurrency } from '../utils/formatters';
import { CurrencyCode } from '../utils/formatters';

interface AIReportProps {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  dcfValue: number;
  comparableValue: number;
  scenario: 'bear' | 'base' | 'bull';
  isDarkMode: boolean;
  currency?: CurrencyCode;
}

export const AIReport: React.FC<AIReportProps> = ({
  financialData,
  assumptions,
  dcfValue,
  comparableValue,
  scenario,
  isDarkMode,
  currency = 'USD',
}) => {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateReport = async () => {
    setLoading(true);

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { incomeStatement, balanceSheet } = financialData;
    const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;

    // Calculate key metrics
    const currentPrice = financialData.currentStockPrice;
    const blendedValue = (dcfValue * 0.6 + comparableValue * 0.4);
    const upside = ((blendedValue - currentPrice) / currentPrice) * 100;
    const grossMargin = (incomeStatement.revenue - incomeStatement.costOfGoodsSold) / incomeStatement.revenue * 100;
    const netMargin = incomeStatement.netIncome / incomeStatement.revenue * 100;
    const roe = incomeStatement.netIncome / balanceSheet.totalEquity * 100;
    const debtToEquity = totalDebt / balanceSheet.totalEquity;

    // Determine recommendation — aligned with engine thresholds
    let recommendation = '';
    if (upside > 30) {
      recommendation = 'STRONG BUY';
    } else if (upside > 10) {
      recommendation = 'BUY';
    } else if (upside > -10) {
      recommendation = 'HOLD';
    } else if (upside > -20) {
      recommendation = 'SELL';
    } else {
      recommendation = 'STRONG SELL';
    }

    // Currency-aware formatting helper
    const fmtC = (v: number) => formatCurrency(v, 0, currency);

    // Generate the report
    const scenarioText = {
      bear: 'pessimistic (Bear Case)',
      base: 'balanced (Base Case)',
      bull: 'optimistic (Bull Case)',
    };

    const generatedReport = `
# WOLF Investment Analysis Report
## ${financialData.companyName} (${financialData.ticker})

---

### Executive Summary

Based on our comprehensive ${scenarioText[scenario]} analysis, **${financialData.companyName}** presents a **${recommendation}** opportunity with a blended fair value of **${fmtC(blendedValue)}** per share, representing a **${upside > 0 ? '+' : ''}${formatPercent(upside)}** ${upside > 0 ? 'upside' : 'downside'} from the current price of ${fmtC(currentPrice)}.

---

### Valuation Summary

| Method | Fair Value | Weight |
|--------|------------|--------|
| DCF Analysis | ${fmtC(dcfValue)} | 60% |
| Comparable Companies | ${fmtC(comparableValue)} | 40% |
| **Blended Value** | **${fmtC(blendedValue)}** | 100% |

---

### Financial Highlights

**Profitability Metrics:**
- Revenue: ${formatNumber(incomeStatement.revenue)}
- Gross Margin: ${formatPercent(grossMargin)}
- Net Margin: ${formatPercent(netMargin)}
- Return on Equity: ${formatPercent(roe)}

**Financial Health:**
- Total Assets: ${formatNumber(balanceSheet.totalAssets)}
- Total Debt: ${formatNumber(totalDebt)}
- Debt/Equity Ratio: ${debtToEquity.toFixed(2)}x

**DCF Assumptions:**
- WACC: ${formatPercent(assumptions.discountRate)}
- Terminal Growth: ${formatPercent(assumptions.terminalGrowthRate)}
- Projection Period: ${assumptions.projectionYears} years

---

### Investment Thesis

${upside > 10 ? `
**Bullish Factors:**
- The stock appears undervalued based on our ${scenarioText[scenario]} DCF model
- Strong profitability with ${formatPercent(netMargin)} net margin
- ${roe > 15 ? `Excellent return on equity of ${formatPercent(roe)}` : `Solid return on equity of ${formatPercent(roe)}`}
- ${debtToEquity < 0.5 ? 'Conservative balance sheet with low leverage' : debtToEquity < 1 ? 'Moderate leverage levels' : 'Higher leverage that could amplify returns'}
` : upside < -10 ? `
**Bearish Factors:**
- The stock appears overvalued based on our ${scenarioText[scenario]} DCF model
- Current price of ${fmtC(currentPrice)} exceeds our fair value estimate
- ${netMargin < 10 ? 'Margin pressure may limit earnings growth' : ''}
- Market expectations may be too optimistic
` : `
**Balanced View:**
- The stock appears fairly valued at current levels
- ${netMargin > 15 ? 'Strong margins provide a buffer against downside' : 'Margins are adequate for the industry'}
- ${debtToEquity < 0.5 ? 'Healthy balance sheet supports stability' : 'Monitor leverage levels'}
`}

---

### Risk Factors

1. **Market Risk:** Broader market conditions could impact valuation multiples
2. **Execution Risk:** ${assumptions.revenueGrowthRate > 15 ? 'Aggressive growth assumptions may not materialize' : 'Growth targets are achievable but not guaranteed'}
3. **Competitive Risk:** Industry dynamics could pressure margins
4. **Interest Rate Risk:** Higher rates could impact WACC and terminal value

---

### Recommendation

**${recommendation}**

${recommendation.includes('BUY') ?
        `We recommend accumulating shares below ${fmtC(blendedValue * 0.9)} for optimal entry.` :
        recommendation.includes('SELL') ?
          `We recommend reducing positions and reallocating capital to better opportunities.` :
          `We recommend holding current positions and monitoring for better entry points.`
      }

---

*Report generated by WOLF Valuation Engine*
*Analysis Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*
*Scenario: ${scenarioText[scenario]}*
    `.trim();

    setReport(generatedReport);
    setLoading(false);
  };

  const copyToClipboard = async () => {
    if (report) {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`rounded-xl border ${isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-gray-200'}`}>
      <div className={`p-4 border-b ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h3 className={`font-semibold ${'text-[var(--text-primary)]'}`}>
                AI Investment Report
              </h3>
              <p className={`text-sm ${'text-[var(--text-secondary)]'}`}>
                Generate a professional analysis using AI
              </p>
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>

      {report && (
        <div className="p-4">
          <div className="flex justify-end mb-3">
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${isDarkMode
                ? 'bg-zinc-700 hover:bg-zinc-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy Report
                </>
              )}
            </button>
          </div>

          <div className={`p-6 rounded-lg font-mono text-sm whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'bg-zinc-900 text-gray-300' : 'bg-gray-50 text-gray-700'
            }`}>
            {(() => {
              // Helper: parse **bold** inline markdown
              const renderInline = (text: string) => {
                const parts = text.split(/(\*\*[^*]+\*\*)/g);
                return parts.map((part, i) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
                  }
                  return <span key={i}>{part}</span>;
                });
              };

              // Parse cells from a pipe-delimited row
              const parseCells = (row: string) =>
                row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());

              // Pre-process: group lines into blocks (table vs regular)
              const lines = report.split('\n');
              const blocks: { type: 'table' | 'line'; lines: string[]; startIdx: number }[] = [];
              let i = 0;
              while (i < lines.length) {
                if (lines[i].startsWith('|')) {
                  const tableLines: string[] = [];
                  const startIdx = i;
                  while (i < lines.length && lines[i].startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                  }
                  blocks.push({ type: 'table', lines: tableLines, startIdx });
                } else {
                  blocks.push({ type: 'line', lines: [lines[i]], startIdx: i });
                  i++;
                }
              }

              return blocks.map((block, bIdx) => {
                if (block.type === 'table') {
                  // Render as HTML table
                  const tableRows = block.lines.filter(l => !l.match(/^\|[\s\-:|]+\|$/)); // skip separator
                  if (tableRows.length === 0) return null;
                  const headerCells = parseCells(tableRows[0]);
                  const bodyRows = tableRows.slice(1);
                  return (
                    <table key={`t${bIdx}`} className={`w-full my-3 text-xs border-collapse ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-300'}`}>
                      <thead>
                        <tr className={isDarkMode ? 'bg-zinc-800 text-white' : 'bg-gray-200 text-gray-900'}>
                          {headerCells.map((c, ci) => (
                            <th key={ci} className="px-3 py-2 text-left font-semibold border border-zinc-600">
                              {renderInline(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bodyRows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0
                            ? (isDarkMode ? 'bg-[var(--bg-card)]' : 'bg-white')
                            : ('bg-[var(--bg-secondary)]')}>
                            {parseCells(row).map((c, ci) => (
                              <td key={ci} className="px-3 py-1.5 border border-zinc-700">
                                {renderInline(c)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                }

                // Regular line rendering
                const line = block.lines[0];
                const index = block.startIdx;
                if (line.startsWith('# ')) {
                  return <h1 key={index} className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{line.replace('# ', '')}</h1>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={index} className={`text-xl font-semibold mb-3 ${'text-[var(--text-primary)]'}`}>{line.replace('## ', '')}</h2>;
                }
                if (line.startsWith('### ')) {
                  return <h3 key={index} className={`text-lg font-semibold mt-4 mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{line.replace('### ', '')}</h3>;
                }
                if (line.startsWith('---')) {
                  return <hr key={index} className={`my-4 ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-300'}`} />;
                }
                if (line.startsWith('*Report') || line.startsWith('*Analysis') || line.startsWith('*Scenario')) {
                  return <p key={index} className="italic text-gray-500 text-xs mt-2">{line.replace(/\*/g, '')}</p>;
                }
                if (line.includes('STRONG BUY') || line.includes('BUY')) {
                  return <p key={index} className="text-green-400 font-bold text-lg">{line.replace(/\*\*/g, '')}</p>;
                }
                if (line.includes('STRONG SELL') || line.includes('SELL')) {
                  return <p key={index} className="text-red-400 font-bold text-lg">{line.replace(/\*\*/g, '')}</p>;
                }
                if (line.includes('HOLD')) {
                  return <p key={index} className="text-yellow-400 font-bold text-lg">{line.replace(/\*\*/g, '')}</p>;
                }
                return <p key={index} className="mb-1">{renderInline(line)}</p>;
              });
            })()}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className={`p-8 text-center ${'text-[var(--text-muted)]'}`}>
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>Click "Generate Report" to create an AI-powered investment analysis</p>
        </div>
      )}
    </div>
  );
};

export default AIReport;
