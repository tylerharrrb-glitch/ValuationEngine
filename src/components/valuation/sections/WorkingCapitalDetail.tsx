/**
 * C2: Working Capital Detail Mode
 * Toggle between Simple (ΔWC% of ΔRevenue) and Detailed (DSO/DIO/DPO).
 * Shows historical DSO/DIO/DPO and CCC with projection capability.
 */
import React, { useState } from 'react';
import { FinancialData } from '../../../types/financial';
import { CurrencyCode } from '../../../utils/formatters';

interface Props {
    financialData: FinancialData;
    isDarkMode: boolean;
    cardClass: string;
    textClass: string;
    textMutedClass: string;
    currency: CurrencyCode;
}

export const WorkingCapitalDetail: React.FC<Props> = ({
    financialData, isDarkMode, cardClass, textClass, textMutedClass,
}) => {
    const [mode, setMode] = useState<'simple' | 'detailed'>('simple');
    const { incomeStatement: is, balanceSheet: bs } = financialData;

    const revenue = is.revenue || 1;
    const cogs = is.costOfGoodsSold || 1;

    // Historical WC components
    const ar = bs.accountsReceivable || 0;
    const inventory = bs.inventory || 0;
    const ap = bs.accountsPayable || 0;

    // DSO/DIO/DPO calculations
    const dso = revenue > 0 ? (ar / revenue) * 365 : 0;
    const dio = cogs > 0 ? (inventory / cogs) * 365 : 0;
    const dpo = cogs > 0 ? (ap / cogs) * 365 : 0;
    const ccc = dso + dio - dpo;

    // NWC
    const nwc = ar + inventory - ap;

    const inputClass = isDarkMode
        ? 'bg-zinc-800 border-zinc-700 text-white'
        : 'bg-white border-gray-300 text-gray-900';

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${textClass}`}>
                    Working Capital Analysis
                </h3>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                    <button
                        onClick={() => setMode('simple')}
                        className={`px-3 py-1 text-xs font-medium transition-all ${mode === 'simple' ? 'bg-red-600 text-white' : isDarkMode ? 'bg-zinc-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        Simple (ΔWC%)
                    </button>
                    <button
                        onClick={() => setMode('detailed')}
                        className={`px-3 py-1 text-xs font-medium transition-all ${mode === 'detailed' ? 'bg-red-600 text-white' : isDarkMode ? 'bg-zinc-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        Detailed (DSO/DIO/DPO)
                    </button>
                </div>
            </div>

            {mode === 'simple' ? (
                <div className="space-y-3">
                    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm font-medium mb-2 ${textClass}`}>Simple Mode</div>
                        <div className={`text-xs ${textMutedClass}`}>
                            ΔWC = ΔRevenue × WC%. Working capital change is calculated as a percentage of revenue change each projection year.
                            This is suitable when detailed balance sheet projections are not needed.
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                                <span className={`text-xs ${textMutedClass}`}>Historical NWC</span>
                                <div className={`text-lg font-bold ${textClass}`}>{(nwc / 1e6).toFixed(0)}M</div>
                            </div>
                            <div>
                                <span className={`text-xs ${textMutedClass}`}>NWC / Revenue</span>
                                <div className={`text-lg font-bold ${textClass}`}>{((nwc / revenue) * 100).toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* DSO/DIO/DPO breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'DSO', value: dso, desc: 'Days Sales Outstanding', formula: 'AR/Rev × 365', color: 'text-blue-400' },
                            { label: 'DIO', value: dio, desc: 'Days Inventory Outstanding', formula: 'Inv/COGS × 365', color: 'text-purple-400' },
                            { label: 'DPO', value: dpo, desc: 'Days Payables Outstanding', formula: 'AP/COGS × 365', color: 'text-orange-400' },
                            { label: 'CCC', value: ccc, desc: 'Cash Conversion Cycle', formula: 'DSO+DIO−DPO', color: 'text-green-400' },
                        ].map(item => (
                            <div key={item.label} className={`p-3 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                                <div className={`text-xs ${textMutedClass}`}>{item.desc}</div>
                                <div className={`text-2xl font-bold ${item.color}`}>{item.value.toFixed(1)}</div>
                                <div className={`text-xs ${textMutedClass}`}>{item.formula}</div>
                            </div>
                        ))}
                    </div>

                    {/* Components table */}
                    <div className={`overflow-x-auto rounded-lg border ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={isDarkMode ? 'bg-zinc-800' : 'bg-gray-50'}>
                                    <th className={`text-left py-2 px-4 ${textMutedClass}`}>Component</th>
                                    <th className={`text-right py-2 px-4 ${textMutedClass}`}>Balance</th>
                                    <th className={`text-right py-2 px-4 ${textMutedClass}`}>Days</th>
                                    <th className={`text-right py-2 px-4 ${textMutedClass}`}>% of Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className={`border-t ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
                                    <td className={`py-2 px-4 ${textClass}`}>Accounts Receivable</td>
                                    <td className={`py-2 px-4 text-right font-medium ${textClass}`}>{(ar / 1e6).toFixed(0)}M</td>
                                    <td className={`py-2 px-4 text-right text-blue-400`}>{dso.toFixed(1)}</td>
                                    <td className={`py-2 px-4 text-right ${textMutedClass}`}>{((ar / revenue) * 100).toFixed(1)}%</td>
                                </tr>
                                <tr className={`border-t ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
                                    <td className={`py-2 px-4 ${textClass}`}>Inventory</td>
                                    <td className={`py-2 px-4 text-right font-medium ${textClass}`}>{(inventory / 1e6).toFixed(0)}M</td>
                                    <td className={`py-2 px-4 text-right text-purple-400`}>{dio.toFixed(1)}</td>
                                    <td className={`py-2 px-4 text-right ${textMutedClass}`}>{((inventory / revenue) * 100).toFixed(1)}%</td>
                                </tr>
                                <tr className={`border-t ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
                                    <td className={`py-2 px-4 ${textClass}`}>Accounts Payable</td>
                                    <td className={`py-2 px-4 text-right font-medium ${textClass}`}>{(ap / 1e6).toFixed(0)}M</td>
                                    <td className={`py-2 px-4 text-right text-orange-400`}>{dpo.toFixed(1)}</td>
                                    <td className={`py-2 px-4 text-right ${textMutedClass}`}>{((ap / revenue) * 100).toFixed(1)}%</td>
                                </tr>
                                <tr className={`border-t-2 ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'} font-bold`}>
                                    <td className={`py-2 px-4 ${textClass}`}>Net Working Capital</td>
                                    <td className={`py-2 px-4 text-right ${textClass}`}>{(nwc / 1e6).toFixed(0)}M</td>
                                    <td className={`py-2 px-4 text-right text-green-400`}>{ccc.toFixed(1)}</td>
                                    <td className={`py-2 px-4 text-right ${textClass}`}>{((nwc / revenue) * 100).toFixed(1)}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className={`text-xs ${textMutedClass}`}>
                        In Detailed mode, projection years use these DSO/DIO/DPO values to project AR, Inventory, and AP separately. ΔWC is computed as the year-over-year change in NWC.
                    </div>
                </div>
            )}
        </div>
    );
};
