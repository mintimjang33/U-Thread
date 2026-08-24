const { loadConfig } = require('./config');
const { generateViaClaude, getClaudeAccountEmail } = require('./generate');
const { collectBenchmark } = require('./collectBenchmark');
const { startDashboard, setStatus } = require('./dashboard');

const POLL_INTERVAL_MS = 8000;
let claudeEmail = null;

async function apiFetch(config, path, options = {}) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}`, ...(options.headers || {}) };
  if (claudeEmail) headers['X-Claude-Account'] = claudeEmail;
  const res = await fetch(config.apiBase + path, { ...options, headers });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}

async function claimAndRun(config, job) {
  console.log(`[job ${job.id}] ${job.type} 시작`);
  setStatus({ currentJob: `${job.type} (${job.id.slice(0, 8)})` });
  await apiFetch(config, `/api/worker/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processing' }) });

  try {
    let output;
    if (job.type === 'generate') {
      const content = await generateViaClaude(job.input.prompt);
      output = { content };
    } else if (job.type === 'collect_benchmark') {
      output = await collectBenchmark(job.input);
    } else {
      throw new Error(`알 수 없는 작업 타입: ${job.type}`);
    }
    await apiFetch(config, `/api/worker/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done', output }) });
    console.log(`[job ${job.id}] 완료`);
  } catch (err) {
    console.error(`[job ${job.id}] 실패:`, err.message);
    await apiFetch(config, `/api/worker/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error: err.message }) });
  } finally {
    setStatus({ currentJob: null });
  }
}

async function pollLoop() {
  startDashboard();

  const config = loadConfig();
  if (!config) {
    console.error('페어링 설정이 없습니다. 먼저 node pair.js 를 실행하세요.');
    setStatus({ state: 'error' });
    return;
  }

  setStatus({ apiBase: config.apiBase });
  claudeEmail = await getClaudeAccountEmail();
  setStatus({ state: 'running', claudeEmail });
  console.log(`유쓰레드 로컬 워커 시작 — ${config.apiBase}${claudeEmail ? ` (클로드 계정: ${claudeEmail})` : ' (클로드 계정 확인 안 됨 — claude auth login 필요)'}`);
  while (true) {
    try {
      const { jobs } = await apiFetch(config, '/api/worker/jobs');
      for (const job of jobs) {
        await claimAndRun(config, job);
      }
    } catch (err) {
      console.error('폴링 오류:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

pollLoop();
