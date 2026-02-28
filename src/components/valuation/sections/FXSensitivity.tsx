/**
 * C9: FX Sensitivity Layer
 * Shows how EGP depreciation affects DCF valuation.
 * Collapsible section for Egyptian market valuations.
 */
import React, { useState } from 'react';
import { formatPrice, CurrencyCode } from '../../../utils/formatters';

interface Props {
    dcfPrice: number;
    currency: CurrencyCode;
    isDarkMode: boolean;
    cardClass: string;
    textClass: string;
    textMutedClass: string;
}

export const FXSensitivity: React.FC<Props> = ({
    dcfPrice, currency, isDarkMode, cardClass, textClass, textMutedClass,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [usdRevPct, setUsdRevPct] = useState(0);
    const [usdDebtPct, setUsdDebtPct] = useState(0);
    const [expectedDepreciation, setExpectedDepreciation] = useState(10);

    const depScenarios = [0, 5, 10, 15, 20];

    const calcFXAdjusted = (depPct: number): number => {
        const depFactor = 1 + depPct / 100;
        // USD revenue becomes worth more in EGP terms
        const revenueGainPct = (usdRevPct / 100) * (depFactor - 1);
        // USD debt increases in EGP terms (negative)
        const debtLossPct = (usdDebtPct / 100) * (depFactor - 1);
        // Net effect on DCF price
        const netEffect = revenueGainPct - debtLossPct * 0.3; // Scaled for debt (smaller base)
        return dcfPrice * (1 + netEffect);
    };

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full text-left`}
            >
                <h3 className={`text-lg font-semibold ${textClass}`}>
                    🔄 FX Sensitivity Analysis (EGP)
                </h3>
                <span className={textMutedClass}>{isOpen ? '▼' : '▶'}</span>
            </button>

            {isOpen && (
                <div className="mt-4 space-y-4">
                    {/* Input controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>USD Revenue %</label>
                            <input
                                type="number"
                                value={usdRevPct}
                                onChange={(e) => setUsdRevPct(parseFloat(e.target.value) || 0)}
                                className={`w-full px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300'}`}
                                min={0} max={100} step={5}
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>USD Debt %</label>
                            <input
                                type="number"
                                value={usdDebtPct}
                                onChange={(e) => setUsdDebtPct(parseFloat(e.target.value) || 0)}
                                className={`w-full px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300'}`}
                                min={0} max={100} step={5}
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>Expected EGP Depn (%/yr)</label>
                            <input
                                type="number"
                                value={expectedDepreciation}
                                onChange={(e) => setExpectedDepreciation(parseFloat(e.target.value) || 0)}
                                className={`w-full px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300'}`}
                                min={0} max={50} step={5}
                            />
                        </div>
                    </div>

                    {/* Sensitivity table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
                                    <th className={`text-left py-2 ${textMutedClass}`}>EGP Depreciation</th>
                                    {depScenarios.map(d => (
                                        <th key={d} className={`text-center py-2 ${d === expectedDepreciation ? 'text-amber-400 font-bold' : textMutedClass}`}>
                                            {d}%
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className={`border-b ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
                                    <td className={`py-2 ${textMutedClass}`}>DCF Price (EGP)</td>
                                    {depScenarios.map(d => {
                                        const adj = calcFXAdjusted(d);
                                        return (
                                            <td key={d} className={`text-center py-2 font-medium ${d === expectedDepreciation ? 'text-amber-400' : textClass
                                                }`}>
                                                {formatPrice(adj, currency)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr>
                                    <td className={`py-2 ${textMutedClass}`}>% Change</td>
                                    {depScenarios.map(d => {
                                        const adj = calcFXAdjusted(d);
                                        const pctChg = ((adj - dcfPrice) / dcfPrice) * 100;
                                        return (
                                            <td key={d} className={`text-center py-2 font-medium ${pctChg > 0 ? 'text-green-400' : pctChg < 0 ? 'text-red-400' : textMutedClass
                                                }`}>
                                                {pctChg >= 0 ? '+' : ''}{pctChg.toFixed(1)}%
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className={`text-xs ${textMutedClass}`}>
                        EGP depreciation ↑ USD revenue (positive) but ↑ EGP cost of USD debt (negative). Net effect depends on USD exposure mix.
                    </div>
                </div>
            )}
        </div>
    );
};
