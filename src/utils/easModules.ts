/**
 * WOLF Valuation Engine — EAS Compliance Modules
 * Egyptian Accounting Standards / IFRS compliance calculations
 *
 * EAS 48 (IFRS 16): Lease adjustments — ROU asset, lease liabilities
 * EAS 31 (IAS 1):   Normalized earnings — add-back / deduction with tax effects
 * EAS 12 (IAS 12):  Deferred tax in EV bridge — DTA / DTL net adjustment
 * EAS 23 (IAS 33):  Basic & Diluted EPS with anti-dilution check
 */

// ============================================
// TYPES
// ============================================

export interface LeaseInputs {
    totalLeasePaymentsPerYear: number;  // Annual lease payment
    remainingLeaseTerm: number;         // Years remaining
    incrementalBorrowingRate: number;   // IBR as percentage (e.g., 15%)
}

export interface LeaseAdjustment {
    rouAsset: number;           // Right-of-Use Asset (PV of lease payments)
    leaseLiability: number;     // = ROU at inception
    annualDepreciation: number; // ROU / remaining term (straight-line)
    interestExpense: number;    // Lease liability × IBR (Year 1)
    ebitdaAddBack: number;      // Full lease payment added back to EBITDA
    preEAS48EBITDA: number;     // EBITDA before lease adjustment
    postEAS48EBITDA: number;    // EBITDA after adding back lease payments
    preEAS48Debt: number;       // Total debt before
    postEAS48Debt: number;      // Total debt + lease liability
}

export interface NormalizationItem {
    description: string;
    amount: number;             // Positive = add-back, Negative = deduction
    isTaxAffected: boolean;     // Whether to apply tax shield
}

export interface NormalizationResult {
    items: NormalizationItem[];
    grossAdjustment: number;    // Sum of all items
    taxEffect: number;          // Tax on tax-affected items
    netAdjustment: number;      // Gross − tax effect
    reportedNI: number;
    normalizedNI: number;       // Reported + net adjustment
    normalizedEPS: number;
}

export interface DeferredTaxInputs {
    deferredTaxAsset: number;   // DTA from balance sheet
    deferredTaxLiability: number; // DTL from balance sheet
}

export interface DeferredTaxAdjustment {
    dta: number;
    dtl: number;
    netDTA: number;             // DTA − DTL (positive = asset)
    evAdjustment: number;       // Added to equity value in EV bridge
    adjustedEquityValue: number;
}

export interface EPSResult {
    basicEPS: number;
    dilutedEPS: number;
    basicShares: number;
    dilutedShares: number;
    dilutionPercent: number;
    isAntiDilutive: boolean;    // If diluted EPS > basic EPS, options are anti-dilutive
}

// ============================================
// EAS 48 (IFRS 16) — LEASE ADJUSTMENTS
// ============================================

/**
 * Calculate lease adjustments per EAS 48 / IFRS 16.
 * Capitalizes operating leases onto the balance sheet.
 *
 * ROU = PV of remaining lease payments at IBR
 * EBITDA add-back = full annual lease payment (operating → financing)
 * Debt increase = lease liability (ROU asset value)
 */
export function calculateLeaseAdjustment(
    inputs: LeaseInputs,
    currentEBITDA: number,
    currentTotalDebt: number,
): LeaseAdjustment {
    const ibr = inputs.incrementalBorrowingRate / 100;
    const payment = inputs.totalLeasePaymentsPerYear;
    const term = inputs.remainingLeaseTerm;

    // PV of annuity: PV = PMT × [(1 − (1+r)^−n) / r]
    let rouAsset: number;
    if (ibr > 0) {
        rouAsset = payment * ((1 - Math.pow(1 + ibr, -term)) / ibr);
    } else {
        rouAsset = payment * term; // edge case: zero rate
    }

    const leaseLiability = rouAsset;
    const annualDepreciation = rouAsset / term; // straight-line
    const interestExpense = leaseLiability * ibr; // Year 1

    return {
        rouAsset,
        leaseLiability,
        annualDepreciation,
        interestExpense,
        ebitdaAddBack: payment,
        preEAS48EBITDA: currentEBITDA,
        postEAS48EBITDA: currentEBITDA + payment,
        preEAS48Debt: currentTotalDebt,
        postEAS48Debt: currentTotalDebt + leaseLiability,
    };
}

