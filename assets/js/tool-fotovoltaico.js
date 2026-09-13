/* ══════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════ */
const HSP=4.8, PR=0.82, CO2F=0.35, TARIFF_INC=0.08, DEG=0.005, DISC=0.15;
const COST_KWP={R:4200000,C:3800000,I:3400000};
const TARIFF_REF={1:380,2:500,3:720,4:800,5:940,6:970,C:850,I:730};

let curSeg='R', curMode='quick', projYears=25, projYearsL=25;
let loads=[], lastResult=null, chart=null;

/* ── PRESET LOADS ─────────────────────────────────── */
const PRESETS={
  R:[
    {cat:'Refrigeración', items:[
      {n:'Nevera/Refrigerador',w:150},{n:'Nevera grande (side-by-side)',w:250},
      {n:'Freezer',w:130},{n:'Mini nevera',w:80}
    ]},
    {cat:'Iluminación',items:[
      {n:'Bombillo LED 9W',w:9},{n:'Bombillo LED 15W',w:15},
      {n:'Tubo fluorescente 36W',w:36},{n:'Foco halógeno 50W',w:50}
    ]},
    {cat:'Entretenimiento',items:[
      {n:'TV LCD/LED 32"',w:60},{n:'TV LCD/LED 55"',w:100},
      {n:'Computador portátil',w:65},{n:'Computador escritorio',w:200},
      {n:'Consola de videojuegos',w:150},{n:'Router Wi-Fi',w:10}
    ]},
    {cat:'Electrodomésticos',items:[
      {n:'Lavadora',w:500},{n:'Lavadora (calentamiento)',w:2000},
      {n:'Plancha de ropa',w:1800},{n:'Microondas',w:1200},
      {n:'Ducha eléctrica',w:3500},{n:'Aspiradora',w:1000}
    ]},
    {cat:'Climatización',items:[
      {n:'Aire acondicionado 9000 BTU',w:900},{n:'Aire acondicionado 12000 BTU',w:1200},
      {n:'Aire acondicionado 18000 BTU',w:1800},{n:'Ventilador de techo',w:75},
      {n:'Ventilador de pie',w:60},{n:'Calefactor eléctrico',w:1500}
    ]},
    {cat:'Cocina',items:[
      {n:'Estufa eléctrica (por hornilla)',w:1500},{n:'Horno eléctrico',w:2000},
      {n:'Licuadora',w:300},{n:'Cafetera',w:900},{n:'Tostadora',w:1000}
    ]},
  ],
  C:[
    {cat:'Iluminación comercial',items:[
      {n:'Tubo LED T8 18W',w:18},{n:'Panel LED 36W',w:36},
      {n:'Reflector LED 100W',w:100},{n:'Luminaria de emergencia',w:20}
    ]},
    {cat:'Climatización',items:[
      {n:'AA comercial 24000 BTU',w:2400},{n:'AA comercial 36000 BTU',w:3600},
      {n:'Ventilador industrial',w:370},{n:'Cortina de aire',w:750}
    ]},
    {cat:'Equipos de oficina',items:[
      {n:'Computador + monitor',w:250},{n:'Impresora láser',w:400},
      {n:'Fotocopiadora',w:1200},{n:'UPS / No-Break',w:100},{n:'Proyector',w:300}
    ]},
    {cat:'Comercio / Taller',items:[
      {n:'Caja registradora',w:50},{n:'Taladro industrial',w:700},
      {n:'Esmeril angular',w:900},{n:'Soldador MIG',w:3000},
      {n:'Compresor de aire 1HP',w:750},{n:'Compresor de aire 3HP',w:2200}
    ]},
    {cat:'Refrigeración comercial',items:[
      {n:'Vitrina refrigerada 2m',w:400},{n:'Cuarto frío pequeño',w:1500},
      {n:'Congelador comercial',w:600},{n:'Nevera exhibidora',w:300}
    ]},
  ],
  I:[
    {cat:'Motores eléctricos',items:[
      {n:'Motor 0.5 HP',w:373},{n:'Motor 1 HP',w:746},{n:'Motor 2 HP',w:1492},
      {n:'Motor 5 HP',w:3730},{n:'Motor 10 HP',w:7460},{n:'Motor 25 HP',w:18650},
      {n:'Motor 50 HP',w:37300},{n:'Motor 100 HP',w:74600}
    ]},
    {cat:'Compresores',items:[
      {n:'Compresor de aire 5 HP',w:3730},{n:'Compresor de aire 10 HP',w:7460},
      {n:'Compresor de aire 25 HP',w:18650},{n:'Bomba centrífuga 3 HP',w:2238}
    ]},
    {cat:'Iluminación industrial',items:[
      {n:'LED industrial 100W (UFO)',w:100},{n:'LED industrial 150W',w:150},
      {n:'LED industrial 200W',w:200},{n:'Proyector exterior 300W',w:300}
    ]},
    {cat:'Equipos industriales',items:[
      {n:'Torno CNC',w:5000},{n:'Fresadora CNC',w:7500},
      {n:'Soldador industrial TIG',w:5000},{n:'Prensa hidráulica',w:3000},
      {n:'Extrusor plástico',w:15000},{n:'Inyectora de plástico',w:10000}
    ]},
    {cat:'Servicios generales',items:[
      {n:'Sistema de ventilación (moto-ventilador)',w:5000},
      {n:'Elevador/montacargas',w:7500},{n:'Puente grúa 2ton',w:10000},
      {n:'AA industrial 5ton',w:18000},{n:'Caldera eléctrica',w:30000}
    ]},
  ]
};

