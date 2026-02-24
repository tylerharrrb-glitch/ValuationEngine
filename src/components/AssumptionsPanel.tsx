import { ValuationAssumptions, MarketRegion, EgyptTaxCategory } from '../types/financial';
import { EGYPTIAN_TAX_CATEGORIES } from '../constants/marketDefaults';
import { formatPercent } from '../utils/formatters';
import { Settings, Info, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  assumptions: ValuationAssumptions;
  onChange: (assumptions: ValuationAssumptions) => void;
  calculatedWacc: number;
  marketRegion?: MarketRegion;
}

export function AssumptionsPanel({ assumptions, onChange, calculatedWacc, marketRegion = 'Egypt' }: Props) {
  const updateField = (key: keyof ValuationAssumptions, value: any) => {
    onChange({ ...assumptions, [key]: value });
  };

  const inputClass = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm";
  const selectClass = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm appearance-none";
  const labelClass = "block text-zinc-500 text-xs font-medium mb-1";
  const sectionClass = "border-t border-zinc-800 pt-4 mt-4";

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center">
          <Settings className="w-4 h-4 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white">Valuation Assumptions</h2>
        <span className="ml-auto text-xs text-zinc-600">
          {marketRegion === 'Egypt' ? '🇪🇬 Egyptian Market' : '🇺🇸 US Market'}
        </span>
      </div>

      {/* ── CAPM Method Toggle ── */}
      <div className="mb-4">
        <label className={labelClass}>CAPM Method</label>
        <div className="flex gap-2">
          <button
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${assumptions.capmMethod === 'A'
              ? 'bg-red-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            onClick={() => updateField('capmMethod', 'A')}
          >
            A — Local Currency
          </button>
          <button
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${assumptions.capmMethod === 'B'
              ? 'bg-red-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            onClick={() => updateField('capmMethod', 'B')}
          >
            B — USD Build-Up
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-1">
          {assumptions.capmMethod === 'A'
            ? 'Ke = Rf(Egypt) + β × ERP. CRP embedded in local Rf.'
            : 'Ke = Rf(US) + β × ERP + CRP, then Fisher adjustment to EGP.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* ── WACC / Cost of Capital ── */}
        <div>
          <label className={labelClass}>WACC (Discount Rate) %</label>
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
          <label className={labelClass}>Risk-Free Rate %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.riskFreeRate}
            onChange={(e) => updateField('riskFreeRate', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
          <p className="text-xs text-zinc-600 mt-0.5">
            {assumptions.capmMethod === 'A' ? '10Y Egyptian Bond' : '10Y US Treasury'}
          </p>
        </div>

        <div>
          <label className={labelClass}>Equity Risk Premium %</label>
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

        <div>
          <label className={labelClass}>Beta Type</label>
          <select
            value={assumptions.betaType}
            onChange={(e) => updateField('betaType', e.target.value)}
            className={selectClass}
          >
            <option value="raw">Raw Beta</option>
            <option value="adjusted">Adjusted (Bloomberg)</option>
            <option value="relevered">Relevered</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Cost of Debt (Pre-Tax) %</label>
          <input
            type="number"
            step="0.1"
            value={assumptions.costOfDebt}
            onChange={(e) => updateField('costOfDebt', parseFloat(e.target.value) || 0)}
            className={inputClass}
          />
        </div>

        {/* ── Method B: CRP Fields (conditional) ── */}
        {assumptions.capmMethod === 'B' && (
          <>
            <div>
              <label className={labelClass}>US Risk-Free Rate %</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.rfUS}
                onChange={(e) => updateField('rfUS', parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country Risk Premium %</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.countryRiskPremium}
                onChange={(e) => updateField('countryRiskPremium', parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Egypt Inflation %</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.egyptInflation}
                onChange={(e) => updateField('egyptInflation', parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>US Inflation %</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.usInflation}
                onChange={(e) => updateField('usInflation', parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Tax Category ── */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">Tax & Projection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketRegion === 'Egypt' ? (
            <div>
              <label className={labelClass}>Egyptian Tax Category</label>
              <select
                value={assumptions.taxCategory || 'standard'}
                onChange={(e) => {
                  const cat = EGYPTIAN_TAX_CATEGORIES.find(c => c.id === e.target.value);
                  if (cat) {
                    onChange({ ...assumptions, taxCategory: e.target.value as EgyptTaxCategory, taxRate: cat.rate });
                  }
                }}
                className={selectClass}
              >
                {EGYPTIAN_TAX_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label} ({cat.rate}%)</option>
                ))}
              </select>
            </div>
          ) : (
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
          )}

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
            <label className={labelClass}>Terminal Growth Rate %</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.terminalGrowthRate}
              onChange={(e) => updateField('terminalGrowthRate', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Projection Drivers ── */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">FCFF Projection Drivers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Revenue Growth %</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.revenueGrowthRate}
              onChange={(e) => updateField('revenueGrowthRate', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>EBITDA Margin %</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.ebitdaMargin}
              onChange={(e) => updateField('ebitdaMargin', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>D&A (% of Rev)</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.daPercent}
              onChange={(e) => updateField('daPercent', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>CapEx (% of Rev)</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.capexPercent}
              onChange={(e) => updateField('capexPercent', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>ΔWC (% of Rev)</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.deltaWCPercent}
              onChange={(e) => updateField('deltaWCPercent', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Margin Improvement %/yr</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.marginImprovement}
              onChange={(e) => updateField('marginImprovement', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Terminal Value & Discounting ── */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">Terminal Value & Discounting</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Terminal Value Method</label>
            <select
              value={assumptions.terminalMethod}
              onChange={(e) => updateField('terminalMethod', e.target.value)}
              className={selectClass}
            >
              <option value="gordon_growth">Gordon Growth Model</option>
              <option value="exit_multiple">Exit Multiple</option>
            </select>
          </div>

          {assumptions.terminalMethod === 'exit_multiple' && (
            <div>
              <label className={labelClass}>Exit EBITDA Multiple</label>
              <input
                type="number"
                step="0.5"
                value={assumptions.exitMultiple}
                onChange={(e) => updateField('exitMultiple', parseFloat(e.target.value) || 8)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Discounting Convention</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${assumptions.discountingConvention === 'end_of_year'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                onClick={() => updateField('discountingConvention', 'end_of_year')}
              >
                End of Year
              </button>
              <button
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${assumptions.discountingConvention === 'mid_year'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                onClick={() => updateField('discountingConvention', 'mid_year')}
              >
                Mid-Year
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── DDM Parameters ── */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">DDM Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Stable Growth Rate %</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.ddmStableGrowth}
              onChange={(e) => updateField('ddmStableGrowth', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>High Growth Rate %</label>
            <input
              type="number"
              step="0.1"
              value={assumptions.ddmHighGrowth}
              onChange={(e) => updateField('ddmHighGrowth', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>High Growth Years</label>
            <input
              type="number"
              min="1"
              max="10"
              value={assumptions.ddmHighGrowthYears}
              onChange={(e) => updateField('ddmHighGrowthYears', parseInt(e.target.value) || 5)}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
