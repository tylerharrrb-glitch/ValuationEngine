"""
WOLF independent reference implementation.

Written from docs/METHODOLOGY.md only (sections 1-5 and 7), not from the TypeScript engine.
Inputs: a company fixture JSON and a frozen rates snapshot JSON.
Output: JSON with every intermediate value, printed to stdout (or written to --out).

Usage:
  python scripts/reference/wolf_reference.py tests/fixtures/mopco-fy2025.json \
      tests/fixtures/rates-snapshot-2026-09-23.json --industry "Chemical (Basic)" [--out file.json]

Choices (all METHODOLOGY defaults unless given): projection years N=5, terminal growth 10%,
mid-year ON, Rf source (a) EGP 10Y secondary, CAPM local_rf, synthetic cost of debt,
market weights, Gordon terminal value, PP&E roll-forward D&A, linear fade ON,
employee distributions ON, employee benefits deducted (not tax-effected).
"""
import argparse
import datetime as dt
import json
import math


# ----------------------------------------------------------------- dates (METHODOLOGY 1)

def d(s):
    return dt.date.fromisoformat(s)


def is_leap(y):
    return (y % 4 == 0 and y % 100 != 0) or y % 400 == 0


def add_years(day, n):
    y = day.year + n
    last = 29 if (day.month == 2 and is_leap(y)) else [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][day.month - 1]
    return dt.date(y, day.month, min(day.day, last))


def yearfrac_actual(a, b):
    """Excel YEARFRAC basis 1 as described in METHODOLOGY 1."""
    if b < a:
        a, b = b, a
    days = (b - a).days
    if days == 0:
        return 0.0
    if a.year == b.year:
        return days / (366 if is_leap(a.year) else 365)
    if b <= add_years(a, 1):
        leap = False
        if is_leap(a.year) and a <= dt.date(a.year, 2, 29):
            leap = True
        if is_leap(b.year) and b >= dt.date(b.year, 2, 29):
            leap = True
        return days / (366 if leap else 365)
    years = range(a.year, b.year + 1)
    avg = sum(366 if is_leap(y) else 365 for y in years) / len(years)
    return days / avg


def timeline(V, fye0, n, mid_year):
    periods = []
    after = V > fye0
    for t in range(1, n + 1):
        end = add_years(fye0, t)
        start = V if (t == 1 and after) else add_years(fye0, t - 1)
        f = yearfrac_actual(V, end) if (t == 1 and after) else 1.0
        s_ord, e_ord, v_ord = start.toordinal(), end.toordinal(), V.toordinal()
        disc = s_ord + (e_ord - s_ord) / 2.0 if mid_year else e_ord
        periods.append({"t": t, "fraction": f, "years": (disc - v_ord) / 365.0})
    tv_years = (add_years(fye0, n).toordinal() - V.toordinal()) / 365.0
    return periods, tv_years


# ----------------------------------------------------------------- rates

class Rates:
    def __init__(self, snap):
        self.e = {x["id"]: x for x in snap["entries"]}

    def v(self, rid):
        return self.e[rid]["value"]


# ----------------------------------------------------------------- model

