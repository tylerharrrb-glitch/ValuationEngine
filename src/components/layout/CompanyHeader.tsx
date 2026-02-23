/**
 * Company Header — Displays ticker, price, recommendation badge, and export buttons.
 */
import React from 'react';
import { FileText, FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection } from '../../types/financial';
import { formatPrice, CurrencyCode } from '../../utils/formatters';
import { exportToPDF } from '../../utils/pdfExport';
import { exportToExcelWithFormulas } from '../../utils/excelExportPro';
import { ScenarioType } from '../ScenarioToggle';
import { Recommendation } from '../../utils/calculations/metrics';

interface CompanyHeaderProps {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  adjustedAssumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  dcfProjections: DCFProjection[];
  dcfValue: number;
  comparableValue: number;
  upside: number;
  recommendation: Recommendation;
  scenario: ScenarioType;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  financialData, assumptions, adjustedAssumptions, comparables,
  dcfProjections, dcfValue, comparableValue, upside, recommendation,
  scenario, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const isPositive = upside >= 0;

  const recStyles: Record<string, string> = {
    'STRONG BUY': 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    'BUY': 'text-green-400 bg-green-500/15 border-green-500/30',
    'HOLD': 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
    'SELL': 'text-red-400 bg-red-500/15 border-red-500/30',
    'STRONG SELL': 'text-rose-400 bg-rose-500/15 border-rose-500/30',
  };
  const recColor = recStyles[recommendation.text] || recStyles['HOLD'];

  const handlePDF = () => {
    exportToPDF({
      financialData,
      assumptions: adjustedAssumptions,
      comparables,
      dcfProjections,
      dcfValue,
      comparableValue,
      scenario,
    });
  };

  const handleExcel = () => {
    exportToExcelWithFormulas(financialData, adjustedAssumptions, comparables);
  };

  return (
    <div className={`p-5 rounded-xl border mb-6 ${cardClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Company Info */}
        <div className="flex items-center gap-4">
          <div>
            <h2 className={`text-2xl font-bold tracking-tight ${textClass}`}>
              {financialData.companyName || 'Company'}
            </h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`font-mono text-sm px-2 py-0.5 rounded ${
                isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {financialData.ticker || '—'}
              </span>
              <span className={`text-xl font-semibold tabular-nums ${textClass}`}>
                {formatPrice(financialData.currentStockPrice, currency)}
              </span>
              <span className={`flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full ${
                isPositive
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-red-400 bg-red-500/10'
              }`}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(upside).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <span className={`px-3.5 py-1.5 rounded-full text-sm font-bold border tracking-wide ${recColor}`}>
            {recommendation.text}
          </span>
          <div className={`w-px h-8 ${isDarkMode ? 'bg-zinc-700' : 'bg-gray-200'}`} />
          <button
            onClick={handleExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            title="Export to Excel with live formulas"
          >
            <FileSpreadsheet size={16} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handlePDF}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            title="Export valuation report as PDF"
          >
            <FileText size={16} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyHeader;
