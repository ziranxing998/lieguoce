#!/usr/bin/env node
/* build-check.js — 《列国策》单文件构建校验（主线三步自动验收）
 * 退出码 0 = 全部通过；非 0 = 列出所有失败项 */
const fs = require('fs');
const path = require('path');
const failures = [];
const ok = (name) => console.log('  ✓ ' + name);
const bad = (name, detail) => { failures.push(name + (detail ? '：' + detail : '')); console.log('  ✗ ' + name + (detail ? '：' + detail : '')); };

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------- 第 0 步：结构与语法 ---------- */
console.log('[0] 结构与语法');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length >= 2) ok('脚本块 ' + blocks.length + ' 段'); else bad('脚本块数量', '期望 ≥2，实际 ' + blocks.length);
const os = require('os');
blocks.forEach((b, i) => {
  const f = path.join(os.tmpdir(), 'lgc-check-' + i + '.js');
  fs.writeFileSync(f, b);
  const r = require('child_process').spawnSync(process.execPath, ['--check', f]);
  if (r.status === 0) ok('脚本块 ' + i + ' 语法'); else bad('脚本块 ' + i + ' 语法', String(r.stderr).split('\n')[0]);
});
if (!/src="(vendor|assets)\//.test(html)) ok('零外部资源引用'); else bad('存在外部资源引用（单文件托管下 403）');
if (html.length <= 1.5 * 1024 * 1024) ok('体积预算内 (' + Math.round(html.length / 1024) + 'KB / 1536KB)'); else bad('超出 1.5MB 预算');

/* ---------- 第 1 步：主线入口（主菜单 → 进入游戏） ---------- */
console.log('[1] 主线入口：登录 → 择国 → 入世');
const game = blocks[blocks.length - 1];
const flowFns = ['boot', 'restoreAuth', 'showAuth', 'phoneLogin', 'wbLogin', 'sendSms', 'enterLoggedIn', 'renderSetup', 'startGame', 'enterWorld', 'renderAll'];
for (const fn of flowFns) (game.includes('function ' + fn) || game.includes('(' + fn + ')')) ? ok('入口函数 ' + fn) : bad('入口函数缺失 ' + fn);
// boot 必须在 await 前完成全部按钮绑定（登录无反应教训）
const bootIdx = game.indexOf('(async function boot(){');
const bootHead = game.slice(bootIdx, bootIdx + 1400);
const binds = ['btnWbLogin', 'btnPhoneLogin', 'btnSms', 'btnSpectate', 'btnStart', 'soundBtn'];
for (const id of binds) bootHead.includes(id) ? ok('boot 即时绑定 ' + id) : bad('boot 未即时绑定 ' + id, '慢网络下点击无响应');
if (bootHead.indexOf('await restoreAuth') === -1 || bootHead.indexOf('await restoreAuth') > bootHead.indexOf('btnWbLogin')) ok('绑定先于 await'); else bad('boot 绑定排在 await 之后');

/* ---------- 第 2 步：设计内容全量可达 ---------- */
console.log('[2] 设计内容：十大系统全部接线');
const systems = [
  ['国策诏（AI+模板兜底）', ['llmDecree', 'templateDecreeFull', 'ensureDecree']],
  ['办差（开工→办理→验收）', ['startTask', 'settleTask', 'player_tasks', 'bump_nation_dim']],
  ['上书/议政案', ['pickMemo', 'submitYian']],
  ['方略树', ['pushFanglue', 'renderFang']],
  ['会战（任意两国）', ['maybeStartWar', 'settleWar', 'getWarNodes', 'WAR_CAPITALS']],
  ['外交斡旋', ['mediate', 'diplo']],
  ['赛季结算与史书', ['seasonSettle', "nation_key:'tianxia'"]],
  ['客卿 BYO', ['keqingCall', 'renderKeqing']],
  ['摄政', ['_regentId']],
  ['功绩簿/反馈/规则', ['renderMerit', 'submitFeedback', 'toggleRules']],
  ['旬制7日节奏', ['XUN_MS', 'xun_started_at', 'renderDaily', 'DAILY_EVENTS']],
  ['君上晨谕（AI 每日批语）', ['ensureDailyEdict', 'llmDailyEdict', 'daily_edicts']],
];
for (const [name, needles] of systems) {
  const miss = needles.filter(n => !game.includes(n));
  miss.length === 0 ? ok('系统 ' + name) : bad('系统 ' + name, '缺 ' + miss.join(','));
}
// 七国元数据完整（人格 p / 偏好 bias / 内嵌画像 img）
for (const n of ['qin', 'qi', 'chu', 'yan', 'zhao', 'wei', 'han']) {
  const m = game.match(new RegExp(n + ':\\{[^}]*\\}'));
  if (!m) { bad('NATION_META.' + n, '未找到'); continue; }
  const seg = m[0];
  (seg.includes("p:'") && seg.includes("bias:'") && seg.includes("img:'data:image")) ? ok('七国 ' + n + ' 人格/偏好/画像') : bad('七国 ' + n + ' 元数据不全', ['p', 'bias', 'img'].filter(k => !seg.includes(k === 'img' ? "img:'data:image" : k + ":'")).join('/'));
}

/* ---------- 第 3 步：失败可自诊断 ---------- */
console.log('[3] 失败自诊断：常驻错误路径 + SDK 回退');
const diag = ['showAuth(', "authHint').textContent", 'handleWorkBuddyCallback', '授权页返回错误', '凭证丢失', 'SDK 未就绪'];
for (const d of diag.slice(0, 5)) game.includes(d) || html.includes(d) ? ok('诊断路径 ' + d.slice(0, 18)) : bad('诊断路径缺失 ' + d);
if (!/from showLoading|hideLoading\(\)\s*\n\s*\}\s*$/.test(game)) {
  // 每个早退分支后 hideLoading 覆盖抽查
  const earlyExits = (game.match(/showLoading\(/g) || []).length;
  const hides = (game.match(/hideLoading\(\)/g) || []).length;
  hides >= earlyExits ? ok('加载遮罩均有退出 (' + hides + ' hide / ' + earlyExits + ' show)') : bad('加载遮罩可能卡死', hides + ' hide < ' + earlyExits + ' show');
}
// SDK 容错：cloud 未就绪时登录页有提示而非白屏
if (game.includes('SDK 未就绪') || game.includes('卷轴未展')) ok('SDK 失败兜底提示'); else bad('SDK 失败无兜底提示');
// dbRead 必须先 .select() 再交给回调（eq/order 只在 select 构建器上——q.eq is not a function 教训）
const dbReadBody = game.slice(game.indexOf('async function dbRead'), game.indexOf('async function dbRead') + 300);
/dbRead[\s\S]*?from\(table\)\.select\(/.test(game) ? ok('dbRead 先 select 再过滤') : bad('dbRead 缺 select 前置', '过滤方法调用将报 q.eq is not a function');
if (dbReadBody.includes('.select(')) ok('dbRead 实现体含 select'); else bad('dbRead 实现体缺 select');

/* ---------- 历史教训回归（硬编码残留检索） ---------- */
console.log('[4] 历史教训回归');
const ghosts = [['qin_win', 0], ['chu_win', 0], ['楚军守御', 0], ['秦军攻克', 0]];
for (const [w, max] of ghosts) {
  const c = (game.match(new RegExp(w, 'g')) || []).length;
  c <= max ? ok('无残留 ' + w) : bad('硬编码残留 ' + w, c + ' 处');
}
const qinCalls = (game.match(/loadNation\('qin'\)/g) || []).length;
qinCalls <= 3 ? ok('loadNation(qin) 仅合法保留 ' + qinCalls + ' 处') : bad('loadNation(qin) 疑似硬编码', qinCalls + ' 处');

console.log('');
if (failures.length) { console.log('构建校验：FAIL（' + failures.length + ' 项）'); process.exit(1); }
console.log('构建校验：全部通过（build OK）'); process.exit(0);
