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
  submitButton: 'div[role="button"]:has-text("게시"), button:has-text("게시")',
};

const MIN_LIKES = 200;
const MIN_REPLIES = 50;
const MAX_LIKES_PER_SESSION = 5; // 봇 탐지 회피 — 짧은 시간에 너무 많이 누르지 않는다.
const MAX_COMMENTS_PER_SESSION = 3; // 댓글은 좋아요보다 눈에 띄는 행동이라 더 보수적으로 제한.

// 투더제이 방식 그대로: AI가 먼저 스팸/부적절 여부를 판단하고, 통과한 글에만 짧은 댓글을 만든다.
async function judgeAndDraftComment(postText) {
  const prompt = `아래 쓰레드(Threads) 게시물에 댓글을 달아도 될지 판단해라.
거절 기준(하나라도 해당하면 거절): 스팸·사기·판매권유, 성인 콘텐츠, 정치적으로 민감한 내용, 만남·연락처 교환 요구, 신청서·지원서 작성 요구.
거절이면 다른 설명 없이 정확히 이 JSON만 출력: {"ok": false}
허용이면, 게시물과 같은 언어로, 광고 티 안 나게 진짜 사람이 남긴 것처럼 자연스러운 1문장 이내의 짧은 댓글을 만들어서 이 형식으로만 출력: {"ok": true, "comment": "..."}

게시물:
"""${postText.slice(0, 500)}"""`;

  try {
    const raw = await generateViaClaude(prompt);
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    if (parsed?.ok && typeof parsed.comment === 'string' && parsed.comment.trim()) {
      return parsed.comment.trim();
    }
  } catch {
    // 판단 실패 시 안전하게 댓글을 달지 않는다.
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

async function collectBenchmark(input) {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('크롬을 찾을 수 없습니다.');

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  try {
    const page = await browser.newPage();
    const keyword = input.keyword || '';
    const url = keyword ? `https://www.threads.net/search?q=${encodeURIComponent(keyword)}&serp_type=default` : 'https://www.threads.net/';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    const items = [];
    let likesUsed = 0;
    let commentsUsed = 0;

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

      for (const c of candidates) {
        if (c.hasMedia) continue; // 일단 텍스트 전용 글만 (원본 수집 1차 범위)
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
        const targetIdx = candidates.findIndex((c) => !c.hasMedia && c.text.trim().length > 10);
        if (targetIdx >= 0) {
          try {
            const comment = await judgeAndDraftComment(candidates[targetIdx].text);
            if (comment) {
              const postHandles = await page.$$(SELECTORS.postContainer);
              const postHandle = postHandles[targetIdx];
              const replyBtn = postHandle && (await postHandle.$(SELECTORS.replyButton));
              if (replyBtn) {
                await replyBtn.click();
                await new Promise((r) => setTimeout(r, 1500));
                const input = await page.$(SELECTORS.commentInput);
                if (input) {
                  // 한 글자씩 타이핑하면 봇 특유의 일정한 리듬이 감지된다(투더제이/남다른AI 둘 다 지적한 부분).
                  // 대신 클립보드에 복사해서 Ctrl+V로 한 번에 붙여넣어 사람이 메모장에서 쓰고 붙여넣는 것처럼 흉내낸다.
                  await input.click();
                  await browser.defaultBrowserContext().overridePermissions('https://www.threads.net', ['clipboard-read', 'clipboard-write']);
                  await page.evaluate((text) => navigator.clipboard.writeText(text), comment);
                  await page.keyboard.down('Control');
                  await page.keyboard.press('KeyV');
                  await page.keyboard.up('Control');
                  await new Promise((r) => setTimeout(r, 800));
                  const submitBtn = await page.$(SELECTORS.submitButton);
                  if (submitBtn) {
                    await submitBtn.click();
                    commentsUsed++;
                    console.log(`[댓글] "${comment}" 게시 완료`);
                    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
                  } else {
                    console.log('[댓글] 게시 버튼을 못 찾음 — 셀렉터 확인 필요 (SELECTORS.submitButton)');
                  }
                } else {
                  console.log('[댓글] 입력창을 못 찾음 — 셀렉터 확인 필요 (SELECTORS.commentInput)');
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

    return { items, likesUsed, commentsUsed, note: '좋아요/댓글 수 필터는 아직 미적용 — DOM에서 수치 파싱 검증 필요' };
  } finally {
    await browser.close();
  }
}

module.exports = { collectBenchmark, MIN_LIKES, MIN_REPLIES };
