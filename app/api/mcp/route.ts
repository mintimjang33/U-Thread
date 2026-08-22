// 유쓰레드(U-Thread) MCP 서버.
// ai-thread-map/fresh-season 패턴(mcp-handler + zod, ?key= 공유비밀 인증, GitHub 조회)을
// 그대로 이식하고, 유쓰레드 고유 기능(스레드 초안 생성/발행, 쿠팡 상품검색, 네이버 트렌드,
// Supabase 테이블 범용 CRUD + 읽기전용 SQL)을 추가했다.
//
// 필요한 환경변수 (Vercel > Settings > Environment Variables):
//   MCP_SHARED_SECRET   - 이 MCP 서버 보호용 공유 비밀키
//   MCP_OWNER_USER_ID   - userId를 생략했을 때 기본으로 사용할 Supabase auth user id(운영자 본인)
//   GITHUB_TOKEN (선택) - GitHub API 한도 완화용
//
// 커넥터 등록 URL: https://u-thread.vercel.app/api/mcp?key=<MCP_SHARED_SECRET>

import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { getSupabaseServerClient } from '../../../lib/supabase';
import { decryptVaultValue } from '../../../lib/vaultCrypto';
import { publishThreadPostNow } from '../../../lib/publishThreadPost';
import { coupangSearchProducts, coupangDeeplink } from '../../../lib/coupangApi';
import { naverKeywordTool, rankByVolume } from '../../../lib/naverAdApi';

const GITHUB_REPO = 'mintimjang33/U-Thread';

const ALLOWED_TABLES = [
  'ut_thread_posts',
  'ut_personas',
  'ut_system_personas',
  'ut_affiliate_templates',
  'ut_benchmark_items',
  'ut_benchmark_folders',
  'ut_threads_accounts',
  'ut_subscriptions',
  'ut_api_keys_vault',
  'ut_editor_defaults',
  'ut_revenue_posts',
  'ut_archive_videos',
];

function resolveUserId(userId?: string): string {
  const id = userId || process.env.MCP_OWNER_USER_ID;
  if (!id) throw new Error('userId가 없고 MCP_OWNER_USER_ID 환경변수도 설정되어 있지 않습니다.');
  return id;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `❌ ${message}` }], isError: true as const };
}

const BASE_SYSTEM_PROMPT = `너는 쓰레드(Threads) 바이럴 글쓰기 전문가다. 아래 규칙을 반드시 지켜라.

금지: 순수 정보나열형/백과사전 어투("~에 좋습니다/주의하세요" 식), 광고 티 나는 문구, 지어낸 경험담이나 검증 안 된 숫자.

허용 포맷 3종 중 하나로 작성:
1. 총정리/치트시트 — 압축된 정보를 리스트로 정리
2. 위트있는 한 줄 — 유행어/공감형 문구 + 검증 가능한 사실 하나
3. 개인 서사 — 실제로 있을 법한 자연스러운 경험 기반(과장된 숫자 금지)

형식: 첫 줄에 숫자·의외성·질문 중 하나로 훅을 만들 것. 해시태그는 2~3개까지만.
결과는 JSON으로만 출력: {"content": "..."}`;

