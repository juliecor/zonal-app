// Branded BIR Zonal Property Report — HTML mirror of the website's PDF report
// (navy #1e3a8a + blue #155eef, FH header band, zonal-value box, signature, disclaimer).
// One HTML string used for BOTH the in-app WebView preview AND the expo-print PDF.

import type { Hazard } from "@/lib/hazards";
import { computeCosts } from "@/lib/phComputations";

export interface ReportData {
  location: string;
  value: number | null;
  classification: string;   // raw BIR code, e.g. "CR"
  parcelSqm?: number;       // sample parcel for the estimate (default 250)
  dateStr: string;
  mapDataUrl?: string | null;
  hazards: Hazard[];
  score: number;
  riskLabel: string;
  riskColor: string;
  checked: number;
  preparedBy: string;
}

const NAVY = "#1e3a8a", GOLD = "#155eef", INK = "#16223a";

const grp = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function money(n: number): string {
  const [a, b] = (Math.round(n * 100) / 100).toFixed(2).split(".");
  return `PHP ${grp(a)}.${b} / sqm`;
}
const HAZ_NAME: Record<string, string> = {
  flood: "Flood", landslide: "Landslide", surge: "Storm Surge",
  fault: "Active Fault", liquefaction: "Liquefaction", tsunami: "Tsunami",
};
const CLS_LABEL: Record<string, string> = {
  RR: "Residential", CR: "Commercial", A: "Agricultural", I: "Industrial",
  RC: "Resid./Commercial", GP: "Govt / Institutional", C: "Commercial",
};
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function assessment(d: ReportData): string {
  const parts: string[] = [];
  if (d.value && d.value > 0) {
    const v = d.value;
    const tier = v >= 50000 ? "a prime, high-value" : v >= 20000 ? "a strong commercial/urban"
      : v >= 8000 ? "an established" : "an emerging";
    const where = d.location.split(",").slice(-2).join(", ").trim() || "the area";
    parts.push(`At ${money(v).replace(" / sqm", "/sqm")}, this location sits in ${tier} value band for ${esc(where)}.`);
  } else {
    parts.push("No BIR zonal value is currently appraised for this exact spot — the nearest assessed street value should be used as a reference.");
  }
  const elevated = d.hazards.filter((h) => h.level >= 2).map((h) => HAZ_NAME[h.key] || h.name);
  if (d.checked === 0) parts.push("Geohazard data could not be assessed for this point.");
  else if (elevated.length) parts.push(`Geohazard screening flags elevated ${elevated.join(", ")} risk — overall ${d.riskLabel.toLowerCase()} (${d.score.toFixed(1)}/3.0); factor this into due diligence.`);
  else parts.push(`Across the six geohazard checks, exposure is ${d.riskLabel.toLowerCase()} (${d.score.toFixed(1)}/3.0) with no elevated risks.`);
  parts.push("Zonal values are BIR-assessed references for taxation, not market appraisals.");
  return parts.join(" ");
}

