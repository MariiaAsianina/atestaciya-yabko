/* ─── AUTH ─── */
const AUTH_HASH = '4a3c40466aa83029f67cd839ba4ea80251f41ae092ce8059dd92f6d53750a851';
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function unlockApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-root').style.display = '';
  init();
}
async function checkLogin() {
  const pass = document.getElementById('login-pass').value;
  if (await sha256Hex(pass) === AUTH_HASH) {
    sessionStorage.setItem('atest_auth', '1');
    unlockApp();
  } else {
    document.getElementById('login-error').classList.add('on');
  }
}
if (sessionStorage.getItem('atest_auth') === '1') unlockApp();
else document.getElementById('login-pass').focus();

const APP_VERSION = 'v1.2';
const APP_VERSION_DATE = '14.06.2026';
const RELEASES = [
  { ver: 'v1.2', date: '14.06.2026', notes: [
    'Гілки production/development та автопублікація GitHub Pages з production.',
    'Автозапис історії комітів у CHANGELOG.md.',
    'Система релізів (теги v1.0, v1.1, v1.2…).',
    'Відображення версії сайту та кнопка «Історія змін».'
  ]},
  { ver: 'v1.1', date: '14.06.2026', notes: [
    'Картки підвищення/пониження/підтвердження посади за результатами атестації.',
    'Дата і час останнього оновлення даних у топбарі.'
  ]},
  { ver: 'v1.0', date: '14.06.2026', notes: [
    'Початкова версія дашборду атестації (графіки, таблиці, фільтри, експорт CSV, імпорт .xlsx).'
  ]}
];

const THR = {'Менеджер з продажів':65,'Спеціаліст з продажів':65,'Експерт (сайт)':70,'Експерт + (сайт)':80};
const POS_LEVEL = {'Спеціаліст з продажів':1,'Менеджер з продажів':2,'Експерт (сайт)':3,'Експерт + (сайт)':4};
const RES_LEVEL = {specialist:1, manager:2, expert:3, expert_plus:4};
const C = ['#4b8cf5','#7b5fe4','#26c6a0','#f5c842','#f07070','#38bdf8','#a78bfa','#fb923c'];
const GR = {color:'rgba(255,255,255,.06)'};
const TK = {color:'#9a9aa2',font:{size:11}};
const TEST_LABELS = ['Новинки Берез.','Принтери','Whoop/Oura','Особл.техніка','Тренінг 2026','Гарантії'];

let ALL=[], FIL=[], TESTS=[], PLAN=[...PLAN_SEED];
let PP=25, activeTab='dash', pendingData=null;
const TS = {
  general:{k:'totalScore',d:-1}, tests:{k:'testSum',d:-1}, qa:{k:'qaAvg',d:-1},
  chats:{k:'convChat',d:-1}, inbound:{k:'convInbound',d:-1}, orders:{k:'totalOrders',d:-1},
  kpi:{k:'kpiBal_kpi',d:-1}, review:{k:'reviewScoreOcinka',d:-1}, teams:{k:'avgScore',d:-1}
};
const TP = {general:1,tests:1,qa:1,chats:1,inbound:1,orders:1,kpi:1,review:1,teams:1};
const CI = {};

/* ─── INIT ─── */
async function init() {
  const dec = async b64 => {
    const bin = atob(b64), buf = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('deflate');
    const wr = ds.writable.getWriter(), rd = ds.readable.getReader();
    wr.write(buf); wr.close();
    let out = '';
    while(true){const{value,done}=await rd.read();if(done)break;out+=new TextDecoder().decode(value);}
    return JSON.parse(out);
  };
  try {
    const [raw, tests] = await Promise.all([dec(SEED_B64), dec(TESTS_B64)]);
    ALL = enrich(raw);
    TESTS = tests;
  } catch(e) { console.error('Decompress error:', e); ALL = []; }
  document.getElementById('loading').style.display = 'none';
  document.getElementById('meta').textContent = 'Атестація Літо 2026 · ' + ALL.length + ' співробітників · Оновлено: ' + DATA_UPDATED;
  document.getElementById('ver').textContent = 'Версія ' + APP_VERSION + ' · оновлено ' + APP_VERSION_DATE;
  buildFilters();
  applyFilters();
}

function enrich(raw) {
  return raw.map((r, i) => {
    const qa = [r.qaLine, r.qaChat, r.qaOrder].filter(v => v != null);
    const qaAvg = qa.length ? +(qa.reduce((a,b)=>a+b,0)/qa.length).toFixed(1) : null;
    const tests = [r.test1,r.test2,r.test3,r.test4,r.test5,r.test6].filter(v => v != null);
    const testSum = tests.length ? tests.reduce((a,b)=>a+b,0) : null;
    return { ...r, qaAvg, testSum, result: calcRes(r.position, r.totalScore), _id: r.email || (r.name+'_'+i) };
  });
}
function calcRes(pos, sc) {
  if (sc == null) return 'none';
  if (sc >= 80) return 'expert_plus';
  if (sc >= 70) return 'expert';
  if (sc >= 65) return 'manager';
  return 'specialist';
}

/* ─── FILTERS ─── */
function buildFilters() {
  const sups = [...new Set(ALL.map(d => d.supervisor||'—'))].sort();
  const poss = [...new Set(ALL.map(d => d.position||'—'))].sort();
  mkCKs('f-sup', sups); mkCKs('f-pos', poss);
}
function mkCKs(id, vals) {
  document.getElementById(id).innerHTML = vals.map(v =>
    '<label class="ckrow"><input type="checkbox" value="'+xss(v)+'" checked onchange="applyFilters()"><span>'+v+'</span></label>'
  ).join('');
}
function getCKed(id) { return [...document.querySelectorAll('#'+id+' input:checked')].map(e=>e.value); }
function applyFilters() {
  const q = document.getElementById('fsearch').value.toLowerCase();
  const sup = getCKed('f-sup'), pos = getCKed('f-pos');
  const res = [...document.querySelectorAll('#sb input[value=expert_plus],#sb input[value=expert],#sb input[value=manager],#sb input[value=specialist]')]
    .filter(e=>e.checked).map(e=>e.value);
  const car = getCKed('f-career');
  FIL = ALL.filter(d =>
    (!q || d.name.toLowerCase().includes(q)) &&
    sup.includes(d.supervisor||'—') &&
    pos.includes(d.position||'—') &&
    res.includes(d.result) &&
    car.includes(careerChange(d))
  );
  Object.keys(TP).forEach(k => TP[k]=1);
  renderAll();
}
function resetFilters() {
  document.getElementById('fsearch').value = '';
  document.querySelectorAll('#sb input[type=checkbox]').forEach(e => e.checked=true);
  applyFilters();
}

/* ─── RENDER ALL ─── */
function renderAll() {
  renderKPICards();
  ['general','tests','qa','chats','inbound','orders','kpi','review'].forEach(t => renderTable(t));
  renderTeamsTab();
  renderCharts(activeTab);
}

/* ─── KPI CARDS ─── */
function kpiCard(v, label, sub, color) {
  return '<div class="kcard" style="--ac-c:'+color+'"><div class="kv" style="color:'+color+'">'+v+'</div><div class="kl">'+label+'</div><div class="ks">'+sub+'</div></div>';
}
function avg(arr) { return arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : null; }
function sum(arr) { return arr.reduce((a,b)=>a+b,0); }

function careerChange(d) {
  const posLvl = POS_LEVEL[d.position], resLvl = RES_LEVEL[d.result];
  if (posLvl == null || resLvl == null) return null;
  if (resLvl > posLvl) return 'up';
  if (resLvl < posLvl) return 'down';
  return 'same';
}

function renderKPICards() {
  const sc = FIL.map(d=>d.totalScore).filter(v=>v!=null);
  const avgSc = sc.length ? +avg(sc).toFixed(1) : '—';
  const withT = FIL.filter(d=>d.result!=='none');
  const pct = withT.length ? Math.round(FIL.filter(d=>d.result==='expert_plus'||d.result==='expert').length/withT.length*100) : 0;
  const ten = FIL.map(d=>d.tenureMonths).filter(v=>v!=null);
  const pass = FIL.filter(d=>d.result==='expert_plus'||d.result==='expert').length;
  const warn = FIL.filter(d=>d.result==='manager').length;
  const fail = FIL.filter(d=>d.result==='specialist').length;
  document.getElementById('d-kpis').innerHTML =
    kpiCard(FIL.length, 'Співробітників', 'з '+ALL.length+' загалом', '#4b8cf5') +
    kpiCard(avgSc, 'Сер. загальний бал', 'із 60 можливих', '#f5c842') +
    kpiCard(FIL.filter(d=>d.result==='expert_plus').length, '⭐ Потенц. Експерт+', '≥ 80 балів', '#b06aff') +
    kpiCard(FIL.filter(d=>d.result==='expert').length, '🔵 Експерт', '70–79 балів', '#4b8cf5') +
    kpiCard(warn, '🟡 Менеджер', '65–69 балів', '#f5c842') +
    kpiCard(ten.length ? Math.round(avg(ten)) : '—', 'Сер. стаж', 'місяців', '#7b5fe4');

  const changes = FIL.map(careerChange);
  const up = changes.filter(c=>c==='up').length;
  const down = changes.filter(c=>c==='down').length;
  const same = changes.filter(c=>c==='same').length;
  document.getElementById('d-career').innerHTML =
    kpiCard(up, '⬆ Підвищення посади', 'за результатами атестації', '#34d399') +
    kpiCard(down, '⬇ Пониження посади', 'за результатами атестації', '#f07070') +
    kpiCard(same, '➡ Підтвердження посади', 'за результатами атестації', '#9a9aa2');
}

