const { execFile } = require('child_process');

// 로컬에 설치된 Claude Code CLI를 헤드리스로 호출한다 — API 종량과금 없이 클로드 구독 안에서 처리됨.
function generateViaClaude(prompt) {
  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      ['-p', prompt, '--output-format', 'text'],
      { maxBuffer: 1024 * 1024 * 10, timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      }
    );
  });
}

function getClaudeAccountEmail() {
  return new Promise((resolve) => {
    execFile('claude', ['auth', 'status'], { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(stdout).email || null);
      } catch {
        resolve(null);
      }
    });
  });
}

module.exports = { generateViaClaude, getClaudeAccountEmail };