export function buildReportHtml(d: ReportData): string {
  const valStr = d.value && d.value > 0 ? money(d.value) : "Not Appraised";
  const sqm = d.parcelSqm ?? 250;
  const est = d.value && d.value > 0 ? `≈ PHP ${grp(String(Math.round(d.value * sqm)))} for ${sqm} sqm · BIR-indexed` : "";
  const clsLabel = d.classification ? (CLS_LABEL[d.classification.toUpperCase()] || "") : "";

  const r = 34, C = 2 * Math.PI * r, dash = Math.max(0, Math.min(1, d.score / 3)) * C;
  const gauge = `
    <svg width="80" height="80" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r="${r}" fill="none" stroke="#dbe5fb" stroke-width="9"/>
      <circle cx="42" cy="42" r="${r}" fill="none" stroke="${d.riskColor}" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/>
      <text x="42" y="48" text-anchor="middle" font-size="21" font-weight="700" fill="${INK}" font-family="Georgia,serif">${d.score.toFixed(1)}</text>
    </svg>`;

  const hazCells = d.hazards.map((h) => `
    <div class="haz">
      <span class="hdot" style="background:${h.color}"></span>
      <div><div class="hname">${esc(HAZ_NAME[h.key] || h.name)}</div>
        <div class="htext" style="color:${h.color}">${esc(h.text)}</div></div>
    </div>`).join("");

  const mapBlock = d.mapDataUrl ? `
    <div class="mapwrap"><img src="${d.mapDataUrl}" alt="Location map"/></div>` : "";

  const php = (n: number) => "₱" + grp(String(Math.round(n)));
  const costs = d.value && d.value > 0 ? computeCosts({ price: d.value * sqm }) : null;
  const costsBlock = costs ? `
    <div class="section">
      <div class="h2">Estimated Transaction Costs</div><div class="h2rule"></div>
      <div class="costnote">Illustrative for a ${sqm} sqm lot at this zonal value (${php(costs.price)} base). Taxes are computed on the higher of the selling price or the BIR zonal value; transfer tax and fees vary by LGU. The broker's professional fee (commission) is customary (~5% for land), seller-paid and negotiable.</div>
      <table class="costs">
        <tr><td>Capital Gains Tax <span>6% · seller</span></td><td>${php(costs.cgt)}</td></tr>
        <tr><td>Documentary Stamp Tax <span>1.5% · buyer</span></td><td>${php(costs.dst)}</td></tr>
        <tr><td>Transfer Tax <span>0.75% · buyer</span></td><td>${php(costs.transferTax)}</td></tr>
        <tr><td>Registration Fee <span>~0.25% · buyer</span></td><td>${php(costs.registrationFee)}</td></tr>
        <tr><td>Broker's Professional Fee <span>${Math.round(costs.brokerRate * 100)}% · seller · customary</span></td><td>${php(costs.brokerFee)}</td></tr>
        <tr class="tot"><td>Total transaction costs</td><td>${php(costs.totalFees)}</td></tr>
        <tr><td>Est. monthly amortization <span>80% loan · 6.5% · 20 yrs</span></td><td>${php(costs.monthlyAmortization)}<small>/mo</small></td></tr>
      </table>
    </div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html,body { margin:0; padding:0; background:#fff; color:${INK}; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; }
  .page { max-width: 820px; margin: 0 auto; }
  .band { background:${NAVY}; color:#fff; padding:22px 32px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .brand { font-size:22px; font-weight:800; letter-spacing:-0.3px; }
  .eyebrow { color:#93b4ff; font-size:10.5px; font-weight:800; letter-spacing:2px; margin-top:5px; }
  .date { font-size:11.5px; color:#cdd7f1; text-align:right; white-space:nowrap; }
  .goldrule { height:3px; background:${GOLD}; }
  .body { padding: 24px 32px 0; }
  .label { font-size:9.5px; letter-spacing:1.5px; font-weight:800; color:#8a93a6; text-transform:uppercase; }
  .loc { font-size:20px; font-weight:700; color:${INK}; margin-top:6px; font-family:Georgia,serif; }
  .valbox { background:${NAVY}; border-radius:14px; padding:16px 18px; margin-top:18px; display:flex; justify-content:space-between; align-items:center; gap:14px; }
  .vlabel { color:#93b4ff; font-size:9.5px; letter-spacing:1.5px; font-weight:800; }
  .vnum { color:#fff; font-size:25px; font-weight:800; font-family:Georgia,serif; margin-top:5px; letter-spacing:-0.3px; }
  .vest { color:#c8d3f0; font-size:10.5px; margin-top:5px; }
  .vcls { text-align:right; }
  .vcls .c1 { color:#fff; font-size:17px; font-weight:800; }
  .vcls .c2 { color:#c8d3f0; font-size:9px; letter-spacing:1px; text-transform:uppercase; margin-top:2px; }
  .mapwrap { margin-top:18px; border:2px solid ${GOLD}; border-radius:10px; overflow:hidden; }
  .mapwrap img { width:100%; display:block; }
  .section { margin-top:24px; }
  .h2 { font-size:15px; font-weight:800; color:${NAVY}; font-family:Georgia,serif; }
  .h2rule { height:2px; width:46px; background:${GOLD}; margin-top:6px; border-radius:1px; }
  .overall { display:flex; align-items:center; gap:16px; margin-top:14px; }
  .read .lvl { font-size:18px; font-weight:800; font-family:Georgia,serif; }
  .read .sc { font-size:11px; color:#5b6577; margin-top:2px; }
  .hazgrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:14px; }
  .haz { display:flex; align-items:center; gap:8px; border:1px solid #e6e1d5; border-radius:10px; padding:9px 10px; }
  .hdot { width:9px; height:9px; border-radius:50%; flex:none; }
  .hname { font-size:11px; font-weight:700; color:${INK}; }
  .htext { font-size:11px; font-weight:800; margin-top:1px; }
  .assess { font-size:12.5px; color:#33405e; line-height:1.62; margin-top:12px; }
  .costnote { font-size:10.5px; color:#5b6577; margin-top:11px; line-height:1.5; }
  .costs { width:100%; border-collapse:collapse; margin-top:12px; }
  .costs td { padding:9px 2px; border-bottom:1px solid #efeadd; font-size:12.5px; color:${INK}; }
  .costs td:last-child { text-align:right; font-weight:800; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .costs td span { display:block; font-size:9px; color:#8a93a6; font-weight:600; letter-spacing:0.4px; text-transform:uppercase; margin-top:2px; }
  .costs td small { font-size:9px; color:#8a93a6; font-weight:600; }
  .costs tr.tot td { border-top:2px solid ${NAVY}; border-bottom:none; color:${NAVY}; font-weight:800; }
  .sign { display:flex; justify-content:space-between; gap:30px; margin-top:38px; }
  .col { flex:1; }
  .col.r { text-align:right; }
  .sigName { font-family:Georgia,serif; font-style:italic; font-size:19px; color:${INK}; border-bottom:1px solid #9aa3b2; padding-bottom:5px; }
  .sigRole { font-size:10.5px; color:#46506a; margin-top:6px; font-weight:700; }
  .sigCap { font-size:8.5px; color:#8a93a6; letter-spacing:1.2px; text-transform:uppercase; margin-top:3px; }
  .disc { margin-top:26px; font-size:9px; color:#8a93a6; line-height:1.55; border-top:1px solid #e6e1d5; padding-top:12px; }
  .foot { background:${INK}; color:#cdd6ea; padding:13px 32px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px; margin-top:22px; gap:12px; }
  .foot b { color:#93b4ff; font-weight:700; }
</style></head>
<body>
  <div class="page">
    <div class="band">
      <div>
        <div class="brand">FH Zonal Finder</div>
        <div class="eyebrow">BIR ZONAL PROPERTY REPORT</div>
      </div>
      <div class="date">${esc(d.dateStr)}</div>
    </div>
    <div class="goldrule"></div>

    <div class="body">
      <div class="label">Location</div>
      <div class="loc">${esc(d.location)}</div>

      <div class="valbox">
        <div>
          <div class="vlabel">ZONAL VALUE</div>
          <div class="vnum">${esc(valStr)}</div>
          ${est ? `<div class="vest">${esc(est)}</div>` : ""}
        </div>
        ${d.classification ? `<div class="vcls"><div class="c1">${esc(d.classification)}</div>${clsLabel ? `<div class="c2">${esc(clsLabel)}</div>` : ""}</div>` : ""}
      </div>

      ${mapBlock}

      <div class="section">
        <div class="h2">Geohazard Profile</div><div class="h2rule"></div>
        <div class="overall">
          ${gauge}
          <div class="read">
            <div class="lvl" style="color:${d.riskColor}">${esc(d.riskLabel)} risk</div>
            <div class="sc">${d.score.toFixed(1)} / 3.0 overall · ${d.checked}/6 checks assessed</div>
          </div>
        </div>
        <div class="hazgrid">${hazCells}</div>
      </div>

      ${costsBlock}

      <div class="section">
        <div class="h2">Property Assessment</div><div class="h2rule"></div>
        <div class="assess">${esc(assessment(d))}</div>
      </div>

      <div class="sign">
        <div class="col">
          <div class="sigName">${esc(d.preparedBy)}</div>
          <div class="sigRole">Prepared by</div>
          <div class="sigCap">Filipino Homes · Leuterio Realty</div>
        </div>
        <div class="col r">
          <div class="sigName">Anthony Gerard Leuterio</div>
          <div class="sigRole">CEO / Founder, Filipino Homes</div>
          <div class="sigCap">zonalvalue.ph</div>
        </div>
      </div>

      <div class="disc">The Zonal Value information in this report is for informational purposes only and is not an official appraisal. Values are based on a data-driven analysis by Filipino Homes and should not be the sole basis for property valuation, legal, or financial decisions. Hazard overlays are sourced from PHIVOLCS &amp; Project NOAH. For an official appraisal, consult a licensed appraiser or the appropriate government authority (e.g., BIR).</div>
    </div>

    <div class="foot">
      <div>© 2026 Filipino Homes · Leuterio Realty</div>
      <div>Zonal values · <b>BIR</b> &nbsp;·&nbsp; Geohazards · <b>PHIVOLCS &amp; Project NOAH</b></div>
    </div>
  </div>
</body></html>`;
}
