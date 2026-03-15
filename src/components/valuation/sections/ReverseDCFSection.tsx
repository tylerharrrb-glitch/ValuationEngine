import React from 'react';
import { CurrencyCode } from '../../../utils/formatters';

interface ReverseDCFData {
  impliedGrowthRate: number;
  baseGrowthRate: number;
  growthGap: number;
  marketExpectation: string;
  narrative: string;
}

interface Props {
  reverseDCF: ReverseDCFData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ReverseDCFSection: React.FC<Props> = ({
  reverseDCF, isDarkMode, cardClass, textClass, textMutedClass,
}) => (
  <div className={`p-6 rounded-xl border ${cardClass}`}>
    <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
      Reverse DCF — What the Market is Pricing In
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
        <div className={`text-sm ${textMutedClass}`}>Implied Growth Rate</div>
        <div className={`text-2xl font-bold ${
          reverseDCF.marketExpectation === 'aggressive' ? 'text-red-400'
          : reverseDCF.marketExpectation === 'conservative' ? 'text-green-400'
          : 'text-yellow-400'
        }`}>{reverseDCF.impliedGrowthRate}%</div>
        <div className={`text-xs ${textMutedClass}`}>Annual revenue growth priced in</div>
      </div>
      <div className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
        <div className={`text-sm ${textMutedClass}`}>Our Base Case Growth</div>
        <div className="text-2xl font-bold text-blue-400">{reverseDCF.baseGrowthRate}%</div>
        <div className={`text-xs ${textMutedClass}`}>WOLF fundamental estimate</div>
      </div>
      <div className={`p-4 rounded-lg ${
        reverseDCF.growthGap > 3 ? 'bg-red-500/10 border border-[var(--accent-gold)]/30'
        : reverseDCF.growthGap < -3 ? 'bg-green-500/10 border border-green-500/30'
        : 'bg-yellow-500/10 border border-yellow-500/30'
      }`}>
        <div className={`text-sm ${textMutedClass}`}>Growth Gap</div>
        <div className={`text-2xl font-bold ${reverseDCF.growthGap > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {reverseDCF.growthGap > 0 ? '+' : ''}{reverseDCF.growthGap}%
        </div>
        <div className={`text-xs ${textMutedClass}`}>
          Market expects {reverseDCF.growthGap > 0 ? 'MORE' : 'LESS'} growth
        </div>
      </div>
    </div>
    <div className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
      <p className={`text-sm ${textMutedClass}`}>{reverseDCF.narrative}</p>
    </div>
  </div>
);