const baseHandler = createMcpHandler(
  (server) => {
    // ── Supabase 범용 CRUD ──────────────────────────────────────────
    server.registerTool(
      'list_tables',
      {
        title: '테이블 목록 조회',
        description: '유쓰레드가 사용하는 Supabase 테이블 목록을 반환한다(ut_ 접두사, UShort와 공유 프로젝트).',
        inputSchema: {},
      },
      async () => textResult(ALLOWED_TABLES.join('\n'))
    );

    server.registerTool(
      'get_rows',
      {
        title: '테이블 행 조회',
        description: '지정한 테이블에서 행을 조회한다. eq 필터와 limit을 지원한다. list_tables로 먼저 테이블명을 확인할 것.',
        inputSchema: {
          table: z.enum(ALLOWED_TABLES as [string, ...string[]]),
          eqColumn: z.string().optional().describe('일치 조건을 걸 컬럼명 (선택)'),
          eqValue: z.string().optional().describe('eqColumn과 짝을 이루는 값 (선택)'),
          limit: z.number().int().min(1).max(200).optional().describe('기본 50'),
        },
      },
      async ({ table, eqColumn, eqValue, limit = 50 }) => {
        try {
          const supabase = getSupabaseServerClient();
          let query = supabase.from(table).select('*').limit(limit);
          if (eqColumn && eqValue !== undefined) query = query.eq(eqColumn, eqValue);
          const { data, error } = await query;
          if (error) throw new Error(error.message);
          return textResult(JSON.stringify(data, null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'upsert_row',
      {
        title: '테이블 행 생성/갱신',
        description: '지정한 테이블에 행을 upsert한다. data는 컬럼명:값 JSON 객체 문자열로 전달한다.',
        inputSchema: {
          table: z.enum(ALLOWED_TABLES as [string, ...string[]]),
          data: z.string().describe('JSON 객체 문자열. 예: {"name":"테스트","tone_prompt":"..."}'),
          onConflict: z.string().optional().describe('충돌 판정 컬럼(예: "user_id,provider")'),
        },
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ table, data, onConflict }) => {
        try {
          const parsed = JSON.parse(data);
          const supabase = getSupabaseServerClient();
          const query = supabase.from(table).upsert(parsed, onConflict ? { onConflict } : undefined).select();
          const { data: result, error } = await query;
          if (error) throw new Error(error.message);
          return textResult(JSON.stringify(result, null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'delete_row',
      {
        title: '테이블 행 삭제',
        description: '지정한 테이블에서 id 컬럼 값이 일치하는 행을 삭제한다.',
        inputSchema: {
          table: z.enum(ALLOWED_TABLES as [string, ...string[]]),
          id: z.string().describe('삭제할 행의 id 값'),
        },
        annotations: { destructiveHint: true, idempotentHint: true },
      },
      async ({ table, id }) => {
        try {
          const supabase = getSupabaseServerClient();
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw new Error(error.message);
          return textResult(`✅ ${table}에서 id=${id} 삭제 완료`);
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'run_sql',
      {
        title: '읽기전용 SQL 실행',
        description: 'SELECT 문만 실행 가능한 안전 SQL 실행 도구. 복잡한 조인/집계가 필요할 때 get_rows 대신 사용한다.',
        inputSchema: { query: z.string().describe('SELECT로 시작하는 SQL 쿼리') },
      },
      async ({ query }) => {
        try {
          const supabase = getSupabaseServerClient();
          const { data, error } = await supabase.rpc('ut_mcp_run_sql', { query });
          if (error) throw new Error(error.message);
          return textResult(JSON.stringify(data, null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    // ── 유쓰레드 도메인 기능 ──────────────────────────────────────────
    server.registerTool(
      'generate_thread_draft',
      {
        title: 'AI 쓰레드 초안 생성',
        description:
          'Gemini로 쓰레드(Threads) 글 초안을 생성해 ut_thread_posts에 저장한다. userId를 생략하면 ' +
          'MCP_OWNER_USER_ID(운영자 본인)의 Gemini BYOK 키를 사용한다. 발행 전에는 항상 사람에게 내용을 ' +
          '보여주고 승인받은 뒤 publish_thread_post를 호출할 것.',
        inputSchema: {
          topic: z.string().describe('작성할 주제'),
          userId: z.string().optional().describe('생략시 MCP_OWNER_USER_ID 사용'),
          personaId: z.string().optional().describe('ut_personas 또는 ut_system_personas의 id'),
          personaIsSystem: z.boolean().optional(),
          affiliateComment: z
            .string()
            .optional()
            .describe(
              '제휴 링크(쿠팡파트너스/토스 등)를 직접 붙여넣을 때 사용. API 연동 전이라 사람이 링크를 수동으로 전달하는 방식 — ' +
                '본문에 넣지 않고 발행 후 첫 댓글로 자동 게시된다(publish_thread_post가 처리).'
            ),
        },
        annotations: { destructiveHint: false, idempotentHint: false },
      },
      async ({ topic, userId, personaId, personaIsSystem, affiliateComment }) => {
        try {
          const uid = resolveUserId(userId);
          const supabase = getSupabaseServerClient();

          const { data: keyRow } = await supabase
            .from('ut_api_keys_vault')
            .select('encrypted_values')
            .eq('user_id', uid)
            .eq('provider', 'GEMINI')
            .maybeSingle();
          const encryptedKey = keyRow?.encrypted_values?.apiKey;
          if (!encryptedKey) throw new Error('해당 사용자의 Gemini API 키가 등록되어 있지 않습니다.');
          const apiKey = decryptVaultValue(encryptedKey);

          let personaContext = '';
          if (personaId && personaIsSystem) {
            const { data: sp } = await supabase.from('ut_system_personas').select('prompt').eq('id', personaId).maybeSingle();
            if (sp) personaContext = `\n\n페르소나 스타일 지침:\n${sp.prompt}`;
          } else if (personaId) {
            const { data: p } = await supabase.from('ut_personas').select('*').eq('id', personaId).eq('user_id', uid).maybeSingle();
            if (p) personaContext = `\n\n말투: ${p.tone_prompt || '기본'}\n타겟: ${p.target_prompt || '일반 독자'}`;
          }

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: BASE_SYSTEM_PROMPT + personaContext }] },
              contents: [{ role: 'user', parts: [{ text: `주제: ${topic}` }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          });
          if (!res.ok) throw new Error(`Gemini 요청 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
          const json = await res.json();
          const rawText = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
          let content = '';
          try {
            content = JSON.parse(rawText).content;
          } catch {
            content = rawText;
          }

          const { data: post, error } = await supabase
            .from('ut_thread_posts')
            .insert({
              user_id: uid,
              persona_id: personaIsSystem ? null : personaId || null,
              topic,
              content,
              status: 'draft',
              affiliate_comment: affiliateComment?.trim() || null,
            })
            .select()
            .single();
          if (error) throw new Error(error.message);

          return textResult(
            `✅ 초안 생성 완료 (id: ${post.id})\n\n${content}` +
              (post.affiliate_comment ? `\n\n[발행 시 첫 댓글로 자동 게시될 제휴 댓글]\n${post.affiliate_comment}` : '')
          );
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'publish_thread_post',
      {
        title: '쓰레드 초안 실제 발행',
        description: 'ut_thread_posts의 draft 상태 글을 실제 Threads 계정에 발행한다. 반드시 사람 승인 후 호출할 것.',
        inputSchema: {
          postId: z.string(),
          threadsAccountId: z.string().describe('ut_threads_accounts의 id'),
        },
        annotations: { destructiveHint: false, idempotentHint: false },
      },
      async ({ postId, threadsAccountId }) => {
        try {
          const supabase = getSupabaseServerClient();
          const { data: post } = await supabase.from('ut_thread_posts').select('*').eq('id', postId).maybeSingle();
          if (!post) throw new Error('글을 찾을 수 없습니다.');
          const { data: account } = await supabase.from('ut_threads_accounts').select('*').eq('id', threadsAccountId).maybeSingle();
          if (!account) throw new Error('연동된 Threads 계정을 찾을 수 없습니다.');

          // /write, /multi-write, 예약발행 크론과 동일한 공용 함수를 쓴다 —
          // 이전엔 여기서만 따로 발행 로직을 복제해뒀다가 타래 다단·제휴댓글이 누락되는 버그가 있었다.
          const result = await publishThreadPostNow(post, account);

          await supabase.from('ut_thread_posts').update({ status: 'posted', threads_account_id: threadsAccountId, threads_post_id: result.threadsPostId }).eq('id', postId);
          return textResult(
            `✅ 발행 완료: threads_post_id=${result.threadsPostId}` +
              (post.affiliate_comment ? '\n↳ 제휴 댓글도 첫 댓글로 함께 발행됨' : '')
          );
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'get_post_insights',
      {
        title: '발행된 글의 실제 조회수/반응 확인',
        description: '특정 Threads 게시물의 실제 조회수·좋아요·답글·리포스트·인용 수를 Threads Graph API로 직접 조회한다. 추측하지 말고 이걸로 확인할 것.',
        inputSchema: {
          postId: z.string().describe('ut_thread_posts의 id (threads_post_id를 자동으로 찾아 조회한다)'),
        },
      },
      async ({ postId }) => {
        try {
          const supabase = getSupabaseServerClient();
          const { data: post } = await supabase.from('ut_thread_posts').select('threads_post_id, threads_account_id').eq('id', postId).maybeSingle();
          if (!post?.threads_post_id) throw new Error('아직 발행되지 않았거나 threads_post_id가 없는 글입니다.');
          const { data: account } = await supabase.from('ut_threads_accounts').select('encrypted_access_token').eq('id', post.threads_account_id).maybeSingle();
          if (!account) throw new Error('연동된 Threads 계정을 찾을 수 없습니다.');
          const accessToken = decryptVaultValue(account.encrypted_access_token);
          const metrics = 'views,likes,replies,reposts,quotes';
          const res = await fetch(`https://graph.threads.net/v1.0/${post.threads_post_id}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message || JSON.stringify(json));
          return textResult(JSON.stringify(json.data, null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'list_mentions',
      {
        title: '내 계정에 달린 언급(멘션) 목록 조회',
        description:
          '연동된 Threads 계정에 언급(mention)된 게시물 목록을 실제 Threads API로 가져온다. ' +
          '⚠️ Meta 앱 심사(threads_manage_mentions) 승인 전에는 테스터 계정이 언급한 것만 반환됨(공식 문서 명시) — ' +
          '"멘션이 없다"고 바로 단정하지 말고 이 제약을 먼저 확인할 것.',
        inputSchema: { threadsAccountId: z.string().describe('ut_threads_accounts의 id') },
      },
      async ({ threadsAccountId }) => {
        try {
          const supabase = getSupabaseServerClient();
          const { data: account } = await supabase.from('ut_threads_accounts').select('*').eq('id', threadsAccountId).maybeSingle();
          if (!account) throw new Error('연동된 Threads 계정을 찾을 수 없습니다.');
          const accessToken = decryptVaultValue(account.encrypted_access_token);
          const fields = 'id,text,username,permalink,timestamp';
          const res = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/mentions?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message || JSON.stringify(json));
          return textResult(JSON.stringify(json.data || [], null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'reply_to_mention',
      {
        title: '언급(멘션)에 답글 달기',
        description: '언급된 게시물에 실제로 답글을 발행한다. 반드시 사람에게 답글 내용을 보여주고 승인받은 뒤 호출할 것.',
        inputSchema: {
          threadsAccountId: z.string().describe('ut_threads_accounts의 id'),
          mentionId: z.string().describe('답글을 달 게시물의 threads media id (list_mentions로 확인)'),
          text: z.string().describe('답글 내용'),
        },
        annotations: { destructiveHint: false, idempotentHint: false },
      },
      async ({ threadsAccountId, mentionId, text }) => {
        try {
          const supabase = getSupabaseServerClient();
          const { data: account } = await supabase.from('ut_threads_accounts').select('*').eq('id', threadsAccountId).maybeSingle();
          if (!account) throw new Error('연동된 Threads 계정을 찾을 수 없습니다.');
          const accessToken = decryptVaultValue(account.encrypted_access_token);
          const createRes = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media_type: 'TEXT', text, reply_to_id: mentionId, access_token: accessToken }),
          });
          const createJson = await createRes.json();
          if (!createRes.ok || !createJson.id) throw new Error(createJson.error?.message || JSON.stringify(createJson));
          const publishRes = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: createJson.id, access_token: accessToken }),
          });
          const publishJson = await publishRes.json();
          if (!publishRes.ok || !publishJson.id) throw new Error(publishJson.error?.message || JSON.stringify(publishJson));
          return textResult(`✅ 답글 발행 완료: reply_id=${publishJson.id}`);
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'search_coupang_products',
      {
        title: '쿠팡파트너스 상품 검색',
        description: '지정한 사용자의 쿠팡파트너스 BYOK 키로 실제 상품을 검색한다.',
        inputSchema: {
          keyword: z.string(),
          userId: z.string().optional().describe('생략시 MCP_OWNER_USER_ID 사용'),
        },
      },
      async ({ keyword, userId }) => {
        try {
          const uid = resolveUserId(userId);
          const supabase = getSupabaseServerClient();
          const { data: keyRow } = await supabase
            .from('ut_api_keys_vault')
            .select('encrypted_values')
            .eq('user_id', uid)
            .eq('provider', 'COUPANG')
            .maybeSingle();
          const enc = keyRow?.encrypted_values;
          if (!enc?.accessKey || !enc?.secretKey) throw new Error('쿠팡파트너스 키가 등록되어 있지 않습니다.');
          const products = await coupangSearchProducts(decryptVaultValue(enc.accessKey), decryptVaultValue(enc.secretKey), keyword);
          return textResult(JSON.stringify(products, null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'get_coupang_deeplink',
      {
        title: '쿠팡 제휴 딥링크 생성',
        description: '쿠팡 상품 URL을 실제 제휴 추적 딥링크로 변환한다.',
        inputSchema: { url: z.string(), userId: z.string().optional() },
      },
      async ({ url, userId }) => {
        try {
          const uid = resolveUserId(userId);
          const supabase = getSupabaseServerClient();
          const { data: keyRow } = await supabase
            .from('ut_api_keys_vault')
            .select('encrypted_values')
            .eq('user_id', uid)
            .eq('provider', 'COUPANG')
            .maybeSingle();
          const enc = keyRow?.encrypted_values;
          if (!enc?.accessKey || !enc?.secretKey) throw new Error('쿠팡파트너스 키가 등록되어 있지 않습니다.');
          const links = await coupangDeeplink(decryptVaultValue(enc.accessKey), decryptVaultValue(enc.secretKey), [url]);
          return textResult(JSON.stringify(links[0], null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'get_trend_keywords',
      {
        title: '네이버 트렌드 키워드 조회',
        description: '시드 키워드로 네이버 검색광고 연관 키워드+월간 검색량을 조회해 정렬한다.',
        inputSchema: { seedKeyword: z.string(), limit: z.number().int().min(1).max(50).optional() },
      },
      async ({ seedKeyword, limit = 20 }) => {
        try {
          const apiKey = process.env.NAVER_AD_API_KEY;
          const secretKey = process.env.NAVER_AD_SECRET_KEY;
          const customerId = process.env.NAVER_AD_CUSTOMER_ID;
          if (!apiKey || !secretKey || !customerId) throw new Error('네이버 검색광고 API 환경변수가 설정되어 있지 않습니다.');
          const keywords = await naverKeywordTool(apiKey, secretKey, customerId, seedKeyword);
          return textResult(JSON.stringify(rankByVolume(keywords, limit), null, 2));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    // ── GitHub 저장소 확인 ────────────────────────────────────────────
    server.registerTool(
      'list_github_files',
      {
        title: 'GitHub 저장소 파일 목록 조회',
        description: `${GITHUB_REPO} 저장소의 특정 경로에 어떤 파일·폴더가 있는지 조회한다. path를 비우면 루트를 본다.`,
        inputSchema: { path: z.string().optional(), ref: z.string().optional() },
      },
      async ({ path = '', ref = 'main' }) => {
        try {
          const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`;
          const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'u-thread-mcp' };
          if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`GitHub API 오류 (${res.status}): ${await res.text()}`);
          const data = await res.json();
          const list = Array.isArray(data) ? data : [data];
          const lines = list.map((f: { type: string; path: string; size: number }) => `${f.type === 'dir' ? '📁' : '📄'} ${f.path}${f.type === 'file' ? ` (${f.size} bytes)` : ''}`);
          return textResult(lines.join('\n'));
        } catch (err) {
          return errorResult(err);
        }
      }
    );

    server.registerTool(
      'get_github_file',
      {
        title: 'GitHub 저장소 파일 내용 조회',
        description: `${GITHUB_REPO} 저장소의 특정 파일 내용을 텍스트로 가져온다.`,
        inputSchema: { path: z.string(), ref: z.string().optional() },
      },
      async ({ path, ref = 'main' }) => {
        try {
          const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`;
          const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'u-thread-mcp' };
          if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`GitHub API 오류 (${res.status}): ${await res.text()}`);
          const data = await res.json();
          if (data.type !== 'file') throw new Error(`"${path}"는 파일이 아니라 ${data.type}입니다`);
          const content = Buffer.from(data.content, data.encoding || 'base64').toString('utf-8');
          return textResult(`[${path}] (${data.size} bytes)\n\n${content}`);
        } catch (err) {
          return errorResult(err);
        }
      }
    );
  },
  {
    instructions:
      '유쓰레드(U-Thread) MCP 서버 — Threads 콘텐츠 자동화 SaaS의 데이터/기능을 직접 다룬다. ' +
      'Supabase 범용 CRUD(list_tables/get_rows/upsert_row/delete_row/run_sql — run_sql은 SELECT만 허용), ' +
      '쓰레드 초안 생성/발행(generate_thread_draft/publish_thread_post — 발행 전 사람 승인 필수), ' +
      '발행 후 실제 성과 확인(get_post_insights), 멘션 조회/답글(list_mentions/reply_to_mention — 답글 전 사람 승인 필수), ' +
      '쿠팡파트너스 상품검색/딥링크(search_coupang_products/get_coupang_deeplink — API 미승인 상태면 generate_thread_draft의 affiliateComment로 링크를 직접 넘길 것), ' +
      '네이버 트렌드 키워드(get_trend_keywords), GitHub 저장소 조회(list_github_files/get_github_file)를 제공한다. ' +
      'userId를 요구하는 도구는 생략시 MCP_OWNER_USER_ID(운영자 본인 계정)를 기본으로 사용한다.',
    verboseLogs: true,
  }
);

async function authedHandler(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!process.env.MCP_SHARED_SECRET || key !== process.env.MCP_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: '인증 필요 (key 파라미터 확인)' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return baseHandler(request);
}

export { authedHandler as GET, authedHandler as POST };