/* ── UI HELPERS ──────────────────────────────────── */
const $=id=>document.getElementById(id);
const V=(id,v)=>$(id).textContent=v;
const hideEl=(el)=>{ if(!el) return; el.classList.add('is-hidden'); el.style.display='none'; };
const showEl=(el)=>{ if(!el) return; el.classList.remove('is-hidden'); el.style.display=''; };
const showBlock=(el)=>{ if(!el) return; el.classList.remove('is-hidden'); el.style.display='block'; };
const showFlex=(el)=>{ if(!el) return; el.classList.remove('is-hidden'); el.style.display='flex'; };
const isHidden=(el)=>!el || el.classList.contains('is-hidden') || el.style.display==='none';

/* ── EJEMPLOS RÁPIDOS ───────────────────────────── */
// seg: 'R'|'C'|'I', bill/kwh en COP/kWh, estrato solo R,
// sched solo C ('diurno'|'mixto'|'nocturno'), roof solo R, btn: elemento clickeado
function applyQuickPreset(seg,bill,kwh,estrato,target,sched,roof,btn){
  const pfx=seg.toLowerCase();
  const setV=(id,v)=>{const el=$(id);if(el)el.value=v;};
  setV(pfx+'-bill',bill);
  // kWh: si es 0 limpiamos el campo para que el autosync calcule
  const kwhEl=$(pfx+'-kwh');
  if(kwhEl) kwhEl.value = kwh||'';
  if(estrato) setV('r-estrato',estrato);
  if(target){ setV(pfx+'-target',target); V(pfx+'-tv',target+'%'); }
  if(roof) setV('r-roof',roof);
  if(sched){
    setV('c-sched',sched);
    document.querySelectorAll('#qC .tgl').forEach(b=>{
      const oc=b.getAttribute('onclick')||'';
      b.classList.toggle('active',oc.includes("'"+sched+"'"));
    });
  }
  // resaltar botón activo
  document.querySelectorAll('[data-ej="'+seg+'"]').forEach(b=>b.classList.remove('ej-on'));
  if(btn) btn.classList.add('ej-on');
  // disparar autosync de kWh para Residencial
  if(seg==='R'&&$('r-bill')) $('r-bill').dispatchEvent(new Event('input'));
}

/* ── PERSONALIZAR PROPUESTA ─────────────────────── */
function togglePropuesta(){
  $('propuesta-wrap').classList.toggle('open');
}

function getClientData(){
  return {
    nombre: ($('p-nombre').value||'').trim(),
    tel:    ($('p-tel').value||'').trim(),
    dir:    ($('p-dir').value||'').trim(),
    email:  ($('p-email').value||'').trim()
  };
}

function updateClientPlaceholders(seg){
  const n=$('p-nombre'), d=$('p-dir');
  if(n) n.placeholder = seg==='R' ? 'Ej: María García' : 'Ej: Empresa XYZ S.A.S.';
  if(d) d.placeholder = seg==='R' ? 'Ej: Pereira, Cerritos'  : 'Ej: Zona Industrial, Dosquebradas';
}

function fillPrintHeader(r, opts){
  const cd = getClientData();
  const label = opts.label || (r.seg==='R'?'Residencial':r.seg==='C'?'Comercial':'Industrial');
  const set = (id,v)=>{ const el=$( id); if(el) el.textContent=v; };
  set('ph-tipo',    label+' · '+fmt(r.systemKwp,1)+' kWp · '+r.panels+' módulos');
  set('ph-nombre',  cd.nombre || 'Solicitante Web');
  set('ph-dir',     cd.dir    || '—');
  set('ph-contact', [cd.tel,cd.email].filter(Boolean).join(' · ') || '—');
  // print-date ya se rellena al cargar la página (IIFE al final del script)
}

function setSeg(s,btn){
  curSeg=s;
  document.querySelectorAll('.seg-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.q-seg').forEach(hideEl);
  showEl($('q'+s));
  hideEl($('results'));
  populatePresets();
  updateClientPlaceholders(s);
}

function setMode(m,btn){
  curMode=m;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  $('quick-wrap').classList.toggle('active', m==='quick');
  $('loads-wrap').classList.toggle('active', m==='loads');
  if(m==='loads') populatePresets();
}

function tgl(btn,hid,val){
  btn.closest('.toggle-grp').querySelectorAll('.tgl').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  $(hid).value=val;
}

function fmt(n,d=0){return new Intl.NumberFormat('es-CO',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n)}
function fmtCOP(n){
  if(n>=1e9) return '$'+fmt(n/1e9,1)+' MM';
  if(n>=1e6) return '$'+fmt(n/1e6,1)+' M';
  if(n>=1e3) return '$'+fmt(n/1e3,0)+' K';
  return '$'+fmt(n,0);
}

function checkSubsidy(){
  const e=parseInt($('r-estrato').value);
  $('subsidy-note').classList.toggle('show', e<=2 && !isHidden($('results')));
}
function checkFP(v){
  if(parseFloat(v)<0.90){
    const btns=$('i-fpp').closest('.toggle-grp').querySelectorAll('.tgl');
    btns[0].classList.add('active'); btns[1].classList.remove('active');
    $('i-fpp').value='si';
  }
}

