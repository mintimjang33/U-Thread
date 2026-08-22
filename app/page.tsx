import Link from "next/link";

// PAS(Problem-Agitate-Solve) 구조의 랜딩페이지.

const painPoints = [
  {
    n: 1,
    title: "자동화의 함정",
    body: "90%의 자동화 툴 유저가 겪는 현실 — 매일 수십 개의 글을 예약 발행하고 올리지만 노출도는 점점 떨어지고, 결국 계정이 '섀도우 밴' 처리되어 그동안의 노력이 물거품이 됩니다.",
  },
  {
    n: 2,
    title: "AI 티 나는 콘텐츠",
    body: "누가 봐도 챗GPT가 복사해 붙인 듯한 전형적인 글을 적으시나요? 사람들은 1초 만에 AI임을 감별해 내고 피드를 이탈합니다. 진짜 '나'의 톤앤매너를 흉내내는 툴은 없었습니다.",
  },
  {
    n: 3,
    title: "API 키 보안·원가 문제",
    body: "API 원가 통제 불가와 보안 취약성 — 출처를 알 수 없는 확장 프로그램이나 스크립트에 고유 API 키를 저장하는 것은 집 비밀번호를 길거리에 적어두는 것과 같습니다.",
  },
];

const coreTech = [
  { label: "CORE TECH 1", title: "스마트 에디터 & 제휴 마케팅", desc: "제휴 API 연동으로 클릭 한 번에 제휴 링크 자동 생성" },
  { label: "CORE TECH 2", title: "데이터랩 & 실시간 트렌드", desc: "실시간 검색어, 트렌드 데이터 자동 수집" },
  { label: "CORE TECH 3", title: "쓰레드 아카이브 & 벤치마킹", desc: "작성한 모든 쓰레드 원본과 통계를 영구적으로 아카이브 보관" },
];

const stats = [
  { value: "0%", label: "Algorithm Penalty" },
  { value: "2.5x", label: "Reach Engagement" },
  { value: "100%", label: "Data Isolation" },
  { value: "∞", label: "Persona Scalability" },
];

export default function LandingPage() {
  return (
    <div className="bg-white text-black">
      <header className="flex items-center justify-between px-8 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-black text-sm">U</div>
          <span className="font-black text-lg tracking-tight">유쓰레드</span>
        </Link>
        <Link href="/login" className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-[11px] font-black rounded-pill transition-colors">
          LOGIN
        </Link>
      </header>

      <section className="text-center px-6 py-24 max-w-3xl mx-auto">
        <div className="inline-block bg-accent-soft text-accent text-[11px] font-black px-4 py-1.5 rounded-pill mb-6">
          ZERO-TRUST AI CONTENT ORCHESTRATION
        </div>
        <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6 break-keep">
          퍼스널 브랜딩과 수익화를 동시에 달성하세요.
        </h1>
        <p className="text-neutral-600 leading-relaxed mb-10 break-keep">
          기계적인 AI 글쓰기에 시간을 낭비하지 마세요. 유쓰레드는 알고리즘 페널티 없이
          당신의 영향력을 극대화하는 가장 완벽한 프리미엄 콘텐츠 오케스트레이션입니다.
        </p>
        <Link href="/signup" className="inline-block px-8 py-4 bg-accent hover:bg-accent-hover text-white text-[11px] font-black rounded-pill transition-colors">
          유쓰레드 시작하기
        </Link>
      </section>

      <section className="bg-neutral-50 py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {painPoints.map((p) => (
            <div key={p.n} className="bg-white border border-border p-8" style={{ borderRadius: 'var(--radius)' }}>
              <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-black mb-4">{p.n}</div>
              <h3 className="font-black text-lg mb-3">{p.title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6 text-center">
        <h2 className="text-2xl font-black mb-3">이 악순환을 끊어낼 거대한 해결책</h2>
        <p className="text-neutral-600 mb-14">유쓰레드만이 가진 압도적인 생성AI 기술의 격차를 확인하세요.</p>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {coreTech.map((c) => (
            <div key={c.label} className="border border-border p-8 text-left" style={{ borderRadius: 'var(--radius)' }}>
              <div className="text-xs font-black text-accent mb-3">{c.label}</div>
              <h3 className="font-black text-lg mb-3">{c.title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-accent text-white py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-black mb-1">{s.value}</div>
              <div className="text-xs text-violet-200">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="text-center px-6 py-24 max-w-2xl mx-auto">
        <h2 className="text-2xl font-black mb-4 break-keep">가장 진보된 형태의 파이프라인, 이제 당신이 직접 증명해 보세요.</h2>
        <p className="text-neutral-600 mb-10">
          단순히 영혼 없는 글을 찍어내는 낡은 방식에서 탈피하세요. 유쓰레드는 팔로워의 신뢰를 무너뜨리지 않으면서도,
          당신의 수익화 목표를 가장 기술적이고 정교하게 달성해 냅니다.
        </p>
        <Link href="/signup" className="inline-block px-8 py-4 bg-accent hover:bg-accent-hover text-white text-[11px] font-black rounded-pill transition-colors">
          유쓰레드 시작하기
        </Link>
      </section>

      <footer className="border-t border-border py-10 px-6 text-center text-xs text-neutral-400">
        <div className="font-black text-neutral-600 mb-2">ZERO-TRUST AI CONTENT ORCHESTRATION PLATFORM</div>
        <div>© 2026 유쓰레드. All rights reserved.</div>
      </footer>
    </div>
  );
}
