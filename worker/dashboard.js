const http = require('http');
const { loadConfig } = require('./config');
const { getClaudeAccountEmail } = require('./generate');

const PORT = 5757;
const MAX_LOG_LINES = 300;
const logs = [];
let status = { state: 'starting', claudeEmail: null, apiBase: null, currentJob: null };

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

const PAGE = () => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>유쓰레드 로컬 워커</title>
<style>
  body { font-family: -apple-system, "Malgun Gothic", sans-serif; background: #f7f7f8; margin: 0; padding: 24px; color: #1a1a1a; }
  .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px; margin-bottom: 16px; max-width: 720px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #888; font-size: 12px; margin-bottom: 16px; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
  .dot.off { background: #d4d4d4; }
  .label { color: #888; width: 110px; flex-shrink: 0; }
  button { background: #6d28d9; color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  button.secondary { background: #fff; color: #333; border: 1px solid #ddd; }
  button:disabled { opacity: .5; cursor: default; }
  input[type=text] { border: 1px solid #ddd; border-radius: 8px; padding: 9px 12px; font-size: 13px; flex: 1; }
  .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .logbar { display: flex; align-items: center; justify-content: space-between; max-width: 720px; margin-bottom: 6px; }
  .logbar span { font-size: 12px; font-weight: 700; color: #555; }
  #logs { max-width: 720px; height: 340px; overflow-y: auto; background: #111; color: #ddd; font-family: Consolas, monospace; font-size: 12px; padding: 12px; border-radius: 10px; box-sizing: border-box; }
  .logline { white-space: pre-wrap; word-break: break-all; margin-bottom: 2px; }
  .time { color: #666; }
  #msg { font-size: 12px; color: #6d28d9; margin-top: 8px; min-height: 16px; }
</style>
</head>
<body>
  <div class="card">
    <h1>🧵 유쓰레드 로컬 워커</h1>
    <div class="sub">이 창을 닫아도 워커는 계속 돌아가요. 완전히 끄려면 이 페이지를 연 터미널(검은 창)을 닫으세요.</div>
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

  <script>
    let lastLogs = [];

    async function tick() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
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
    if (req.url === '/api/action/shutdown' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      console.log('[대시보드] 종료 버튼으로 워커를 끕니다.');
      // 응답을 먼저 보내고 나서 살짝 뒤에 종료해야 브라우저가 "종료됨" 메시지를 받을 수 있다.
      setTimeout(() => process.exit(0), 300);
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
