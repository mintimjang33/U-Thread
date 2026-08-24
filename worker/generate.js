const spawn = require('cross-spawn');

// 로컬에 설치된 Claude Code CLI를 헤드리스로 호출한다 — API 종량과금 없이 클로드 구독 안에서 처리됨.
// cross-spawn을 쓰는 이유: Windows에서 claude(.cmd)를 execFile로 직접 부르면 ENOENT가 나고,
// shell:true로 우회하면 프롬프트 내용에 셸 특수문자가 있을 때 인젝션 위험이 생긴다.
//
// 프롬프트는 커맨드라인 인자(-p "...")가 아니라 stdin으로 넘긴다. claude가 Windows에서
// .cmd 셸 스크립트라 cross-spawn이 내부적으로 cmd.exe를 거쳐 실행하는데, cmd.exe는 인자 안의
// 줄바꿈을 명령 구분자로 취급해서 여러 줄 프롬프트가 첫 줄만 남고 통째로 잘린다(실측 확인:
// "line one\nline two\nline three"를 인자로 넘기면 AI는 "line one"만 받음). stdin에는
// 이런 파싱이 적용되지 않아 문제 자체가 사라진다.
function runClaude(args, input) {
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
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

function generateViaClaude(prompt) {
  return runClaude(['-p', '--output-format', 'text'], prompt);
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
