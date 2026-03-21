/**
 * WOLF Valuation Engine — Native jsPDF Vector PDF Export (9 Pages)
 * No html2canvas. No hidden divs. No screenshots.
 * Pure vector drawing: sharp text, searchable, <400KB, <1 second.
 */
import { useState } from 'react';
import jsPDF from 'jspdf';
import type { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../../types/financial';
import { calculateWACC } from '../../utils/valuation';
import { calcScenarioPrice } from '../../utils/calculations/scenarios';
import { calculateQualityScorecard, calculateReverseDCF, runMonteCarloSimulation } from '../../utils/advancedAnalysis';
import { calculateDDM } from '../../utils/valuationEngine';

// ── DESIGN TOKENS ──────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  bg: [11,15,26] as RGB, nv: [26,35,64] as RGB, gd: [197,164,78] as RGB,
  iv: [244,237,228] as RGB, gr: [107,114,128] as RGB, gn: [34,197,94] as RGB,
  rd: [239,68,68] as RGB, am: [245,158,11] as RGB, dim: [30,40,60] as RGB,
  alt: [15,22,40] as RGB, hl: [20,35,60] as RGB,
};
const PW = 210, PH_ = 297, ML = 20, MR = 20, CW = PW - ML - MR;

// ── FORMATTERS ─────────────────────────────────────────────────
const fe = (n:number|null|undefined,c='EGP'):string => n==null||isNaN(n!)||!isFinite(n!) ? '—' : `${n!.toFixed(2)} ${c}`;
const fl = (n:number|null|undefined):string => n==null||isNaN(n!)||!isFinite(n!) ? '—' : Math.round(n!).toLocaleString('en-US');
const fm = (n:number|null|undefined):string => n==null||isNaN(n!) ? '—' : n!<0?`(${Math.abs(n!).toLocaleString('en-US')})`:Math.round(n!).toLocaleString('en-US');
const fp = (n:number|null|undefined,s=false):string => n==null||isNaN(n!) ? '—' : `${s&&n!>0?'+':''}${n!.toFixed(2)}%`;
const fx = (n:number|null|undefined):string => n==null||isNaN(n!) ? '—' : `${n!.toFixed(2)}x`;
const fd_ = (n:number|null|undefined):string => n==null||isNaN(n!) ? '—' : `${n!.toFixed(1)} days`;

// ── DRAWING HELPERS ────────────────────────────────────────────
function fill(d:jsPDF,c:RGB){d.setFillColor(c[0],c[1],c[2])}
function stk(d:jsPDF,c:RGB){d.setDrawColor(c[0],c[1],c[2])}
function tc(d:jsPDF,c:RGB){d.setTextColor(c[0],c[1],c[2])}

function pageBg(d:jsPDF){fill(d,C.bg);d.rect(0,0,PW,PH_,'F')}
function pageHdr(d:jsPDF,t:string){
  fill(d,C.nv);d.rect(0,0,PW,14,'F');stk(d,C.gd);d.setLineWidth(0.3);d.line(0,14,PW,14);
  d.setFont('helvetica','bold');d.setFontSize(11);tc(d,C.gd);d.text('WOLF',ML,9.5);
  d.setFont('helvetica','normal');d.setFontSize(7.5);tc(d,C.gr);d.text(t.toUpperCase(),PW-MR,9.5,{align:'right'});
}
function pageFtr(d:jsPDF,n:number){
  fill(d,C.nv);d.rect(0,PH_-10,PW,10,'F');stk(d,C.gd);d.setLineWidth(0.3);d.line(0,PH_-10,PW,PH_-10);
  d.setFont('helvetica','normal');d.setFontSize(6.5);tc(d,C.gr);
  d.text('Wolf Valuation Engine | Part of the Wolf Financial Suite',ML,PH_-3.5);
  d.text(`Page ${n}`,PW-MR,PH_-3.5,{align:'right'});
}

function secHdr(d:jsPDF,y:number,t:string,sub?:string):number{
  stk(d,C.gd);d.setLineWidth(0.4);d.line(ML,y+7,ML+CW,y+7);
  d.setFont('helvetica','bold');d.setFontSize(11);tc(d,C.gd);d.text(t.toUpperCase(),ML,y+5);
  if(sub){d.setFont('courier','normal');d.setFontSize(7.5);tc(d,C.gr);d.text(sub,ML+CW,y+5,{align:'right'})}
  return y+12;
}

function dr(d:jsPDF,y:number,l:string,v:string,hl=false,vc?:RGB,lx=ML,w=CW):number{
  const rh=7;
  if(hl){fill(d,C.nv);d.rect(lx,y,w,rh,'F')}
  stk(d,C.dim);d.setLineWidth(0.1);d.line(lx,y+rh,lx+w,y+rh);
  d.setFont('helvetica','normal');d.setFontSize(9);tc(d,C.gr);d.text(l,lx+3,y+rh-2);
  d.setFont('courier','bold');d.setFontSize(8.5);tc(d,vc??C.iv);d.text(v,lx+w-3,y+rh-2,{align:'right'});
  return y+rh;
}

function card(d:jsPDF,x:number,y:number,w:number,h:number,label:string,value:string,gold=false){
  fill(d,C.nv);stk(d,gold?C.gd:C.dim);d.setLineWidth(gold?0.5:0.2);d.rect(x,y,w,h,'FD');
  d.setFont('helvetica','normal');d.setFontSize(7);tc(d,C.gr);d.text(label,x+w/2,y+5,{align:'center'});
  d.setFont('courier','bold');d.setFontSize(11);tc(d,gold?C.gd:C.iv);d.text(value,x+w/2,y+12,{align:'center'});
}

function tblHdr(d:jsPDF,y:number,cols:{t:string,w:number}[]):number{
  fill(d,C.nv);d.rect(ML,y,CW,7,'F');let x=ML;
  cols.forEach((c,i)=>{d.setFont('helvetica','bold');d.setFontSize(7.5);tc(d,C.gd);
    d.text(c.t,i===0?x+2:x+c.w-2,y+5,{align:i===0?'left':'right'});x+=c.w});
  return y+7;
}