/* ─── TABLES ─── */
const TBL = {
  general:['name','supervisor','position','hireDate','tenureMonths','kpiBal','testSum','qaLine','qaChat','qaOrder','kpInbound','kpConvInbound','kpChats','kpConvChat','kpSuccessPct','kpOrders','managerScore','totalScore','result'],
  tests:  ['name','supervisor','position','test1','test2','test3','test4','test5','test6','testSum'],
  qa:     ['name','supervisor','position','qaLine','qaChat','qaOrder','qaAvg'],
  chats:  ['name','supervisor','position','totalChats','ordersFromChats','workDaysOnChats','convChat','chatsPerDay','balChats','balConvChat'],
  inbound:['name','supervisor','position','inboundCalls','totalInbound','callsPerDay','ordersFromCalls','convInbound','balInbound','balConvInbound'],
  orders: ['name','supervisor','position','totalOrders','successOrders','successPct','cancelPct','ordFromCalls','ordFromChats','scoreSuccess','scoreQty','totalScore','result'],
  kpi:    ['name','supervisor','position','kpiGlass','kpiBlackSide','kpiBlocks','kpiCorning','kpiCase','kpiDG','kpiDGPremium','kpiBal_kpi'],
  review: ['name','supervisor','position','reviewStrength','reviewRecommendation','reviewRelations','reviewDiscipline','reviewInitiative','reviewScorePts','reviewScoreOcinka'],
};

const BAR = {
  qaLine:{m:5,c:'#4b8cf5'},qaChat:{m:5,c:'#26c6a0'},qaOrder:{m:5,c:'#f5c842'},qaAvg:{m:5,c:'#7b5fe4'},
  test1:{m:2,c:'#4b8cf5'},test2:{m:2,c:'#7b5fe4'},test3:{m:2,c:'#26c6a0'},
  test4:{m:2,c:'#f5c842'},test5:{m:2,c:'#f07070'},test6:{m:2,c:'#38bdf8'},testSum:{m:12,c:'#fb923c'},
  kpiBal:{m:30,c:'#4b8cf5'},kpiBal_kpi:{m:30,c:'#4b8cf5'},
  kpInbound:{m:8,c:'#4b8cf5'},kpConvInbound:{m:8,c:'#7b5fe4'},kpChats:{m:8,c:'#26c6a0'},
  kpConvChat:{m:8,c:'#7b5fe4'},kpSuccessPct:{m:10,c:'#f5c842'},kpOrders:{m:6,c:'#f07070'},
  managerScore:{m:10,c:'#7b5fe4'},
  totalChats:{m:1000,c:'#26c6a0'},ordersFromChats:{m:200,c:'#f5c842'},
  convChat:{m:25,c:'#7b5fe4'},chatsPerDay:{m:50,c:'#38bdf8'},
  balChats:{m:4,c:'#26c6a0'},balConvChat:{m:6,c:'#7b5fe4'},
  inboundCalls:{m:3000,c:'#4b8cf5'},totalInbound:{m:5000,c:'#38bdf8'},
  callsPerDay:{m:50,c:'#4b8cf5'},ordersFromCalls:{m:500,c:'#f5c842'},
  convInbound:{m:25,c:'#7b5fe4'},balInbound:{m:4,c:'#4b8cf5'},balConvInbound:{m:6,c:'#7b5fe4'},
  totalOrders:{m:2500,c:'#f07070'},successOrders:{m:2500,c:'#34d399'},
  successPct:{m:100,c:'#f5c842'},cancelPct:{m:50,c:'#f07070'},
  scoreSuccess:{m:7,c:'#34d399'},scoreQty:{m:3,c:'#4b8cf5'},
  ordFromCalls:{m:500,c:'#4b8cf5'},ordFromChats:{m:200,c:'#26c6a0'},
  kpiGlass:{m:50,c:'#38bdf8'},kpiBlackSide:{m:70,c:'#a78bfa'},kpiBlocks:{m:30,c:'#fb923c'},
  kpiCorning:{m:15,c:'#f5c842'},kpiCase:{m:30,c:'#26c6a0'},kpiDG:{m:30,c:'#4b8cf5'},
  kpiDGPremium:{m:7,c:'#f5c842'},
  reviewScorePts:{m:30,c:'#7b5fe4'},reviewScoreOcinka:{m:10,c:'#7b5fe4'},
};

function renderTable(tab) {
  const st = TS[tab];
  const data = [...FIL].sort((a,b) => {
    const av=a[st.k], bv=b[st.k];
    if (av==null) return 1; if (bv==null) return -1;
    return st.d * (typeof av==='string' ? av.localeCompare(bv,'uk') : av-bv);
  });
  const pg = TP[tab], sl = data.slice((pg-1)*PP, pg*PP);
  const tb = document.querySelector('#tbl-'+tab+' tbody');
  if (!tb) return;

  const rows = sl.map(d => {
    const id = (d._id||'').replace(/'/g,"\\'");
    const cells = TBL[tab].map(c => renderCell(d,c)).join('');
    return '<tr onclick="openEmp(\''+id+'\')">' + cells + '</tr>';
  });
  tb.innerHTML = rows.join('') || '<tr><td colspan="20" class="empty-td">Немає даних для поточних фільтрів</td></tr>';

  const cnt = document.getElementById('cnt-'+tab);
  if (cnt) cnt.innerHTML = 'Показано <b>'+sl.length+'</b> з <b>'+FIL.length+'</b> (всього <b>'+ALL.length+'</b>)';

  document.querySelectorAll('#tbl-'+tab+' thead th').forEach(th => th.classList.toggle('srt', th.dataset.k===st.k));
  renderPg(tab, FIL.length, pg);
}

// Wire sort clicks
['general','tests','qa','chats','inbound','orders','kpi','review'].forEach(tab => {
  document.querySelectorAll('#tbl-'+tab+' thead th[data-k]').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.k;
      TS[tab].d = (TS[tab].k===k) ? -TS[tab].d : -1;
      TS[tab].k = k; TP[tab] = 1;
      renderTable(tab);
    });
  });
});

function renderCell(d, col) {
  if (col==='result') return '<td>'+badge(d.result)+'</td>';
  if (col==='totalScore') {
    const cl=rClr(d.result), pct=d.totalScore?Math.min(100,d.totalScore/60*100):0;
    return '<td><div class="sb"><span style="font-weight:700;color:'+cl+';min-width:24px">'+(d.totalScore!=null?d.totalScore:'—')+'</span><div class="sbbg"><div class="sbfill" style="width:'+pct+'%;background:'+cl+'"></div></div></div></td>';
  }
  if (col==='name') return '<td><b>'+d.name+'</b></td>';
  if (col==='supervisor') return '<td style="color:var(--t2)">'+(d.supervisor||'—')+'</td>';
  if (col==='position') return '<td>'+posTag(d.position)+'</td>';
  const v = d[col];
  if (v==null) return '<td><span style="color:var(--t3)">—</span></td>';
  if (typeof v==='string' && v.length>30)
    return '<td style="color:var(--t2);font-size:11px;max-width:160px;white-space:normal;line-height:1.3">'+v+'</td>';
  const b = BAR[col];
  if (b) {
    const pct = Math.min(100, v/b.m*100);
    return '<td><div class="sb"><span style="font-weight:600;color:'+b.c+';min-width:26px">'+v+'</span><div class="sbbg"><div class="sbfill" style="width:'+pct+'%;background:'+b.c+'"></div></div></div></td>';
  }
  return '<td style="color:var(--t2)">'+v+'</td>';
}

