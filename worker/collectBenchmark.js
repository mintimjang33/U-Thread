const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');
const { generateViaClaude } = require('./generate');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const PROFILE_DIR = path.join(os.homedir(), '.u-thread-worker', 'chrome-profile');

// ⚠️ 실제 로그인된 쓰레드 세션으로 검증되지 않음. 최초 실행은 반드시 headless:false로 눈으로 확인할 것.
// 쓰레드 DOM 구조가 바뀌면 여기 셀렉터만 고치면 된다. 특히 replyButton/commentInput/submitButton은
// 아직 실전 검증 못 함 — 처음 댓글 기능 켜서 돌려볼 땐 반드시 화면으로 지켜볼 것.
const SELECTORS = {
  postContainer: 'div[data-pressable-container="true"]',
  postText: 'span[dir="auto"]',
  likeButton: 'svg[aria-label="좋아요"]',
  replyButton: 'svg[aria-label="댓글"], svg[aria-label="답글"]',
  commentInput: 'div[contenteditable="true"]',
};

// puppeteer-core는 Playwright의 :has-text() 같은 텍스트 기반 셀렉터를 지원하지 않아서,
// "게시"라는 텍스트가 든 버튼을 JS로 직접 찾는다.
async function findSubmitButton(page) {
  return page.evaluateHandle(() => {
    const candidates = Array.from(document.querySelectorAll('div[role="button"], button'));
    return candidates.find((el) => (el.textContent || '').trim() === '게시' || (el.textContent || '').trim() === 'Post') || null;
  });
}

const MIN_LIKES = 200;
const MIN_REPLIES = 50;
const MAX_LIKES_PER_SESSION = 5; // 봇 탐지 회피 — 짧은 시간에 너무 많이 누르지 않는다.
const MAX_COMMENTS_PER_SESSION = 3; // 댓글은 좋아요보다 눈에 띄는 행동이라 더 보수적으로 제한.

// 투더제이 방식 그대로: AI가 먼저 스팸/부적절 여부를 판단하고, 통과한 글에만 짧은 댓글을 만든다.
async function judgeAndDraftComment(postText) {
  // 큰따옴표 3개(""")로 게시물을 감쌌더니 윈도우 명령줄 인자 이스케이프 과정에서 내용이 통째로 유실되는
  // 문제가 있었다(AI가 "게시물 내용이 안 보인다"고 계속 응답함, 2026-08-24 실측 확인). 따옴표가 없는
  // 구분자로 바꿔서 이스케이프 충돌을 피한다.
  const prompt = `아래 쓰레드(Threads) 게시물에 댓글을 달아도 될지 판단해라.
거절 기준(하나라도 해당하면 거절): 스팸/사기/판매권유, 성인 콘텐츠, 정치적으로 민감한 내용, 만남/연락처 교환 요구, 신청서/지원서 작성 요구.
거절이면 다른 설명 없이 정확히 이 JSON만 출력: {ok: false}
허용이면, 게시물과 같은 언어로, 광고 티 안 나게 진짜 사람이 남긴 것처럼 자연스러운 1문장 이내의 짧은 댓글을 만들어서 이 형식으로만 출력: {ok: true, comment: 여기에댓글}
반드시 유효한 JSON 문법으로(키와 문자열 값에 큰따옴표 사용) 출력해라.

===게시물 시작===
${postText.slice(0, 500)}
===게시물 끝===`;

  try {
    const raw = await generateViaClaude(prompt);
    console.log('[댓글] AI 원본 응답:', raw.slice(0, 200));
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    if (parsed?.ok && typeof parsed.comment === 'string' && parsed.comment.trim()) {
      return parsed.comment.trim();
    }
  } catch (err) {
    console.log('[댓글] AI 판단/파싱 실패:', err.message);
  }
  return null;
}

function findChrome() {
  const fs = require('fs');
  return CHROME_PATHS.find((p) => fs.existsSync(p));
}

