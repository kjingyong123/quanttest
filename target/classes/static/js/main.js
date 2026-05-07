//Global variable

let S={
  apiKey:'',ticker:'',data:null,interval:'1day',prevScreen:null,
  sel:['ma_cross'],combo:'AND',dir:'long',
  sl:5,tp:10,trail:false,trailPct:3,
  capital:100000,comm:0.1,
  params:{},results:null,cmpRes:null,
  activeTab:'equity',sbOpen:true
};

/* ══ INDICATORS ══ */
const smArr=(d,n)=>d.map((_,i)=>i<n-1?null:d.slice(i-n+1,i+1).reduce((s,x)=>s+x.close,0)/n);
//////////////////////////
function init(){
  // Quick picks
  const qp=document.getElementById('qpicks');
  POP.forEach(sym=>{const b=document.createElement('button');b.className='qp';b.textContent=sym;b.onclick=()=>{document.getElementById('tickIn').value=sym;qp.querySelectorAll('.qp').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');doFetch(false);};qp.appendChild(b);});
  // Strategy checkboxes
  const sl=document.getElementById('stratList');
  Object.entries(STRATS).forEach(([k,s])=>{
    S.params[k]={};s.p.forEach(p=>S.params[k][p.k]=p.def);
    const lbl=document.createElement('label');
    lbl.className='sc-row'+(S.sel.includes(k)?' on':'');lbl.style.setProperty('--c',s.c);
    lbl.innerHTML=`<input type="checkbox" ${S.sel.includes(k)?'checked':''}/><span class="sn"><span style="color:${s.c}">◆</span> ${s.lbl}</span>`;
    lbl.querySelector('input').onchange=e=>{
      if(e.target.checked){if(!S.sel.includes(k))S.sel.push(k);}else{S.sel=S.sel.filter(x=>x!==k);}
      lbl.classList.toggle('on',e.target.checked);renderAcc();if(S.data)showSigChart();
    };
    sl.appendChild(lbl);
  });
  renderAcc();
  document.getElementById('capIn').oninput=e=>S.capital=+e.target.value;
  document.getElementById('commIn').oninput=e=>S.comm=+e.target.value;
  document.getElementById('slIn').oninput=e=>{S.sl=+e.target.value;updateRRDisplay();};
  document.getElementById('tpIn').oninput=e=>{S.tp=+e.target.value;updateRRDisplay();};
  document.getElementById('trailIn').oninput=e=>S.trailPct=+e.target.value;
  document.getElementById('useTrail').onchange=e=>{S.trail=e.target.checked;document.getElementById('trailRow').style.display=e.target.checked?'block':'none';};
  document.getElementById('bSP500').onclick=showSP500;
  document.getElementById('bRRG').onclick=showRRG;
  document.getElementById('bTC').onclick=showTradeCenter;
  document.getElementById('bBrief').onclick=showBrief;
  document.getElementById('bRun').onclick=doRun;
  document.getElementById('bCmp').onclick=doCmp;
  document.getElementById('bSig').onclick=showSigChart;
  document.getElementById('bTrend').onclick=showTrend;
  document.getElementById('bTips').onclick=showTips;
  document.getElementById('togSB').onclick=()=>{S.sbOpen=!S.sbOpen;document.getElementById('sb').style.display=S.sbOpen?'':'none';document.getElementById('togSB').textContent=S.sbOpen?'◀':'▶';};
  document.getElementById('tickIn').oninput=e=>e.target.value=e.target.value.toUpperCase();
  // Event delegation for interval switcher buttons (data-swiv attribute)
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-swiv]');
    if (btn) { e.preventDefault(); switchTrendInterval(btn.getAttribute('data-swiv')); }
  });
  updateRRDisplay(); // set initial R:R highlight
  // Show nav buttons always (screens handle no-data state themselves)
  const hbInit=document.getElementById('hbtns');hbInit.style.display='flex';hbInit.style.gap='6px';
  updateNav();
  document.getElementById('tickIn').onkeydown=e=>{if(e.key==='Enter')doFetch(false);};
  document.getElementById('apiIn').onkeydown=e=>{if(e.key==='Enter')doFetch(false);};
  showEmpty();
}

