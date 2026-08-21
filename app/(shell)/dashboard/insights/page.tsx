'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const CATEGORIES = ['패션의류', '패션잡화', '화장품/미용', '디지털/가전', '가구/인테리어', '출산/육아', '식품', '스포츠/레저', '생활/건강', '여가/생활편의', '도서'];
const TABS = [
  { id: 'datalab', label: '데이터랩', free: true },
  { id: 'google', label: '구글 트렌드', free: false },
  { id: 'shopping', label: '쇼핑 트렌드', free: false },
  { id: 'realtime', label: '실시간 뉴스', free: false },
];

type RankedKeyword = { keyword: string; volume: number };
type NewsItem = { title: string; link: string; description: string; pubDate: string };
type GoogleTrendItem = { title: string; trafficLabel: string | null };
type ShoppingPoint = { period: string; ratio: number };

export default function InsightsPage() {
  const [tab, setTab] = useState('datalab');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [search, setSearch] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [keywords, setKeywords] = useState<RankedKeyword[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [googleTrends, setGoogleTrends] = useState<GoogleTrendItem[]>([]);
  const [shoppingPoints, setShoppingPoints] = useState<ShoppingPoint[]>([]);

  useEffect(() => {
    fetch('/api/subscription')
      .then((r) => r.json())
      .then((d) => setIsSubscribed(!!d.isSubscribed))
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    let req: Promise<Response>;
    if (tab === 'datalab') req = fetch(`/api/trends/datalab?category=${encodeURIComponent(category)}`);
    else if (tab === 'google') req = fetch('/api/trends/google');
    else if (tab === 'shopping') req = fetch(`/api/trends/shopping?category=${encodeURIComponent(category)}`);
    else req = fetch(`/api/trends/realtime?query=${encodeURIComponent(search || category)}`);

    req
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        if (tab === 'datalab') setKeywords(d.keywords || []);
        else if (tab === 'google') setGoogleTrends(d.items || []);
        else if (tab === 'shopping') setShoppingPoints(d.points || []);
        else setNewsItems(d.items || []);
        setSyncedAt(d.syncedAt);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (tab === 'datalab' || (isSubscribed && ['google', 'shopping', 'realtime'].includes(tab))) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category, isSubscribed]);

  function selectTab(id: string, free: boolean) {
    if (!free && !isSubscribed) {
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
        <span className="text-xs text-neutral-400">
          {syncedAt ? `최근 데이터 동기화 완료: ${new Date(syncedAt).toLocaleString('ko-KR')}` : '최근 데이터 동기화 완료: 기록 없음'}
        </span>
        <button onClick={load} className="border border-border px-4 py-2.5 text-xs font-bold">
          실시간 데이터 재동기화
        </button>
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
            {t.label} {!t.free && !isSubscribed && <span className="text-[10px]">🔒</span>}
          </button>
        ))}
      </div>

      {(tab === 'datalab' || tab === 'shopping') && (
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 text-[13px] font-black ${category === c ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-500'}`}
              style={{ borderRadius: 14 }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 font-black">
            {tab === 'datalab' && `📊 ${category} 인기 연관 키워드`}
            {tab === 'google' && '🌐 구글 트렌드 (한국, 오늘)'}
            {tab === 'shopping' && `🛍️ ${category} 쇼핑 관심도 추이 (최근 30일)`}
            {tab === 'realtime' && '📰 실시간 뉴스'}
          </div>
          {loading ? (
            <span className="text-xs bg-neutral-100 px-3 py-1 text-neutral-500">불러오는 중...</span>
          ) : (
            <span className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1">
              {tab === 'google' ? 'Google Trends 연동됨' : '네이버 API 연동됨'}
            </span>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

        {!error && tab === 'datalab' && (
          keywords.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-16">데이터가 없어요.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {keywords.map((k, i) => (
                <div key={k.keyword} className="flex items-center gap-3 border border-border p-3">
                  <span className={`w-6 h-6 rounded-full text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 ${i < 3 ? 'bg-blue-600' : 'bg-neutral-300'}`}>{i + 1}</span>
                  <span className="font-bold text-sm flex-1">{k.keyword}</span>
                  <span className="text-xs text-neutral-400">월 {k.volume.toLocaleString()}회</span>
                </div>
              ))}
            </div>
          )
        )}

        {!error && tab === 'google' && (
          googleTrends.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-16">데이터가 없어요.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {googleTrends.map((t, i) => (
                <div key={t.title} className="flex items-center gap-3 border border-border p-3">
                  <span className={`w-6 h-6 rounded-full text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 ${i < 3 ? 'bg-blue-600' : 'bg-neutral-300'}`}>{i + 1}</span>
                  <span className="font-bold text-sm flex-1">{t.title}</span>
                  {t.trafficLabel && <span className="text-xs text-neutral-400">{t.trafficLabel}+</span>}
                </div>
              ))}
            </div>
          )
        )}

        {!error && tab === 'shopping' && (
          shoppingPoints.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-16">데이터가 없어요.</p>
          ) : (
            <div className="space-y-2">
              {shoppingPoints.map((p) => (
                <div key={p.period} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 w-20 flex-shrink-0">{p.period}</span>
                  <div className="flex-1 bg-neutral-100 h-4 relative">
                    <div className="bg-blue-600 h-4" style={{ width: `${p.ratio}%` }} />
                  </div>
                  <span className="text-xs font-bold w-10 text-right">{p.ratio}</span>
                </div>
              ))}
            </div>
          )
        )}

        {!error && tab === 'realtime' && (
          newsItems.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-16">데이터가 없어요.</p>
          ) : (
            <div className="space-y-3">
              {newsItems.map((n) => (
                <a key={n.link} href={n.link} target="_blank" rel="noopener noreferrer" className="block border border-border p-3 hover:bg-neutral-50">
                  <div className="text-sm font-bold mb-1">{n.title}</div>
                  <div className="text-xs text-neutral-400 line-clamp-1">{n.description}</div>
                </a>
              ))}
            </div>
          )
        )}

        {tab === 'datalab' && (
          <p className="text-[10px] text-neutral-300 text-center mt-6">
            네이버 검색광고 키워드도구 기반 연관 검색량 정렬입니다(실시간 트렌드 랭킹과는 다를 수 있어요).
          </p>
        )}
        {tab === 'google' && (
          <p className="text-[10px] text-neutral-300 text-center mt-6">Google Trends 비공식 RSS 피드 기반입니다.</p>
        )}
        {tab === 'shopping' && (
          <p className="text-[10px] text-neutral-300 text-center mt-6">네이버 데이터랩 쇼핑인사이트 상대지수(0~100) 기반입니다.</p>
        )}
      </div>

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
