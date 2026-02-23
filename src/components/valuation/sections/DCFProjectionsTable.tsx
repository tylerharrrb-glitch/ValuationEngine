import React from 'react';
import { Tooltip } from '../../Tooltip';
import { DCFProjection } from '../../../types/financial';
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
}

export const DCFProjectionsTable: React.FC<Props> = ({
  dcfProjections, scenario, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => (
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
            <tr key={proj.year} className={isDarkMode ? 'border-t border-zinc-800' : 'border-t border-gray-200'}>
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
  </div>
);
