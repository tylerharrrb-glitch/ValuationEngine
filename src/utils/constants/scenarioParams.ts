/**
 * Scenario parameters — SINGLE SOURCE OF TRUTH.
 * V2.3: Imported by Engine UI, PDF export, and Excel export.
 * Ensures Bear/Base/Bull values are identical across all outputs.
 */
export interface ScenarioParams {
    revenueGrowthMultiplier: number;   // multiplied by base growth
    waccAdjustmentPP: number;          // percentage points added to WACC
    marginAdjPerYear: number;          // EBITDA margin delta per projection year (decimal)
    terminalGrowthMultiplier: number;  // multiplied by base terminal g
}

export const SCENARIO_PARAMS: Record<string, ScenarioParams> = {
    bear: {
        revenueGrowthMultiplier: 0.40,   // 15% × 0.40 = 6.0%
        waccAdjustmentPP: +2.50,         // +2.50pp → 28.34%
        marginAdjPerYear: -0.015,        // −1.5pp/yr EBITDA margin compression
        terminalGrowthMultiplier: 0.75,  // 8% × 0.75 = 6.0%
    },
    base: {
        revenueGrowthMultiplier: 1.00,
        waccAdjustmentPP: 0.00,
        marginAdjPerYear: 0.00,
        terminalGrowthMultiplier: 1.00,
    },
    bull: {
        revenueGrowthMultiplier: 2.00,   // 15% × 2.00 = 30.0%
        waccAdjustmentPP: -2.50,         // −2.50pp → 23.34%
        marginAdjPerYear: +0.025,        // +2.5pp/yr EBITDA margin expansion
        terminalGrowthMultiplier: 1.25,  // 8% × 1.25 = 10.0%
    },
};