function renderPg(tab, total, pg) {
  const pages = Math.ceil(total/PP);
  let h = '<select class="ppsel" onchange="PP=+this.value;Object.keys(TP).forEach(k=>TP[k]=1);[\'general\',\'tests\',\'qa\',\'chats\',\'inbound\',\'orders\',\'kpi\',\'review\'].forEach(t=>renderTable(t));renderTeamsTab()">'
    + [25,50,100].map(n=>'<option'+(PP===n?' selected':'')+'>'+n+'</option>').join('') + '</select>';
  if (pages>1) {
    h += '<button class="pgb" onclick="goPg(\''+tab+'\','+( pg-1)+')" '+(pg<=1?'disabled':'')+'>‹</button>';
    for(let i=1;i<=pages;i++){
      if(i===1||i===pages||Math.abs(i-pg)<=1)
        h+='<button class="pgb'+(i===pg?' cur':'')+'" onclick="goPg(\''+tab+'\','+i+')">'+i+'</button>';
      else if(Math.abs(i-pg)===2)h+='<span style="color:var(--t3)">…</span>';
    }
    h += '<button class="pgb" onclick="goPg(\''+tab+'\','+( pg+1)+')" '+(pg>=pages?'disabled':'')+'>›</button>';
  }
  const el = document.getElementById('pg-'+tab);
  if (el) el.innerHTML = h;
}
function goPg(tab, p) { TP[tab]=Math.max(1,Math.min(p,Math.ceil(FIL.length/PP))); renderTable(tab); }

/* ─── TEAMS TAB ─── */
function renderTeamsTab() {
  const teamNames = [...new Set(FIL.map(d=>d.supervisor||'—'))].sort();
  const html = teamNames.map(name => {
    const members = FIL.filter(d=>(d.supervisor||'—')===name);
    const scores = members.map(d=>d.totalScore).filter(v=>v!=null);
    const avgSc = scores.length ? +(avg(scores)).toFixed(1) : null;
    const ep   = members.filter(d=>d.result==='expert_plus').length;
    const ex   = members.filter(d=>d.result==='expert').length;
    const mg   = members.filter(d=>d.result==='manager').length;
    const sp   = members.filter(d=>d.result==='specialist').length;
    const none = members.filter(d=>d.result==='none').length;
    const pass = ep + ex;
    const warn = mg;
    const fail = sp;
    const pct = (ep+ex+mg+sp) ? Math.round((ep+ex)/(ep+ex+mg+sp)*100) : 0;
    const avgTen = members.map(d=>d.tenureMonths).filter(v=>v!=null);
    const avgT = avgTen.length ? Math.round(avg(avgTen)) : '—';
    const qaVals = members.map(d=>d.qaAvg).filter(v=>v!=null);
    const avgQA = qaVals.length ? +(avg(qaVals)).toFixed(1) : '—';
    const avgConvChat = members.map(d=>d.convChat).filter(v=>v!=null);
    const avgCC = avgConvChat.length ? +(avg(avgConvChat)).toFixed(1) : '—';
    const avgConvInb = members.map(d=>d.convInbound).filter(v=>v!=null);
    const avgCI = avgConvInb.length ? +(avg(avgConvInb)).toFixed(1) : '—';
    const kpiBals = members.map(d=>d.kpiBal_kpi).filter(v=>v!=null);
    const avgKPI = kpiBals.length ? +(avg(kpiBals)).toFixed(1) : '—';
    const totalOrd = members.map(d=>d.totalOrders).filter(v=>v!=null);
    const avgOrd = totalOrd.length ? Math.round(avg(totalOrd)) : '—';
    const succPct = members.map(d=>d.successPct).filter(v=>v!=null);
    const avgSucc = succPct.length ? +(avg(succPct)).toFixed(1) : '—';

    const scoreColor = avgSc >= 80 ? '#b06aff' : avgSc >= 70 ? '#4b8cf5' : avgSc >= 65 ? '#f5c842' : '#f07070';
    const barW = avgSc ? Math.min(100, avgSc/80*100) : 0;

    const memberRows = [...members].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0)).map(d => {
      const res = badge(d.result);
      const sc = d.totalScore != null ? d.totalScore : '—';
      const scColor = rClr(d.result);
      return '<div class="team-member-row">'
        +'<div class="tmr-name">'+d.name+'</div>'
        +'<div class="tmr-pos">'+posTag(d.position)+'</div>'
        +'<div class="tmr-score" style="color:'+scColor+'">'+sc+'</div>'
        +'<div class="tmr-badge">'+res+'</div>'
        +'</div>';
    }).join('');

    return '<div class="team-card" id="tc-'+name.replace(/[^a-zа-яA-ZА-Я0-9]/gi,'-')+'">'
      +'<div class="tc-header">'
        +'<div class="tc-title">'+name+'</div>'
        +'<div class="tc-count">'+members.length+' осіб</div>'
      +'</div>'
      +'<div class="tc-score-row">'
        +'<div class="tc-main-score" style="color:'+scoreColor+'">'+(avgSc!=null?avgSc:'—')+'</div>'
        +'<div class="tc-score-info">'
          +'<div class="tc-bar-wrap"><div class="tc-bar" style="width:'+barW+'%;background:'+scoreColor+'"></div></div>'
          +'<div class="tc-score-label">Сер. загальний бал</div>'
        +'</div>'
        +'<div class="tc-result-badges">'
          +(ep?'<span class="bdg bep">⭐ '+ep+'</span>':'')
          +(ex?'<span class="bdg bex">🔵 '+ex+'</span>':'')
          +(mg?'<span class="bdg bmg">🟡 '+mg+'</span>':'')
          +(sp?'<span class="bdg bsp">🔴 '+sp+'</span>':'')
          +(none?'<span class="bdg bx">— '+none+'</span>':'')
        +'</div>'
      +'</div>'
      +'<div class="tc-metrics">'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgKPI+'</div><div class="tc-m-lbl">Сер. бал КПІ</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgQA+'</div><div class="tc-m-lbl">Сер. КЯ</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgCC+'%</div><div class="tc-m-lbl">Конв. чатів</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgCI+'%</div><div class="tc-m-lbl">Конв. вхідних</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgOrd+'</div><div class="tc-m-lbl">Сер. замовл.</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgSucc+'%</div><div class="tc-m-lbl">% Успішних</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+avgT+' міс.</div><div class="tc-m-lbl">Сер. стаж</div></div>'
        +'<div class="tc-metric"><div class="tc-m-val">'+pct+'%</div><div class="tc-m-lbl">% склали</div></div>'
      +'</div>'
      +'<details class="tc-members-wrap"><summary class="tc-members-toggle">Учасники команди ('+members.length+')</summary>'
        +'<div class="tc-members">'+memberRows+'</div>'
      +'</details>'
      +'</div>';
  }).join('');
  const el = document.getElementById('teams-grid');
  if (el) el.innerHTML = html || '<div style="color:var(--t3);text-align:center;padding:32px">Немає даних</div>';

  // also render teams chart if on that tab
  if (activeTab==='teams') setTimeout(()=>renderTeamsChart(), 30);
}