// 쓰레드는 SPA라 백그라운드에서 자체적으로 클라이언트 사이드 네비게이션을 계속 일으킨다.
// 그 타이밍에 evaluate가 걸리면 "Execution context was destroyed"가 뜨는데, 치명적 에러가
// 아니라 그냥 그 순간을 건너뛰고 잠깐 뒤에 다시 시도하면 되는 일이라 재시도로 흡수한다.
async function safeEvaluate(page, fn, arg, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return arg !== undefined ? await page.evaluate(fn, arg) : await page.evaluate(fn);
    } catch (err) {
      if (i === retries || !String(err.message).includes('Execution context was destroyed')) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

// 퍼펫티어로 띄운 크롬은 워커(node) 프로세스와 별개의 OS 프로세스라서, 대시보드의
// "워커 종료" 버튼이 process.exit()만 호출해서는 이 창이 안 닫힌다. 종료 시 같이
// 닫을 수 있게 마지막으로 띄운 브라우저 인스턴스를 모듈 스코프에 보관해둔다.
let currentBrowser = null;

// 워커(node)가 재시작되면 이전 실행이 띄운 크롬에 대한 메모리 참조(currentBrowser)는
// 사라지지만, 실제 크롬 창(OS 프로세스)은 그대로 남아있을 수 있다. 이 경우 currentBrowser로는
// 절대 못 찾으므로, 우리 자동화 전용 프로필 경로(u-thread-worker\chrome-profile)로 실행 중인
// chrome.exe를 커맨드라인 기준으로 직접 찾아서 강제 종료한다 — 프로세스 재시작과 무관하게 동작.
function killOrphanChromeProcesses() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const { spawn } = require('child_process');
  const psScript = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*u-thread-worker*' } | ForEach-Object { Write-Output $_.ProcessId; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  return new Promise((resolve) => {
    let out = '';
    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      resolve([]);
    }, 6000);
    child.stdout.on('data', (d) => (out += d));
    child.on('close', () => {
      clearTimeout(timer);
      resolve(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      console.log('[워커] 크롬 프로세스 정리 실행 실패:', err.message);
      resolve([]);
    });
  });
}

async function closeBrowser() {
  if (currentBrowser) {
    const browser = currentBrowser;
    currentBrowser = null;
    const proc = browser.process ? browser.process() : null;

    try {
      // 실제 구글 크롬은 "백그라운드 앱 계속 실행" 설정이나 작업 도중(evaluate 등)
      // close()를 호출하면 응답이 없거나 창만 남는 경우가 있어, 무한정 기다리지 않는다.
      await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 3000))]);
    } catch (err) {
      console.log('[워커] browser.close() 중 에러(강제 종료로 이어감):', err.message);
    }

    if (proc && proc.exitCode === null && !proc.killed) {
      try {
        proc.kill();
      } catch (err) {
        console.log('[워커] 프로세스 강제 종료 실패:', err.message);
      }
    }
  }

  const killedPids = await killOrphanChromeProcesses();
  if (killedPids.length) {
    console.log(`[워커] 자동화 크롬 프로세스 정리 완료 (PID: ${killedPids.join(', ')})`);
  } else {
    console.log('[워커] 정리할 자동화 크롬 프로세스 없음.');
  }
}

async function checkThreadsLogin(page) {
  return safeEvaluate(page, () => !document.body.innerText.includes('로그인'));
}

// 사이드바 "계정" 탭에서 쓰는 가벼운 연결 확인 — collectBenchmark()처럼 5분씩 로그인 대기하지 않고
// 지금 로그인 상태인지만 빠르게 보고 끝낸다. 이미 떠 있는 브라우저가 있으면 그걸 재사용하고,
// 없으면 새로 띄웠다가 확인 후 닫는다(백그라운드 상태 확인용 창을 계속 남겨두지 않기 위함).
async function checkLoginStatus() {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('크롬을 찾을 수 없습니다.');

  const reusingExisting = !!currentBrowser;
  const browser =
    currentBrowser ||
    (currentBrowser = await puppeteer.launch({
      executablePath,
      headless: false,
      userDataDir: PROFILE_DIR,
      args: ['--no-first-run', '--no-default-browser-check'],
    }));

  const page = await browser.newPage();
  try {
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    return await checkThreadsLogin(page);
  } finally {
    await page.close().catch(() => {});
    if (!reusingExisting) {
      await closeBrowser();
    }
  }
}

