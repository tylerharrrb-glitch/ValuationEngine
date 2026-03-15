/**
 * Company Header — Hero strip with company info, recommendation, and exports.
 */
import React, { useState } from 'react';
import { FileText, FileSpreadsheet, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection } from '../../types/financial';
import { formatPrice, CurrencyCode } from '../../utils/formatters';
import { exportToPDF } from '../../utils/pdfExport';
import { exportToExcelWithFormulas } from '../../utils/excelExportPro';
import { ScenarioType } from '../ScenarioToggle';
import { Recommendation } from '../../utils/calculations/metrics';
import { isWolfConfigured, callWolfAnalyst } from '../../services/wolfAnalyst';

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
  onOpenWolfAnalyst?: () => void;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  financialData, assumptions, adjustedAssumptions, comparables,
  dcfProjections, dcfValue, comparableValue, upside, recommendation,
  scenario, currency, onOpenWolfAnalyst,
}) => {
  const isPositive = upside >= 0;
  const [verifying, setVerifying] = useState<'pdf' | 'excel' | null>(null);

  const recStyles: Record<string, string> = {
    'STRONG BUY': 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    'BUY': 'text-green-400 bg-green-500/15 border-green-500/30',
    'HOLD': 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
    'SELL': 'text-red-400 bg-red-500/15 border-[var(--accent-gold)]/30',
    'STRONG SELL': 'text-rose-400 bg-rose-500/15 border-rose-500/30',
  };
  const recColor = recStyles[recommendation.text] || recStyles['HOLD'];

  const verifyAndExport = async (type: 'pdf' | 'excel') => {
    if (type === 'pdf') {
      exportToPDF({
        financialData,
        assumptions: adjustedAssumptions,
        comparables,
        dcfProjections,
        dcfValue,
        comparableValue,
        scenario,
      });
    } else {
      exportToExcelWithFormulas(financialData, adjustedAssumptions, comparables);
    }

    if (isWolfConfigured() && onOpenWolfAnalyst) {
      setVerifying(type);
      try {
        const reply = await callWolfAnalyst({
          mode: 'verify',
          userMessage: `Verify all values before ${type.toUpperCase()} export. Flag any discrepancy.`,
          financialData,
          assumptions: adjustedAssumptions,
          comparables,
          dcfProjections,
          dcfValue,
          comparableValue,
          blendedValue: dcfValue * 0.6 + comparableValue * 0.4,
          upside,
        });
        if (reply.includes('❌') || reply.includes('Discrepancy')) {
          onOpenWolfAnalyst();
        }
      } catch {
        // Verification failed silently — export already succeeded
      } finally {
        setVerifying(null);
      }
    }
  };

  const handlePDF = () => verifyAndExport('pdf');
  const handleExcel = () => verifyAndExport('excel');

  return (
    <section
      className="relative"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '48px 0 40px',
      }}
    >
      {/* Radial glow */}
      <div className="hero-glow" />

      <div className="max-w-[1100px] mx-auto px-6">
        {/* Mono label */}
        <span className="section-label">EQUITY VALUATION · INSTITUTIONAL GRADE</span>

        {/* Company Name + Badge Row */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2
              style={{ fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', lineHeight: 1.2, color: 'var(--text-primary)' }}
            >
              {financialData.companyName || 'WOLF Valuation Engine'}
            </h2>
            <p style={{ fontFamily: 'var(--ff-mono)', color: 'var(--text-secondary)', fontSize: '.85rem', marginTop: '8px' }}>
              DCF Analysis · Monte Carlo Simulation · Comparable Company Analysis
            </p>
          </div>

          {/* Recommendation + Price */}
          <div className="flex items-center gap-4">
            {financialData.ticker && (
              <div className="text-right">
                <span
                  className="block"
                  style={{ fontFamily: 'var(--ff-mono)', fontSize: '.75rem', color: 'var(--text-muted)' }}
                >
                  {financialData.ticker}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    style={{ fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-primary)' }}
                  >
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
            )}
            <span className={`px-3.5 py-1.5 rounded-full text-sm font-bold border tracking-wide ${recColor}`}>
              {recommendation.text}
            </span>
          </div>
        </div>

        {/* Stat Badges + Export Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="stat-pill">3 Valuation Methods</span>
            <span className="stat-pill">Automated PDF/Excel Output</span>
            <span className="stat-pill">Institutional-Grade Accuracy</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExcel}
              disabled={verifying === 'excel'}
              className="btn-outline text-sm"
              title="Export to Excel with live formulas"
            >
              {verifying === 'excel' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={handlePDF}
              disabled={verifying === 'pdf'}
              className="btn-outline text-sm"
              title="Export valuation report as PDF"
            >
              {verifying === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompanyHeader;
