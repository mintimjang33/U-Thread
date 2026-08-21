'use client';

import { useState } from 'react';
import Link from 'next/link';

const CONTENT_TYPES = [
  { key: 'casual', icon: '⚡', label: '간편 글쓰기', desc: '일상·소통형 가벼운 글' },
  { key: 'expert', icon: '📝', label: '전문성 글쓰기', desc: '정보·칼럼·인사이트' },
  { key: 'coupang', icon: '📦', label: '쿠팡 파트너스', desc: '상품 리뷰 & 수익화' },
  { key: 'toss', icon: '🛒', label: '토스 쇼핑', desc: '토스 공동구매 & 제휴' },
  { key: 'affiliate', icon: '💰', label: '제휴 마케팅', desc: '기타 외부 제휴 링크' },
] as const;

type ContentTypeKey = (typeof CONTENT_TYPES)[number]['key'];

const TEXTAREA_COPY: Record<ContentTypeKey, { label: string; placeholder: string }> = {
  casual: {
    label: '모든 계정에 공통으로 적용될 주제 또는 원고 텍스트 (필수)',
    placeholder: '각 계정의 페르소나에 맞추어 다채롭게 바리에이션될 주제나 텍스트를 입력하세요...',
  },
  expert: {
    label: '모든 계정에 공통으로 적용될 주제 또는 원고 텍스트 (필수)',
    placeholder: '각 계정의 페르소나에 맞추어 다채롭게 바리에이션될 주제나 텍스트를 입력하세요...',
  },
  coupang: {
    label: '추가 강조할 내용 또는 참고 원고 (선택사항 - 비워둘 시 선택된 상품 정보로 AI 자동 작성)',
    placeholder: '선택된 상품에 대해 특별히 강조하고 싶은 리뷰 내용이나 타겟층이 있다면 입력하세요. (비워둘 시 AI가 상품에 맞춰 자유롭게 작성합니다)',
  },
  toss: {
    label: '추가 강조할 내용 또는 참고 원고 (선택사항 - 비워둘 시 선택된 상품 정보로 AI 자동 작성)',
    placeholder: '선택된 공동구매 상품에 대해 강조하고 싶은 내용이 있다면 입력하세요. (비워둘 시 AI가 자유롭게 작성합니다)',
  },
  affiliate: {
    label: '제휴 링크와 함께 소개할 내용 (필수)',
    placeholder: '소개할 제품/서비스와 제휴 링크에 대한 정보를 입력하세요...',
  },
};

