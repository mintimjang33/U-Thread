const http = require('http');
const { loadConfig } = require('./config');
const { getClaudeAccountEmail } = require('./generate');
const { closeBrowser } = require('./collectBenchmark');

const PORT = 5757;
const MAX_LOG_LINES = 300;
const logs = [];
let status = { state: 'starting', claudeEmail: null, apiBase: null, currentJob: null, threadsLoggedIn: null, threadsCheckedAt: null };

function pushLog(line) {
  logs.push({ time: new Date().toLocaleTimeString('ko-KR'), text: String(line) });
  if (logs.length > MAX_LOG_LINES) logs.shift();
}

function setStatus(patch) {
  status = { ...status, ...patch };
}

// console.log/error를 가로채서 대시보드 로그에도 남긴다(터미널 출력은 그대로 유지).
function hookConsole() {
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => {
    pushLog(args.map(String).join(' '));
    origLog(...args);
  };
  console.error = (...args) => {
    pushLog('❌ ' + args.map(String).join(' '));
    origError(...args);
  };
}

async function handleCollectAction(body) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const keyword = (body?.keyword || '').trim();
  if (!keyword) throw new Error('키워드를 입력하세요.');

  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ type: 'collect_benchmark', input: { keyword, maxScrolls: 5 } }),
  });
  if (!res.ok) throw new Error(`작업 생성 실패 (${res.status})`);
  const { job } = await res.json();
  pushLog(`[대시보드] "${keyword}" 원본 수집 작업 등록 완료(${job.id.slice(0, 8)}) — 곧 처리됩니다.`);
  return job;
}

async function handleCheckAccountAction() {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');

  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ type: 'check_threads_login', input: {} }),
  });
  if (!res.ok) throw new Error(`작업 생성 실패 (${res.status})`);
  const { job } = await res.json();
  pushLog(`[대시보드] 쓰레드 계정 연결 확인 작업 등록(${job.id.slice(0, 8)}) — 곧 처리됩니다.`);
  return job;
}

async function handleRecheckAction() {
  logs.length = 0; // 재연결하면 로그를 비우고 새로 시작 — 예전 로그와 섞여서 헷갈리지 않게.
  pushLog('[대시보드] 재연결 시작...');

  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const email = await getClaudeAccountEmail();
  setStatus({ claudeEmail: email, apiBase: config.apiBase });
  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    headers: { Authorization: `Bearer ${config.token}`, ...(email ? { 'X-Claude-Account': email } : {}) },
  });
  if (!res.ok) throw new Error(`서버 연결 실패 (${res.status})`);
  pushLog(`[대시보드] 재연결 확인 완료 — 클로드 계정: ${email || '확인 안 됨'}`);
  return email;
}

// 왼쪽 메뉴 구조 — 참고 앱(쓰레드 자동화 챌린지)의 사이드바를 그대로 매핑.
// ready:true인 것만 실제로 동작하고, 나머지는 "준비 중" 화면만 보여준다(안 되는 걸 되는 척하지 않음).
const NAV_SECTIONS = [
  {
    label: '오늘',
    items: [
      { id: 'status', label: '현황', ready: true },
      { id: 'daily', label: '일상글 올리기', ready: false },
      { id: 'shopping', label: '쇼핑글 올리기', ready: false },
      { id: 'schedule', label: '예약', ready: false },
      { id: 'custom', label: '직접 소싱(커스텀)', ready: false },
      { id: 'clone', label: '채널 복제', ready: false },
      { id: 'revenue', label: '수익', ready: false },
      { id: 'review', label: '검수', ready: false },
      { id: 'toss', label: '토스링크(테스트)', ready: false },
    ],
  },
  {
    label: '준비',
    items: [
      { id: 'ideas', label: '글감 창고', ready: false },
      { id: 'account', label: '계정', ready: true },
      { id: 'persona', label: '페르소나', ready: false },
      { id: 'coupang', label: '쿠파스 API 연결', ready: false },
    ],
  },
];