async function collectBenchmark(input) {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('크롬을 찾을 수 없습니다.');

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  currentBrowser = browser;

  try {
    const page = await browser.newPage();
    const keyword = input.keyword || '';
    const url = keyword ? `https://www.threads.net/search?q=${encodeURIComponent(keyword)}&serp_type=default` : 'https://www.threads.net/';
    // 쓰레드는 백그라운드 폴링/웹소켓 통신이 끊이지 않는 SPA라 networkidle2가 절대 안 와서
    // 화면은 다 로드됐는데도 30초 타임아웃으로 실패했다(실측 확인). domcontentloaded로 바꾸고
    // 아래 대기 시간으로 렌더링 안정화를 기다린다.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    let loggedIn = await safeEvaluate(page, () => !document.body.innerText.includes('로그인'));
    if (!loggedIn) {
      console.log('⚠️ threads.net에 로그인이 안 되어 있습니다. 방금 뜬 크롬 창에서 직접 로그인해주세요 (최대 5분 대기, 한 번만 하면 이후엔 계속 유지됩니다).');
      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        loggedIn = await safeEvaluate(page, () => !document.body.innerText.includes('로그인')).catch(() => false);
        if (loggedIn) break;
      }
      if (!loggedIn) {
        throw new Error('로그인 대기 시간(5분) 초과. 다시 시도해주세요.');
      }
      console.log('✅ 로그인 확인됨 — 수집을 시작합니다.');
      // 로그인 직후엔 쓰레드 자체의 리다이렉트가 아직 끝나지 않은 경우가 있어(레이스 컨디션),
      // 잠깐 안정화를 기다린 뒤 재이동한다. 그래도 뜨는 net::ERR_ABORTED는 그 리다이렉트와
      // 겹친 것뿐이라 한 번 더 시도하면 보통 해결된다.
      await new Promise((r) => setTimeout(r, 5000));
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    const items = [];
    let likesUsed = 0;
    let commentsUsed = 0;
    const commentsLog = []; // 어떤 글에 뭐라고 댓글 달았는지 기록(추적용)

    for (let scroll = 0; scroll < (input.maxScrolls || 5); scroll++) {
      const candidates =
        (await safeEvaluate(
          page,
          (sel) => {
            const posts = Array.from(document.querySelectorAll(sel.postContainer));
            return posts.map((el) => {
              // 아바타(프로필 사진)는 모든 글에 항상 붙어있어서, 단순히 "img가 있냐"로만 판단하면
              // 텍스트 전용 글도 전부 "미디어 있음"으로 오판된다 — 실제 첨부 이미지만한 크기(가로 100px 이상)일
              // 때만 진짜 미디어로 친다.
              const media = Array.from(el.querySelectorAll('img, video')).filter((m) => (m.clientWidth || m.width || 0) > 100);
              return { text: el.innerText || '', hasMedia: media.length > 0, textLen: (el.innerText || '').length };
            });
          },
          SELECTORS
        ).catch(() => [])) || [];

      console.log(`[디버그] scroll ${scroll}: postContainer ${candidates.length}개 발견, hasMedia=${candidates.filter((c) => c.hasMedia).length}개, 텍스트있음=${candidates.filter((c) => c.textLen > 0).length}개`);

      if (scroll === 0) {
        const detail = await safeEvaluate(
          page,
          (sel) => {
            const posts = Array.from(document.querySelectorAll(sel.postContainer));
            const first = posts[0];
            if (!first) return null;
            const imgs = Array.from(first.querySelectorAll('img, video')).map((m) => ({
              tag: m.tagName,
              clientWidth: m.clientWidth,
              width: m.width,
              src: (m.src || m.currentSrc || '').slice(0, 80),
            }));
            return { textPreview: (first.innerText || '').slice(0, 60), imgs, outerHtmlLen: first.outerHTML.length };
          },
          SELECTORS
        ).catch(() => null);
        if (detail) {
          console.log('[디버그 상세] 첫 postContainer 텍스트:', detail.textPreview);
          console.log('[디버그 상세] 첫 postContainer 안 img/video 목록:', JSON.stringify(detail.imgs));
        }
      }

      for (const c of candidates) {
        if (!c.text.trim()) continue;
        if (items.find((it) => it.content === c.text)) continue;
        items.push({ content: c.text, source: `threads.net 검색:${keyword}` });
      }

      // 사람처럼 보이게 세션당 최대 5개까지만, 느리게 좋아요
      if (likesUsed < MAX_LIKES_PER_SESSION) {
        const likeButtons = await page.$$(SELECTORS.likeButton);
        if (likeButtons[0]) {
          try {
            await likeButtons[0].click();
            likesUsed++;
            await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
          } catch {
            // 좋아요 실패는 치명적이지 않으므로 무시하고 계속 진행
          }
        }
      }

      // 투더제이 방식: 텍스트 위주 글 중 하나를 골라 AI가 스팸 여부 판단 → 통과하면 짧은 댓글 작성.
      // 좋아요보다 눈에 띄는 행동이라 세션당 훨씬 적게(최대 3개) 제한한다.
      if (commentsUsed < MAX_COMMENTS_PER_SESSION) {
        const targetIdx = candidates.findIndex((c) => c.text.trim().length > 10);
        if (targetIdx < 0) {
          console.log('[댓글] 댓글 달 만한(텍스트 10자 이상) 글을 이번 스크롤에서 못 찾음');
        } else {
          try {
            console.log(`[댓글] 후보 글 판단 중: "${candidates[targetIdx].text.slice(0, 40)}..."`);
            const comment = await judgeAndDraftComment(candidates[targetIdx].text);
            if (!comment) {
              console.log('[댓글] AI가 이 글은 댓글 달기 부적절하다고 판단(스팸/성인/정치/만남요구 등) 또는 응답 파싱 실패 — 건너뜀');
            } else {
              console.log(`[댓글] AI가 만든 댓글: "${comment}" — 게시 시도`);
              const postHandles = await page.$$(SELECTORS.postContainer);
              const postHandle = postHandles[targetIdx];
              const replyBtn = postHandle && (await postHandle.$(SELECTORS.replyButton));
              if (!replyBtn) {
                console.log('[댓글] 댓글 버튼을 못 찾음 — 셀렉터 확인 필요 (SELECTORS.replyButton)');
              } else {
                await replyBtn.click();
                await new Promise((r) => setTimeout(r, 1500));
                const input = await page.$(SELECTORS.commentInput);
                if (!input) {
                  console.log('[댓글] 입력창을 못 찾음 — 셀렉터 확인 필요 (SELECTORS.commentInput)');
                } else {
                  // 한 글자씩 타이핑하면 봇 특유의 일정한 리듬이 감지된다(투더제이/남다른AI 둘 다 지적한 부분).
                  // 대신 클립보드에 복사해서 Ctrl+V로 한 번에 붙여넣어 사람이 메모장에서 쓰고 붙여넣는 것처럼 흉내낸다.
                  await input.click();
                  await browser.defaultBrowserContext().overridePermissions('https://www.threads.net', ['clipboard-read', 'clipboard-write']);
                  await page.evaluate((text) => navigator.clipboard.writeText(text), comment);
                  await page.keyboard.down('Control');
                  await page.keyboard.press('KeyV');
                  await page.keyboard.up('Control');
                  await new Promise((r) => setTimeout(r, 800));
                  const submitBtn = await findSubmitButton(page);
                  const isSubmitUsable = submitBtn && (await submitBtn.asElement());
                  if (!isSubmitUsable) {
                    console.log('[댓글] "게시" 버튼을 못 찾음 — 쓰레드 UI 문구/구조가 다를 수 있음');
                  } else {
                    await submitBtn.asElement().click();
                    commentsUsed++;
                    commentsLog.push({ postPreview: candidates[targetIdx].text.slice(0, 80), comment });
                    console.log(`[댓글] ✅ "${comment}" 게시 완료`);
                    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
                  }
                }
              }
            }
          } catch (err) {
            console.log('[댓글] 실패(무시하고 계속):', err.message);
          }
        }
      }

      await safeEvaluate(page, () => window.scrollBy(0, window.innerHeight * 1.5)).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));
    }

    console.log('[디버그] 작업 완료 — 디버깅 편의를 위해 크롬 창은 자동으로 안 닫아요. 필요하면 직접 닫으세요.');
    return { items, likesUsed, commentsUsed, commentsLog, note: '좋아요/댓글 수 필터는 아직 미적용 — DOM에서 수치 파싱 검증 필요' };
  } catch (err) {
    console.log('[디버그] 작업 실패 — 원인 확인할 수 있게 크롬 창은 그대로 뒀어요:', err.message);
    throw err;
  }
}

module.exports = { collectBenchmark, closeBrowser, checkLoginStatus, MIN_LIKES, MIN_REPLIES };
