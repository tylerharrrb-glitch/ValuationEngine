import { ValuationAssumptions } from '../types/financial';
import { formatPercent } from '../utils/formatters';
import { Settings, Info } from 'lucide-react';

interface Props {
  assumptions: ValuationAssumptions;
  onChange: (assumptions: ValuationAssumptions) => void;
  calculatedWacc: number;
}

export function AssumptionsPanel({ assumptions, onChange, calculatedWacc }: Props) {
  const updateField = (key: keyof ValuationAssumptions, value: number) => {
    onChange({ ...assumptions, [key]: value });
  };

  const inputClass = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm";
  const labelClass = "block text-zinc-500 text-xs font-medium mb-1";

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center">
          <Settings className="w-4 h-4 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white">Valuation Assumptions</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Discount Rate (WACC) %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.discountRate}
            onChange={(e) => updateField('discountRate', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
          <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Calculated: {formatPercent(calculatedWacc)}
          </p>
        </div>
        
        <div>
          <label className={labelClass}>Terminal Growth Rate %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.terminalGrowthRate}
            onChange={(e) => updateField('terminalGrowthRate', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Projection Years</label>
          <input
            type="number"
            min="1"
            max="10"
            value={assumptions.projectionYears}
            onChange={(e) => updateField('projectionYears', parseInt(e.target.value) || 5)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Revenue Growth Rate %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.revenueGrowthRate}
            onChange={(e) => updateField('revenueGrowthRate', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Margin Improvement % (annual)</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.marginImprovement}
            onChange={(e) => updateField('marginImprovement', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Tax Rate %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.taxRate}
            onChange={(e) => updateField('taxRate', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Risk-Free Rate %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.riskFreeRate}
            onChange={(e) => updateField('riskFreeRate', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Market Risk Premium %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.marketRiskPremium}
            onChange={(e) => updateField('marketRiskPremium', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Beta</label>
          <input
            type="number"
            step="0.01"
            value={assumptions.beta}
            onChange={(e) => updateField('beta', parseFloat(e.target.value) || 1)}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
