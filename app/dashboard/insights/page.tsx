'use client';

import { useState } from 'react';
import Link from 'next/link';

const CATEGORIES = ['패션의류', '패션잡화', '화장품/미용', '디지털/가전', '가구/인테리어', '출산/육아', '식품', '스포츠/레저', '생활/건강', '여가/생활편의', '도서'];
const TABS = [
  { id: 'datalab', label: '데이터랩', free: true },
  { id: 'google', label: '구글 트렌드', free: false },
  { id: 'shopping', label: '쇼핑 트렌드', free: false },
  { id: 'realtime', label: '실시간 뉴스', free: false },
];

export default function InsightsPage() {
  const [tab, setTab] = useState('datalab');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [showLockModal, setShowLockModal] = useState(false);
  const [search, setSearch] = useState('');

  function selectTab(id: string, free: boolean) {
    if (!free) {
      setShowLockModal(true);
      return;
    }
    setTab(id);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">트렌드 & 인사이트</h1>
        <span className="text-[11px] bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full">트렌드 & 인사이트 사용법 보기</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 flex items-center border border-border px-3 py-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="쓰레드 인기 글 검색 (예: 마케팅, AI)"
            className="flex-1 text-sm outline-none"
          />
        </div>
        <span className="text-xs text-neutral-400">최근 데이터 동기화 완료: 기록 없음</span>
        <button className="border border-border px-4 py-2.5 text-xs font-bold">실시간 데이터 재동기화</button>
      </div>

      <div className="flex gap-8 border-b border-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id, t.free)}
            className={`pb-3 text-sm font-black flex items-center gap-1.5 ${
              tab === t.id ? 'border-b-2 border-black text-black' : 'text-neutral-400'
            }`}
          >
            {t.label} {!t.free && <span className="text-[10px]">🔒</span>}
          </button>
        ))}
      </div>

      {tab === 'datalab' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 text-[13px] font-black ${
                  category === c ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-500'
                }`}
                style={{ borderRadius: 14 }}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 font-black">📊 {category} 트렌드 TOP 500</div>
              <span className="text-xs bg-neutral-100 px-3 py-1 text-neutral-500">데이터 연동 대기중</span>
            </div>
            <p className="text-sm text-neutral-400 text-center py-16">
              실제 트렌드 데이터는 준비 중이에요. (원본은 비공식 스크래핑 영역이라, 공식 오픈API/자체 데이터로 대체 예정)
            </p>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowLockModal(false)}>
          <div className="bg-white p-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold mb-6">
              프리미엄 구독이 필요합니다 — 실시간 뉴스, 구글/쇼핑 트렌드 기능은 프리미엄 회원 전용입니다.
            </p>
            <div className="flex gap-2">
              <Link href="/purchase" className="flex-1 text-center bg-black text-white text-[11px] font-black py-3">
                구독하기
              </Link>
              <button onClick={() => setShowLockModal(false)} className="flex-1 border border-border text-[11px] font-black py-3">
                나중에 할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