/* ══ FETCH ══ */
async function doFetch(forceRefresh=false){
  const sym=document.getElementById('tickIn').value.trim().toUpperCase();
  const key=S.apiKey||document.getElementById('apiIn').value.trim();
  const iv=S.interval||'1day';
  const ck=sym+':'+iv;  // composite cache key
  const ivLabel=IVL_LABELS[iv]||iv;
  const err=document.getElementById('ferr');
  if(!sym){err.textContent='Enter a ticker symbol.';err.style.display='block';return;}
  if(!key){err.textContent='Enter API key first.';err.style.display='block';return;}
  err.style.display='none';

  // ── Use cache if available and not forcing refresh ──
  if(!forceRefresh && CACHE[ck]){
    loadFromCache(sym,iv);
    const btn=document.getElementById('bFetch');
    const orig=btn.innerHTML;btn.innerHTML='✓ cached';btn.style.background='#00e5a055';
    setTimeout(()=>{btn.innerHTML=orig;btn.style.background='#7c6aff';},1400);
    return;
  }

  const btn=document.getElementById('bFetch');
  const rBtn=document.getElementById('bRefresh');
  btn.innerHTML='<span class="spin">↻</span>';btn.disabled=true;
  rBtn.disabled=true;
  const ivShort={'1day':'D','1week':'W','1month':'M'}[iv]||iv;
  M().innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:75vh">
    <div class="spin" style="font-size:36px;color:#7c6aff;margin-bottom:13px">↻</div>
    <div style="color:var(--muted);letter-spacing:2px">FETCHING ${sym} (${ivLabel}) FROM API...</div>
    <div style="color:var(--muted);font-size:var(--fs-xs);margin-top:8px">${CACHE[ck]?'Refreshing existing cache entry':'New API request'} · ${Object.keys(CACHE).length} dataset(s) cached</div>
  </div>`;
  try{
    // Twelve Data interval param: 1day, 1week, 1month
    const outputsize=iv==='1month'?120:500;
    const res=await fetch(`https://api.twelvedata.com/time_series?symbol=${sym}&interval=${iv}&outputsize=${outputsize}&apikey=${key}&format=JSON`);
    const json=await res.json();
    if(json.status==='error'||!json.values)throw new Error(json.message||'Failed. Check symbol or key.');
    const data=json.values.reverse().map(v=>({date:v.datetime,open:+v.open,high:+v.high,low:+v.low,close:+v.close,volume:+(v.volume||0)}));
    // Store with composite key
    CACHE[ck]={data,fetchedAt:Date.now(),bars:data.length,interval:iv};
    S.data=data;S.ticker=sym;S.interval=iv;S.apiKey=key;S.results=null;S.cmpRes=null;
    document.getElementById('apiSec').style.display='none';document.getElementById('apiSet').style.display='block';
    document.getElementById('tbadge').textContent=`${sym} · ${data.length}b · ${ivShort}`;document.getElementById('tbadge').style.display='';
    const hb=document.getElementById('hbtns');hb.style.display='flex';hb.style.gap='6px';
    document.getElementById('qpicks').querySelectorAll('.qp').forEach(b=>b.classList.toggle('sel',b.textContent===sym));
    renderCachePanel();
    showBrief();
  }catch(e){err.textContent=e.message;err.style.display='block';showEmpty();}
  btn.innerHTML='→';btn.disabled=false;rBtn.disabled=false;
}


