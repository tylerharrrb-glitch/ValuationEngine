import React from 'react';
import { CurrencyCode } from '../../../utils/formatters';

interface Props {
  dcfWeight: number;
  compsWeight: number;
  setDcfWeight: (w: number) => void;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const BlendedWeightSlider: React.FC<Props> = ({
  dcfWeight, compsWeight, setDcfWeight, cardClass, textClass,
}) => (
  <div className={`p-6 rounded-xl border ${cardClass}`}>
    <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Blended Valuation Weighting</h3>
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className={`text-sm font-medium ${textClass}`}>DCF: {dcfWeight}%</span>
        <input type="range" min="0" max="100" step="5" value={dcfWeight}
          onChange={(e) => setDcfWeight(parseInt(e.target.value))}
          className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
        <span className={`text-sm font-medium ${textClass}`}>Comps: {compsWeight}%</span>
      </div>
      <div className="flex gap-2">
        {[
          { label: '100% DCF', value: 100, active: 'bg-blue-600' },
          { label: '70/30', value: 70, active: 'bg-blue-600' },
          { label: '60/40', value: 60, active: 'bg-blue-600' },
          { label: '50/50', value: 50, active: 'bg-blue-600' },
          { label: '100% Comps', value: 0, active: 'bg-purple-600' },
        ].map(({ label, value, active }) => (
          <button key={label} onClick={() => setDcfWeight(value)}
            className={`px-3 py-1 text-xs rounded ${dcfWeight === value ? `${active} text-white` : 'bg-zinc-700 text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  </div>
);