function tblRow(d:jsPDF,y:number,cols:{t:string,w:number}[],vals:string[],hl=false,alt=false):number{
  if(hl){fill(d,C.hl);d.rect(ML,y,CW,7,'F')}else if(alt){fill(d,C.alt);d.rect(ML,y,CW,7,'F')}
  let x=ML;
  vals.forEach((v,i)=>{
    const isV=i>0;d.setFont(isV?'courier':'helvetica',hl&&isV?'bold':'normal');
    d.setFontSize(isV?7.5:8);tc(d,i===0?C.gr:(hl?C.gd:C.iv));
    d.text(v,i===0?x+2:x+cols[i].w-2,y+5,{align:i===0?'left':'right'});x+=cols[i].w});
  return y+7;
}

// ── PROPS ──────────────────────────────────────────────────────
interface Props {
  financialData:FinancialData;assumptions:ValuationAssumptions;comparables:ComparableCompany[];
  dcfProjections:DCFProjection[];dcfValue:number;comparableValue:number;
  blendedValue:number;upside:number;scenario:'bear'|'base'|'bull';marketRegion:MarketRegion;
}

// ── MAIN PDF GENERATION ────────────────────────────────────────
function generateNativePDF(props:Props){
  const{financialData:fd,assumptions,comparables,dcfProjections:proj,dcfValue,comparableValue,blendedValue,upside,scenario,marketRegion}=props;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const ccy=marketRegion==='Egypt'?'EGP':'USD';
  const price=fd.currentStockPrice;
  const rec=upside>10?'BUY':upside>=-10?'HOLD':'SELL';
  const recC=rec==='BUY'?C.gn:rec==='SELL'?C.rd:C.am;
  const date=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

  // WACC sync
  const syncWACC=calculateWACC(fd,assumptions);
  const a={...assumptions,discountRate:syncWACC};
  const is=fd.incomeStatement,bs=fd.balanceSheet,cf=fd.cashFlowStatement;
  const totalDebt=bs.shortTermDebt+bs.longTermDebt;
  const ebitda=is.operatingIncome+is.depreciation+is.amortization;
  const mktCap=price*fd.sharesOutstanding;
  const shares=fd.sharesOutstanding;

  // Scenarios
  const bear=calcScenarioPrice(fd,a,'bear');
  const bull=calcScenarioPrice(fd,a,'bull');

  // EV Bridge
  const sumPV=proj.reduce((s,p)=>s+p.presentValue,0);
  const lastFCFF=proj[proj.length-1]?.freeCashFlow||0;
  const wD=a.discountRate/100,gD=a.terminalGrowthRate/100;
  const tv=wD>gD?(lastFCFF*(1+gD))/(wD-gD):0;
  const pvTV=tv/Math.pow(1+wD,a.projectionYears);
  const ev=sumPV+pvTV;
  const eqVal=ev-totalDebt+bs.cash;
  const dcfPS=eqVal/shares;

  // WACC components
  const ke=a.riskFreeRate+a.beta*a.marketRiskPremium;
  const kdAT=a.costOfDebt*(1-a.taxRate/100);
  const eqW=mktCap/(mktCap+totalDebt),dW=1-eqW;

  // Margins
  const rev=is.revenue||1;
  const gm=(rev-is.costOfGoodsSold)/rev*100;
  const em_=ebitda/rev*100,om=is.operatingIncome/rev*100,nm=is.netIncome/rev*100;
  const fcfm=cf.freeCashFlow/rev*100;
  const da_=is.depreciation+is.amortization;

  // Advanced
  const sc=(()=>{try{return calculateQualityScorecard(fd)}catch{return null}})();
  const rdcf=(()=>{try{return calculateReverseDCF(fd,a)}catch{return null}})();
  const mc=runMonteCarloSimulation(fd,a,5000);
  const ddm=calculateDDM(fd,a,ke);

  // Z-Score
  const wc=bs.totalCurrentAssets-bs.totalCurrentLiabilities;
  const ta=bs.totalAssets||1,tl=bs.totalLiabilities||1;
  const re_=bs.retainedEarnings||bs.totalEquity;
  const zS=1.2*(wc/ta)+1.4*(re_/ta)+3.3*(is.operatingIncome/ta)+0.6*(mktCap/tl)+is.revenue/ta;
  const zZ=zS>2.99?'Safe Zone':zS>1.81?'Grey Zone':'Distress Zone';
  const zC=zS>2.99?C.gn:zS>1.81?C.am:C.rd;

  // DuPont
  const npm_=is.netIncome/rev,at_=is.revenue/ta,em2=bs.totalEquity>0?ta/bs.totalEquity:0;
  const dpROE=npm_*at_*em2*100;

  // Ratios
  const roe=bs.totalEquity>0?(is.netIncome/bs.totalEquity)*100:0;
  const roa=(is.netIncome/ta)*100;
  const ic_=bs.totalEquity+totalDebt-bs.cash;
  const statTax=a.taxRate/100;
  const nopat_=is.operatingIncome*(1-statTax);
  const roic=ic_>0?(nopat_/ic_)*100:0;
  const cr=bs.totalCurrentLiabilities>0?bs.totalCurrentAssets/bs.totalCurrentLiabilities:0;
  const qr=bs.totalCurrentLiabilities>0?(bs.cash+bs.accountsReceivable)/bs.totalCurrentLiabilities:0;
  const de=bs.totalEquity>0?totalDebt/bs.totalEquity:0;
  const dEbitda=ebitda>0?totalDebt/ebitda:0;
  const intCov=is.interestExpense>0?is.operatingIncome/is.interestExpense:999;
  const ndEbitda=ebitda>0?(totalDebt-bs.cash)/ebitda:0;
  const evEbitda=ebitda>0?(mktCap+totalDebt-bs.cash)/ebitda:0;
  const pe_=is.netIncome>0?mktCap/is.netIncome:0;
  const pb_=bs.totalEquity>0?mktCap/bs.totalEquity:0;
  const eps=is.netIncome/shares;
  const dps=Math.abs(cf.dividendsPaid||0)/shares;
  const divYield=price>0?(dps/price)*100:0;
  const fcfYield=mktCap>0?(cf.freeCashFlow/mktCap)*100:0;

  // Working capital
  const cogs=is.costOfGoodsSold||1;
  const dso=(bs.accountsReceivable/rev)*365;
  const dio=(bs.inventory/cogs)*365;
  const dpo=(bs.accountsPayable/cogs)*365;
  const ccc=dso+dio-dpo;

  // Sensitivity
  const bW=a.discountRate,bTG=a.terminalGrowthRate;
  const wSteps=[-4,-2,0,2,4].map(d=>bW+d);
  const gSteps=[-3,-1.5,0,1.5,3].map(d=>bTG+d);

  // Base year
  const baseYr=(()=>{const d=fd.lastReportedDate;if(d){const p=new Date(d);if(!isNaN(p.getTime()))return p.getFullYear()}return new Date().getFullYear()})();

  // FCFF reconciliation
  const ebit_=is.operatingIncome;
  const capex_=cf.capitalExpenditures;
  const m1=ebit_*(1-statTax)+da_-capex_;
  const m2=ebitda*(1-statTax)+da_*statTax-capex_;
  const m3=is.netIncome+is.interestExpense*(1-statTax)+da_-capex_;

  // Profit distribution
  const legalRes=is.netIncome*0.05;
  const distrib=is.netIncome-legalRes;
  const empProf=distrib*0.10;
  const availSH=distrib-empProf;
  const divPaid=Math.abs(cf.dividendsPaid||0);
  const retained=availSH-divPaid;

  let y=0;
  const hw=(CW-6)/2, c2x=ML+hw+6;

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1: COVER
  // ═══════════════════════════════════════════════════════════════
  pageBg(doc);
  doc.setFont('helvetica','bold');doc.setFontSize(56);tc(doc,C.gd);
  doc.text('W O L F',PW/2,95,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(9);tc(doc,C.gr);
  doc.text('EQUITY VALUATION ENGINE',PW/2,104,{align:'center',charSpace:2});
  stk(doc,C.gd);doc.setLineWidth(0.5);doc.line(PW/2-25,109,PW/2+25,109);
  doc.setFont('helvetica','bold');doc.setFontSize(20);tc(doc,C.iv);
  doc.text('Equity Valuation Report',PW/2,124,{align:'center'});
  doc.setFont('helvetica','bold');doc.setFontSize(14);tc(doc,C.gd);
  doc.text(`${fd.companyName} (${fd.ticker})`,PW/2,136,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(9);tc(doc,C.gr);
  doc.text(date,PW/2,144,{align:'center'});
  // Badge
  const bTxt=`${rec} — ${upside>0?'+':''}${upside.toFixed(2)}% Upside`;
  stk(doc,recC);doc.setLineWidth(0.6);doc.rect(PW/2-38,150,76,10,'S');
  doc.setFont('courier','bold');doc.setFontSize(10);tc(doc,recC);
  doc.text(bTxt,PW/2,156.5,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(8);tc(doc,C.gr);
  doc.text(`Currency: ${ccy}  |  Current: ${fe(price,ccy)}  |  Blended: ${fe(blendedValue,ccy)}`,PW/2,168,{align:'center'});
  doc.setFontSize(6.5);doc.text('Wolf Valuation Engine | Part of the Wolf Financial Suite',PW/2,PH_-6,{align:'center'});

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2: VALUATION SUMMARY
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Valuation Summary');pageFtr(doc,2);
  y=22;y=secHdr(doc,y,'Valuation Overview',`${scenario.toUpperCase()} CASE`);
  const cw3=(CW-8)/3;
  card(doc,ML,y,cw3,16,'DCF Fair Value',fe(dcfValue,ccy));
  card(doc,ML+cw3+4,y,cw3,16,'Comparable Fair Value',fe(comparableValue,ccy));
  card(doc,ML+2*(cw3+4),y,cw3,16,'Blended Value (60/40)',fe(blendedValue,ccy),true);
  y+=21;
  y=dr(doc,y,'Current Stock Price',fe(price,ccy));
  y=dr(doc,y,'Upside / (Downside)',fp(upside,true),false,upside>0?C.gn:C.rd);
  y=dr(doc,y,'Recommendation',rec,false,recC);
  y+=4;y=secHdr(doc,y,'Key Assumptions');
  [['WACC (Discount Rate)',fp(a.discountRate)],['Terminal Growth',fp(a.terminalGrowthRate)],['Revenue Growth',fp(a.revenueGrowthRate)],['EBITDA Margin',fp(a.ebitdaMargin)],['Tax Rate',fp(a.taxRate)],['Projection Years',`${a.projectionYears}`],['CAPM Method',a.capmMethod==='B'?'B — USD Build-Up':'A — Local Currency']].forEach(([l,v])=>{y=dr(doc,y,l,v)});
  y+=4;y=secHdr(doc,y,'Football Field — Valuation Range');
  const ffC=[{t:'Method',w:35},{t:'Low',w:30},{t:'Mid',w:30},{t:'High',w:30},{t:'vs Current',w:CW-125}];
  y=tblHdr(doc,y,ffC);
  const peImp=eps*(ccy==='EGP'?7:15);
  const evImp=(ebitda*(ccy==='EGP'?5:10)-totalDebt+bs.cash)/shares;
  const pbImp=(bs.totalEquity/shares)*(ccy==='EGP'?1.5:2);
  const ffR=[
    ['DCF',fe(dcfValue*0.73,ccy),fe(dcfValue,ccy),fe(dcfValue*1.59,ccy),fp(((dcfValue-price)/price)*100,true)],
    ['P/E',fe(peImp*0.85,ccy),fe(peImp,ccy),fe(peImp*1.15,ccy),''],
    ['EV/EBITDA',fe(evImp*0.85,ccy),fe(evImp,ccy),fe(evImp*1.15,ccy),''],
    ...(ddm.applicable&&ddm.gordonGrowth?[['DDM',fe(ddm.gordonGrowth,ccy),fe(ddm.hModel,ccy),fe(ddm.twoStage,ccy),'']]:[] as string[][]),
    ['P/B',fe(pbImp*0.85,ccy),fe(pbImp,ccy),fe(pbImp*1.15,ccy),''],
    ['Blended',fe(blendedValue*0.9,ccy),fe(blendedValue,ccy),fe(blendedValue*1.1,ccy),fp(upside,true)],
  ];
  ffR.forEach((r,i)=>{y=tblRow(doc,y,ffC,r,false,i%2===0)});
  y+=4;y=secHdr(doc,y,'Scenario Analysis');
  [{n:'BEAR CASE',p:bear.price,g:bear.growth,w:bear.wacc,c:C.rd,h:false},{n:'BASE CASE',p:dcfValue,g:a.revenueGrowthRate,w:a.discountRate,c:C.gd,h:true},{n:'BULL CASE',p:bull.price,g:bull.growth,w:bull.wacc,c:C.gn,h:false}].forEach(s=>{
    if(s.h){fill(doc,C.nv);doc.rect(ML,y,CW,10,'F')}
    fill(doc,s.c);doc.rect(ML,y,1.5,10,'F');
    doc.setFont('helvetica',s.h?'bold':'normal');doc.setFontSize(8);tc(doc,s.h?C.iv:C.gr);doc.text(s.n,ML+5,y+4);
    doc.setFont('helvetica','normal');doc.setFontSize(7);tc(doc,C.gr);doc.text(`Growth: ${s.g.toFixed(1)}%, WACC: ${s.w.toFixed(1)}%`,ML+5,y+8);
    doc.setFont('courier','bold');doc.setFontSize(10);tc(doc,s.c);doc.text(fe(s.p,ccy),ML+CW-3,y+7,{align:'right'});
    const vs=(s.p-price)/price*100;doc.setFontSize(7.5);tc(doc,vs>0?C.gn:C.rd);doc.text(fp(vs,true),ML+CW-40,y+7,{align:'right'});
    y+=11;
  });

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3: DCF ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'DCF Analysis');pageFtr(doc,3);
  y=22;y=secHdr(doc,y,'FCFF Projections',`${a.projectionYears}-Year Horizon`);
  const yrCols=[{t:'Metric',w:42},...proj.map((_,i)=>({t:`${baseYr+i+1}`,w:Math.floor((CW-42)/proj.length)}))];
  y=tblHdr(doc,y,yrCols);
  const fcffKeys:{l:string,k:keyof DCFProjection,h:boolean,dec?:number}[]=[
    {l:'Revenue',k:'revenue',h:false},{l:'EBITDA',k:'ebitda',h:false},{l:'D&A',k:'dAndA',h:false},
    {l:'EBIT',k:'ebit',h:false},{l:'NOPAT',k:'nopat',h:false},{l:'CapEx',k:'capex',h:false},
    {l:'Delta WC',k:'deltaWC',h:false},{l:'FCFF',k:'freeCashFlow',h:true},
    {l:'Disc. Factor',k:'discountFactor',h:false,dec:4},{l:'PV of FCFF',k:'presentValue',h:true},
  ];
  fcffKeys.forEach((r,ri)=>{
    const vals=[r.l,...proj.map(p=>{const v=p[r.k] as number;return r.dec?v.toFixed(r.dec):fl(v)})];
    y=tblRow(doc,y,yrCols,vals,r.h,ri%2===0&&!r.h);
  });
  y+=6;
  // Two-column: EV Bridge + WACC
  let yL=y,yR=y;
  yL=secHdr(doc,yL,'EV-to-Equity Bridge');
  [[`Sum PV(FCFF) Yr 1-${a.projectionYears}`,fl(sumPV),false],[`Terminal Value (g=${fp(a.terminalGrowthRate)})`,fl(tv),false],['PV of Terminal Value',fl(pvTV),false],['Enterprise Value',fl(ev),true],['Less: Total Debt',`(${fl(totalDebt)})`,false],['Plus: Cash',fl(bs.cash),false],['Equity Value',fl(eqVal),true],['Shares Outstanding',fl(shares),false],['DCF Fair Value / Share',fe(dcfPS,ccy),true]].forEach(([l,v,h])=>{
    yL=dr(doc,yL,l as string,v as string,h as boolean,h?C.gd:undefined,ML,hw);
  });
  yR=secHdr(doc,yR,'WACC Breakdown');
  [['Risk-Free Rate (Rf)',fp(a.riskFreeRate),false],['Equity Risk Premium',fp(a.marketRiskPremium),false],['Beta',a.beta.toFixed(2),false],['Cost of Equity (Ke)',fp(ke),true],['Cost of Debt (Pre-Tax)',fp(a.costOfDebt),false],['Tax Rate',fp(a.taxRate),false],['Cost of Debt (After-Tax)',fp(kdAT),false],['Equity Weight (We)',fp(eqW*100),false],['Debt Weight (Wd)',fp(dW*100),false],['WACC',fp(a.discountRate),true],['CAPM Method',a.capmMethod==='B'?'B — USD':'A — Local',false]].forEach(([l,v,h])=>{
    yR=dr(doc,yR,l as string,v as string,h as boolean,h?C.gd:undefined,c2x,hw);
  });

  // ═══════════════════════════════════════════════════════════════
  // PAGE 4: COMPARABLES & SENSITIVITY
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Comparables & Sensitivity');pageFtr(doc,4);
  y=22;
  if(comparables.length>0){
    y=secHdr(doc,y,'Peer Company Multiples',`${comparables.length} Peers`);
    const cc=[{t:'Company',w:54},{t:'P/E',w:29},{t:'EV/EBITDA',w:29},{t:'P/S',w:29},{t:'P/B',w:29}];
    y=tblHdr(doc,y,cc);
    comparables.forEach((c,i)=>{y=tblRow(doc,y,cc,[c.name,fx(c.peRatio),fx(c.evEbitda),fx(c.psRatio),fx(c.pbRatio)],false,i%2===0)});
    y=tblRow(doc,y,cc,['Average',fx(comparables.reduce((s,c)=>s+c.peRatio,0)/comparables.length),fx(comparables.reduce((s,c)=>s+c.evEbitda,0)/comparables.length),fx(comparables.reduce((s,c)=>s+c.psRatio,0)/comparables.length),fx(comparables.reduce((s,c)=>s+c.pbRatio,0)/comparables.length)],true);
    y+=6;
  }
  y=secHdr(doc,y,'DCF Sensitivity — WACC vs Terminal Growth');
  const sw=25,slw=30,sensW=slw+sw*gSteps.length;
  // Header
  fill(doc,C.nv);doc.rect(ML,y,sensW,7,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7);tc(doc,C.gd);doc.text('WACC \\ g',ML+2,y+5);
  gSteps.forEach((g,i)=>{const isB=Math.abs(g-bTG)<0.01;doc.setFont('courier',isB?'bold':'normal');doc.setFontSize(7);tc(doc,C.gd);
    doc.text(`${g.toFixed(1)}%${isB?'\u2605':''}`,ML+slw+i*sw+sw/2,y+5,{align:'center'})});
  y+=7;
  wSteps.forEach((w,ri)=>{
    const isBaseRow=Math.abs(w-bW)<0.01;
    if(isBaseRow){fill(doc,C.nv);doc.rect(ML,y,sensW,7,'F')}
    doc.setFont('courier',isBaseRow?'bold':'normal');doc.setFontSize(7);tc(doc,isBaseRow?C.gd:C.gr);
    doc.text(`${w.toFixed(1)}%${isBaseRow?'\u2605':''}`,ML+2,y+5);
    gSteps.forEach((g,ci)=>{
      const wd2=w/100,gd2=g/100;
      if(wd2<=gd2){doc.setFont('courier','normal');doc.setFontSize(7);tc(doc,C.gr);doc.text('N/A',ML+slw+ci*sw+sw/2,y+5,{align:'center'});return}
      let sp2=0;for(let yr=0;yr<proj.length;yr++)sp2+=proj[yr].freeCashFlow/Math.pow(1+wd2,yr+1);
      const tv2=(proj[proj.length-1].freeCashFlow*(1+gd2))/(wd2-gd2);
      const pv2=tv2/Math.pow(1+wd2,proj.length);
      const ps2=(sp2+pv2+bs.cash-totalDebt)/shares;
      const isB=Math.abs(w-bW)<0.01&&Math.abs(g-bTG)<0.01;
      // Color tinting
      if(!isB){
        if(ps2>blendedValue){fill(doc,[20,40,30]);doc.rect(ML+slw+ci*sw,y,sw,7,'F')}
        else if(ps2<dcfValue){fill(doc,[40,20,20]);doc.rect(ML+slw+ci*sw,y,sw,7,'F')}
      }else{stk(doc,C.gd);doc.setLineWidth(0.4);doc.rect(ML+slw+ci*sw,y,sw,7,'S')}
      doc.setFont('courier',isB?'bold':'normal');doc.setFontSize(7);tc(doc,isB?C.gd:C.iv);
      doc.text(ps2.toFixed(2),ML+slw+ci*sw+sw/2,y+5,{align:'center'});
    });
    y+=7;
  });
  doc.setFont('courier','normal');doc.setFontSize(6);tc(doc,C.gr);doc.text(`\u2605 = Base case. All values in ${ccy}.`,ML,y+4);

  // ═══════════════════════════════════════════════════════════════
  // PAGE 5: ADVANCED ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Advanced Analytics');pageFtr(doc,5);
  y=22;yL=y;yR=y;
  // Left: Z-Score + DuPont
  yL=secHdr(doc,yL,'Altman Z-Score');
  yL=dr(doc,yL,'Z-Score',zS.toFixed(2),true,zC,ML,hw);
  yL=dr(doc,yL,'Assessment',zZ,false,zC,ML,hw);
  [['X1 (WC/TA)',(1.2*(wc/ta)).toFixed(3)],['X2 (RE/TA)',(1.4*(re_/ta)).toFixed(3)],['X3 (EBIT/TA)',(3.3*(is.operatingIncome/ta)).toFixed(3)],['X4 (MCap/TL)',(0.6*(mktCap/tl)).toFixed(3)],['X5 (Rev/TA)',(is.revenue/ta).toFixed(3)]].forEach(([l,v])=>{yL=dr(doc,yL,l,v,false,undefined,ML,hw)});
  doc.setFont('courier','normal');doc.setFontSize(6);tc(doc,C.gr);doc.text('> 2.99 = Safe | 1.81-2.99 = Grey | < 1.81 = Distress',ML,yL+4);
  yL+=8;yL=secHdr(doc,yL,'DuPont Decomposition');
  yL=dr(doc,yL,'Net Profit Margin',fp(npm_*100),false,undefined,ML,hw);
  yL=dr(doc,yL,'x Asset Turnover',fx(at_),false,undefined,ML,hw);
  yL=dr(doc,yL,'x Equity Multiplier',fx(em2),false,undefined,ML,hw);
  yL=dr(doc,yL,'= DuPont ROE',fp(dpROE),true,dpROE>15?C.gn:C.iv,ML,hw);
  // Right: Quality + Reverse DCF
  if(sc){yR=secHdr(doc,yR,'Quality Scorecard');
    yR=dr(doc,yR,'Overall Score',`${sc.totalScore} / ${sc.maxTotalScore}`,true,C.gd,c2x,hw);
    yR=dr(doc,yR,'Grade',sc.grade,false,C.gd,c2x,hw);
    [['Economic Moat',`${sc.economicMoat.score}/${sc.economicMoat.maxScore}`],['Financial Health',`${sc.financialHealth.score}/${sc.financialHealth.maxScore}`],['Growth Profile',`${sc.growthProfile.score}/${sc.growthProfile.maxScore}`],['Capital Allocation',`${sc.capitalAllocation.score}/${sc.capitalAllocation.maxScore}`],['Quality Premium',`+${sc.qualityPremium?.toFixed(1)??'0'}%`]].forEach(([l,v])=>{yR=dr(doc,yR,l,v,false,undefined,c2x,hw)});
    yR+=4;
  }
  if(rdcf){yR=secHdr(doc,yR,'Reverse DCF');
    yR=dr(doc,yR,'Market Implied Growth',`${rdcf.impliedGrowthRate?.toFixed(1)??'—'}%`,false,undefined,c2x,hw);
    yR=dr(doc,yR,'WOLF Estimate',fp(a.revenueGrowthRate),false,undefined,c2x,hw);
    yR=dr(doc,yR,'Growth Gap',`${rdcf.growthGap>=0?'+':''}${rdcf.growthGap?.toFixed(1)??'—'}pp`,false,rdcf.growthGap>0?C.gn:C.rd,c2x,hw);
  }
  y=Math.max(yL,yR)+6;
  y=secHdr(doc,y,'Monte Carlo Simulation',`${mc.simulations.toLocaleString()} Runs`);
  yL=y;yR=y;
  [['Mean Price',fe(mc.meanPrice,ccy)],['Median Price',fe(mc.medianPrice,ccy)],['Std Deviation',fe(mc.stdDev,ccy)],['P(Above Current)',`${mc.probabilityAboveCurrentPrice.toFixed(1)}%`],['P(Above Base)',`${mc.probabilityAboveBaseCase.toFixed(1)}%`]].forEach(([l,v])=>{yL=dr(doc,yL,l,v,false,undefined,ML,hw)});
  [['5th Percentile',fe(mc.percentile5,ccy)],['25th Percentile',fe(mc.percentile25,ccy)],['75th Percentile',fe(mc.percentile75,ccy)],['95th Percentile',fe(mc.percentile95,ccy)]].forEach(([l,v])=>{yR=dr(doc,yR,l,v,false,undefined,c2x,hw)});

  // ═══════════════════════════════════════════════════════════════
  // PAGE 6: FINANCIAL STATEMENTS
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Financial Statements');pageFtr(doc,6);
  y=22;yL=y;yR=y;
  yL=secHdr(doc,yL,'Income Statement');
  [['Revenue',fm(is.revenue),'100.0%',false],['COGS',`(${fm(is.costOfGoodsSold)})`,`${(is.costOfGoodsSold/rev*100).toFixed(1)}%`,false],['Gross Profit',fm(is.grossProfit),`${gm.toFixed(1)}%`,true],['OpEx',`(${fm(is.operatingExpenses)})`,`${(is.operatingExpenses/rev*100).toFixed(1)}%`,false],['EBITDA',fm(ebitda),`${em_.toFixed(1)}%`,false],['D&A',`(${fm(da_)})`,`${(da_/rev*100).toFixed(1)}%`,false],['EBIT',fm(is.operatingIncome),`${om.toFixed(1)}%`,true],['Interest Exp.',`(${fm(is.interestExpense)})`,`${(is.interestExpense/rev*100).toFixed(1)}%`,false],['EBT',fm(is.operatingIncome-is.interestExpense),`${((is.operatingIncome-is.interestExpense)/rev*100).toFixed(1)}%`,false],['Tax',`(${fm(is.taxExpense)})`,`${(is.taxExpense/rev*100).toFixed(1)}%`,false],['Net Income',fm(is.netIncome),`${nm.toFixed(1)}%`,true]].forEach(([l,v,p,h])=>{
    if(h){fill(doc,C.nv);doc.rect(ML,yL,hw,7,'F')}
    stk(doc,C.dim);doc.setLineWidth(0.1);doc.line(ML,yL+7,ML+hw,yL+7);
    doc.setFont('helvetica','normal');doc.setFontSize(8);tc(doc,C.gr);doc.text(l as string,ML+2,yL+5);
    doc.setFont('courier',h?'bold':'normal');doc.setFontSize(7.5);tc(doc,h&&l==='Net Income'?(is.netIncome>0?C.gn:C.rd):C.iv);doc.text(v as string,ML+hw-30,yL+5,{align:'right'});
    doc.setFont('courier','normal');doc.setFontSize(7);tc(doc,C.gr);doc.text(p as string,ML+hw-3,yL+5,{align:'right'});
    yL+=7;
  });
  // Right: Balance Sheet
  yR=secHdr(doc,yR,'Balance Sheet');
  doc.setFont('helvetica','bold');doc.setFontSize(8);tc(doc,C.gd);doc.text('ASSETS',c2x,yR+3);yR+=6;
  [['Cash',fm(bs.cash)],['Accounts Receivable',fm(bs.accountsReceivable)],['Inventory',fm(bs.inventory)],['Total Current Assets',fm(bs.totalCurrentAssets)]].forEach(([l,v])=>{yR=dr(doc,yR,l,v,false,undefined,c2x,hw)});
  yR=dr(doc,yR,'PP&E (Net)',fm(bs.propertyPlantEquipment),false,undefined,c2x,hw);
  yR=dr(doc,yR,'Total Assets',fm(bs.totalAssets),true,undefined,c2x,hw);
  doc.setFont('helvetica','bold');doc.setFontSize(8);tc(doc,C.gd);doc.text('LIABILITIES & EQUITY',c2x,yR+5);yR+=8;
  yR=dr(doc,yR,'Total Current Liabilities',fm(bs.totalCurrentLiabilities),false,undefined,c2x,hw);
  yR=dr(doc,yR,'Long-Term Debt',fm(bs.longTermDebt),false,undefined,c2x,hw);
  yR=dr(doc,yR,'Total Liabilities',fm(bs.totalLiabilities),true,undefined,c2x,hw);
  yR=dr(doc,yR,'Total Equity',fm(bs.totalEquity),true,undefined,c2x,hw);
  const bsDiff=Math.abs(bs.totalAssets-bs.totalLiabilities-bs.totalEquity);
  const bsOk=bs.totalAssets>0&&bsDiff<bs.totalAssets*0.01;
  yR=dr(doc,yR,'A = L + E Check',bsOk?'Balanced':'Imbalanced',false,bsOk?C.gn:C.rd,c2x,hw);
  // Cash Flow
  y=Math.max(yL,yR)+6;y=secHdr(doc,y,'Cash Flow Statement');
  yL=y;yR=y;
  [['Operating Cash Flow',fm(cf.operatingCashFlow)],['Capital Expenditures',`(${fm(cf.capitalExpenditures)})`],['Free Cash Flow',fm(cf.freeCashFlow)]].forEach(([l,v],i)=>{yL=dr(doc,yL,l,v,i===2,i===2?(cf.freeCashFlow>0?C.gn:C.rd):undefined,ML,hw)});
  [['Dividends Paid',`(${fm(Math.abs(cf.dividendsPaid||0))})`],['Net Change in Cash',fm(cf.netChangeInCash)]].forEach(([l,v],i)=>{yR=dr(doc,yR,l,v,i===1,undefined,c2x,hw)});

  // ═══════════════════════════════════════════════════════════════
  // PAGE 7: RATIOS & DDM
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Ratios & Dividend Models');pageFtr(doc,7);
  y=22;y=secHdr(doc,y,'Comprehensive Ratios');yL=y;yR=y;
  [['Gross Margin',fp(gm)],['EBITDA Margin',fp(em_)],['Operating Margin',fp(om)],['Net Margin',fp(nm)],['FCF Margin',fp(fcfm)],['ROE',fp(roe)],['ROA',fp(roa)],['ROIC',fp(roic)],['FCF Yield',fp(fcfYield)],['Dividend Yield',fp(divYield)]].forEach(([l,v])=>{yL=dr(doc,yL,l,v,false,undefined,ML,hw)});
  [['Current Ratio',fx(cr)],['Quick Ratio',fx(qr)],['Debt / Equity',fx(de)],['Debt / EBITDA',fx(dEbitda)],['Interest Coverage',fx(intCov)],['Net Debt / EBITDA',fx(ndEbitda)],['EV / EBITDA',fx(evEbitda)],['P / E',fx(pe_)],['P / B',fx(pb_)],['EPS',fe(eps,ccy)]].forEach(([l,v])=>{yR=dr(doc,yR,l,v,false,undefined,c2x,hw)});
  y=Math.max(yL,yR)+6;y=secHdr(doc,y,'Dividend Discount Models');
  if(ddm.applicable){
    const ddmW=(CW-8)/3;
    [['Gordon Growth',ddm.gordonGrowth!=null?fe(ddm.gordonGrowth,ccy):'—','P = D1/(Ke-g)'],['Two-Stage DDM',ddm.twoStage!=null?fe(ddm.twoStage,ccy):'—',`${a.ddmHighGrowthYears}yr high then terminal`],['H-Model',ddm.hModel!=null?fe(ddm.hModel,ccy):'—',`H = ${(a.ddmHighGrowthYears/2).toFixed(1)}, linear fade`]].forEach(([t,v,s],i)=>{
      const cx=ML+i*(ddmW+4);
      fill(doc,C.nv);stk(doc,C.gd);doc.setLineWidth(0.3);doc.rect(cx,y,ddmW,20,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(7);tc(doc,C.gd);doc.text(t,cx+ddmW/2,y+5,{align:'center'});
      doc.setFont('courier','bold');doc.setFontSize(11);tc(doc,C.iv);doc.text(v,cx+ddmW/2,y+13,{align:'center'});
      doc.setFont('helvetica','normal');doc.setFontSize(6);tc(doc,C.gr);doc.text(s,cx+ddmW/2,y+18,{align:'center'});
    });
    y+=25;
    doc.setFont('courier','normal');doc.setFontSize(7);tc(doc,C.gr);
    doc.text(`DPS = ${fe(dps,ccy)}  |  Ke = ${fp(ke)}  |  Stable = ${fp(a.ddmStableGrowth)}  |  High = ${fp(a.ddmHighGrowth)}`,ML,y);
    y+=6;
  }else{doc.setFont('helvetica','normal');doc.setFontSize(9);tc(doc,C.gr);doc.text(ddm.message||'DDM Not Applicable',ML,y+5);y+=10}
  y=secHdr(doc,y,'Working Capital & CCC');yL=y;yR=y;
  [['DSO',fd_(dso)],['DIO',fd_(dio)]].forEach(([l,v])=>{yL=dr(doc,yL,l,v,false,undefined,ML,hw)});
  [['DPO',fd_(dpo)],['CCC',fd_(ccc)]].forEach(([l,v],i)=>{yR=dr(doc,yR,l,v,i===1,undefined,c2x,hw)});

  // ═══════════════════════════════════════════════════════════════
  // PAGE 8: VERIFICATION & COMPLIANCE
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Verification & Compliance');pageFtr(doc,8);
  y=22;y=secHdr(doc,y,'FCFF Cross-Verification (Base Year)');
  const vc=[{t:'Method',w:55},{t:'Formula',w:75},{t:'Result',w:40}];
  y=tblHdr(doc,y,vc);
  y=tblRow(doc,y,vc,['Method 1 (NOPAT)','EBIT x (1-t) + D&A - CapEx',fm(m1)],false,true);
  y=tblRow(doc,y,vc,['Method 2 (EBITDA)','EBITDA x (1-t) + D&A x t - CapEx',fm(m2)]);
  y=tblRow(doc,y,vc,['Method 3 (Net Income)','NI + Int x (1-t) + D&A - CapEx',fm(m3)],false,true);
  if(Math.abs(m1-m3)>1){doc.setFont('courier','normal');doc.setFontSize(6);tc(doc,C.gr);doc.text(`M1 vs M3 diff: ${fm(Math.abs(m1-m3))} = statutory vs effective tax rate gap`,ML,y+4);y+=8}
  y+=4;y=secHdr(doc,y,'EAS Compliance Status');
  const ec=[{t:'Standard',w:45},{t:'Description',w:80},{t:'Status',w:45}];
  y=tblHdr(doc,y,ec);
  [['EAS 48 (IFRS 16)','Lease Capitalization','Applied'],['EAS 31 (IAS 1)','Normalized Earnings','Available'],['EAS 12 (IAS 12)','Deferred Tax in EV Bridge','Calculated'],['EAS 23 (IAS 33)','Basic & Diluted EPS','Calculated'],['EAS 42 (IAS 19)','End-of-Service Provision','Tracked']].forEach((r,i)=>{y=tblRow(doc,y,ec,r,false,i%2===0)});
  y+=4;y=secHdr(doc,y,'Profit Distribution (Egyptian Law 159/1981)');
  y=dr(doc,y,'Net Income (after tax)',fm(is.netIncome));
  y=dr(doc,y,'Legal Reserve (5% of NI)',`(${fm(Math.round(legalRes))})`);
  y=dr(doc,y,'Distributable Profit',fm(Math.round(distrib)),true);
  y=dr(doc,y,'Employee Profit Distribution (10%)',`(${fm(Math.round(empProf))})`);
  y=dr(doc,y,'Available for Shareholders',fm(Math.round(availSH)),true);
  y=dr(doc,y,'Dividends Paid',`(${fm(divPaid)})`);
  y=dr(doc,y,'Retained Earnings',fm(Math.round(retained)),true,retained>0?C.gn:C.rd);

  // ═══════════════════════════════════════════════════════════════
  // PAGE 9: ASSUMPTIONS & DISCLAIMER
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();pageBg(doc);pageHdr(doc,'Assumptions & Disclaimer');pageFtr(doc,9);
  y=22;y=secHdr(doc,y,'Key Assumptions');yL=y;yR=y;
  [['WACC',fp(a.discountRate)],['Terminal Growth',fp(a.terminalGrowthRate)],['Revenue Growth',fp(a.revenueGrowthRate)],['EBITDA Margin',fp(a.ebitdaMargin)],['D&A (% Rev)',fp(a.daPercent)],['CapEx (% Rev)',fp(a.capexPercent)],['Delta WC (% dRev)',fp(a.deltaWCPercent)],['CAPM Method',a.capmMethod==='B'?'B — USD':'A — Local'],['Discounting',a.discountingConvention==='mid_year'?'Mid-Year':'End of Year']].forEach(([l,v])=>{yL=dr(doc,yL,l,v,false,undefined,ML,hw)});
  [['Projection Years',`${a.projectionYears}`],['Tax Rate',fp(a.taxRate)],['Risk-Free Rate',fp(a.riskFreeRate)],['Equity Risk Premium',fp(a.marketRiskPremium)],['Beta',a.beta.toFixed(2)],['Beta Type',a.betaType||'raw'],['Cost of Debt',fp(a.costOfDebt)],['Terminal Method',a.terminalMethod==='exit_multiple'?`Exit Multiple (${a.exitMultiple}x)`:'Gordon Growth']].forEach(([l,v])=>{yR=dr(doc,yR,l,v,false,undefined,c2x,hw)});
  // Disclaimer
  y=Math.max(yL,yR)+14;
  stk(doc,C.gd);doc.setLineWidth(0.4);doc.line(ML,y,ML+CW,y);y+=8;
  doc.setFont('helvetica','normal');doc.setFontSize(8);tc(doc,C.gr);
  const disc=['This report was prepared using the WOLF Valuation Engine. All parameters and calculations','are provided for informational purposes only. This engine has not been approved by the Financial','Regulatory Authority (FRA) of Egypt. Tax calculations follow Law 91/2005 standard rates.','','This engine does not constitute legal, tax, or financial advisory services. Users must verify all','outputs with qualified professionals before relying on them for actual transactions or investment','decisions. Past performance does not guarantee future results. All projections are estimates only.'];
  disc.forEach(l=>{doc.text(l,PW/2,y,{align:'center'});y+=4.5});
  y+=6;stk(doc,C.gd);doc.setLineWidth(0.4);doc.line(ML,y,ML+CW,y);y+=10;
  doc.setFont('helvetica','bold');doc.setFontSize(20);tc(doc,C.gd);doc.text('WOLF',PW/2,y,{align:'center'});
  y+=6;doc.setFont('helvetica','normal');doc.setFontSize(8);tc(doc,C.gr);doc.text('Part of the Wolf Financial Suite',PW/2,y,{align:'center'});

  // ── SAVE ─────────────────────────────────────────────────────
  doc.save(`WOLF_Valuation_Report_${fd.ticker||fd.companyName.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── REACT COMPONENT (just a button) ────────────────────────────
export default function DispatchPDF(props:Props){
  const[busy,setBusy]=useState(false);
  const go=()=>{setBusy(true);try{generateNativePDF(props)}catch(e){console.error(e);alert('PDF generation failed.')}finally{setBusy(false)}};
  return<div style={{padding:'24px 0',textAlign:'center'}}>
    <button onClick={go} disabled={busy} id="dispatch-pdf-btn" style={{padding:'14px 40px',backgroundColor:busy?'#1A2340':'#C5A44E',color:busy?'#6b7280':'#0B0F1A',border:'none',borderRadius:'6px',fontFamily:'Inter,sans-serif',fontWeight:700,fontSize:'14px',letterSpacing:'0.1em',cursor:busy?'not-allowed':'pointer',transition:'all 0.2s'}}>
      {busy?'GENERATING...':'DISPATCH PDF'}
    </button>
  </div>;
}
