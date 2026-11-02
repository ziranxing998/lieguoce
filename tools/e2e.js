/* e2e.js — 《列国策》机器测试员：真实浏览器全链路测试
 * 用法: node e2e.js [过滤词]
 * 每项测试：步骤+断言；任何 pageerror/console error 记为失败证据。
 */
const { firefox } = require('playwright');

const URL = 'https://liguoce-trial.app.workbuddy.host/?sharecode=ERWXTHQTQQ';
const filter = process.argv[2] || '';

const results = [];
const pageErrors = [];
async function step(name, fn){
  if(filter && !name.includes(filter)){ return; }
  const t0 = Date.now();
  try{
    await fn();
    results.push(['✓', name, Date.now()-t0]);
  }catch(e){
    results.push(['✗', name + ' —— ' + (e.message||e).split('\n')[0].slice(0,220), Date.now()-t0]);
  }
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));

(async()=>{
  const browser = await firefox.launch({ headless:true });
  const ctx = await browser.newContext({ viewport:{width:1380, height:860} });
  const page = await ctx.newPage();
  page.on('pageerror', e=>pageErrors.push('pageerror: '+(e.message||e).slice(0,200)));
  page.on('console', m=>{ if(m.type()==='error') pageErrors.push('console: '+m.text().slice(0,200)); });

  await step('T1 打开线上游戏', async()=>{
    await page.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
  });

  await step('T2 登录屏元素齐全（双通道+观政入口）', async()=>{
    await page.waitForSelector('#auth', { state:'visible', timeout:45000 });
    const st = await page.evaluate(()=>({
      wb: !!document.getElementById('btnWbLogin'),
      sms: !!document.getElementById('btnPhoneLogin') && !!document.getElementById('btnSms'),
      spec: !!document.getElementById('btnSpectate'),
    }));
    if(!st.wb||!st.sms||!st.spec) throw new Error('登录元素缺失 '+JSON.stringify(st));
  });

  await step('T3 程序化建号入世（等同游客数据路径）', async()=>{
    const who = await page.evaluate(async()=>{
      const origin0 = ['chu','qin','qi','wei','zhao','yan','han'][Math.floor(Math.random()*7)];
      const { data, error } = await cloud.database.from('players').insert({
        token:guestToken(), name:'E2E测试士', nation_key:origin0, prestige:0,
      }).select();
      if(error) throw new Error('insert: '+(error.message||error));
      player = data[0];
      localStorage.setItem('lgc_memo_'+player.token, '[]');
      document.body.classList.remove('setup-bg');
      document.getElementById('auth').style.display='none';
      document.getElementById('game').style.display='block';
      await enterWorld(); enterScene();
      return { nation: player.nation_key, hasNation: !!nation };
    });
    if(!who.hasNation) throw new Error('nation 未就绪 '+JSON.stringify(who));
    await page.waitForSelector('#sceneCanvas', { state:'visible', timeout:20000 });
  });

  await step('T4 场景就绪（画布+角色+镜头变量）', async()=>{
    await page.waitForSelector('#sceneCanvas', { state:'visible', timeout:15000 });
    const st = await page.evaluate(()=>({ hasP: !!window._scenePlayer, cam: typeof camX==='number' }));
    if(!st.hasP || !st.cam) throw new Error('场景未就绪 '+JSON.stringify(st));
  });

  await step('T5 驻留自动开工（传送到采石场→1.5s自动采集）', async()=>{
    await page.evaluate(()=>{ const d=bDoor(sceneBuildingOf('quarry')); window._scenePlayer.x=d.x; window._scenePlayer.y=d.y+6; });
    await sleep(2600);
    const st = await page.evaluate(()=>({
      panel: getComputedStyle(document.getElementById('bMask')).display,
      title: (document.getElementById('bmTitle')||{}).textContent,
      running: (window._myTaskRows||[]).some(x=>x.dim==='gather'&&x.status==='running'),
    }));
    if(!st.running) throw new Error('未自动开工 '+JSON.stringify(st));
  });

  await step('T6 采集结算（回拨工时→点结算→断言入库+余额）', async()=>{
    // 回拨【本 token】的 running 采集行 started_at 5 分钟
    await page.evaluate(async()=>{
      const rows = await cloud.database.from('player_tasks').select('*').eq('dim','gather').eq('status','running');
      const mine = (rows.data||[]).filter(r=>r.token===player.token);
      const row = mine[0];
      if(!row) throw new Error('无本号进行中采集 rows='+(rows.data||[]).length);
      await cloud.database.from('player_tasks').update({ started_at: new Date(Date.now()-5*60000).toISOString() }).eq('id', row.id);
    });
    // 重开采集面板（重读 DB 的 started_at）→ 点结算
    await page.evaluate(()=>openBuilding('quarry'));
    await page.waitForSelector('button[data-gstop]', { state:'visible', timeout:15000 });
    await page.click('button[data-gstop]');
    await sleep(2500);
    const st = await page.evaluate(()=>({ res: player.resources||'', toast: (document.getElementById('toast')||{}).textContent }));
    const res = JSON.parse(st.res||'{}');
    if(!(res.stone>0)) throw new Error('石料未入私产 res='+st.res+' toast='+st.toast);
    if(!(st.toast||'').includes('入库')) throw new Error('无入库提示 toast='+st.toast);
    // 关面板，还场景给 T7
    await page.evaluate(()=>{ if(window._bmOpen) closeBuilding(); });
  });

  await step('T7 朝堂面板（传送→按E→上书/晨谕元素在）', async()=>{
    await page.evaluate(()=>{ if(window._bmOpen) closeBuilding(); });
    await page.evaluate(()=>{ const d=bDoor(sceneBuildingOf('chaotang')); window._scenePlayer.x=d.x; window._scenePlayer.y=d.y+8; });
    await sleep(500); // 等场景循环跑一帧刷新 sceneNear
    await page.keyboard.press('e');
    await sleep(1500);
    const st = await page.evaluate(()=>({ open: getComputedStyle(document.getElementById('bMask')).display, title:(document.getElementById('bmTitle')||{}).textContent, body:(document.getElementById('bmBody')||{}).innerHTML||'' }));
    if(st.open==='none') throw new Error('朝堂面板未打开');
    if(st.title!=='朝堂') throw new Error('面板不是朝堂 title='+st.title);
    if(!st.body.includes('memo') && !st.body.includes('上书')) throw new Error('朝堂内容异常 title='+st.title);
  });

  await step('T8 零页面错误（整场无 JS 异常）', async()=>{
    const sceneErr = await page.evaluate(()=>{ const t=document.getElementById('sceneTip'); return t&&t.textContent.includes('场景异常')?t.textContent:null; });
    if(pageErrors.length) throw new Error(pageErrors.slice(0,3).join(' | '));
    if(sceneErr) throw new Error(sceneErr);
  });

  await browser.close();
  let fail = 0;
  console.log('\n═══ E2E 测试报告 ═══');
  for(const [mark, name, ms] of results){ if(mark==='✗') fail++; console.log(mark, name, '('+Math.round(ms/1000)+'s)'); }
  console.log(fail===0 && results.length ? '全部通过 ✓' : ('失败 '+fail+'/'+results.length));
  process.exit(fail===0?0:1);
})().catch(e=>{ console.log('测试架异常:', (e.message||e).slice(0,300)); process.exit(2); });