function showTrend(){
  S.currentScreen='trend';updateNav();
  if(!S.data){M().innerHTML=noDataPicker('📈 TREND ANALYSIS','#ffd166','Select a ticker to view trend analysis');return;}
  const data=S.data,t=getTrend(data);
  const tCol=t.trend==='BULLISH'?'#00e5a0':t.trend==='BEARISH'?'#ff4466':'#ffd166';
  const maColors={20:'#ffd166',50:'#00e5a0',100:'#38bdf8',200:'#ff4466'};
  const step=Math.max(1,Math.floor(data.length/300));
  const tD=data.filter((_,i)=>i%step===0||i===data.length-1);
  const w=CW();

  M().innerHTML=`<div class="fade">
    ${_exportBar('trend','📈 TREND ANALYSIS',S.ticker?(S.ticker+' · '+({'1day':'Daily','1week':'Weekly','1month':'Monthly'}[S.interval]||S.interval)):'')}
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:11px;flex-wrap:wrap">
      <span style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:${tCol};letter-spacing:2px">TREND · ${S.ticker}</span>
      <span class="tp ${t.trend==='BULLISH'?'bull':t.trend==='BEARISH'?'bear':'neu'}" style="font-size:13px">${t.trend}</span>
      <span style="color:var(--muted);font-size:var(--fs-sm)">Score ${t.score}/100 · ${t.bull}↑ ${t.bear}↓ · <strong style='color:#c8c0ff'>${{'1day':'Daily','1week':'Weekly','1month':'Monthly'}[S.interval]||S.interval}</strong> · ${data.length} bars</span>
      <!-- Interval selector -->
      <div style="display:flex;gap:4px;margin-left:auto">
        ${['1day','1week','1month'].map(iv=>{
          const hasCached = !!CACHE[S.ticker+':'+iv];
          const isActive  = S.interval===iv;
          const lbl = {'1day':'Daily','1week':'Weekly','1month':'Monthly'}[iv];
          const dot = hasCached && !isActive ? ' ✓' : '';
          const bc  = isActive ? '#ffd166' : '#1e1e2e';
          const bg  = isActive ? '#ffd16618' : 'transparent';
          const tc  = isActive ? '#ffd166' : '#5a547a';
          return '<button data-swiv="'+iv+'" style="padding:4px 11px;border-radius:3px;font-size:11px;font-family:Rajdhani,sans-serif;font-weight:700;cursor:pointer;border:1px solid '+bc+';background:'+bg+';color:'+tc+'">'+lbl+dot+'</button>';
        }).join('')}
      </div>
    </div>

    <div class="pnl">
      <div class="pnl-t">── TREND SCORE GAUGE (${t.score}/100)</div>
      <div style="background:#111120;border-radius:4px;height:20px;margin-bottom:12px;overflow:hidden;border:1px solid #1a1a2e;position:relative">
        <div style="height:100%;width:${t.score}%;background:linear-gradient(90deg,${tCol},${tCol}cc);border-radius:4px;transition:width .5s"></div>
        <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700">${t.score}% BULLISH</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:8px">
        ${t.rows.map(r=>{
          const slopeN=t.slopes[r.n];
          const slopeStr=slopeN!=null?(slopeN>=0?`▲ +${slopeN.toFixed(2)}%`:`▼ ${slopeN.toFixed(2)}%`):'—';
          const slopeC=slopeN>0?'#00e5a0':slopeN<0?'#ff4466':'#4a4470';
          return`<div style="background:#0e0e1c;border:1px solid ${r.rel==='above'?'#00e5a022':'#ff446622'};border-radius:4px;padding:9px 11px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
              <span style="color:${maColors[r.n]};font-family:'Rajdhani',sans-serif;font-weight:700;font-size:14px">MA ${r.n}</span>
              <span class="tp ${r.rel==='above'?'bull':'bear'}" style="font-size:10px">${r.rel?r.rel.toUpperCase():'N/A'}</span>
            </div>
            <div style="font-size:13px;color:#f0ecff;margin-bottom:3px">$${r.v??'N/A'}</div>
            <div style="display:flex;justify-content:space-between;font-size:10px">
              <span style="color:${r.pct>=0?'#00e5a0':'#ff4466'}">${r.pct!=null?fp(r.pct):'—'} vs price</span>
              <span style="color:${slopeC}">${slopeStr} 5d</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="pnl">
      <div class="pnl-t">── WHAT THIS MEANS FOR YOUR TRADING</div>
      ${t.trend==='BULLISH'?`
        <div style="color:#00e5a0;font-size:12px;margin-bottom:8px">✓ Price is above most MAs — confirmed uptrend.</div>
        <div style="color:#8b85cc;font-size:11px;line-height:2.1">
          • <b style="color:#c8c0ff">Bias: LONG only.</b> Set Direction to LONG in sidebar. Avoid short signals.<br>
          • Dips to MA20 or MA50 = <b>buying opportunities</b> — look for ENTER LONG signals near those levels.<br>
          • If price falls below MA200, the bull case weakens — reduce size and tighten stops.<br>
          • <b>Best strategies in uptrend:</b> MA Cross, EMA Cross, Momentum (trend-following).<br>
          • Avoid RSI overbought sells in strong uptrends — they stay overbought for extended periods.
        </div>
      `:t.trend==='BEARISH'?`
        <div style="color:#ff4466;font-size:12px;margin-bottom:8px">✗ Price is below most MAs — confirmed downtrend.</div>
        <div style="color:#8b85cc;font-size:11px;line-height:2.1">
          • <b style="color:#c8c0ff">Bias: SHORT only or CASH.</b> Set Direction to SHORT in sidebar.<br>
          • Bounces to MA20 or MA50 = <b>shorting opportunities</b> — look for ENTER SHORT signals there.<br>
          • If price reclaims MA200, the bear case weakens — cover shorts, re-assess.<br>
          • <b>Best strategies in downtrend:</b> MACD, RSI Reversion, Stoch RSI on short side.<br>
          • Bear market rallies are sharp and fast — use tight trailing stops on shorts.
        </div>
      `:`
        <div style="color:#ffd166;font-size:12px;margin-bottom:8px">~ Mixed signals — no clear trend direction.</div>
        <div style="color:#8b85cc;font-size:11px;line-height:2.1">
          • <b style="color:#c8c0ff">Bias: REDUCE SIZE.</b> Choppy markets hurt trend strategies. Trade smaller or stay flat.<br>
          • Wait for price to clearly break <b>above MA50</b> before going long, <b>below MA50</b> before shorting.<br>
          • <b>Best strategies in range:</b> Bollinger Bands, Stoch RSI, KDJ (mean-reversion).<br>
          • Avoid MA Cross and EMA Cross in sideways markets — they generate whipsaw losses.<br>
          • A break above/below MA200 with volume is the clearest trend-resumption signal.
        </div>
      `}
    </div>

    <div class="pnl">
      <div class="pnl-t">── MA20 / MA50 / MA100 / MA200 vs PRICE</div>
      <canvas id="tc2" width="${w}" height="270"></canvas>
    </div>
  </div>`;

  requestAnimationFrame(()=>{
    const ds=[
      {values:tD.map(d=>d.close),labels:tD.map(d=>d.date),color:'#7c6aff',w:1.8,fill:true},
      {values:smArr(data,20).filter((_,i)=>i%step===0||i===data.length-1),labels:tD.map(d=>d.date),color:'#ffd166',w:1.2,dash:[4,2]},
      {values:smArr(data,50).filter((_,i)=>i%step===0||i===data.length-1),labels:tD.map(d=>d.date),color:'#00e5a0',w:1.4,dash:[4,2]},
      {values:smArr(data,100).filter((_,i)=>i%step===0||i===data.length-1),labels:tD.map(d=>d.date),color:'#38bdf8',w:1.4,dash:[4,2]},
      {values:smArr(data,200).filter((_,i)=>i%step===0||i===data.length-1),labels:tD.map(d=>d.date),color:'#ff4466',w:1.6,dash:[6,3]},
    ];
    drawLine('tc2',ds,{yF:v=>`$${v>=100?v.toFixed(0):v.toFixed(2)}`,legend:[{c:'#7c6aff',t:'Price'},{c:'#ffd166',t:'MA20'},{c:'#00e5a0',t:'MA50'},{c:'#38bdf8',t:'MA100'},{c:'#ff4466',t:'MA200'}]});
  });
}


/* ── Nav active state ── */
function updateNav() {
  const map = {
    signals:'bSig', trend:'bTrend', brief:'bBrief', tips:'bTips',
    run:'bRun', compare:'bCmp', sp500:'bSP500',
    tradecenter:'bTC', rrg:'bRRG'
  };
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const id = map[S.currentScreen];
  if (id) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.add('active');
  }
  // Update subtitle
  const names = {
    signals:'Signal Chart', trend:'Trend Analysis', brief:'Trade Brief',
    tips:'Improve', run:'Backtest', compare:'Compare', sp500:'S&P 500',
    tradecenter:'Trade Center', rrg:'Sector RRG'
  };
  const sub = document.getElementById('hdr-subtitle');
  if (sub) { sub.style.display = S.currentScreen ? 'block' : 'none'; sub.textContent = names[S.currentScreen] || ''; }
}

/* ══ TREND ══ */
function getTrend(data){
  const price=data[data.length-1].close;
  const mas={20:null,50:null,100:null,200:null};
  Object.keys(mas).forEach(n=>{const a=smArr(data,+n);mas[n]=a[a.length-1];});
  let bull=0,bear=0;
  if(mas[20]&&price>mas[20])bull++;else bear++;
  if(mas[50]&&price>mas[50])bull++;else bear++;
  if(mas[100]&&price>mas[100])bull++;else bear++;
  if(mas[200]&&price>mas[200])bull++;else bear++;
  if(mas[20]&&mas[50]&&mas[20]>mas[50])bull++;else bear++;
  if(mas[50]&&mas[100]&&mas[50]>mas[100])bull++;else bear++;
  if(mas[100]&&mas[200]&&mas[100]>mas[200])bull++;else bear++;
  const total=bull+bear;const score=Math.round(bull/total*100);
  const trend=score>=65?'BULLISH':score<=35?'BEARISH':'NEUTRAL';
  const rows=Object.entries(mas).map(([n,v])=>{if(!v)return{n:+n,v:null,rel:null,pct:null};const pct=(price-v)/v*100;return{n:+n,v:+v.toFixed(2),rel:price>v?'above':'below',pct:+pct.toFixed(2)};});
  const slopes={};Object.keys(mas).forEach(n=>{const a=smArr(data,+n);const cur=a[a.length-1],prev=a[a.length-6];if(cur&&prev)slopes[n]=(cur-prev)/prev*100;});
  return{trend,score,bull,bear,mas,rows,slopes,price};
}



function doCmp(){
  S.currentScreen='compare';updateNav();
  if(!S.data){M().innerHTML=noDataPicker('⇌ COMPARE','#00e5a0','No ticker loaded. Select one below to compare strategies.');return;}
  const all={};
  Object.entries(STRATS).forEach(([k,s])=>{
    const sig=combineSignals(S.data,[k],S.combo,S.params,S.dir);
    all[k]={...backtest(S.data,sig,S.capital,S.comm,S.sl,S.tp,S.trail,S.trailPct),label:s.sh,color:s.c};
  });
  all.bh={...backtest(S.data,[{i:1,type:'buy',action:'enter_long'}],S.capital,S.comm,0,999,false,3),label:'Buy & Hold',color:'#444466'};
  S.cmpRes=all;S.results=null;
  document.getElementById('qres').style.display='none';
  // Render immediately with no combos (fast) then compute combos async
  renderCmp([]);
  // Defer combo computation so UI renders first
  setTimeout(function(){
    const data=S.data;
    const KEYS=Object.keys(STRATS);
    const comboCandidates=[];
    for(let i=0;i<KEYS.length;i++) for(let j=i+1;j<KEYS.length;j++) comboCandidates.push([KEYS[i],KEYS[j]]);
    const topKeys=['ema_cross','macd','rsi_rev','bb','srsi','obv_trend','vol_surge','sr_break','kdj','mom','ma_cross'];
    for(let i=0;i<topKeys.length;i++) for(let j=i+1;j<topKeys.length;j++) for(let k=j+1;k<topKeys.length;k++) comboCandidates.push([topKeys[i],topKeys[j],topKeys[k]]);
    // Update progress display in batches
    const batchSize=20; let done=0;


    function runBatch(results){
      const end=Math.min(done+batchSize, comboCandidates.length);
      for(let i=done;i<end;i++){
        const keys=comboCandidates[i];
        const sig=combineSignals(data,keys,'AND',S.params,S.dir);
        const r=backtest(data,sig,S.capital,S.comm,S.sl,S.tp,S.trail,S.trailPct);
        if(r.numTrades>=3){
          results.push({keys,lbl:keys.map(k=>STRATS[k]?.sh||k).join(' + '),col:STRATS[keys[0]]?.c||'#7c6aff',...r});
        }
      }
      done=end;
      const prog=document.getElementById('combo-progress');
      if(prog) prog.textContent=done+'/'+comboCandidates.length;
      if(done<comboCandidates.length){ setTimeout(()=>runBatch(results),0); return; }
      // Done — sort and re-render
      results.sort((a,b)=>(b.wr*0.5+(b.sharpe||0)*10+Math.max(0,b.ret)*0.3)-(a.wr*0.5+(a.sharpe||0)*10+Math.max(0,a.ret)*0.3));
      if(S.currentScreen==='compare') renderCmp(results.slice(0,15));
    }
    
    runBatch([]);
  }, 50);
}