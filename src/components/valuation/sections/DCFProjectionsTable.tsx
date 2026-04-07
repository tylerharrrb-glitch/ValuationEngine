import React from 'react';
import { Tooltip } from '../../Tooltip';
import { DCFProjection, FinancialData, ValuationAssumptions } from '../../../types/financial';
import { ScenarioType, scenarioMultipliers } from '../../ScenarioToggle';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
  dcfProjections: DCFProjection[];
  scenario: ScenarioType;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
  financialData?: FinancialData;
  assumptions?: ValuationAssumptions;
}

export const DCFProjectionsTable: React.FC<Props> = ({
  dcfProjections, scenario, isDarkMode, cardClass, textClass, textMutedClass, currency,
  financialData, assumptions,
}) => {
  // Task #10: EBITDA margin reconciliation
  const isEbitda = financialData
    ? financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization
    : 0;
  const isEbitdaMargin = financialData && financialData.incomeStatement.revenue > 0
    ? (isEbitda / financialData.incomeStatement.revenue) * 100 : 0;
  const dcfEbitdaMargin = assumptions?.ebitdaMargin ?? 0;
  const marginGap = Math.abs(isEbitdaMargin - dcfEbitdaMargin);
  const showMarginNote = financialData && assumptions && marginGap > 1;

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        <Tooltip term="DCF">DCF Projections</Tooltip>
        <span className={`ml-2 text-sm font-normal ${textMutedClass}`}>({scenarioMultipliers[scenario].label})</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={textMutedClass}>
              <th className="text-left py-2 px-3">Year</th>
              <th className="text-right py-2 px-3">Revenue</th>
              <th className="text-right py-2 px-3"><Tooltip term="EBITDA">EBITDA</Tooltip></th>
              <th className="text-right py-2 px-3"><Tooltip term="FCF">FCF</Tooltip></th>
              <th className="text-right py-2 px-3"><Tooltip term="Discount Rate">Discount Factor</Tooltip></th>
              <th className="text-right py-2 px-3"><Tooltip term="NPV">Present Value</Tooltip></th>
            </tr>
          </thead>
          <tbody>
            {dcfProjections.map((proj) => (
              <tr key={proj.year} className={'border-t border-[var(--border)]'}>
                <td className={`py-2 px-3 font-medium ${textClass}`}>{proj.year}</td>
                <td className={`py-2 px-3 text-right ${textClass}`}>{formatCurrencyShort(proj.revenue, currency)}</td>
                <td className={`py-2 px-3 text-right ${textClass}`}>{formatCurrencyShort(proj.ebitda, currency)}</td>
                <td className="py-2 px-3 text-right text-green-500">{formatCurrencyShort(proj.freeCashFlow, currency)}</td>
                <td className={`py-2 px-3 text-right ${textMutedClass}`}>{proj.discountFactor.toFixed(3)}</td>
                <td className={`py-2 px-3 text-right ${textClass}`}>{formatCurrencyShort(proj.presentValue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Task #10: EBITDA Reconciliation Note */}
      {showMarginNote && (
        <div className={`mt-3 text-xs p-2.5 rounded-lg ${isDarkMode ? 'bg-zinc-800/50 border border-zinc-700 text-zinc-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          ℹ️ Historical EBITDA margin ({isEbitdaMargin.toFixed(1)}%) differs from DCF projection driver ({dcfEbitdaMargin.toFixed(1)}%) by {marginGap.toFixed(1)}pp.
          This is intentional — the DCF uses your assumed <strong>forward margin</strong>, which may reflect margin compression, expansion, or sector normalization targets. The trailing margin is derived from reported financials.
        </div>
      )}
    </div>
  );
};