def run(company, snap, industry, n=5, g_pct=10.0, mid_year=True):
    R = Rates(snap)
    Y = company["years"][-1]
    P = company["years"][-2] if len(company["years"]) >= 2 else None
    I, B, C = Y["income"], Y["balance"], Y["cashFlow"]
    out = {}

    # 2. normalization: remove ECL, impairment, provisions released, capital gains when non-zero
    adj = [I[k] for k in ("eclReversal", "impairmentReversal", "provisionsReleased", "capitalGains") if I[k] != 0]
    norm_ebit = I["operatingProfit"] - sum(adj)
    da0 = I["depreciation"] + I["amortization"]
    out["normalizedEbit"] = norm_ebit
    out["normalizedEbitda"] = norm_ebit + da0
    out["reportedEbitda"] = I["operatingProfit"] + da0

    # 3.1 seed drivers (decimals)
    R0 = I["revenue"]
    tau = R.v("eg.cit") / 100.0
    gmx = (I["grossProfit"] + da0) / R0
    sga = -(I["sellingMarketing"] + I["generalAdmin"]) / R0
    oth = (norm_ebit - I["grossProfit"] - I["sellingMarketing"] - I["generalAdmin"]) / R0
    cc0 = R0 * (1 - gmx)
    oca0 = B["otherCurrentAssets"] + B["supplierAdvances"] + B["dueFromRelatedParties"]
    ocl0 = B["otherPayables"] + B["customerAdvances"] + B["provisions"] + B["dueToRelatedParties"] + B["otherCurrentLiabilities"]
    open_ppe = P["balance"]["ppe"] if P else B["ppe"]
    seed = {
        "g": (R0 / P["income"]["revenue"] - 1) if P else 0.0,
        "gmx": gmx, "sga": sga, "oth": oth,
        "da": da0 / R0,
        "dep": I["depreciation"] / open_ppe,
        "am": I["amortization"] / R0,
        "cpx": -C["capex"] / R0,
        "dso": B["receivables"] / R0 * 365,
        "dio": B["inventory"] / cc0 * 365,
        "dpo": B["tradePayables"] / cc0 * 365,
        "oca": oca0 / R0, "ocl": ocl0 / R0,
        "tau": tau,
    }
    nwc0 = B["receivables"] + B["inventory"] + oca0 - B["tradePayables"] - ocl0
    out["seed"] = seed

    # 4. WACC (needed first: RONIC default = WACC for the terminal capex default)
    rf = R.v("eg.bond10ySecondary")
    erp = R.v("damodaran.matureErp")
    crp = R.v("damodaran.egypt.crp")
    beta_u = next(r for r in R.v("damodaran.betas.emerging") if r["industry"] == industry)["unleveredBetaCorrectedForCash"]
    shares = company["shares"]["basic"] + sum(x["shares"] for x in company["shares"]["dilutiveItems"])
    E = company["price"] * shares
    D = B["bankDebtCurrent"] + B["bankDebtNonCurrent"] + B["bondsNonCurrent"] + B["leaseCurrent"] + B["leaseNonCurrent"]
    beta_l = beta_u * (1 + (1 - tau) * D / E)
    ke = rf + beta_l * erp  # local_rf, size premium 0
    interest = -(I["financeCostDebt"] + I["financeCostLease"])
    coverage = norm_ebit / interest if interest > 0 else math.inf
    usd_mcap = E / R.v("eg.usdEgp")
    table = R.v("damodaran.synthetic.small" if usd_mcap < 5e9 else "damodaran.synthetic.large")
    table = sorted(table, key=lambda r: r["coverageAbove"])
    row = table[-1]
    for r in table:
        if r["coverageAbove"] < coverage <= r["coverageUpTo"]:
            row = r
            break
    kd = rf + row["spread"]  # local Rf: no country default spread
    ev_w = E / (E + D)
    dv_w = D / (E + D)
    wacc = ev_w * ke + dv_w * kd * (1 - tau)
    out.update({"rf": rf, "betaU": beta_u, "debtToEquity": D / E, "betaL": beta_l, "ke": ke, "coverage": coverage,
                "rating": row["rating"], "kd": kd, "equityWeight": ev_w, "debtWeight": dv_w, "wacc": wacc})
    w = wacc / 100.0
    g = g_pct / 100.0

    # 3.4 terminal drivers and value-driver capex
    term = dict(seed)
    term["g"] = g
    rr = g / w
    nwc_pct_T = term["dso"] / 365 + (1 - term["gmx"]) * (term["dio"] - term["dpo"]) / 365 + term["oca"] - term["ocl"]
    term["cpx"] = seed["da"] - nwc_pct_T * g / (1 + g) + rr * (term["gmx"] - term["sga"] + term["oth"] - seed["da"]) * (1 - tau)
    out["terminalCapexPct"] = term["cpx"]

    # 3.2 fade
    years = []
    for t in range(1, n + 1):
        wgt = (t - 1) / (n - 1) if n > 1 else 0.0
        years.append({k: seed[k] + (term[k] - seed[k]) * wgt for k in seed})

    # 3.3 operating model
    nfi = I["financeIncome"] + I["financeCostDebt"] + I["financeCostLease"] + I["financeCostEmployeeBenefit"] + I["financeCostOther"]
    p_dist = -C["employeeBoardDistributions"] / P["income"]["netProfit"]
    prev = {"R": R0, "ppe": B["ppe"], "nwc": nwc0, "np": I["netProfit"]}
    rows = []

    def step(dr, growth):
        Rt = prev["R"] * (1 + growth)
        ebitda = Rt * (dr["gmx"] - dr["sga"] + dr["oth"])
        capex = Rt * dr["cpx"]
        dep = dr["dep"] * prev["ppe"]
        am = Rt * dr["am"]
        da = dep + am
        close_ppe = prev["ppe"] + capex - dep
        ebit = ebitda - da
        nopat = ebit * (1 - dr["tau"])
        cc = Rt * (1 - dr["gmx"])
        nwc = Rt * dr["dso"] / 365 + cc * dr["dio"] / 365 + Rt * dr["oca"] - cc * dr["dpo"] / 365 - Rt * dr["ocl"]
        dnwc = nwc - prev["nwc"]
        np_t = nopat + nfi * (1 - dr["tau"])
        dist = p_dist * prev["np"]
        fcff = nopat + da - capex - dnwc - dist
        prev.update({"R": Rt, "ppe": close_ppe, "nwc": nwc, "np": np_t})
        return {"revenue": Rt, "ebitda": ebitda, "da": da, "ebit": ebit, "nopat": nopat, "capex": capex,
                "deltaNwc": dnwc, "distributions": dist, "netProfit": np_t, "fcff": fcff}

    for dr in years:
        rows.append(step(dr, dr["g"]))
    terminal = step(term, g)
    out["forecast"] = rows
    out["terminal"] = terminal

    # 1 + 5.1 discounting
    V = d(company["valuationDate"])
    fye0 = d(Y["periodEnd"])
    periods, tv_years = timeline(V, fye0, n, mid_year)
    pvs = []
    for p, r in zip(periods, rows):
        df = (1 + w) ** (-p["years"])
        pvs.append({"fraction": p["fraction"], "years": p["years"], "df": df, "pv": p["fraction"] * r["fcff"] * df})
    out["periods"] = pvs
    sum_pv = sum(x["pv"] for x in pvs)
    df_tv = (1 + w) ** (-tv_years)

    # 5.2 terminal values
    tv_g = terminal["fcff"] / (w - g)
    mcap = company["price"] * company["shares"]["basic"]
    unrestricted = B["cash"] + B["fvtplSecurities"] + B["amortizedCostCurrent"] + B["amortizedCostNonCurrent"]
    multiple = (mcap + D - unrestricted) / out["reportedEbitda"]
    tv_x = rows[-1]["ebitda"] * multiple
    out.update({"sumPv": sum_pv, "tvYears": tv_years, "dfTv": df_tv, "gordonTv": tv_g, "gordonPv": tv_g * df_tv,
                "exitMultiple": multiple, "exitTv": tv_x, "exitPv": tv_x * df_tv})
    ev = sum_pv + tv_g * df_tv
    out["enterpriseValue"] = ev

    # 5.3 bridge
    bridge = {
        "cash": B["cash"],
        "fvtpl": B["fvtplSecurities"],
        "amortizedCurrent": B["amortizedCostCurrent"],
        "amortizedNonCurrent": B["amortizedCostNonCurrent"],
        "associates": B["associates"],
        "debt": -(B["bankDebtCurrent"] + B["bankDebtNonCurrent"] + B["bondsNonCurrent"]),
        "leases": -(B["leaseCurrent"] + B["leaseNonCurrent"]),
        "employeeBenefits": -(B["employeeBenefitsCurrent"] + B["employeeBenefitsNonCurrent"]),
        "minority": -B["minorityInterest"],
        "preferred": -B["preferredEquity"],
    }
    out["bridge"] = bridge
    out["restrictedMemo"] = B["restrictedCashCurrent"] + B["restrictedCashNonCurrent"]
    equity = ev + sum(bridge.values())
    out["equityValue"] = equity
    out["perShare"] = equity / shares

    # 7 DDM (two-stage headline, H-model)
    dps0 = -C["dividendsToShareholders"] / company["shares"]["basic"]
    gH = (rows[-1]["revenue"] / R0) ** (1.0 / n) - 1
    gS = g
    ke_d = ke / 100.0
    pv_div = 0.0
    dn = dps0
    for t in range(1, n + 1):
        dn = dps0 * (1 + gH) ** t
        pv_div += dn / (1 + ke_d) ** t
    tv_d = dn * (1 + gS) / (ke_d - gS)
    two_stage = pv_div + tv_d / (1 + ke_d) ** n
    h_model = dps0 * (1 + gS) / (ke_d - gS) + dps0 * (n / 2.0) * (gH - gS) / (ke_d - gS)
    out["ddm"] = {"dps0": dps0, "gH": gH, "twoStage": two_stage, "hModel": h_model}

    # 12 blend: DCF 75% / DDM 25%
    out["blended"] = 0.75 * out["perShare"] + 0.25 * two_stage
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("company")
    ap.add_argument("snapshot")
    ap.add_argument("--industry", required=True)
    ap.add_argument("--out")
    a = ap.parse_args()
    company = json.load(open(a.company, encoding="utf-8"))
    snap = json.load(open(a.snapshot, encoding="utf-8"))
    res = run(company, snap, a.industry)
    txt = json.dumps(res, indent=2, default=lambda x: None if isinstance(x, float) and math.isinf(x) else x)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(txt)
    else:
        print(txt)


if __name__ == "__main__":
    main()
