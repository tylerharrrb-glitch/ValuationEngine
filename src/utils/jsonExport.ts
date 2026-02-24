/**
 * WOLF Valuation Engine — JSON Export
 * CFA-grade JSON export with full metadata and audit trail.
 * Section 8.4 schema compliance.
 */
import {
    FinancialData,
    ValuationAssumptions,
    DCFProjection,
    DCFResult,
    WACCResult,
    DDMResult,
    SensitivityMatrix,
    FinancialRatios,
    FCFFVerification,
    ScenarioAnalysis,
    MarketRegion,
    ValuationJSON,
} from '../types/financial';

const ENGINE_VERSION = '3.0.0';

export interface JSONExportInput {
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    projections: DCFProjection[];
    dcfResult: DCFResult;
    waccResult: WACCResult;
    ddmResult: DDMResult;
    sensitivityMatrix: SensitivityMatrix;
    ratios: FinancialRatios;
    fcffVerification: FCFFVerification;
    scenarioAnalysis: ScenarioAnalysis;
    marketRegion: MarketRegion;
    comparableMultiples: Record<string, number>;
}

/**
 * Generate a fully-compliant JSON export per Section 8.4
 */
export function generateValuationJSON(input: JSONExportInput): ValuationJSON {
    const {
        financialData, assumptions, projections, dcfResult,
        waccResult, ddmResult, sensitivityMatrix, ratios,
        fcffVerification, scenarioAnalysis, marketRegion,
        comparableMultiples,
    } = input;

    const currency = marketRegion === 'Egypt' ? 'EGP' as const : 'USD' as const;

    return {
        metadata: {
            engine_version: ENGINE_VERSION,
            generation_date: new Date().toISOString(),
            currency,
            company_name: financialData.companyName,
            capm_method: assumptions.capmMethod === 'A' ? 'LOCAL_CAPM' : 'USD_BUILDUP',
            rf_instrument: assumptions.capmMethod === 'A'
                ? '10-Year Egyptian Government Bond' : '10-Year US Treasury Bond',
            rf_date: assumptions.rfDate,
            discounting_convention: assumptions.discountingConvention === 'mid_year' ? 'MID_YEAR' : 'END_OF_YEAR',
        },
        inputs: {
            company_name: financialData.companyName,
            ticker: financialData.ticker,
            shares_outstanding: financialData.sharesOutstanding,
            current_stock_price: financialData.currentStockPrice,
            dividends_per_share: financialData.dividendsPerShare,
            revenue: financialData.incomeStatement.revenue,
            ebit: financialData.incomeStatement.operatingIncome,
            net_income: financialData.incomeStatement.netIncome,
            total_debt: financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt,
            cash: financialData.balanceSheet.cash,
            total_equity: financialData.balanceSheet.totalEquity,
            risk_free_rate: assumptions.riskFreeRate,
            beta: assumptions.beta,
            erp: assumptions.marketRiskPremium,
            cost_of_debt: assumptions.costOfDebt,
            tax_rate: assumptions.taxRate,
            terminal_growth: assumptions.terminalGrowthRate,
            projection_years: assumptions.projectionYears,
            revenue_growth: assumptions.revenueGrowthRate,
            ebitda_margin: assumptions.ebitdaMargin,
            da_percent: assumptions.daPercent,
            capex_percent: assumptions.capexPercent,
            delta_wc_percent: assumptions.deltaWCPercent,
        },
        calculated: {
            wacc: waccResult,
            dcf: {
                ...dcfResult,
                projections: projections.map(p => ({
                    year: p.year,
                    revenue: p.revenue,
                    ebitda: p.ebitda,
                    d_and_a: p.dAndA,
                    ebit: p.ebit,
                    nopat: p.nopat,
                    capex: p.capex,
                    delta_wc: p.deltaWC,
                    fcff: p.freeCashFlow,
                    discount_factor: p.discountFactor,
                    present_value: p.presentValue,
                })),
                projected_fcff: projections.map(p => p.freeCashFlow),
                pv_fcff: projections.map(p => p.presentValue),
                ev_bridge: {
                    enterprise_value: dcfResult.enterpriseValue,
                    total_debt: financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt,
                    cash: financialData.balanceSheet.cash,
                    net_debt: dcfResult.netDebt,
                    equity_value: dcfResult.equityValue,
                    shares_outstanding: financialData.sharesOutstanding,
                    intrinsic_value_per_share: dcfResult.impliedSharePrice,
                },
            },
            ddm: ddmResult,
            multiples: comparableMultiples,
            sensitivity: sensitivityMatrix,
            ratios,
            fcff_verification: fcffVerification,
            scenarios: scenarioAnalysis,
        },
    };
}

/**
 * Download JSON export as file
 */
export function downloadJSON(json: ValuationJSON, filename?: string): void {
    const jsonStr = JSON.stringify(json, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${json.metadata.company_name.replace(/\s+/g, '_')}_Valuation.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
