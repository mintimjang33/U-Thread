const spawn = require('cross-spawn');

// 로컬에 설치된 Claude Code CLI를 헤드리스로 호출한다 — API 종량과금 없이 클로드 구독 안에서 처리됨.
// cross-spawn을 쓰는 이유: Windows에서 claude(.cmd)를 execFile로 직접 부르면 ENOENT가 나고,
// shell:true로 우회하면 프롬프트 내용에 셸 특수문자가 있을 때 인젝션 위험이 생긴다.
function runClaude(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { timeout: 120000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `claude exited with code ${code}`));
      resolve(stdout.trim());
    });
  });
}

function generateViaClaude(prompt) {
  return runClaude(['-p', prompt, '--output-format', 'text']);
}

async function getClaudeStatus() {
  try {
    const out = await runClaude(['auth', 'status']);
    return JSON.parse(out);
  } catch {
    return null;
  }
}

async function getClaudeAccountEmail() {
  const status = await getClaudeStatus();
  return status?.email || null;
}

module.exports = { generateViaClaude, getClaudeAccountEmail, getClaudeStatus };
