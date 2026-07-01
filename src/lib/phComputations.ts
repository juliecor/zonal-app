// Philippine real-estate transaction computations (NIRC / LGC, rates current 2024–2026).
// Verified against the website's PropertyCalculator + a PH-tax compliance review.
// IMPORTANT: these are PLANNING ESTIMATES, not legal/tax advice. In practice the tax base
// is the HIGHER of the selling price, the BIR zonal value, or the assessor's FMV.

export const CGT_RATE = 0.06;       // Capital Gains Tax — NIRC Sec. 24(D), seller
export const DST_RATE = 0.015;      // Documentary Stamp Tax — NIRC Sec. 196, ₱15 / ₱1,000-or-fraction
export const REG_RATE = 0.0025;     // Registry of Deeds registration — ~0.25% (LRA schedule; estimate)
export const TRANSFER_RATE_PROVINCE = 0.005;  // LGC Sec. 135 (province, ≤0.5%)
export const TRANSFER_RATE_CITY = 0.0075;     // LGC Sec. 151 (city / Metro Manila, ≤0.75%)
export const BROKER_RATE = 0.05;    // Broker's professional fee (commission) — customary ~3–5% (land ~5%), SELLER-paid, negotiable; NOT a statutory tax
export const SEF_RATE = 0.01;       // Special Education Fund — LGC Sec. 235
export const VAT_RESIDENTIAL_EXEMPT_THRESHOLD = 3_600_000; // RR 1-2024 (house-and-lot/dwelling)

export interface CostInput {
  price: number;             // tax base (use the higher-of in practice)
  transferRate?: number;     // default city 0.75%
  withRegistration?: boolean; // default true
  brokerRate?: number;       // broker's commission; default 5%, pass 0 to exclude
  downPct?: number;          // default 20
  annualRatePct?: number;    // default 6.5
  termYears?: number;        // default 20
}

export interface CostBreakdown {
  price: number;
  cgt: number; dst: number; transferTax: number; registrationFee: number; brokerFee: number;
  buyerFees: number; sellerFees: number; totalFees: number;
  downPayment: number; loanPrincipal: number; monthlyAmortization: number; totalInterest: number;
  cashIfFinanced: number; cashIfFull: number;
  transferRate: number; brokerRate: number; downPct: number; annualRatePct: number; termYears: number;
}

export function estimatedValue(zonalPerSqm: number, areaSqm: number): number {
  return Math.max(0, zonalPerSqm || 0) * Math.max(0, areaSqm || 0);
}

// DST is statutorily ₱15 per ₱1,000 OR FRACTION thereof → round the base up to the next ₱1,000.
export function dstExact(base: number): number {
  return 15 * Math.ceil(Math.max(0, base) / 1000);
}

// Standard amortizing-loan (annuity) monthly payment.
export function monthlyAmortization(principal: number, annualRatePct: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const i = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (i === 0) return principal / n;
  const f = Math.pow(1 + i, n);
  return (principal * i * f) / (f - 1);
}

export function computeCosts(input: CostInput): CostBreakdown {
  const price = Math.max(0, input.price || 0);
  const transferRate = input.transferRate ?? TRANSFER_RATE_CITY;
  const withReg = input.withRegistration ?? true;
  const brokerRate = input.brokerRate ?? BROKER_RATE;
  const downPct = input.downPct ?? 20;
  const annualRatePct = input.annualRatePct ?? 6.5;
  const termYears = input.termYears ?? 20;

  const cgt = price * CGT_RATE;
  const dst = dstExact(price);
  const transferTax = price * transferRate;
  const registrationFee = withReg ? price * REG_RATE : 0;
  const brokerFee = price * brokerRate;                     // seller-paid professional fee (commission)
  const buyerFees = dst + transferTax + registrationFee;
  const sellerFees = cgt + brokerFee;                       // seller pays CGT + the broker's commission
  const totalFees = buyerFees + sellerFees;                 // all transaction costs (taxes, fees & commission)

  const downPayment = price * (downPct / 100);
  const loanPrincipal = Math.max(0, price - downPayment);
  const monthly = monthlyAmortization(loanPrincipal, annualRatePct, termYears);
  const totalInterest = Math.max(0, monthly * termYears * 12 - loanPrincipal);

  return {
    price, cgt, dst, transferTax, registrationFee, brokerFee, buyerFees, sellerFees, totalFees,
    downPayment, loanPrincipal, monthlyAmortization: monthly, totalInterest,
    cashIfFinanced: downPayment + buyerFees, cashIfFull: price + buyerFees,
    transferRate, brokerRate, downPct, annualRatePct, termYears,
  };
}

// LGC Sec. 218 max land assessment levels.
export const ASSESSMENT_LEVEL: Record<string, number> = {
  residential: 0.20, commercial: 0.50, industrial: 0.50, agricultural: 0.40, other: 0.20,
};
export function groupFromCode(code?: string): keyof typeof ASSESSMENT_LEVEL {
  const c = String(code || "").toUpperCase();
  if (c.startsWith("C")) return "commercial";
  if (c.startsWith("I")) return "industrial";
  if (c.startsWith("A")) return "agricultural";
  if (c.startsWith("R")) return "residential";
  return "other";
}
export function assessmentLevelFor(groupOrCode?: string): number {
  const g = String(groupOrCode || "").toLowerCase();
  if (g.includes("comm")) return ASSESSMENT_LEVEL.commercial;
  if (g.includes("indus")) return ASSESSMENT_LEVEL.industrial;
  if (g.includes("agri")) return ASSESSMENT_LEVEL.agricultural;
  if (g.includes("resid")) return ASSESSMENT_LEVEL.residential;
  return ASSESSMENT_LEVEL[groupFromCode(groupOrCode)];
}

// Real Property Tax (amilyar), annual. assessed = FMV × assessment level; tax = assessed × (basicRate + SEF).
export function realPropertyTax(fmv: number, groupOrCode?: string, cityRate = true) {
  const level = assessmentLevelFor(groupOrCode);
  const assessed = Math.max(0, fmv || 0) * level;
  const basicRate = cityRate ? 0.02 : 0.01; // city/MM ≤2%, province ≤1%
  const basic = assessed * basicRate;
  const sef = assessed * SEF_RATE;
  return { assessed, level, basicRate, basic, sef, total: basic + sef };
}

export const COST_DISCLAIMER =
  "Estimates only — not legal or tax advice. Taxes use the higher of the selling price or the BIR zonal / assessor value. " +
  "Transfer tax and real property tax vary by LGU. The broker's professional fee (commission) is customary (~5% for land), seller-paid and negotiable. " +
  "Consult a licensed CPA, tax lawyer, or PRC-licensed broker.";