const PAGE = () => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>유쓰레드 로컬 워커</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Malgun Gothic", sans-serif; background: #f7f7f8; margin: 0; color: #1a1a1a; }
  .shell { display: flex; min-height: 100vh; }
  .sidebar { width: 200px; flex-shrink: 0; background: #17151f; color: #eee; padding: 18px 0; }
  .sidebar .brand { padding: 0 18px 16px; font-weight: 900; font-size: 15px; border-bottom: 1px solid #302c3d; margin-bottom: 10px; }
  .sidebar .brand .sub { font-size: 11px; color: #8b87a0; font-weight: 400; margin-top: 2px; }
  .navsec { margin-bottom: 16px; }
  .navsec .navlabel { font-size: 10px; color: #6f6b85; font-weight: 900; padding: 6px 18px; letter-spacing: .04em; }
  .navitem { display: flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 12.5px; font-weight: 700; cursor: pointer; color: #cfccdd; }
  .navitem:hover { background: #221f2e; }
  .navitem.active { background: #6d28d9; color: #fff; }
  .navitem .badge { font-size: 9px; color: #6f6b85; }
  .navitem.active .badge { color: #d8ccff; }
  .main { flex: 1; padding: 24px 28px; min-width: 0; }
  .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px; margin-bottom: 16px; max-width: 720px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #888; font-size: 12px; margin-bottom: 16px; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
  .dot.off { background: #d4d4d4; }
  .dot.warn { background: #f59e0b; }
  .label { color: #888; width: 110px; flex-shrink: 0; }
  button { background: #6d28d9; color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  button.secondary { background: #fff; color: #333; border: 1px solid #ddd; }
  button:disabled { opacity: .5; cursor: default; }
  input[type=text] { border: 1px solid #ddd; border-radius: 8px; padding: 9px 12px; font-size: 13px; flex: 1; }
  .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .logbar { display: flex; align-items: center; justify-content: space-between; max-width: 720px; margin-bottom: 6px; }
  .logbar span { font-size: 12px; font-weight: 700; color: #555; }
  #logs { max-width: 720px; height: 280px; overflow-y: auto; background: #111; color: #ddd; font-family: Consolas, monospace; font-size: 12px; padding: 12px; border-radius: 10px; box-sizing: border-box; }
  .logline { white-space: pre-wrap; word-break: break-all; margin-bottom: 2px; }
  .time { color: #666; }
  #msg { font-size: 12px; color: #6d28d9; margin-top: 8px; min-height: 16px; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .soon { max-width: 480px; border: 1px dashed #d8d4e0; border-radius: 10px; padding: 28px 20px; text-align: center; color: #8b87a0; background: #fff; }
  .soon .emoji { font-size: 26px; margin-bottom: 8px; }
  .soon .title { font-weight: 900; color: #444; font-size: 14px; margin-bottom: 4px; }
  .steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .step { position: relative; width: 92px; border: 1px solid #e5e5e5; border-radius: 10px; padding: 10px 6px; text-align: center; background: #fafafa; }
  .step.done { border-color: #86efac; background: #f0fdf4; }
  .step.active { border-color: #f59e0b; background: #fffbeb; }
  .step .emoji { font-size: 20px; }
  .step .label { font-size: 11px; font-weight: 800; color: #333; margin-top: 4px; width: auto; }
  .step .sub2 { font-size: 10px; color: #999; margin-top: 2px; }
  .step .badge2 { position: absolute; top: -6px; right: -6px; font-size: 13px; }
  .arrow { color: #ccc; font-size: 14px; }
  .checkitem { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 12.5px; }
  .checkitem:last-child { border-bottom: none; }
  .checkitem .ci-title { font-weight: 800; }
  .checkitem.ok .ci-title { color: #16a34a; }
  .checkitem.bad .ci-title { color: #dc2626; }
  .checkitem .ci-desc { color: #888; margin: 3px 0; }
  .checkitem .ci-hint { color: #6d28d9; }
</style>
</head>
<body>
  <div class="shell">
    <div class="sidebar">
      <div class="brand">🧵 유쓰레드 워커<div class="sub">로컬 자동화</div></div>
      ${NAV_SECTIONS.map(
        (sec) => `
        <div class="navsec">
          <div class="navlabel">${sec.label}</div>
          ${sec.items
            .map(
              (it) => `<div class="navitem${it.id === 'status' ? ' active' : ''}" data-tab="${it.id}">
            <span>${it.label}</span>${it.ready ? '' : '<span class="badge">🚧</span>'}
          </div>`
            )
            .join('')}
        </div>`
      ).join('')}
    </div>

    <div class="main">
      <div class="tab-panel active" data-panel="status">
        <div class="card" style="max-width:720px">
          <h1>🐣 오늘 현황</h1>
          <div class="sub">계정이 얼마나 컸는지 확인해요. 급하게 쇼핑글부터 올리면 계정이 막혀요 — 일상글로 1주일 예열한 다음 쇼핑글로 넘어가세요.</div>
          <div class="steps" id="stepRow"></div>
        </div>

        <div class="card" style="max-width:720px" id="checklistCard"></div>

        <div class="card">
          <div class="sub" style="margin-bottom:12px">이 창을 닫아도 워커는 계속 돌아가요. 완전히 끄려면 "🛑 워커 종료" 버튼을 쓰세요.</div>
          <div class="row"><span class="dot" id="dot"></span><span id="stateText">연결 확인 중...</span></div>
          <div class="row"><span class="label">클로드 계정</span><span id="claudeEmail">-</span></div>
          <div class="row"><span class="label">서버 주소</span><span id="apiBase">-</span></div>
          <div class="row"><span class="label">현재 작업</span><span id="currentJob">없음</span></div>

          <div class="row" style="margin-top:12px">
            <input type="text" id="keyword" placeholder="예: 다이소 꿀템" />
            <button id="collectBtn">원본 수집 시작</button>
          </div>
          <div class="actions">
            <button class="secondary" id="recheckBtn">🔄 재연결 확인</button>
            <button class="secondary" id="shutdownBtn" style="color:#dc2626;border-color:#fca5a5">🛑 워커 종료</button>
          </div>
          <div id="msg"></div>
        </div>

        <div class="logbar">
          <span>실시간 로그</span>
          <button class="secondary" id="copyBtn">📋 로그 복사</button>
        </div>
        <div id="logs"></div>
      </div>

      <div class="tab-panel" data-panel="account">
        <div class="card">
          <h1>👤 계정</h1>
          <div class="sub">이 워커가 조종하는 전용 크롬 프로필이 지금 쓰레드에 로그인돼 있는지 확인해요. (지금 구조는 워커 1개당 쓰레드 계정 1개 — 서브계정 여러 개 연결은 아직 지원 안 해요)</div>
          <div class="row"><span class="dot" id="acctDot"></span><span id="acctText">아직 확인 안 함</span></div>
          <div class="row"><span class="label">클로드 계정</span><span id="acctClaudeEmail">-</span></div>
          <div class="actions">
            <button id="checkAcctBtn">지금 확인하기</button>
          </div>
          <div id="acctMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;"></div>
        </div>

        <div class="card">
          <h1 style="font-size:14px">🛡 안전하게 쓰는 기준</h1>
          <div class="sub" style="margin-bottom:12px">권고입니다 — 강제로 막지는 않아요. 계정 나이별 권장 게시 개수예요.</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr style="color:#888"><td style="padding:4px 0">새 계정 (1주 이내)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">1개</td></tr>
            <tr style="color:#888"><td style="padding:4px 0">예열 중 (1~4주)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">2개</td></tr>
            <tr style="color:#888"><td style="padding:4px 0">자리 잡음 (1개월~)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">3개</td></tr>
            <tr style="color:#888"><td style="padding:4px 0">성숙 (3개월~)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">5개</td></tr>
          </table>
          <div class="sub" style="margin-top:10px">글 사이 간격 2시간 · 좋아요 하루 3개 · 피하는 시간대 00~08시</div>
          <div class="sub">쓰레드는 "많이"보다 "꾸준히"가 이깁니다. 하루 1개를 30일 올린 계정이 하루 5개를 6일 올린 계정보다 안전하고 멀리 갑니다.</div>
        </div>
      </div>

      ${NAV_SECTIONS.flatMap((s) => s.items)
        .filter((it) => !it.ready)
        .map(
          (it) => `
      <div class="tab-panel" data-panel="${it.id}">
        <div class="soon">
          <div class="emoji">🚧</div>
          <div class="title">${it.label} — 아직 준비 중이에요</div>
          <div>다음 업데이트에서 실제로 동작하게 만들 예정이에요.</div>
        </div>
      </div>`
        )
        .join('')}
    </div>
  </div>

  <script>
    let lastLogs = [];

    document.querySelectorAll('.navitem').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.navitem').forEach((n) => n.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        el.classList.add('active');
        const panel = document.querySelector('.tab-panel[data-panel="' + el.dataset.tab + '"]');
        if (panel) panel.classList.add('active');
      });
    });

    function renderChecklist(s) {
      const aiDone = !!s.claudeEmail;
      const browserDone = true; // 워커가 떠 있다는 것 자체가 크롬을 이미 찾았다는 뜻
      const acctDone = s.threadsLoggedIn === true;

      const steps = [
        { emoji: '🤖', label: 'AI 연결', sub2: '클로드', done: aiDone },
        { emoji: '🌐', label: '브라우저', sub2: '구글 크롬 사용', done: browserDone },
        { emoji: '🧵', label: '계정 연결', sub2: acctDone ? '연결됨' : '아직 없음', done: acctDone, active: !acctDone && browserDone },
        { emoji: '✍️', label: '일상글 쓰기', sub2: '아직 준비중', locked: true },
        { emoji: '☀️', label: '1주일 예열', sub2: '아직 준비중', locked: true },
        { emoji: '🛍️', label: '쇼핑글 올리기', sub2: '아직 준비중', locked: true },
      ];

      document.getElementById('stepRow').innerHTML = steps
        .map((st, i) => {
          const cls = st.done ? 'done' : st.active ? 'active' : '';
          const badge = st.locked ? '🔒' : st.done ? '✅' : st.active ? '' : '⬜';
          const arrow = i < steps.length - 1 ? '<span class="arrow">→</span>' : '';
          return (
            '<div class="step ' + cls + '"><span class="badge2">' + badge + '</span>' +
            '<div class="emoji">' + st.emoji + '</div>' +
            '<div class="label">' + st.label + '</div>' +
            '<div class="sub2">' + st.sub2 + '</div></div>' + arrow
          );
        })
        .join('');

      const items = [
        {
          ok: aiDone,
          title: (aiDone ? '✅' : '❌') + ' 클로드(Claude Code) 연결',
          desc: aiDone ? '연결됨 — ' + s.claudeEmail : '클로드 CLI 로그인이 안 돼있어요.',
          hint: aiDone ? '' : '☞ 0_claude_login.bat을 실행해서 클로드 구독 계정으로 로그인하세요.',
        },
        {
          ok: browserDone,
          title: '✅ 브라우저(구글 크롬)',
          desc: '구글 크롬 사용',
          hint: '',
        },
        {
          ok: acctDone,
          title: (acctDone ? '✅' : '❌') + ' 쓰레드 계정 연결',
          desc: acctDone ? '로그인된 계정이 있습니다.' : '로그인된 계정이 없습니다. 안 하면: 연결 전까지는 글을 만들 수는 있어도 올릴 수는 없습니다.',
          hint: acctDone ? '' : '☞ [계정] 탭에서 "지금 확인하기"를 누르면 뜨는 크롬 창에서 평소처럼 쓰레드에 로그인하면 끝입니다.',
        },
      ];
      document.getElementById('checklistCard').innerHTML =
        '<h1 style="font-size:14px">시작하기 전에 — 아래 순서대로만 하면 됩니다</h1>' +
        '<div class="sub" style="margin-bottom:10px">✅는 이미 끝난 것이니 넘어가세요. ❌만 위에서부터 차례로 해결하면 됩니다.</div>' +
        items.map((it) => (
          '<div class="checkitem ' + (it.ok ? 'ok' : 'bad') + '"><div class="ci-title">' + it.title + '</div>' +
          '<div class="ci-desc">' + it.desc + '</div>' +
          (it.hint ? '<div class="ci-hint">' + it.hint + '</div>' : '') + '</div>'
        )).join('');
    }

    async function tick() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        renderChecklist(data.status);
        document.getElementById('dot').className = 'dot' + (data.status.state === 'running' ? '' : ' off');
        document.getElementById('stateText').textContent = data.status.state === 'running' ? '온라인 — 정상 작동 중' : '연결 대기 중';
        document.getElementById('claudeEmail').textContent = data.status.claudeEmail || '확인 안 됨';
        document.getElementById('apiBase').textContent = data.status.apiBase || '-';
        document.getElementById('currentJob').textContent = data.status.currentJob || '없음';
        lastLogs = data.logs;
        const logsEl = document.getElementById('logs');
        const atBottom = logsEl.scrollHeight - logsEl.scrollTop - logsEl.clientHeight < 40;
        logsEl.innerHTML = data.logs.map(l => '<div class="logline"><span class="time">[' + l.time + ']</span> ' + l.text.replace(/</g,'&lt;') + '</div>').join('');
        if (atBottom) logsEl.scrollTop = logsEl.scrollHeight;

        document.getElementById('acctClaudeEmail').textContent = data.status.claudeEmail || '확인 안 됨';
        const acctDot = document.getElementById('acctDot');
        const acctText = document.getElementById('acctText');
        if (data.status.threadsLoggedIn === null) {
          acctDot.className = 'dot off';
          acctText.textContent = '아직 확인 안 함';
        } else if (data.status.threadsLoggedIn) {
          acctDot.className = 'dot';
          acctText.textContent = '쓰레드 로그인됨' + (data.status.threadsCheckedAt ? ' · ' + new Date(data.status.threadsCheckedAt).toLocaleString('ko-KR') + ' 확인' : '');
        } else {
          acctDot.className = 'dot warn';
          acctText.textContent = '로그인 안 됨 — 원본 수집 실행 시 뜨는 크롬 창에서 직접 로그인하세요';
        }
      } catch {}
    }
    tick();
    setInterval(tick, 1500);

    function setMsg(text) {
      document.getElementById('msg').textContent = text;
    }

    document.getElementById('collectBtn').addEventListener('click', async () => {
      const keyword = document.getElementById('keyword').value.trim();
      if (!keyword) { setMsg('키워드를 입력하세요.'); return; }
      const btn = document.getElementById('collectBtn');
      btn.disabled = true;
      setMsg('작업 등록 중...');
      try {
        const res = await fetch('/api/action/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        setMsg('✅ 작업 등록됨 — 아래 로그에서 진행상황을 확인하세요.');
      } catch (err) {
        setMsg('❌ ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('checkAcctBtn').addEventListener('click', async () => {
      const btn = document.getElementById('checkAcctBtn');
      btn.disabled = true;
      document.getElementById('acctMsg').textContent = '확인 중... (크롬 창이 잠깐 떴다 닫혀요)';
      try {
        const res = await fetch('/api/action/check-account', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        document.getElementById('acctMsg').textContent = '✅ 확인 작업이 등록됐어요 — 몇 초 안에 위 상태가 갱신돼요.';
      } catch (err) {
        document.getElementById('acctMsg').textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('shutdownBtn').addEventListener('click', async () => {
      if (!confirm('워커를 종료할까요? 콘솔 창도 같이 닫혀요.')) return;
      setMsg('종료 중...');
      try {
        await fetch('/api/action/shutdown', { method: 'POST' });
        setMsg('✅ 워커가 종료됐어요. 이 페이지는 이제 안 써도 돼요.');
      } catch {
        setMsg('✅ 워커가 종료됐어요.');
      }
    });

    document.getElementById('recheckBtn').addEventListener('click', async () => {
      const btn = document.getElementById('recheckBtn');
      btn.disabled = true;
      setMsg('재연결 확인 중...');
      try {
        const res = await fetch('/api/action/recheck', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        setMsg('✅ 재연결 확인 완료 (클로드 계정: ' + (data.claudeEmail || '확인 안 됨') + ')');
      } catch (err) {
        setMsg('❌ ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('copyBtn').addEventListener('click', async () => {
      const text = lastLogs.map(l => '[' + l.time + '] ' + l.text).join('\\n');
      try {
        await navigator.clipboard.writeText(text);
        setMsg('✅ 로그를 클립보드에 복사했어요.');
      } catch {
        setMsg('❌ 복사 실패 — 브라우저 권한을 확인하세요.');
      }
    });
  </script>
</body>
</html>`;

function startDashboard() {
  hookConsole();
  const server = http.createServer((req, res) => {
    if (req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status, logs }));
      return;
    }
    if (req.url === '/api/action/collect' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const job = await handleCollectAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, job }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/check-account' && req.method === 'POST') {
      handleCheckAccountAction()
        .then((job) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, job }));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    if (req.url === '/api/action/shutdown' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      console.log('[대시보드] 종료 버튼으로 워커를 끕니다.');
      // 응답을 먼저 보내고, 크롬(퍼펫티어) 창을 닫은 뒤, 워커 프로세스를 종료한다.
      // 크롬은 워커와 별개의 OS 프로세스라 process.exit()만으로는 안 닫힌다.
      setTimeout(async () => {
        await closeBrowser();
        process.exit(0);
      }, 300);
      return;
    }
    if (req.url === '/api/action/recheck' && req.method === 'POST') {
      handleRecheckAction()
        .then((claudeEmail) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, claudeEmail }));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE());
  });
  server.listen(PORT, () => {
    console.log(`대시보드: http://localhost:${PORT}`);
  });
  return { setStatus };
}

module.exports = { startDashboard, setStatus, pushLog };