// ============================================
// EAS 31 (IAS 1) — NORMALIZED EARNINGS
// ============================================

/**
 * Calculate normalized earnings by adding back / deducting non-recurring items.
 * Tax-affected items are adjusted at the marginal tax rate.
 *
 * Common add-backs: impairment charges, restructuring costs, legal settlements
 * Common deductions: gain on asset sale, insurance proceeds, one-time subsidies
 */
export function calculateNormalizedEarnings(
    items: NormalizationItem[],
    reportedNetIncome: number,
    taxRate: number, // percentage (e.g., 22.5)
    sharesOutstanding: number,
): NormalizationResult {
    const taxDec = taxRate / 100;
    const grossAdjustment = items.reduce((sum, item) => sum + item.amount, 0);
    const taxEffect = items
        .filter(item => item.isTaxAffected)
        .reduce((sum, item) => sum + item.amount * taxDec, 0);
    const netAdjustment = grossAdjustment - taxEffect;
    const normalizedNI = reportedNetIncome + netAdjustment;

    return {
        items,
        grossAdjustment,
        taxEffect,
        netAdjustment,
        reportedNI: reportedNetIncome,
        normalizedNI,
        normalizedEPS: sharesOutstanding > 0 ? normalizedNI / sharesOutstanding : 0,
    };
}

// ============================================
// EAS 12 (IAS 12) — DEFERRED TAX IN EV BRIDGE
// ============================================

/**
 * Calculate deferred tax adjustment for EV-to-Equity bridge.
 *
 * Net DTA (DTA > DTL) → adds to equity value (future tax savings)
 * Net DTL (DTL > DTA) → reduces equity value (future tax obligations)
 *
 * Adjusted Equity = Base Equity + Net DTA
 */
export function calculateDeferredTaxAdjustment(
    inputs: DeferredTaxInputs,
    baseEquityValue: number,
): DeferredTaxAdjustment {
    const netDTA = inputs.deferredTaxAsset - inputs.deferredTaxLiability;
    return {
        dta: inputs.deferredTaxAsset,
        dtl: inputs.deferredTaxLiability,
        netDTA,
        evAdjustment: netDTA,
        adjustedEquityValue: baseEquityValue + netDTA,
    };
}

// ============================================
// EAS 23 (IAS 33) — BASIC & DILUTED EPS
// ============================================

/**
 * Calculate Basic and Diluted EPS per EAS 23 / IAS 33.
 *
 * Basic EPS = Net Income / Weighted Average Basic Shares
 * Diluted EPS = (Net Income + Convertible Adjustments) / (Basic + Dilutive Shares)
 *
 * Anti-dilution check: if Diluted EPS > Basic EPS, dilutive securities
 * are excluded (anti-dilutive) and Diluted EPS = Basic EPS.
 */
export function calculateEPS(
    netIncome: number,
    basicShares: number,
    dilutedShares: number,        // basic + options/warrants/convertibles
    convertibleInterest: number = 0, // after-tax interest on convertible debt
): EPSResult {
    if (basicShares <= 0) {
        return {
            basicEPS: 0,
            dilutedEPS: 0,
            basicShares: 0,
            dilutedShares: 0,
            dilutionPercent: 0,
            isAntiDilutive: false,
        };
    }

    const basicEPS = netIncome / basicShares;

    // Diluted: add convertible interest to numerator, use diluted shares
    const effectiveDilutedShares = Math.max(dilutedShares, basicShares);
    const rawDilutedEPS = (netIncome + convertibleInterest) / effectiveDilutedShares;

    // Anti-dilution check: if diluted > basic, options are anti-dilutive
    const isAntiDilutive = rawDilutedEPS > basicEPS;
    const dilutedEPS = isAntiDilutive ? basicEPS : rawDilutedEPS;

    const dilutionPercent = basicEPS !== 0
        ? ((basicEPS - dilutedEPS) / basicEPS) * 100
        : 0;

    return {
        basicEPS,
        dilutedEPS,
        basicShares,
        dilutedShares: effectiveDilutedShares,
        dilutionPercent,
        isAntiDilutive,
    };
}