/* Period selectors */
// ── Cambio 3: período unificado ──────────────────────
function _setPeriodCore(y,mode,btn){
  const isQ=mode==='q';
  if(isQ) projYears=y; else projYearsL=y;
  const rangeEl=$(isQ?'q-period-range':'l-period-range');
  const labelEl=$(isQ?'q-period-label':'l-period-label');
  const scopeSel=isQ?'#quick-wrap':'#loads-wrap';
  if(rangeEl) {
    rangeEl.value=y;
    updateRange(rangeEl);
  }
  if(labelEl) labelEl.textContent=y+' años';
  document.querySelectorAll(scopeSel+' .period-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function setPeriodQ(y,btn){ _setPeriodCore(y,'q',btn); }
function setPeriodL(y,btn){ _setPeriodCore(y,'l',btn); }
function setPeriodFromRange(v){ _setPeriodCore(parseInt(v),'q',null); }
function setPeriodFromRangeL(v){ _setPeriodCore(parseInt(v),'l',null); }

/* ── LOAD TRACKER ────────────────────────────────── */
function populatePresets(){
  const sel=$('load-preset');
  sel.innerHTML='<option value="">— Seleccionar de la lista —</option>';
  const data=PRESETS[curSeg]||PRESETS.R;
  data.forEach(cat=>{
    const og=document.createElement('optgroup');
    og.label=cat.cat;
    cat.items.forEach(item=>{
      const o=document.createElement('option');
      o.value=JSON.stringify(item);
      o.textContent=`${item.n} (${item.w} W)`;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
}

function applyPreset(){
  const v=$('load-preset').value;
  if(!v) return;
  const item=JSON.parse(v);
  $('load-w').value=item.w;
  // Set default hours by segment
  const defH={R:8,C:10,I:16};
  $('load-h').value=defH[curSeg]||8;
}

function toggleCustomLoad(){
  $('custom-load-form').classList.toggle('show');
}

function calcKwh(w,h,d,qty){
  return (w*h*(d/7)*30.44*qty)/1000;
}

function addLoad(){
  const preset=$('load-preset').value;
  const name=preset?JSON.parse(preset).n:'Carga personalizada';
  const w=parseFloat($('load-w').value);
  const h=parseFloat($('load-h').value);
  const d=parseFloat($('load-d').value)||7;
  const qty=parseInt($('load-qty').value)||1;
  if(!w||!h){alert('Ingresa la potencia y las horas de uso.');return;}
  loads.push({name,w,h,d,qty,kwh:calcKwh(w,h,d,qty)});
  $('load-preset').value=''; $('load-w').value=''; $('load-h').value=''; $('load-qty').value=1;
  renderLoads();
}

function addCustomLoad(){
  const name=$('cl-name').value.trim()||'Equipo personalizado';
  const w=parseFloat($('cl-w').value);
  const h=parseFloat($('cl-h').value);
  const d=parseFloat($('cl-d').value)||7;
  const qty=parseInt($('cl-qty').value)||1;
  if(!w||!h){alert('Ingresa la potencia y las horas de uso.');return;}
  loads.push({name,w,h,d,qty,kwh:calcKwh(w,h,d,qty)});
  $('cl-name').value=''; $('cl-w').value=''; $('cl-h').value=''; $('cl-qty').value=1;
  renderLoads();
}

function removeLoad(idx){
  loads.splice(idx,1);
  renderLoads();
}

function getActiveTariff(fallbackKey){
  const ct=parseFloat($('custom-tariff-l')&&$('custom-tariff-l').value)||parseFloat($('custom-tariff')&&$('custom-tariff').value)||0;
  return ct>100?ct:getTariffFromSelect(fallbackKey||$('l-estrato').value);
}

function renderLoads(){
  const total=loads.reduce((s,l)=>s+l.kwh,0);
  const tariff=getActiveTariff($('l-estrato').value);
  const cost=total*tariff;

  $('ls-total-kwh').textContent=fmt(total,1)+' kWh/mes';
  $('ls-total-cop').textContent=fmtCOP(cost)+'/mes';

  if(loads.length===0){
    showEl($('empty-loads'));
    hideEl($('loads-table'));
    return;
  }
  hideEl($('empty-loads'));
  showEl($('loads-table'));

  const tbody=$('loads-tbody');
  tbody.innerHTML='';
  loads.forEach((l,i)=>{
    const pct=total>0?l.kwh/total*100:0;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><strong>${l.name}</strong></td>
      <td>${l.w} W × ${l.qty}</td>
      <td>${l.h} h</td>
      <td>${l.d} días</td>
      <td>${l.qty}</td>
      <td><strong>${fmt(l.kwh,2)}</strong>
        <div class="kw-bar"><div class="kw-bar-fill" style="width:${Math.min(pct,100)}%"></div></div>
      </td>
      <td>${fmt(pct,1)}%</td>
      <td><button class="del-btn" onclick="removeLoad(${i})">🗑</button></td>`;
    tbody.appendChild(tr);
  });
  $('tfoot-kwh').textContent=fmt(total,2)+' kWh/mes';
  $('tfoot-cop').textContent=fmtCOP(cost)+'/mes';
}

function recalcLoads(){ renderLoads(); }

function getTariffFromSelect(v){
  if(!isNaN(v)) return TARIFF_REF[parseInt(v)];
  return TARIFF_REF[v]||TARIFF_REF[4];
}

/* ── CORE CALCULATOR (CREG 174 / Ley 1715) ───────── */
// selfRate: fracción autoconsumida (R=0.60, C/I=0.70 por defecto)
// Excedentes inyectados se reconocen al 75 % del CU (CREG 174 Art.7)
// Factor efectivo = selfRate × 1.0 + (1−selfRate) × 0.75 = 0.75 + 0.25×selfRate
function runCalc(bill,kwh,target,pr,costPerKwp,years,schedFactor=1,fpVal=1,fpPenalty=false,demand=0,selfRate=0.60,panelWp=450){
  const tariffRate=bill/kwh;
  const dailyProd=(kwh*target*schedFactor)/30;
  const systemKwp=Math.max(0.5,dailyProd/(HSP*pr));
  const annualProd=systemKwp*HSP*pr*365;
  const investment=systemKwp*costPerKwp;
  const panelKwp=panelWp/1000;
  const panels=Math.ceil(systemKwp/panelKwp);
  const creg174=0.75+0.25*selfRate; // factor ponderado de ahorro real

  // Year-by-year projection with CREG 174 correction
  let cumSave=0, npv=-investment, payback=null, data=[];
  for(let y=1;y<=years;y++){
    const prodY=annualProd*Math.pow(1-DEG,y-1);
    const tariffY=tariffRate*Math.pow(1+TARIFF_INC,y-1);
    const savY=prodY*tariffY*creg174;
    cumSave+=savY;
    npv+=savY/Math.pow(1+DISC,y);
    if(!payback&&cumSave>=investment) payback=y;
    data.push({y,save:savY,cum:cumSave});
  }
  const annSave1=data[0].save;
  const paybackSimple=investment/annSave1;
  const tir=calcTIR(investment,data.map(d=>d.save));

  // FP
  let fpSaving=0,capCost=0;
  if(fpVal<0.90){
    fpSaving=bill*12*(0.90-fpVal)*3.5;
    const kVAR=demand>0?demand*(Math.tan(Math.acos(fpVal))-Math.tan(Math.acos(0.97))):kwh/(30*8)*Math.tan(Math.acos(fpVal));
    capCost=Math.max(1800000,kVAR*85000);
  }

  // Eco
  const co2Year=annualProd*CO2F/1000;
  const co2Period=data.reduce((s,d)=>s+annualProd*Math.pow(1-DEG,d.y-1)*CO2F/1000,0);
  const trees=Math.round(co2Year*50);

  return {tariffRate,systemKwp,annualProd,investment,panels,panelWp,panelKwp,data,annSave1,paybackSimple,payback,tir,npv,fpSaving,capCost,co2Year,co2Period,trees,pr,selfRate,creg174};
}

function calcTIR(inv,cfs){
  let lo=0,hi=10,mid,npv;
  for(let i=0;i<60;i++){
    mid=(lo+hi)/2;
    npv=-inv+cfs.reduce((s,cf,y)=>s+cf/Math.pow(1+mid,y+1),0);
    if(npv>0)lo=mid;else hi=mid;
    if(Math.abs(npv)<1)break;
  }
  return mid*100;
}

/* ── QUICK CALCULATE ─────────────────────────────── */
function calculate(){
  let bill,kwh,target,pr,costPerKwp,schedFactor=1,fpVal=1,fpPenalty=false,demand=0,estrato=4;

  if(curSeg==='R'){
    bill=parseFloat($('r-bill').value);
    kwh=parseFloat($('r-kwh').value);
    target=parseInt($('r-target').value)/100;
    pr=PR*parseFloat($('r-roof').value);
    estrato=parseInt($('r-estrato').value);
    costPerKwp=COST_KWP.R;
    if(!kwh||isNaN(kwh)) kwh=bill/TARIFF_REF[estrato];
  } else if(curSeg==='C'){
    bill=parseFloat($('c-bill').value);
    kwh=parseFloat($('c-kwh').value);
    target=parseInt($('c-target').value)/100;
    pr=PR;
    schedFactor={diurno:.88,mixto:.65,nocturno:.35}[$('c-sched').value];
    costPerKwp=COST_KWP.C;
    if(!kwh||isNaN(kwh)) kwh=bill/TARIFF_REF.C;
  } else {
    bill=parseFloat($('i-bill').value);
    kwh=parseFloat($('i-kwh').value);
    target=parseInt($('i-target').value)/100;
    pr=PR;
    demand=parseFloat($('i-demand').value)||0;
    fpVal=parseFloat($('i-fp').value);
    fpPenalty=$('i-fpp').value==='si'||fpVal<0.90;
    costPerKwp=COST_KWP.I;
    if(!kwh||isNaN(kwh)) kwh=bill/TARIFF_REF.I;
  }

  if(!bill||isNaN(bill)||bill<=0){alert('Ingresa el valor de tu factura mensual.');return;}

  // Override tariff if user specified a custom one
  const customTariff=parseFloat($('custom-tariff').value)||0;
  if(customTariff>100) kwh=bill/customTariff;

  const selfRate=curSeg==='R'?0.60:0.70;
  const panelWp=curSeg==='R'?450:550;
  const r=runCalc(bill,kwh,target,pr,costPerKwp,projYears,schedFactor,fpVal,fpPenalty,demand,selfRate,panelWp);
  // ── API_HOOK: aquí se empaquetan todos los datos del cliente + resultado ──
  // Para enviar la propuesta por correo (ej. EmailJS), consumir getClientData()
  // junto con lastResult: emailjs.send('service_id','template_id',{...lastResult,...getClientData()})
  lastResult={...r,bill,kwh,estrato,seg:curSeg,fpVal,years:projYears,target,schedFactor,selfRate,clientData:getClientData()};

  // Load breakdown - hide in quick mode
  $('load-breakdown').classList.remove('show');

  showResults(r,{estrato,fpVal,fpPenalty:fpVal<0.90,years:projYears,label:curSeg==='R'?'Residencial':curSeg==='C'?'Comercial':'Industrial'});
}

/* ── LOADS CALCULATE ─────────────────────────────── */
function calculateLoads(){
  if(loads.length===0){alert('Agrega al menos una carga eléctrica para calcular.');return;}
  const total=loads.reduce((s,l)=>s+l.kwh,0);
  const estratoVal=$('l-estrato').value;
  const tariff=getActiveTariff(estratoVal);
  const bill=total*tariff;
  const target=parseInt($('l-target').value)/100;
  const pr=PR;
  const costPerKwp=isNaN(parseInt(estratoVal))?COST_KWP[estratoVal]||COST_KWP.C:COST_KWP.R;
  const label=isNaN(parseInt(estratoVal))?{C:'Comercial',I:'Industrial'}[estratoVal]:'Residencial';
  const estrato=isNaN(parseInt(estratoVal))?4:parseInt(estratoVal);

  const selfRate=isNaN(parseInt(estratoVal))?0.70:0.60;
  const panelWp=isNaN(parseInt(estratoVal))?550:450;
  const r=runCalc(bill,total,target,pr,costPerKwp,projYearsL,1,1,false,0,selfRate,panelWp);
  // ── API_HOOK: ídem que en calculate() — conectar EmailJS u otro servicio aquí
  lastResult={...r,bill,kwh:total,estrato,seg:isNaN(parseInt(estratoVal))?estratoVal:'R',fpVal:1,years:projYearsL,target,schedFactor:1,selfRate,clientData:getClientData()};

  // Show load breakdown
  const lb=$('load-breakdown');
  lb.classList.add('show');
  const grid=$('lb-grid');
  grid.innerHTML='';
  const totalKwh=loads.reduce((s,l)=>s+l.kwh,0);
  loads.forEach(l=>{
    const pct=totalKwh>0?l.kwh/totalKwh*100:0;
    const div=document.createElement('div');
    div.className='lb-item';
    div.innerHTML=`<div class="lb-name">${l.name} ×${l.qty}</div>
      <div class="lb-kwh">${fmt(l.kwh,2)} kWh/mes</div>
      <div class="lb-pct">${fmt(pct,1)} % del total · ${l.w*l.qty}W × ${l.h}h/día</div>`;
    grid.appendChild(div);
  });

  showResults(r,{estrato,fpVal:1,fpPenalty:false,years:projYearsL,label:'Cargas – '+label});
}

/* ── SHOW RESULTS ────────────────────────────────── */
function showResults(r,{estrato,fpVal,fpPenalty,years,label}){
  const res=$('results');
  showBlock(res);
  res.scrollIntoView({behavior:'smooth',block:'start'});

  $('res-title').textContent=`Resultados · ${label}`;
  $('res-tag').textContent=label;

  $('k-sm').textContent=fmtCOP(r.annSave1/12);
  $('k-sy').textContent=fmtCOP(r.annSave1);
  $('k-sys').textContent=fmt(r.systemKwp,1)+' kWp';
  $('k-inv').textContent=fmtCOP(r.investment);
  $('k-pb').textContent= r.paybackSimple<1?'< 1 año':fmt(r.paybackSimple,1)+' años';
  $('k-tot').textContent=fmtCOP(r.data[r.data.length-1].cum);

  $('d-pr').textContent=fmt(r.pr*100,0)+' %';
  $('d-panels').textContent=r.panels+' paneles ('+r.panelWp+' Wp)';
  renderPanelViz(r.panels,r.panelWp);
  $('d-prod').textContent=fmt(r.annualProd,0)+' kWh/año';

  // Desglose de cálculos
  const desgEl=$('calc-desglose');
  if(desgEl){
    showBlock(desgEl);
    fillDesglose(r,lastResult);
  }
  $('d-tariff').textContent='$'+fmt(r.tariffRate,0)+'/kWh';
  $('d-pct').textContent=fmt(lastResult.kwh>0?r.annualProd/lastResult.kwh/12*100:0,0)+' %';
  $('d-tir').textContent=fmt(r.tir,0)+' %';
  $('d-van').textContent=fmtCOP(r.npv);

  // Subsidy note
  $('subsidy-note').classList.toggle('show', estrato<=2);

  // FP
  const hasFP=fpVal<0.90||r.fpSaving>0;
  $('fp-alert').classList.toggle('show', hasFP);
  if(hasFP){
    $('fp-alert-text').textContent=`Tu FP actual es ${fpVal.toFixed(2)}, por debajo del límite CREG (0.90). Se estima un ahorro adicional de ${fmtCOP(r.fpSaving)}/año mediante un banco de capacitores automático (inversión estimada: ${fmtCOP(r.capCost)}).`;
    showFlex($('fp-row'));
    showFlex($('cap-row'));
    $('d-fpsav').textContent=fmtCOP(r.fpSaving)+'/año';
    $('d-cap').textContent=fmtCOP(r.capCost);
  } else {
    hideEl($('fp-row'));
    hideEl($('cap-row'));
  }

  // Eco
  $('e-co2').textContent=fmt(r.co2Year,1)+' ton';
  $('e-trees').textContent=fmt(r.trees,0)+' 🌳';
  $('e-kwh').textContent=fmt(r.annualProd,0)+' kWh';
  $('e-co2t').textContent=fmt(r.co2Period,1)+' ton';

  // Period control sync
  $('res-period').value=years;
  updateRange($('res-period'));
  $('res-period-label').textContent=years+' años';
  document.querySelectorAll('.period-control .pb').forEach(b=>{
    b.classList.toggle('act', parseInt(b.textContent)===years);
  });

  // Comparación antes/después
  const scEl=$('savings-compare');
  const pbEl=$('payback-bar-wrap');
  if(scEl){
    showEl(scEl);
    const bill=lastResult.bill;
    const monthlySave=r.annSave1/12;
    const afterBill=Math.max(0,bill-monthlySave);
    const pctSaved=bill>0?Math.min(100,Math.round(monthlySave/bill*100)):0;
    $('sc-before').textContent=fmtCOP(bill);
    $('sc-after').textContent=fmtCOP(afterBill);
    $('sc-pct').textContent=pctSaved+'%';
  }
  if(pbEl){
    showEl(pbEl);
    const pbYrs=r.paybackSimple;
    const pct=Math.min(pbYrs/years*100,100);
    $('pb-fill').style.width='0%';
    setTimeout(()=>{ $('pb-fill').style.width=pct.toFixed(1)+'%'; },120);
    $('pb-years-txt').textContent=pbYrs<1?'¡Menos de 1 año!':fmt(pbYrs,1)+' años de recuperación';
    $('pb-mid-label').textContent='Equilibrio: año '+fmt(pbYrs,1);
    $('pb-end-label').textContent=years+' años';
  }

  renderChart(r.data, r.investment);
  updateEcoImpact(r.annualProd);
  fillPrintHeader(r, opts||{});
}

/* ── RESULT PERIOD CONTROL ─────────────────────── */
function setResYears(y,btn){
  document.querySelectorAll('.period-control .pb').forEach(b=>b.classList.remove('act'));
  btn.classList.add('act');
  $('res-period').value=y;
  updateRange($('res-period'));
  $('res-period-label').textContent=y+' años';
  rerunWithYears(y);
}
function setResYearsRange(v){
  $('res-period-label').textContent=v+' años';
  updateRange($('res-period'));
  document.querySelectorAll('.period-control .pb').forEach(b=>b.classList.remove('act'));
  rerunWithYears(parseInt(v));
}
function rerunWithYears(y){
  if(!lastResult)return;
  const {bill,kwh,investment,tariffRate,systemKwp,annualProd,panels,pr:prVal,fpVal,estrato,seg,selfRate:sr}=lastResult;
  const creg174=0.75+0.25*(sr||0.60);
  const years=y;
  let cumSave=0,npv=-investment,data=[];
  for(let yr=1;yr<=years;yr++){
    const prodY=annualProd*Math.pow(1-DEG,yr-1);
    const tariffY=tariffRate*Math.pow(1+TARIFF_INC,yr-1);
    const savY=prodY*tariffY*creg174;
    cumSave+=savY;
    npv+=savY/Math.pow(1+DISC,yr);
    data.push({y:yr,save:savY,cum:cumSave});
  }
  const tir=calcTIR(investment,data.map(d=>d.save));
  const co2Period=data.reduce((s,d)=>s+annualProd*Math.pow(1-DEG,d.y-1)*CO2F/1000,0);

  $('k-tot').textContent=fmtCOP(data[data.length-1].cum);
  $('d-tir').textContent=fmt(tir,0)+' %';
  $('d-van').textContent=fmtCOP(npv);
  $('e-co2t').textContent=fmt(co2Period,1)+' ton';
  renderChart(data,investment);
}

/* ── CHART ───────────────────────────────────────── */
function renderChart(data,investment){
  const labels=data.map(d=>'Año '+d.y);
  const savY=data.map(d=>Math.round(d.save/1000));
  const cumY=data.map(d=>Math.round(d.cum/1000));
  const invL=data.map(()=>Math.round(investment/1000));

  if(chart)chart.destroy();
  chart=new Chart($('savingsChart').getContext('2d'),{
    type:'bar',
    data:{
      labels,
      datasets:[
        // Eje Y izquierdo — magnitudes anuales
        {label:'Ahorro anual (COP miles)',data:savY,backgroundColor:'rgba(46,134,171,.75)',borderRadius:4,yAxisID:'y',order:2},
        {label:'Inversión',data:invL,type:'line',borderColor:'#E74C3C',borderDash:[6,4],pointRadius:0,borderWidth:1.8,yAxisID:'y',order:0,fill:false},
        // Eje Y derecho — acumulado (escala independiente)
        {label:'Ahorro acumulado',data:cumY,type:'line',borderColor:'#27AE60',backgroundColor:'rgba(39,174,96,.07)',pointRadius:2,pointHoverRadius:5,borderWidth:2.5,fill:true,yAxisID:'y2',order:1,tension:.35},
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'top',labels:{font:{size:11},padding:10,usePointStyle:true}},
        tooltip:{callbacks:{label:ctx=>{
          const v=ctx.parsed.y;
          const tag=ctx.dataset.yAxisID==='y2'?' (acum.)':'';
          return ` ${ctx.dataset.label}${tag}: $${new Intl.NumberFormat('es-CO').format(v)} K`;
        }}}
      },
      scales:{
        x:{ticks:{font:{size:9},maxRotation:45},grid:{display:false}},
        y:{
          type:'linear',position:'left',
          title:{display:true,text:'Anual / Inversión (COP miles)',font:{size:9},color:'#7F8C8D'},
          ticks:{font:{size:10},callback:v=>'$'+(v>=1000?(v/1000).toFixed(1)+'M':v+'K')},
          grid:{color:'rgba(0,0,0,.05)'}
        },
        y2:{
          type:'linear',position:'right',
          title:{display:true,text:'Acumulado (COP miles)',font:{size:9},color:'#27AE60'},
          ticks:{font:{size:10},color:'#27AE60',callback:v=>'$'+(v>=1000?(v/1000).toFixed(1)+'M':v+'K')},
          grid:{drawOnChartArea:false}
        }
      }
    }
  });
}

/* ── INIT ────────────────────────────────────────── */
populatePresets();

/* ── RANGE SLIDER GRADIENT ───────────────────────── */
function updateRange(el){
  const min=parseFloat(el.min)||0, max=parseFloat(el.max)||100;
  const pct=((parseFloat(el.value)-min)/(max-min)*100).toFixed(1)+'%';
  el.style.setProperty('--fill',pct);
}
function initRanges(){
  document.querySelectorAll('input[type=range]').forEach(r=>{
    updateRange(r);
    r.addEventListener('input',()=>updateRange(r));
  });
}
initRanges();

// ── Cambio 2: Auto-sync kWh residencial ──────────────
(function(){
  function syncKwh(){
    const bill=parseFloat($('r-bill').value)||0;
    const kwhEl=$('r-kwh');
    if(bill>0&&(!kwhEl.value||kwhEl.value==='0')){
      const estrato=parseInt($('r-estrato').value)||4;
      kwhEl.value=Math.round(bill/(TARIFF_REF[estrato]||800));
    }
  }
  const rBill=$('r-bill'), rEstrato=$('r-estrato');
  if(rBill) rBill.addEventListener('input',syncKwh);
  if(rEstrato) rEstrato.addEventListener('change',syncKwh);
})();

// ── Cambio 4: Tooltips accesibles en móviles ────────
(function(){
  const pop=document.createElement('div');
  pop.className='tip-popover';
  document.body.appendChild(pop);
  let hideT;
  function showTip(el,e){
    clearTimeout(hideT);
    const text=el.getAttribute('title')||el.dataset.tip||'';
    if(!text) return;
    pop.textContent=text;
    pop.classList.add('tip-show');
    // Posición bajo el ícono
    const r=el.getBoundingClientRect();
    const top=r.bottom+8;
    const left=Math.max(8,Math.min(r.left,window.innerWidth-316));
    pop.style.cssText='top:'+(top+window.scrollY)+'px;left:'+left+'px';
    hideT=setTimeout(()=>pop.classList.remove('tip-show'),3800);
  }
  document.addEventListener('click',e=>{
    const tip=e.target.closest('.info-tip');
    if(tip){e.stopPropagation();showTip(tip,e);}
    else pop.classList.remove('tip-show');
  });
})();

// ── Imprimir: rellenar header con fecha y datos del cliente justo antes de imprimir ──
(function(){
  const setDate=()=>{const el=$('print-date');if(el){const d=new Date();el.textContent='Informe generado: '+d.toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});}};
  setDate();
  window.addEventListener('beforeprint',function(){
    setDate(); // fecha siempre actualizada
    if(lastResult){
      const seg=lastResult.seg||'R';
      const label=seg==='R'?'Residencial':seg==='C'?'Comercial':'Industrial';
      fillPrintHeader(lastResult,{label});
    }
  });
})();

function toggleDesglose(btn){
  const body=$('desglose-body');
  const open=!isHidden(body);
  open ? hideEl(body) : showBlock(body);
  const arr=btn.querySelector('.desglose-arrow');
  if(arr)arr.style.transform=open?'':'rotate(180deg)';
}

function fillDesglose(r,lr){
  const bill=lr.bill, kwh=lr.kwh, target=lr.target||0.7, sf=lr.schedFactor||1;
  const dailyProd=(kwh*target*sf)/30;

  // Entrada
  set('df-bill','Ingresado por el usuario');
  set('dv-bill',fmtCOP(bill)+'/mes');
  set('df-kwh','Ingresado / estimado de factura');
  set('dv-kwh',fmt(kwh,0)+' kWh/mes');
  set('df-tariff',fmtCOP(bill)+' ÷ '+fmt(kwh,0)+' kWh');
  set('dv-tariff','$'+fmt(r.tariffRate,0)+'/kWh');
  set('df-target','Slider de objetivo');
  set('dv-target',fmt(target*100,0)+'%');

  // Dimensionamiento
  set('df-daily',fmt(kwh,0)+' × '+fmt(target*100,0)+'% / 30 días'+(sf<1?' × '+fmt(sf,2)+' (sched)':''));
  set('dv-daily',fmt(dailyProd,2)+' kWh/día');
  set('df-kwp',fmt(dailyProd,2)+' / (4.8 × '+fmt(r.pr,2)+')');
  set('dv-kwp',fmt(r.systemKwp,2)+' kWp');
  const pWp=r.panelWp||450;
  set('df-panels','⌈'+fmt(r.systemKwp,2)+' / '+fmt(pWp/1000,3)+'⌉');
  set('dv-panels2',r.panels+' módulos ('+pWp+' Wp)');
  const desNPanels=document.getElementById('des-n-panels');
  if(desNPanels) desNPanels.textContent='Módulos '+pWp+' Wp';
  set('df-pr','Techo + cableado + inversor');
  set('dv-pr2',fmt(r.pr*100,0)+'%');

  // Producción
  set('df-prod',fmt(r.systemKwp,2)+' × 4.8 × '+fmt(r.pr,2)+' × 365');
  set('dv-prod2',fmt(r.annualProd,0)+' kWh/año');

  // CREG 174
  const sr=r.selfRate||lr.selfRate||0.60;
  const cf=r.creg174||(0.75+0.25*sr);
  set('dv-selfrate',fmt(sr*100,0)+'% autoconsumido · '+fmt((1-sr)*100,0)+'% inyectado a la red');
  set('df-creg','0.75 + 0.25 × '+fmt(sr*100,0)+'%');
  set('dv-creg174',fmt(cf*100,1)+'% del valor del CU');

  // Economía
  set('df-save',fmt(r.annualProd,0)+' × $'+fmt(r.tariffRate,0)+' × '+fmt(cf,3));
  set('dv-save',fmtCOP(r.annSave1)+'/año');
  set('df-inv',fmt(r.systemKwp,2)+' kWp × $/kWp instalado');
  set('dv-inv2',fmtCOP(r.investment));
  set('df-pb',fmtCOP(r.investment)+' ÷ '+fmtCOP(r.annSave1));
  set('dv-pb2',fmt(r.paybackSimple,1)+' años');
  set('df-van','Σ años 1–'+lr.years+' de [Ahorro_y / 1.15^y] − inversión');
  set('dv-van2',fmtCOP(r.npv));
  set('dv-tir2',fmt(r.tir,0)+'%');

  // Eco
  set('df-co2',fmt(r.annualProd,0)+' × 0.35 / 1000');
  set('dv-co22',fmt(r.co2Year,2)+' ton CO₂/año');
  set('df-trees',fmt(r.co2Year,2)+' ton × 50 árboles/ton');
  set('dv-trees2',r.trees+' árboles equiv./año');

  function set(id,txt){const el=$(id);if(el)el.textContent=txt;}
}

function setTariff(val,btn){
  [$('custom-tariff'),$('custom-tariff-l')].forEach(el=>{if(el)el.value=val;});
  document.querySelectorAll('.tp-btn').forEach(b=>b.classList.remove('tp-on'));
  if(btn)btn.classList.add('tp-on');
}
function onTariffChange(el){
  document.querySelectorAll('.tp-btn').forEach(b=>b.classList.remove('tp-on'));
}

function renderPanelViz(n,panelWp=450){
  const wrap=$('panel-viz-wrap');
  if(!wrap||n<1)return;
  showBlock(wrap);
  const PW=26,PH=18,PG=5;
  const shown=Math.min(n,24);
  const cols=shown<=4?shown:shown<=8?4:shown<=12?4:shown<=16?4:8;
  const rows=Math.ceil(shown/cols);
  const arrW=cols*(PW+PG)-PG;
  const arrH=rows*(PH+PG)-PG;
  const topPad=10, botPad=28;
  const streamCy=topPad+arrH/2;
  const sx=arrW+8, ex=arrW+72;
  const svgW=ex+48, svgH=arrH+topPad+botPad;

  let panels='';
  for(let i=0;i<shown;i++){
    const col=i%cols, row=Math.floor(i/cols);
    const px=col*(PW+PG), py=row*(PH+PG)+topPad;
    const delay=(i*0.045).toFixed(2);
    panels+=`<g class="pviz-panel" style="animation:pviz-appear .38s ${delay}s both">
      <rect x="${px}" y="${py}" width="${PW}" height="${PH}" rx="2" fill="#1a3a5c" stroke="#2E86AB" stroke-width="1.1"/>
      <line x1="${px}" y1="${py+PH/3}" x2="${px+PW}" y2="${py+PH/3}" stroke="rgba(46,134,171,.4)" stroke-width=".65"/>
      <line x1="${px}" y1="${py+PH*2/3}" x2="${px+PW}" y2="${py+PH*2/3}" stroke="rgba(46,134,171,.4)" stroke-width=".65"/>
      <line x1="${px+PW/3}" y1="${py}" x2="${px+PW/3}" y2="${py+PH}" stroke="rgba(46,134,171,.4)" stroke-width=".65"/>
      <line x1="${px+PW*2/3}" y1="${py}" x2="${px+PW*2/3}" y2="${py+PH}" stroke="rgba(46,134,171,.4)" stroke-width=".65"/>
    </g>`;
  }

  const extra=n>24?`<text x="${arrW/2}" y="${svgH-3}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.4)" font-family="sans-serif">+${n-24} módulos más no mostrados</text>`:'';

  const dots=[0,0.47,0.94].map(d=>`<circle cy="${streamCy}" r="3.5" fill="#FFD23C" filter="url(#pvg)">
    <animate attributeName="cx" from="${sx}" to="${ex}" dur="1.4s" begin="${d}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="1.4s" begin="${d}s" repeatCount="indefinite"/>
  </circle>`).join('');

  wrap.innerHTML=`
    <div class="pviz-header">
      <span class="pviz-count">${n}</span>
      <span class="pviz-txt">módulos solares · ${panelWp} Wp c/u · sistema de ${(n*panelWp/1000).toFixed(2)} kWp</span>
    </div>
    <svg class="pviz-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="pvg"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${panels}${extra}
      <line x1="${sx}" y1="${streamCy}" x2="${ex}" y2="${streamCy}" stroke="rgba(255,210,60,.3)" stroke-width="2" stroke-dasharray="4 3"/>
      ${dots}
      <rect x="${ex+2}" y="${streamCy-10}" width="42" height="20" rx="5" fill="rgba(31,78,121,.7)" stroke="rgba(46,134,171,.5)" stroke-width="1"/>
      <text x="${ex+23}" y="${streamCy+4}" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,.75)" font-family="sans-serif">Inversor</text>
    </svg>`;
}

/* ── IMPACTO AMBIENTAL ───────────────────────────── */
function updateEcoImpact(annualKwh){
  const co2Kg = annualKwh * CO2F;        // kg CO2 evitados/año  (CO2F=0.35)
  const trees  = Math.round(co2Kg / 20); // 1 árbol ≈ 20 kg CO2/año
  const km     = Math.round(co2Kg / 0.15); // 0.15 kg CO2/km vehículo gasolina

  const pending = document.getElementById('eco-pending');
  const grid    = document.getElementById('eco-impact-grid');
  hideEl(pending);
  if(grid)    grid.classList.add('visible');

  animateCounter('eco-co2',   co2Kg, 0);
  animateCounter('eco-trees', trees,  0);
  animateCounter('eco-km',    km,     0);
}

function animateCounter(id, target, decimals){
  const el = document.getElementById(id);
  if(!el) return;
  const duration = 1400;
  const startVal = parseFloat(el.textContent.replace(/[^0-9.]/g,'')) || 0;
  const startTime = performance.now();
  function tick(now){
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const val = startVal + (target - startVal) * eased;
    el.textContent = new Intl.NumberFormat('es-CO',{
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
    if(t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

(function(){
  if(!window.matchMedia('(pointer:fine)').matches)return;
  const cur=document.getElementById('sol-cursor');
  if(!cur)return;
  let tx=0,ty=0,cx=0,cy=0,pvx=0,pvy=0,lx=0,ly=0;
  function loop(){
    pvx=tx-lx; pvy=ty-ly; lx=tx; ly=ty;
    const spd=Math.sqrt(pvx*pvx+pvy*pvy);
    const tilt=Math.max(-18,Math.min(18,pvx*0.6));
    const lift=Math.max(-10,Math.min(10,-pvy*0.4));
    cx+=(tx-cx)*0.22; cy+=(ty-cy)*0.22;
    cur.style.transform=`translate(${cx}px,${cy}px) rotate(${tilt}deg) translateY(${lift*0.3}px) scale(${1+spd*0.004})`;
    requestAnimationFrame(loop);
  }
  document.addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;cur.classList.add('sol-on')});
  document.addEventListener('mouseleave',()=>cur.classList.remove('sol-on'));
  document.addEventListener('mouseenter',()=>cur.classList.add('sol-on'));
  document.addEventListener('mousedown',()=>cur.classList.add('sol-click'));
  document.addEventListener('mouseup',()=>cur.classList.remove('sol-click'));
  requestAnimationFrame(loop);
})();