function renderTeamsChart() {
  const teamNames = [...new Set(FIL.map(d=>d.supervisor||'—'))].sort();
  const metrics = [
    { key:'avgScore', label:'Заг. бал', color:'#4b8cf5', max:80 },
    { key:'avgQA', label:'КЯ ×10', color:'#26c6a0', max:8 },
    { key:'avgKPI', label:'КПІ бал', color:'#f5c842', max:30 },
  ];

  const teamData = teamNames.map(name => {
    const m = FIL.filter(d=>(d.supervisor||'—')===name);
    const sc = m.map(d=>d.totalScore).filter(v=>v!=null);
    const qa = m.map(d=>d.qaAvg).filter(v=>v!=null);
    const kp = m.map(d=>d.kpiBal_kpi).filter(v=>v!=null);
    return {
      name,
      avgScore: sc.length ? +avg(sc).toFixed(1) : 0,
      avgQA: qa.length ? +(avg(qa)*10).toFixed(1) : 0,  // scale to ~50 range
      avgKPI: kp.length ? +avg(kp).toFixed(1) : 0,
    };
  }).sort((a,b)=>b.avgScore-a.avgScore);

  mk('c-teams-radar', {
    type: 'bar',
    data: {
      labels: teamData.map(t=>t.name),
      datasets: [
        {label:'Заг. бал', data:teamData.map(t=>t.avgScore), backgroundColor:'#4b8cf588', borderColor:'#4b8cf5', borderWidth:1, borderRadius:3},
        {label:'КЯ ×10',  data:teamData.map(t=>t.avgQA),    backgroundColor:'#26c6a088', borderColor:'#26c6a0', borderWidth:1, borderRadius:3},
        {label:'КПІ бал', data:teamData.map(t=>t.avgKPI),   backgroundColor:'#f5c84288', borderColor:'#f5c842', borderWidth:1, borderRadius:3},
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#9a9aa2',font:{size:11},padding:12}}},
      scales:{
        x:{ticks:{...TK,maxRotation:20},grid:{display:false}},
        y:{ticks:TK,grid:GR,beginAtZero:true}
      }
    }
  });

  // Pass rate bar chart
  const passData = teamNames.map(name => {
    const m = FIL.filter(d=>(d.supervisor||'—')===name);
    const w = m.filter(d=>d.result!=='none');
    return { name, pct: w.length ? Math.round(m.filter(d=>d.result==='pass').length/w.length*100) : 0 };
  }).sort((a,b)=>b.pct-a.pct);

  mk('c-teams-pass', {
    type:'bar',
    data:{labels:passData.map(t=>t.name), datasets:[{
      data:passData.map(t=>t.pct),
      backgroundColor: passData.map(t => t.pct>=70?'#4b8cf588':t.pct>=50?'#f5c84288':'#f0707088'),
      borderColor: passData.map(t => t.pct>=70?'#4b8cf5':t.pct>=50?'#f5c842':'#f07070'),
      borderWidth:1, borderRadius:5
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true,max:100}},
      animation:{onComplete:e=>{const ch=e.chart,cx=ch.ctx;cx.save();cx.font='bold 11px Segoe UI';cx.fillStyle='#dde2f0';cx.textAlign='center';ch.data.datasets[0].data.forEach((v,i)=>{if(!v)return;const m=ch.getDatasetMeta(0).data[i];if(m)cx.fillText(v+'%',m.x,m.y-6);});cx.restore();}}}
  });
}

/* ─── CHARTS ─── */
function mk(id, cfg) {
  if (CI[id]) { CI[id].destroy(); delete CI[id]; }
  const el = document.getElementById(id);
  if (!el) return;
  CI[id] = new Chart(el, cfg);
}
function tAvg(key) {
  const m = {};
  FIL.forEach(d => {
    const k = d.supervisor||'—';
    if (!m[k]) m[k]=[];
    if (d[key]!=null) m[k].push(d[key]);
  });
  return Object.entries(m).map(([k,v])=>[k, v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):0]).sort((a,b)=>b[1]-a[1]);
}
function barChart(id,labels,data,colors,opts={}) {
  mk(id,{type:'bar',data:{labels,datasets:[{data,backgroundColor:colors.map(c=>c+'aa'),borderColor:colors,borderWidth:1,borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+ctx.parsed.y}}},
    scales:{x:{ticks:{...TK,maxRotation:25},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true,...(opts.max?{max:opts.max}:{})}},...(opts.extra||{})}});
}
function hBarChart(id,labels,data,colors) {
  mk(id,{type:'bar',data:{labels,datasets:[{data,backgroundColor:colors.map(c=>c+'aa'),borderColor:colors,borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},
    scales:{x:{ticks:TK,grid:GR,beginAtZero:true},y:{ticks:{...TK,font:{size:10}},grid:{display:false}}}}});
}
function drawLabels(e) {
  const ch=e.chart,cx=ch.ctx;
  cx.save();cx.font='bold 11px Segoe UI';cx.fillStyle='#dde2f0';cx.textAlign='center';
  ch.data.datasets[0].data.forEach((v,i)=>{if(!v)return;const m=ch.getDatasetMeta(0).data[i];if(m)cx.fillText(v,m.x,m.y-6);});
  cx.restore();
}

function renderCharts(tab) {
  if (tab==='dash')    renderDash();
  else if (tab==='tests')   renderTestCharts();
  else if (tab==='qa')      renderQACharts();
  else if (tab==='chats')   renderChatCharts();
  else if (tab==='inbound') renderInbCharts();
  else if (tab==='orders')  renderOrdCharts();
  else if (tab==='kpi')     renderKPICharts();
  else if (tab==='review')  renderRevCharts();
  else if (tab==='teams')   renderTeamsChart();
  else if (tab==='plan')    renderPlan();
}

function renderDash() {
  const cnt = ['expert_plus','expert','manager','specialist','none'].map(r=>FIL.filter(d=>d.result===r).length);
  mk('c-donut',{type:'doughnut',data:{labels:['⭐ Потенц. Експерт+','🔵 Експерт','🟡 Менеджер','🔴 Спеціаліст','⬜ Без балу'],datasets:[{data:cnt,backgroundColor:['#b06aff','#4b8cf5','#f5c842','#f07070','#5a6480'],borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'right',labels:{color:'#9a9aa2',font:{size:11},padding:10,boxWidth:12}}}}});

  const bins=Array(13).fill(0);
  FIL.forEach(d=>{if(d.totalScore!=null)bins[Math.min(Math.floor(d.totalScore/5),12)]++;});
  mk('c-hist',{type:'bar',data:{labels:bins.map((_,i)=>i*5+'-'+(i*5+4)),datasets:[{data:bins,backgroundColor:bins.map((_,i)=>{const s=i*5;return s>=80?'#b06affaa':s>=70?'#4b8cf5aa':s>=65?'#f5c842aa':'#f07070aa';}),borderWidth:0,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>'Бал '+i[0].label,label:i=>' '+i.parsed.y+' осіб'}}},scales:{x:{ticks:{...TK,font:{size:9},maxRotation:45},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true}}}});

  const te=tAvg('totalScore');
  mk('c-teams',{type:'bar',data:{labels:te.map(e=>e[0]),datasets:[{data:te.map(e=>e[1]),backgroundColor:te.map((_,i)=>C[i%C.length]+'bb'),borderColor:te.map((_,i)=>C[i%C.length]),borderWidth:1,borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>' '+i.parsed.y+' балів'}}},scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true,max:80}},animation:{onComplete:drawLabels}}});

  const posC={'Менеджер з продажів':'#4b8cf5','Спеціаліст з продажів':'#26c6a0','Експерт (сайт)':'#f5c842','Експерт + (сайт)':'#f07070'};
  const pts=FIL.filter(d=>d.tenureMonths!=null&&d.totalScore!=null);
  mk('c-scatter',{type:'scatter',data:{datasets:[{data:pts.map(d=>({x:d.tenureMonths,y:d.totalScore})),backgroundColor:pts.map(d=>(posC[d.position]||'#9a9aa2')+'bb'),pointRadius:5,pointHoverRadius:7}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>{const d=pts[i.dataIndex];return d?d.name+': '+d.totalScore+' ('+d.tenureMonths+' міс.)':'';},title:()=>''}}},scales:{x:{ticks:TK,grid:GR,title:{display:true,text:'Стаж (місяців)',color:'#9a9aa2'}},y:{ticks:TK,grid:GR,title:{display:true,text:'Загальний бал',color:'#9a9aa2'}}}}});

  const pm={};FIL.forEach(d=>{const k=d.position||'—';if(!pm[k])pm[k]=[];if(d.totalScore!=null)pm[k].push(d.totalScore);});
  const pe=Object.entries(pm).map(([k,v])=>[k,v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):0]).sort((a,b)=>b[1]-a[1]);
  barChart('c-pos',pe.map(e=>e[0]),pe.map(e=>+e[1]),C.slice(0,pe.length),{max:85});
}