export default function MultiEditorPage() {
  const [contentType, setContentType] = useState<ContentTypeKey>('casual');
  const [inputMode, setInputMode] = useState<'shared' | 'individual'>('shared');
  const [topic, setTopic] = useState('');
  const [mediaCount, setMediaCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState(true);
  const [googleSearch, setGoogleSearch] = useState(true);
  const [threadSegments, setThreadSegments] = useState(1);
  const [relayDelay, setRelayDelay] = useState(false);

  const copy = TEXTAREA_COPY[contentType];

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lg">⚡</span>
        <h1 className="text-xl font-black">멀티 에디터</h1>
      </div>
      <p className="text-xs text-neutral-400 mb-6 pl-7">여러 계정의 스레드 타래 글을 한 번에 동시 기획·생성·발행합니다</p>

      {/* 1. 발행 계정 선택 및 페르소나 매핑 */}
      <div className="border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center">1</span>
            <h2 className="font-black text-sm">발행 계정 선택 및 페르소나 매핑</h2>
          </div>
          <div className="text-[11px] text-neutral-400">
            <button className="mr-3 text-neutral-400">전체 해제</button>
            선택됨: <span className="font-black text-black">0</span> / 0개
          </div>
        </div>
        <div className="border border-dashed border-border py-10 text-center text-xs text-neutral-400">
          연동된 Threads 계정이 없습니다.{' '}
          <Link href="/dashboard/threads-manage" className="underline font-bold text-black">
            [내 쓰레드 관리]
          </Link>{' '}
          메뉴에서 계정을 연동해주세요.
        </div>
      </div>

      {/* 2. 글 작성 유형 선택 */}
      <div className="border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-5 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center">2</span>
          <h2 className="font-black text-sm">글 작성 유형 선택</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CONTENT_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setContentType(t.key)}
              className={`text-left border p-4 text-xs ${
                contentType === t.key ? 'border-black bg-neutral-50' : 'border-border'
              }`}
            >
              <div className="font-black mb-1">
                {t.icon} {t.label}
              </div>
              <div className="text-neutral-400 text-[10px]">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. 원고 내용 입력 및 미디어 첨부 */}
      <div className="border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center">3</span>
            <h2 className="font-black text-sm">원고 내용 입력 및 미디어 첨부</h2>
          </div>
          <div className="flex text-[11px] font-bold border border-border">
            <button
              onClick={() => setInputMode('shared')}
              className={`px-3 py-1.5 ${inputMode === 'shared' ? 'bg-black text-white' : 'text-neutral-400'}`}
            >
              🌐 전체 공통 입력
            </button>
            <button
              onClick={() => setInputMode('individual')}
              className={`px-3 py-1.5 ${inputMode === 'individual' ? 'bg-black text-white' : 'text-neutral-400'}`}
            >
              👤 계정별 개별 입력
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="bg-black text-white text-[11px] font-black px-3 py-2 cursor-pointer">
            🖼 사진/영상 첨부 ({mediaCount}개)
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => setMediaCount(e.target.files?.length || 0)}
            />
          </label>
          <Link href="/dashboard/benchmark" className="bg-amber-50 text-amber-700 text-[11px] font-black px-3 py-2">
            📁 벤치마킹 게시글 불러오기
          </Link>
          <Link href="/dashboard/insights" className="bg-rose-50 text-rose-600 text-[11px] font-black px-3 py-2">
            🔥 트렌드 주제
          </Link>
          <span className="text-[10px] text-neutral-400 ml-auto">첨부된 미디어는 모든 계정의 첫 타래에 공유됩니다.</span>
        </div>

        {inputMode === 'shared' ? (
          <div>
            <div className="text-xs font-bold mb-2">{copy.label}</div>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={copy.placeholder}
              rows={4}
              className="w-full border border-border px-3 py-2.5 text-sm"
            />
          </div>
        ) : (
          <div className="border border-dashed border-border py-8 text-center text-xs text-neutral-400">
            계정별 개별 입력은 Threads 계정 연동 후 계정 목록이 있어야 사용할 수 있어요.
          </div>
        )}
      </div>

      {/* 5. 글 작성 (원본에도 4번 없이 5로 점프) */}
      <div className="border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center">5</span>
            <h2 className="font-black text-sm">글 작성</h2>
          </div>
          <div className="text-[10px] text-neutral-400">
            📸 미디어{visionAnalysis ? 'ON' : 'OFF'} · 🔍 검색{googleSearch ? 'ON' : 'OFF'} · 🧵 {threadSegments}단
          </div>
        </div>

        <div className="flex items-center justify-between border border-border p-4 mb-4">
          <div>
            <div className="text-xs font-black mb-1">⚡ 글 작성 옵션</div>
            <div className="text-[11px] text-neutral-400">
              기본 글양식 설정이 적용되어 있습니다.
              <br />
              세부설정 버튼으로 변경할 수 있습니다.
            </div>
          </div>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="bg-black text-white text-[11px] font-black px-4 py-2"
          >
            ⚙ 세부설정
          </button>
        </div>

        {showSettings && (
          <div className="border border-border p-4 mb-4 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="font-black mb-1">
                📸 첨부 미디어 AI 비전 분석
                <div className="text-[10px] text-neutral-400 font-normal">이미지/영상을 분석하여 글에 반영합니다.</div>
              </div>
              <button
                onClick={() => setVisionAnalysis((v) => !v)}
                className={`w-9 h-5 rounded-full relative ${visionAnalysis ? 'bg-blue-600' : 'bg-neutral-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    visionAnalysis ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="font-black mb-1">
                🔍 실시간 구글 검색 활용
                <div className="text-[10px] text-neutral-400 font-normal">최신 웹 검색 팩트체크 기반으로 작성합니다.</div>
              </div>
              <button
                onClick={() => setGoogleSearch((v) => !v)}
                className={`w-9 h-5 rounded-full relative ${googleSearch ? 'bg-blue-600' : 'bg-neutral-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    googleSearch ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="text-xs">
              <div className="font-black mb-2">🧵 스레드 타래 갯수 (1~10단)</div>
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setThreadSegments(n)}
                    className={`w-7 h-7 text-[11px] font-bold ${
                      threadSegments === n ? 'bg-black text-white' : 'border border-border text-neutral-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="font-black mb-1">
                ⏱️ 타래별 시간차 지연 발행 (릴레이)
                <div className="text-[10px] text-neutral-400 font-normal">
                  {relayDelay ? '타래마다 시간차를 두고 순차 발행됩니다.' : '모든 타래가 한 번에 즉시 발행됩니다.'}
                </div>
              </div>
              <button
                onClick={() => setRelayDelay((v) => !v)}
                className={`w-9 h-5 rounded-full relative ${relayDelay ? 'bg-blue-600' : 'bg-neutral-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    relayDelay ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        <button disabled className="w-full bg-neutral-300 text-white text-[11px] font-black py-4 cursor-not-allowed">
          ✨ 선택한 0개 계정 맞춤 글 일괄 생성하기
        </button>
        <div className="text-[10px] text-neutral-400 text-center mt-2">
          Threads 계정 연동(Phase 4) 후 계정을 선택하면 생성 버튼이 활성화돼요.
        </div>
      </div>
    </div>
  );
}
