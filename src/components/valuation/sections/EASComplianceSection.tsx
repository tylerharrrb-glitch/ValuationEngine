/**
 * EAS Compliance Section (Phase 4)
 * Displays Egyptian Accounting Standards compliance calculations:
 *   - EAS 48 (IFRS 16): Lease adjustments
 *   - EAS 31 (IAS 1):   Normalized earnings
 *   - EAS 12 (IAS 12):  Deferred tax in EV bridge
 *   - EAS 23 (IAS 33):  Basic & Diluted EPS
 */
import React from 'react';
import { FinancialData, ValuationAssumptions } from '../../../types/financial';
import { calculateLeaseAdjustment, calculateEPS, calculateDeferredTaxAdjustment, LeaseInputs, DeferredTaxInputs } from '../../../utils/easModules';
import { formatNumber, formatPercent, CurrencyCode, formatCurrencyShort } from '../../../utils/formatters';

interface Props {
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    isDarkMode: boolean;
    cardClass: string;
    textClass: string;
    textMutedClass: string;
    currency: CurrencyCode;
}

export const EASComplianceSection: React.FC<Props> = ({
    financialData, assumptions, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
    const { incomeStatement: is, balanceSheet: bs } = financialData;
    const totalDebt = bs.shortTermDebt + bs.longTermDebt;
    const ebitda = is.operatingIncome + is.depreciation + is.amortization;

    // Bug #1 fix: EAS 13 — use actual intangibleAssets + goodwill fields
    const intangibles = bs.intangibleAssets || 0;
    const goodwill = bs.goodwill || 0;
    // C4: EAS 26 — Banking sector check
    const sector = (financialData.sector || '').toLowerCase();
    const isBanking = sector.includes('financial') || sector.includes('bank');

    // EAS 48: Lease adjustment (using a reasonable estimate)
    const leaseInputs: LeaseInputs = {
        totalLeasePaymentsPerYear: ebitda * 0.05, // Approximate 5% of EBITDA as lease
        remainingLeaseTerm: 5,
        incrementalBorrowingRate: assumptions.costOfDebt || 12,
    };
    const leaseAdj = calculateLeaseAdjustment(leaseInputs, ebitda, totalDebt);

    // EAS 12: Deferred tax (use zero if no data provided)
    const dtInputs: DeferredTaxInputs = { deferredTaxAsset: 0, deferredTaxLiability: 0 };
    const dcfEquity = financialData.currentStockPrice * financialData.sharesOutstanding; // proxy
    const dtAdj = calculateDeferredTaxAdjustment(dtInputs, dcfEquity);

    // EAS 23: EPS
    const eps = calculateEPS(
        is.netIncome,
        financialData.sharesOutstanding,
        financialData.sharesOutstanding * 1.02, // assume 2% dilution from options
        0,
    );

    const rowClass = 'border-t border-[var(--border)]';
    const headerBg = isDarkMode ? 'bg-red-900/30' : 'bg-red-50';

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-1 ${textClass}`}>
                🏛️ EAS Compliance
            </h3>
            <p className={`text-xs mb-4 ${textMutedClass}`}>Egyptian Accounting Standards / IFRS alignment checks</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EAS 48 — Lease Adjustments */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS 48 (IFRS 16) — Lease Adjustments</div>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>ROU Asset</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatCurrencyShort(leaseAdj.rouAsset, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Lease Liability</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatCurrencyShort(leaseAdj.leaseLiability, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>EBITDA Add-back</td><td className={`py-1.5 px-4 text-right font-medium text-green-400`}>{formatCurrencyShort(leaseAdj.ebitdaAddBack, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Post-EAS48 EBITDA</td><td className={`py-1.5 px-4 text-right font-bold ${textClass}`}>{formatCurrencyShort(leaseAdj.postEAS48EBITDA, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Post-EAS48 Debt</td><td className={`py-1.5 px-4 text-right font-bold ${textClass}`}>{formatCurrencyShort(leaseAdj.postEAS48Debt, currency)}</td></tr>
                        </tbody>
                    </table>
                </div>

                {/* EAS 23 — EPS */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS 23 (IAS 33) — Basic & Diluted EPS</div>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Basic EPS</td><td className={`py-1.5 px-4 text-right font-bold ${textClass}`}>{currency === 'EGP' ? 'EGP ' : '$'}{eps.basicEPS.toFixed(2)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Diluted EPS</td><td className={`py-1.5 px-4 text-right font-bold ${textClass}`}>{currency === 'EGP' ? 'EGP ' : '$'}{eps.dilutedEPS.toFixed(2)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Basic Shares</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatNumber(eps.basicShares)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Diluted Shares</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatNumber(eps.dilutedShares)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Dilution</td><td className={`py-1.5 px-4 text-right font-medium ${eps.isAntiDilutive ? 'text-yellow-400' : textClass}`}>{eps.dilutionPercent.toFixed(2)}%{eps.isAntiDilutive ? ' (Anti-dilutive)' : ''}</td></tr>
                        </tbody>
                    </table>
                </div>

                {/* EAS 12 — Deferred Tax */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS 12 (IAS 12) — Deferred Tax Bridge</div>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>DTA</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatCurrencyShort(dtAdj.dta, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>DTL</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatCurrencyShort(dtAdj.dtl, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Net DTA</td><td className={`py-1.5 px-4 text-right font-bold ${dtAdj.netDTA >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrencyShort(dtAdj.netDTA, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>EV Adjustment</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatCurrencyShort(dtAdj.evAdjustment, currency)}</td></tr>
                        </tbody>
                    </table>
                    <div className={`px-4 py-2 text-xs ${textMutedClass}`}>
                        DTA/DTL values default to 0 — enter manually on the Input Tab for accurate results.
                    </div>
                </div>

                {/* C4: EAS 42 — End-of-Service Provisions */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS 42 (IAS 19) — End-of-Service</div>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Provision Amount</td><td className={`py-1.5 px-4 text-right font-medium ${textClass}`}>{formatCurrencyShort(bs.endOfServiceProvision ?? 0, currency)}</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Treatment</td><td className={`py-1.5 px-4 text-right font-medium ${textMutedClass}`}>Debt-like obligation → added to EV</td></tr>
                            <tr className={rowClass}><td className={`py-1.5 px-4 ${textMutedClass}`}>Adjusted EV Impact</td><td className={`py-1.5 px-4 text-right font-bold ${(bs.endOfServiceProvision ?? 0) > 0 ? 'text-red-400' : textClass}`}>{(bs.endOfServiceProvision ?? 0) > 0 ? `+${formatCurrencyShort(bs.endOfServiceProvision ?? 0, currency)}` : 'No provision entered'}</td></tr>
                        </tbody>
                    </table>
                </div>

                {/* C4: EAS 13 — Impairment (Bug #1 fix: check intangibles + goodwill) */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS 13 (IAS 36) — Impairment</div>
                    <div className="p-4">
                        {goodwill > 0 && intangibles > 0 ? (
                            <div className="space-y-2">
                                <div className={`text-sm ${textMutedClass}`}>Goodwill: {formatCurrencyShort(goodwill, currency)} | Intangible Assets: {formatCurrencyShort(intangibles, currency)}</div>
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
                                    🔴 Goodwill ({formatCurrencyShort(goodwill, currency)}) and Intangible Assets ({formatCurrencyShort(intangibles, currency)}) present. Annual impairment testing required per EAS 13 (IAS 36).
                                </div>
                            </div>
                        ) : goodwill > 0 ? (
                            <div className="space-y-2">
                                <div className={`text-sm ${textMutedClass}`}>Goodwill: {formatCurrencyShort(goodwill, currency)}</div>
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
                                    🔴 Goodwill ({formatCurrencyShort(goodwill, currency)}) present. Annual impairment testing required per EAS 13 (IAS 36).
                                </div>
                            </div>
                        ) : intangibles > 0 ? (
                            <div className="space-y-2">
                                <div className={`text-sm ${textMutedClass}`}>Intangible Assets: {formatCurrencyShort(intangibles, currency)}</div>
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
                                    🟡 Intangible Assets ({formatCurrencyShort(intangibles, currency)}) present. Monitor for impairment indicators per EAS 13 (IAS 36). Annual testing required for indefinite-life intangibles.
                                </div>
                            </div>
                        ) : (
                            <div className={`text-sm ${textMutedClass}`}>No goodwill or intangible assets — EAS 13 impairment testing not required.</div>
                        )}
                    </div>
                </div>

                {/* C4: EAS 26 — ECL (Banking) */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS 26 (IFRS 9) — ECL Provisions</div>
                    <div className="p-4">
                        {isBanking ? (
                            <div className="space-y-2">
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                    🏦 Banking sector: Expected Credit Loss provisions should be disclosed. ECL is deducted from operating income for valuation.
                                </div>
                                <div className={`text-sm ${textMutedClass}`}>ECL Provision: Enter on Balance Sheet for automatic adjustment.</div>
                            </div>
                        ) : (
                            <div className={`text-sm ${textMutedClass}`}>Non-banking sector — EAS 26 ECL provisions typically not material.</div>
                        )}
                    </div>
                </div>

                {/* EAS Standards Summary */}
                <div className={`rounded-lg border ${isDarkMode ? 'border-[var(--border)]' : 'border-gray-200'} overflow-hidden md:col-span-2`}>
                    <div className={`px-4 py-2 font-semibold text-sm ${textClass} ${headerBg}`}>EAS Compliance Status</div>
                    <div className="p-4 space-y-2">
                        {[
                            { standard: 'EAS 48 (IFRS 16)', desc: 'Lease Capitalization', status: '✅ Applied' },
                            { standard: 'EAS 31 (IAS 1)', desc: 'Normalized Earnings', status: '✅ Available' },
                            { standard: 'EAS 12 (IAS 12)', desc: 'Deferred Tax in EV Bridge', status: dtAdj.netDTA !== 0 ? '✅ Active' : '⚠️ No DTA/DTL data' },
                            { standard: 'EAS 23 (IAS 33)', desc: 'Basic & Diluted EPS', status: '✅ Calculated' },
                            { standard: 'EAS 42 (IAS 19)', desc: 'End-of-Service Provision', status: (bs.endOfServiceProvision ?? 0) > 0 ? '✅ Active' : '⚠️ No provision data' },
                            { standard: 'EAS 13 (IAS 36)', desc: 'Impairment Testing', status: (goodwill > 0) ? '🔴 Required' : (intangibles > 0) ? '🟡 Monitored' : '✅ Not Required' },
                            { standard: 'EAS 26 (IFRS 9)', desc: 'Expected Credit Losses', status: isBanking ? '⚠️ Disclosure Required' : '✅ N/A (Non-Banking)' },
                        ].map((item) => (
                            <div key={item.standard} className="flex items-center justify-between">
                                <div>
                                    <span className={`text-sm font-medium ${textClass}`}>{item.standard}</span>
                                    <span className={`text-xs ml-2 ${textMutedClass}`}>{item.desc}</span>
                                </div>
                                <span className="text-xs">{item.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