function renderTestCharts() {
  const avgs=TEST_LABELS.map((_,i)=>{const k='test'+(i+1);const v=FIL.map(d=>d[k]).filter(x=>x!=null);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):0;});
  barChart('c-tests-avg',TEST_LABELS.map((n,i)=>'Т'+(i+1)+': '+n),avgs.map(Number),C,{max:2});
  const tm={};FIL.forEach(d=>{const k=d.supervisor||'—';if(!tm[k])tm[k]=[];if(d.testSum!=null)tm[k].push(d.testSum);});
  const te=Object.entries(tm).map(([k,v])=>[k,v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):0]).sort((a,b)=>b[1]-a[1]);
  barChart('c-tests-teams',te.map(e=>e[0]),te.map(e=>+e[1]),te.map((_,i)=>C[i%C.length]),{max:12});
}
function renderQACharts() {
  const ql=tAvg('qaLine'),qc=tAvg('qaChat'),qo=tAvg('qaOrder');
  const names=[...new Set([...ql,...qc,...qo].map(e=>e[0]))];
  const qM=arr=>Object.fromEntries(arr);
  mk('c-qa-teams',{type:'bar',data:{labels:names,datasets:[{label:'Лінія',data:names.map(n=>qM(ql)[n]||0),backgroundColor:'#4b8cf5aa',borderColor:'#4b8cf5',borderWidth:1,borderRadius:3},{label:'Чат',data:names.map(n=>qM(qc)[n]||0),backgroundColor:'#26c6a0aa',borderColor:'#26c6a0',borderWidth:1,borderRadius:3},{label:'Замовлення',data:names.map(n=>qM(qo)[n]||0),backgroundColor:'#f5c842aa',borderColor:'#f5c842',borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#9a9aa2',font:{size:11},padding:10}}},scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true,max:5}}}});
  const bins=[0,0,0,0,0,0];FIL.forEach(d=>{if(d.qaAvg!=null)bins[Math.min(Math.floor(d.qaAvg),5)]++;});
  barChart('c-qa-dist',['0','1','2','3','4','5'],bins,['#f07070','#f5c842','#f5c842','#38bdf8','#26c6a0','#34d399']);
}
function renderChatCharts() {
  const cpd=tAvg('chatsPerDay'); barChart('c-cpd-t',cpd.map(e=>e[0]),cpd.map(e=>e[1]),cpd.map((_,i)=>C[i%C.length]));
  const cc=tAvg('convChat');     barChart('c-cconv-t',cc.map(e=>e[0]),cc.map(e=>e[1]),cc.map((_,i)=>C[i%C.length]));
}
function renderInbCharts() {
  const cpd=tAvg('callsPerDay'); barChart('c-idpd-t',cpd.map(e=>e[0]),cpd.map(e=>e[1]),cpd.map((_,i)=>C[i%C.length]));
  const ci=tAvg('convInbound');  barChart('c-iconv-t',ci.map(e=>e[0]),ci.map(e=>e[1]),ci.map((_,i)=>C[i%C.length]));
}
function renderOrdCharts() {
  const ot=tAvg('totalOrders');
  mk('c-ord-t',{type:'bar',data:{labels:ot.map(e=>e[0]),datasets:[{data:ot.map(e=>e[1]),backgroundColor:ot.map((_,i)=>C[i%C.length]+'bb'),borderColor:ot.map((_,i)=>C[i%C.length]),borderWidth:1,borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true}},animation:{onComplete:drawLabels}}});
  const st=tAvg('successPct');
  mk('c-suc-t',{type:'bar',data:{labels:st.map(e=>e[0]),datasets:[{data:st.map(e=>e[1]),backgroundColor:st.map((_,i)=>C[i%C.length]+'bb'),borderColor:st.map((_,i)=>C[i%C.length]),borderWidth:1,borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true}},animation:{onComplete:drawLabels}}});
  const top=[...FIL].filter(d=>d.totalOrders!=null).sort((a,b)=>b.totalOrders-a.totalOrders).slice(0,15);
  hBarChart('c-ord-top',top.map(d=>d.name.split(' ').slice(0,2).join(' ')),top.map(d=>d.totalOrders),top.map((_,i)=>C[i%C.length]));
  const src=[...FIL].filter(d=>d.ordFromCalls!=null||d.ordFromChats!=null).sort((a,b)=>(b.ordFromCalls||0)+(b.ordFromChats||0)-((a.ordFromCalls||0)+(a.ordFromChats||0))).slice(0,15);
  mk('c-ord-src',{type:'bar',data:{labels:src.map(d=>d.name.split(' ').slice(0,2).join(' ')),datasets:[{label:'З дзвінків',data:src.map(d=>d.ordFromCalls||0),backgroundColor:'#4b8cf5aa',borderRadius:0},{label:'З чатів',data:src.map(d=>d.ordFromChats||0),backgroundColor:'#26c6a0aa',borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#9a9aa2',font:{size:11}}}},scales:{x:{stacked:true,ticks:{...TK,maxRotation:30,font:{size:10}},grid:{display:false}},y:{stacked:true,ticks:TK,grid:GR,beginAtZero:true}}}});
}
function renderKPICharts() {
  const kt=tAvg('kpiBal_kpi');
  mk('c-kpi-t',{type:'bar',data:{labels:kt.map(e=>e[0]),datasets:[{data:kt.map(e=>e[1]),backgroundColor:kt.map((_,i)=>C[i%C.length]+'bb'),borderColor:kt.map((_,i)=>C[i%C.length]),borderWidth:1,borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true}},animation:{onComplete:drawLabels}}});
  const gl=tAvg('kpiGlass'); barChart('c-kpi-glass',gl.map(e=>e[0]),gl.map(e=>e[1]),gl.map((_,i)=>C[i%C.length]));
  const kpiKeys=[{k:'kpiGlass',l:'Скло'},{k:'kpiBlackSide',l:'Black Side'},{k:'kpiBlocks',l:'Блоки'},{k:'kpiCase',l:'Чохли'},{k:'kpiDG',l:'ДГ'}];
  const teams=[...new Set(FIL.map(d=>d.supervisor||'—'))];
  mk('c-kpi-all',{type:'bar',data:{labels:teams,datasets:kpiKeys.map((kp,i)=>({label:kp.l,data:teams.map(t=>{const v=FIL.filter(d=>(d.supervisor||'—')===t).map(d=>d[kp.k]).filter(x=>x!=null);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):0;}),backgroundColor:C[i]+'88',borderColor:C[i],borderWidth:1,borderRadius:2}))},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#9a9aa2',font:{size:11}}}},scales:{x:{ticks:{...TK,maxRotation:20},grid:{display:false}},y:{ticks:TK,grid:GR,beginAtZero:true}}}});
}
function renderRevCharts() {
  const rt=tAvg('reviewScoreOcinka'); barChart('c-rev-t',rt.map(e=>e[0]),rt.map(e=>e[1]),rt.map((_,i)=>C[i%C.length]),{max:10});
  const recs={};FIL.forEach(d=>{if(d.reviewRecommendation){const k=d.reviewRecommendation.trim().substring(0,35);recs[k]=(recs[k]||0)+1;}});
  const rs=Object.entries(recs).sort((a,b)=>b[1]-a[1]);
  hBarChart('c-rev-rec',rs.map(e=>e[0]),rs.map(e=>e[1]),rs.map((_,i)=>C[i%C.length]));
}

function renderPlan() {
  const sc = {
    'Завершено':    {bg:'rgba(52,211,153,.1)', br:'#34d399',tx:'#34d399',ic:'✓'},
    'В процесі':    {bg:'rgba(245,200,66,.1)', br:'#f5c842',tx:'#f5c842',ic:'◉'},
    'Не розпочато': {bg:'rgba(90,100,128,.08)',br:'#5a6480',tx:'#5a6480',ic:'○'}
  };
  const done=PLAN.filter(p=>p.status==='Завершено').length;
  const prog=PLAN.filter(p=>p.status==='В процесі').length;
  const pend=PLAN.filter(p=>p.status==='Не розпочато').length;
  const el = document.getElementById('plan-kpis');
  if (el) el.innerHTML =
    kpiCard(done,'Завершено','етапів','#34d399')+
    kpiCard(prog,'В процесі','етапів','#f5c842')+
    kpiCard(pend,'Не розпочато','етапів','#5a6480')+
    kpiCard(PLAN.length,'Всього','етапів','#4b8cf5');

  const tl = document.getElementById('plan-timeline');
  if (!tl) return;
  tl.innerHTML = '<div class="tl-wrap"><div class="tl-line"></div>'
    + PLAN.map(p => {
        const s = sc[p.status]||sc['Не розпочато'];
        return '<div class="tl-item">'
          +'<div class="tl-dot" style="border-color:'+s.br+';color:'+s.tx+'">'+s.ic+'</div>'
          +'<div class="tl-card" style="border-left-color:'+s.br+'">'
            +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">'
              +'<div style="flex:1;min-width:180px">'
                +'<div class="tl-name">'+p.stage+'</div>'
                +'<div class="tl-owner">👤 '+p.owner+'</div>'
                +(p.comment?'<div class="tl-comment">💬 '+p.comment+'</div>':'')
              +'</div>'
              +'<div class="tl-right">'
                +'<span class="tl-status" style="background:'+s.bg+';color:'+s.tx+';border-color:'+s.br+'">'+s.ic+' '+p.status+'</span>'
                +'<div class="tl-date">📅 '+p.start+' → '+p.deadline+'</div>'
              +'</div>'
            +'</div>'
          +'</div>'
          +'</div>';
      }).join('')
    + '</div>';
}

/* ─── TAB SWITCH ─── */
function goTab(btn) {
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('p-'+tab).classList.add('on');
  activeTab = tab;
  requestAnimationFrame(() => requestAnimationFrame(() => renderCharts(tab)));
}

/* ─── EMPLOYEE MODAL ─── */
function openEmp(id) {
  const d = ALL.find(r => r._id===id); if (!d) return;
  const cl=rClr(d.result);
  const mRow = (lbl,v,max,c) => {
    if (v==null) return '';
    const p=Math.min(100,v/max*100);
    return '<div class="mbr"><span class="mbrl">'+lbl+'</span><div class="mbrbg"><div class="mbrfill" style="width:'+p+'%;background:'+c+'"></div></div><span class="mbrv" style="color:'+c+'">'+v+'</span></div>';
  };
  const testRows = TEST_LABELS.map((nm,i)=>mRow('Тест '+(i+1)+': '+nm, d['test'+(i+1)], 2, C[i])).join('');
  document.getElementById('emp-body').innerHTML =
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap">'
      +'<div><h2 style="font-size:18px;font-weight:800;margin-bottom:4px">'+d.name+'</h2>'
        +'<div style="font-size:12px;color:var(--t2);display:flex;gap:8px;flex-wrap:wrap">'
          +'<span>'+posTag(d.position)+'</span><span style="color:var(--t3)">·</span><span>'+( d.supervisor||'—')+'</span>'
        +'</div></div>'
      +'<div style="text-align:right"><div style="font-size:42px;font-weight:800;color:'+cl+';line-height:1">'+(d.totalScore!=null?d.totalScore:'—')+'</div>'
        +'<div style="margin-top:5px">'+badge(d.result)+'</div>'
        +'<div style="font-size:11px;color:var(--t3);margin-top:4px">'+rText(d.result)+' (≥80 Поц.Ексн.+, 70-79 Експерт, 65-69 Менеджер, &lt;65 Спеціаліст)</div>'
      +'</div></div>'
    +'<div class="msec"><h4>Загальна інформація</h4><div class="igrid">'
      +'<div class="ii"><div class="k">E-mail</div><div class="vv" style="font-size:11px">'+(d.email||'—')+'</div></div>'
      +'<div class="ii"><div class="k">Дата прийому</div><div class="vv">'+(d.hireDate||'—')+'</div></div>'
      +'<div class="ii"><div class="k">Стаж</div><div class="vv">'+(d.tenureMonths!=null?d.tenureMonths+' міс.':'—')+'</div></div>'
      +'<div class="ii"><div class="k">Бал КПІ (Загальна)</div><div class="vv" style="color:var(--ac)">'+(d.kpiBal||'—')+'</div></div>'
    +'</div></div>'
    +'<div class="msec"><h4>Тести (макс. 2 бали × 6 = 12)</h4>'+testRows
      +(d.testSum!=null?'<div style="margin-top:8px;font-size:12px;color:var(--t2)">Сума: <b style="color:var(--or);font-size:15px">'+d.testSum+'</b>/12</div>':'')
    +'</div>'
    +'<div class="msec"><h4>КЯ — Якість консультацій (макс. 5)</h4>'
      +mRow('Вхідна лінія',d.qaLine,5,'#4b8cf5')+mRow('Чат',d.qaChat,5,'#26c6a0')+mRow('Замовлення',d.qaOrder,5,'#f5c842')
      +(d.qaAvg!=null?'<div style="margin-top:7px;font-size:12px;color:var(--t2)">Середнє: <b style="color:var(--ac)">'+d.qaAvg+'</b>/5</div>':'')
    +'</div>'
    +'<div class="msec"><h4>Чати</h4>'
      +mRow('К-сть чатів',d.totalChats,1000,'#26c6a0')+mRow('Замовлень з чатів',d.ordersFromChats,200,'#f5c842')
      +mRow('Конверсія %',d.convChat,25,'#7b5fe4')+mRow('Чатів на день',d.chatsPerDay,50,'#38bdf8')
    +'</div>'
    +'<div class="msec"><h4>Вхідні дзвінки</h4>'
      +mRow('Вхідних дзвінків',d.inboundCalls,3000,'#4b8cf5')+mRow('Замовлень з дзвінків',d.ordersFromCalls,500,'#f5c842')
      +mRow('Конверсія %',d.convInbound,25,'#7b5fe4')+mRow('Дзвінків на день',d.callsPerDay,50,'#38bdf8')
    +'</div>'
    +'<div class="msec"><h4>Замовлення (Кошик)</h4>'
      +mRow('Всього замовлень',d.totalOrders,2500,'#f07070')+mRow('Успішних',d.successOrders,2500,'#34d399')
      +mRow('% Успішних',d.successPct,100,'#f5c842')+mRow('% Відмов',d.cancelPct,50,'#f07070')
    +'</div>'
    +'<div class="msec"><h4>КПІ — Проникність</h4>'
      +mRow('Скло %',d.kpiGlass,50,'#38bdf8')+mRow('Black Side %',d.kpiBlackSide,70,'#a78bfa')
      +mRow('Блоки %',d.kpiBlocks,30,'#fb923c')+mRow('Чохли %',d.kpiCase,30,'#26c6a0')
      +mRow('ДГ %',d.kpiDG,30,'#4b8cf5')+mRow('ДГ Преміум',d.kpiDGPremium,7,'#f5c842')
      +(d.kpiBal_kpi!=null?'<div style="margin-top:7px;font-size:12px;color:var(--t2)">Бал КПІ (таблиця): <b style="color:var(--ac);font-size:15px">'+d.kpiBal_kpi+'</b></div>':'')
    +'</div>'
    +(d.reviewStrength?'<div class="msec"><h4>Відгук керівника</h4>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
        +'<div class="ii"><div class="k">💪 Сильна сторона</div><div class="vv" style="font-size:12px">'+d.reviewStrength+'</div></div>'
        +'<div class="ii"><div class="k">📌 Рекомендація</div><div class="vv" style="font-size:12px">'+d.reviewRecommendation+'</div></div>'
      +'</div>'
      +(d.reviewRelations?'<div class="ii" style="margin-bottom:8px"><div class="k">Відносини в колективі</div><div class="vv" style="font-size:11px;color:var(--t2)">'+d.reviewRelations+'</div></div>':'')
      +mRow('Оцінка керівника',d.reviewScoreOcinka,10,'#7b5fe4')
    +'</div>':'');
  document.getElementById('emp-ov').classList.add('on');
}

/* ─── FILE UPLOAD ─── */
function onFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {type:'array',cellDates:true});
      if (wb.SheetNames.includes('Загальна')) {
        const nd = parseXLSX(wb);
        if (nd.length) { showDiff(nd, f.name); inp.value=''; return; }
      }
      if (wb.SheetNames.includes('План проведення атестації')) {
        const ws = wb.Sheets['План проведення атестації'];
        const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
        const np = parsePlan(rows);
        if (np.length) { PLAN=np; renderPlan(); const tb=document.querySelector('[data-tab="plan"]'); if(tb) goTab(tb); inp.value=''; return; }
      }
      alert('Файл не розпізнано.\nОчікується Excel-файл з аркушем «Загальна» або «План проведення атестації».');
    } catch(err) { console.error(err); alert('Помилка читання файлу: '+err.message); }
    inp.value='';
  };
  reader.readAsArrayBuffer(f);
}
function findCol(headerRows, matchers, maxRow) {
  // matchers: array of strings to find (case-insensitive substring match)
  // searches first `maxRow` rows for each header text, returns column index or -1
  maxRow = maxRow || headerRows.length;
  const results = {};
  matchers.forEach(m => results[m] = -1);
  for (let r = 0; r < Math.min(maxRow, headerRows.length); r++) {
    const row = headerRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c]||'').trim().toLowerCase();
      if (!cell) continue;
      matchers.forEach(m => {
        if (results[m] === -1 && cell.includes(m.toLowerCase())) results[m] = c;
      });
    }
  }
  return results;
}

function parseXLSX(wb) {
  const sv = v => { if(v==null)return null; if(v instanceof Date)return v.toLocaleDateString('uk-UA'); const s=String(v).trim(); if(s===''||['#N/A','#REF!','#VALUE!','#DIV/0!'].includes(s))return null; const n=parseFloat(s); return isNaN(n)?s:n; };
  const num = v => { if(v==='' || v==null) return null; const x=sv(v); return typeof x==='number'?x:null; };
  const nk = s => String(s||'').trim().toLowerCase().split(/\s+/).join(' ');

  // ───── ЗАГАЛЬНА ─────
  const wsGen = wb.Sheets['Загальна'];
  const genRows = XLSX.utils.sheet_to_json(wsGen,{header:1,defval:null,raw:true});
  // Header is in row index 1 (0-based), data starts at row index 3
  const gh = findCol(genRows, ['продавець','команда','e-mail','прийом','стаж (місяців)','років','посада','1','вхідна лінія','чат','замовлення','вхід','конверсія вхід','чати','конверсія чати','% успішних','к-сть замовлень','відгук керівника','заг. бал'], 3);
  // Tests: columns labeled 1..6 in row index 1, find first numeric "1" header then assume sequential
  let testStart = -1;
  for (let c=0;c<genRows[1].length;c++){
    if (String(genRows[1][c]).trim()==='1') { testStart=c; break; }
  }
  const SKIP=['Бали старі','Бали нові ','Бали нові'];
  const result=[];
  for(let i=3;i<genRows.length;i++){
    const r=genRows[i]; const name=sv(r[0]); if(!name||typeof name!=='string'||!name.trim()) continue;
    const posIdx = gh['посада']>=0?gh['посада']:6;
    const pos=sv(r[posIdx]); if(SKIP.includes(String(pos))) continue;
    const ti = testStart>=0?testStart:11;
    result.push({
      name:name.trim(),
      supervisor:sv(r[gh['команда']>=0?gh['команда']:1]),
      email:sv(r[gh['e-mail']>=0?gh['e-mail']:2]),
      hireDate:sv(r[gh['прийом']>=0?gh['прийом']:3]),
      tenureMonths:num(r[gh['стаж (місяців)']>=0?gh['стаж (місяців)']:4]),
      tenureYears:num(r[gh['років']>=0?gh['років']:5]),
      position:String(pos||'').trim(),
      kpiBal:num(r[9]),
      test1:num(r[ti]),test2:num(r[ti+1]),test3:num(r[ti+2]),test4:num(r[ti+3]),test5:num(r[ti+4]),test6:num(r[ti+5]),
      qaLine:num(r[gh['вхідна лінія']>=0?gh['вхідна лінія']:18]),
      qaChat:num(r[gh['чат']>=0?gh['чат']:19]),
      qaOrder:num(r[gh['замовлення']>=0?gh['замовлення']:20]),
      kpInbound:num(r[gh['вхід']>=0?gh['вхід']:22]),
      kpConvInbound:num(r[gh['конверсія вхід']>=0?gh['конверсія вхід']:23]),
      kpChats:num(r[gh['чати']>=0?gh['чати']:24]),
      kpConvChat:num(r[gh['конверсія чати']>=0?gh['конверсія чати']:25]),
      kpSuccessPct:num(r[gh['% успішних']>=0?gh['% успішних']:26]),
      kpOrders:num(r[gh['к-сть замовлень']>=0?gh['к-сть замовлень']:27]),
      managerScore:num(r[gh['відгук керівника']>=0?gh['відгук керівника']:29]),
      totalScore:num(r[gh['заг. бал']>=0?gh['заг. бал']:30]),
      managerFeedback:'',comment:'',
    });
  }

  // ───── КПІ ─────
  const kpiMap = {};
  if (wb.SheetNames.includes('КПІ')) {
    const wsK = wb.Sheets['КПІ'];
    const kRows = XLSX.utils.sheet_to_json(wsK,{header:1,defval:null,raw:true});
    const kh = findCol(kRows, ['скла','black side','блоків','corning','чохлів','дг','дг преміум','бал'], 1);
    for (let i=1;i<kRows.length;i++){
      const r=kRows[i]; const n=sv(r[0]); if(!n||typeof n!=='string') continue;
      const bal = num(r[kh['бал']>=0?kh['бал']:9]);
      if (bal==null) continue;
      kpiMap[nk(n)] = {
        kpiGlass:num(r[kh['скла']>=0?kh['скла']:1]),
        kpiBlackSide:num(r[kh['black side']>=0?kh['black side']:2]),
        kpiBlocks:num(r[kh['блоків']>=0?kh['блоків']:3]),
        kpiCorning:num(r[kh['corning']>=0?kh['corning']:4]),
        kpiCase:num(r[kh['чохлів']>=0?kh['чохлів']:5]),
        kpiDG:num(r[kh['дг']>=0?kh['дг']:6]),
        kpiDGPremium:num(r[kh['дг преміум']>=0?kh['дг преміум']:7]),
        kpiBal_kpi:bal
      };
    }
  }

  // ───── ЧАТИ ─────
  const chatsMap = {};
  if (wb.SheetNames.includes('Чати')) {
    const wsC = wb.Sheets['Чати'];
    const cRows = XLSX.utils.sheet_to_json(wsC,{header:1,defval:null,raw:true});
    const ch = findCol(cRows, ['продавець','загальна к-сть','к-сть замовлень з чатів','к-сть днів','конверсія з чатів','к-сть чатів на день','бал - к-сть чати','бал конверсія'], 1);
    for (let i=1;i<cRows.length;i++){
      const r=cRows[i]; const n=sv(r[0]); if(!n||typeof n!=='string') continue;
      const tc = num(r[ch['загальна к-сть']>=0?ch['загальна к-сть']:1]);
      if (tc==null) continue;
      chatsMap[nk(n)] = {
        totalChats:tc,
        ordersFromChats:num(r[ch['к-сть замовлень з чатів']>=0?ch['к-сть замовлень з чатів']:2]),
        workDaysOnChats:num(r[ch['к-сть днів']>=0?ch['к-сть днів']:3]),
        convChat: (() => { const v=num(r[ch['конверсія з чатів']>=0?ch['конверсія з чатів']:4]); return v!=null?+(v*100).toFixed(1):null; })(),
        chatsPerDay: (() => { const v=num(r[ch['к-сть чатів на день']>=0?ch['к-сть чатів на день']:5]); return v!=null?+v.toFixed(1):null; })(),
        balChats:num(r[ch['бал - к-сть чати']>=0?ch['бал - к-сть чати']:7]),
        balConvChat:num(r[ch['бал конверсія']>=0?ch['бал конверсія']:8]),
      };
    }
  }

  // ───── ВХІД ─────
  const inbMap = {};
  if (wb.SheetNames.includes('Вхід')) {
    const wsI = wb.Sheets['Вхід'];
    const iRows = XLSX.utils.sheet_to_json(wsI,{header:1,defval:null,raw:true});
    const ih = findCol(iRows, ['продавець','кількість вхідних','всього вхід','дз. день','к--сть замовлень з дзвінка','конверсія з вхідних','бал - к-сть вхід'], 2);
    let dataStart = 2;
    for (let i=1;i<iRows.length;i++){
      const r=iRows[i]; const n=sv(r[0]); if(!n||typeof n!=='string') continue;
      if (n.trim()==='Продавець:'||n.trim()==='Продавець') continue;
      const ic = num(r[ih['кількість вхідних']>=0?ih['кількість вхідних']:1]);
      if (ic==null) continue;
      inbMap[nk(n)] = {
        inboundCalls:ic,
        totalInbound:num(r[ih['всього вхід']>=0?ih['всього вхід']:6]),
        callsPerDay: (() => { const v=num(r[ih['дз. день']>=0?ih['дз. день']:10]); return v!=null?+v.toFixed(1):null; })(),
        ordersFromCalls:num(r[ih['к--сть замовлень з дзвінка']>=0?ih['к--сть замовлень з дзвінка']:12]),
        convInbound: (() => { const v=num(r[ih['конверсія з вхідних']>=0?ih['конверсія з вхідних']:13]); return v!=null?+(v*100).toFixed(1):null; })(),
        balInbound:num(r[ih['бал - к-сть вхід']>=0?ih['бал - к-сть вхід']:15]),
        balConvInbound:num(r[16]),
      };
    }
  }

  // ───── КОШИК ─────
  const koshykMap = {};
  if (wb.SheetNames.includes('Кошик')) {
    const wsB = wb.Sheets['Кошик'];
    const bRows = XLSX.utils.sheet_to_json(wsB,{header:1,defval:null,raw:true});
    const bh = findCol(bRows, ['продавець','всього заявок','успішні','% усп','% відмови','оцінка успішність','оцінка кількість','замовлення з дзвінка','замовлення з чату'], 1);
    for (let i=1;i<bRows.length;i++){
      const r=bRows[i]; const n=sv(r[0]); if(!n||typeof n!=='string') continue;
      const to = num(r[bh['всього заявок']>=0?bh['всього заявок']:2]);
      if (to==null) continue;
      koshykMap[nk(n)] = {
        totalOrders:to,
        successOrders:num(r[bh['успішні']>=0?bh['успішні']:4]),
        successPct: (() => { const v=num(r[bh['% усп']>=0?bh['% усп']:9]); return v!=null?+(v*100).toFixed(1):null; })(),
        cancelPct: (() => { const v=num(r[bh['% відмови']>=0?bh['% відмови']:10]); return v!=null?+(v*100).toFixed(1):null; })(),
        scoreSuccess:num(r[bh['оцінка успішність']>=0?bh['оцінка успішність']:11]),
        scoreQty:num(r[bh['оцінка кількість']>=0?bh['оцінка кількість']:12]),
        ordFromCalls:num(r[bh['замовлення з дзвінка']>=0?bh['замовлення з дзвінка']:14]),
        ordFromChats:num(r[bh['замовлення з чату']>=0?bh['замовлення з чату']:15]),
      };
    }
  }

  // ───── ВІДГУК КЕРІВНИКА ─────
  const reviewMap = {};
  if (wb.SheetNames.includes('Відгук керівника')) {
    const wsR = wb.Sheets['Відгук керівника'];
    const rRows = XLSX.utils.sheet_to_json(wsR,{header:1,defval:null,raw:true});
    const rh = findCol(rRows, ['відносини в колективі','дисципліна','ініціативність','сильна сторона','пі працівника','рекомендація','к-сть балів','оцінка'], 1);
    // Name column: find header containing "ПІ працівника"
    const nameCol = rh['пі працівника']>=0 ? rh['пі працівника'] : 8;
    for (let i=1;i<rRows.length;i++){
      const r=rRows[i]; const n=sv(r[nameCol]); if(!n||typeof n!=='string') continue;
      reviewMap[nk(n)] = {
        reviewRelations:String(r[rh['відносини в колективі']>=0?rh['відносини в колективі']:1]||'').slice(0,120),
        reviewDiscipline:String(r[rh['дисципліна']>=0?rh['дисципліна']:2]||'').slice(0,120),
        reviewInitiative:String(r[rh['ініціативність']>=0?rh['ініціативність']:3]||'').slice(0,120),
        reviewStrength:String(r[rh['сильна сторона']>=0?rh['сильна сторона']:7]||'').slice(0,60),
        reviewRecommendation:String(r[rh['рекомендація']>=0?rh['рекомендація']:9]||'').slice(0,80),
        reviewScorePts:num(r[rh['к-сть балів']>=0?rh['к-сть балів']:10]),
        reviewScoreOcinka:num(r[rh['оцінка']>=0?rh['оцінка']:11]),
      };
    }
  }

  // ───── MERGE ─────
  const merged = enrich(result).map(e => {
    const k = nk(e.name);
    const extra = Object.assign({}, kpiMap[k]||{}, chatsMap[k]||{}, inbMap[k]||{}, koshykMap[k]||{}, reviewMap[k]||{});
    const out = Object.assign({}, e, extra);
    if (!out.managerScore && out.reviewScoreOcinka) out.managerScore = out.reviewScoreOcinka;
    // re-run enrich-derived fields since extra fields don't affect qaAvg/testSum/result, but result depends on totalScore which is unchanged
    return out;
  });

  return merged;
}
function parsePlan(rows) {
  const fmtDate = v => {
    if (v==null) return '';
    if (v instanceof Date) return v.toLocaleDateString('uk-UA');
    const s = String(v).trim();
    const d = new Date(s);
    if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(s)) return d.toLocaleDateString('uk-UA');
    return s.slice(0,10);
  };
  const res=[]; let hi=-1, ci=-1;
  for(let i=0;i<Math.min(5,rows.length);i++){
    if(!rows[i]) continue;
    const idx = rows[i].findIndex(c=>String(c||'').trim()==='Етап');
    if (idx>=0) { hi=i; ci=idx; break; }
  }
  if(hi<0) return [];
  for(let i=hi+1;i<rows.length;i++){
    const r=rows[i]; const s=String(r[ci]||'').trim(); if(!s)continue;
    res.push({stage:s,owner:String(r[ci+1]||'').trim(),start:fmtDate(r[ci+2]),deadline:fmtDate(r[ci+3]),status:String(r[ci+4]||'').trim(),comment:String(r[ci+5]||'').trim()});
  }
  return res;
}
function showDiff(nd, fn) {
  const om=new Map(ALL.map(d=>[d.email||d.name,d]));
  const nm=new Map(nd.map(d=>[d.email||d.name,d]));
  const added=nd.filter(d=>!om.has(d.email||d.name));
  const removed=ALL.filter(d=>!nm.has(d.email||d.name));
  const changed=nd.filter(d=>{const o=om.get(d.email||d.name);return o&&o.totalScore!==d.totalScore;});
  pendingData={data:nd,fn};
  const items=[...added.map(d=>({t:'a',n:d.name,i:'новий'})),...removed.map(d=>({t:'d',n:d.name,i:'видалено'})),...changed.map(d=>{const o=om.get(d.email||d.name);return{t:'c',n:d.name,i:'бал: '+(o.totalScore)+'→'+(d.totalScore)};})];
  document.getElementById('diff-body').innerHTML =
    '<h2 style="font-size:17px;font-weight:700;margin-bottom:4px">Оновлення даних</h2>'
    +'<p style="font-size:12px;color:var(--t2);margin-bottom:14px">'+fn+' · '+nd.length+' записів</p>'
    +(items.length?
      '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
        +(added.length?'<span class="bdg bg">+'+added.length+' нових</span>':'')
        +(removed.length?'<span class="bdg br">−'+removed.length+' видалено</span>':'')
        +(changed.length?'<span class="bdg by">✎ '+changed.length+' змінено</span>':'')
      +'</div>'
      +'<div style="max-height:240px;overflow-y:auto;margin-bottom:14px">'
        +items.slice(0,20).map(it=>'<div class="dfrow"><span class="dftag '+(it.t==='a'?'dfa':it.t==='d'?'dfd':'dfc')+'">'+(it.t==='a'?'+':it.t==='d'?'−':'✎')+'</span><span>'+it.n+'</span><span style="color:var(--t3);font-size:11px;margin-left:auto">'+it.i+'</span></div>').join('')
        +(items.length>20?'<div style="color:var(--t3);font-size:11px;padding:6px">…ще '+(items.length-20)+'</div>':'')
      +'</div>'
    : '<p style="color:var(--t2);margin-bottom:14px;font-size:12px">Змін не виявлено.</p>')
    +'<div style="display:flex;gap:8px"><button class="btn btn-p" onclick="confirmUpd()">✓ Підтвердити</button><button class="btn btn-g" style="flex:1" onclick="document.getElementById(\'diff-ov\').classList.remove(\'on\')">Скасувати</button></div>';
  document.getElementById('diff-ov').classList.add('on');
}
function confirmUpd() {
  if (!pendingData) return;
  ALL=pendingData.data;
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const updNow = pad(now.getDate())+'.'+pad(now.getMonth()+1)+'.'+now.getFullYear()+' '+pad(now.getHours())+':'+pad(now.getMinutes());
  document.getElementById('meta').textContent='Атестація Літо 2026 · '+ALL.length+' співробітників · Оновлено: '+updNow;
  pendingData=null;
  document.getElementById('diff-ov').classList.remove('on');
  buildFilters(); applyFilters();
}

/* ─── CHANGELOG ─── */
function openChangelog() {
  document.getElementById('cl-body').innerHTML =
    '<h2 style="margin-bottom:14px">📜 Історія змін</h2>'
    + RELEASES.map(r =>
        '<div class="cl-rel"><h3>'+xss(r.ver)+'</h3>'
        + '<div class="cl-date">'+xss(r.date)+'</div>'
        + '<ul>'+r.notes.map(n=>'<li>'+xss(n)+'</li>').join('')+'</ul></div>'
      ).join('');
  document.getElementById('cl-ov').classList.add('on');
}

/* ─── EXPORT ─── */
function exportCSV() {
  const h=['Імя','Команда','Посада','Прийом','Стаж(міс)','Бал КПІ','Тест1','Тест2','Тест3','Тест4','Тест5','Тест6','∑Тести','КЯ Лін','КЯ Чат','КЯ Зам','КЯ сер','Чатів','Зам.з чатів','Конв.чат%','Вхідних','Зам.з дзв','Конв.вхід%','Всього зам','Успішних','%Успіх','%Відмов','Скло%','BlackSide%','Блоки%','Чохли%','ДГ%','Бал КПІ(таб)','Відгук','Сила','Рекомендація','Заг.бал','Результат'];
  const rows=FIL.map(d=>[d.name,d.supervisor,d.position,d.hireDate,d.tenureMonths,d.kpiBal,d.test1,d.test2,d.test3,d.test4,d.test5,d.test6,d.testSum,d.qaLine,d.qaChat,d.qaOrder,d.qaAvg,d.totalChats,d.ordersFromChats,d.convChat,d.inboundCalls,d.ordersFromCalls,d.convInbound,d.totalOrders,d.successOrders,d.successPct,d.cancelPct,d.kpiGlass,d.kpiBlackSide,d.kpiBlocks,d.kpiCase,d.kpiDG,d.kpiBal_kpi,d.managerScore,d.reviewStrength,d.reviewRecommendation,d.totalScore,rText(d.result)]);
  const csv=[h,...rows].map(r=>r.map(v=>v==null?'':(String(v).includes(',')?'"'+v+'"':v)).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download='attestation_export.csv';a.click();
}

/* ─── HELPERS ─── */
function badge(r){const m={expert_plus:'<span class="bdg bep">⭐ Потенц. Експерт+</span>',expert:'<span class="bdg bex">🔵 Експерт</span>',manager:'<span class="bdg bmg">🟡 Менеджер</span>',specialist:'<span class="bdg bsp">🔴 Спеціаліст</span>',none:'<span class="bdg bx">— Без балу</span>'};return m[r]||m.none;}
function rClr(r){return{expert_plus:'var(--ep)',expert:'var(--ac)',manager:'var(--ye)',specialist:'var(--re)',none:'var(--gy)'}[r]||'var(--gy)';}
function rText(r){return{expert_plus:'Потенц.Експерт+',expert:'Експерт',manager:'Менеджер',specialist:'Спеціаліст',none:'Без балу'}[r]||'';}
function posTag(p){if(!p)return'<span style="color:var(--t3)">—</span>';const c=p.includes('Менеджер')?'var(--ac)':p.includes('Спеціаліст')?'var(--ac3)':p.includes('+')?'var(--re)':'var(--ye)';const s=p.includes('Менеджер')?'Менеджер':p.includes('Спеціаліст')?'Спеціаліст':p.includes('+')?'Експерт+':'Експерт';return'<span style="color:'+c+';font-weight:600">'+s+'</span>';}
function xss(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&(f.name.endsWith('.xlsx')||f.name.endsWith('.xls'))){const dt=new DataTransfer();dt.items.add(f);document.getElementById('fi').files=dt.files;onFile(document.getElementById('fi'));}});
