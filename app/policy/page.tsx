export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-16">
        <section id="terms">
          <h1 className="text-xl font-black mb-4">이용약관</h1>
          <div className="text-sm text-neutral-600 leading-relaxed space-y-3">
            <p>본 약관은 유쓰레드(이하 &quot;회사&quot;)가 제공하는 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정합니다.</p>
            <p>회원은 본인의 계정으로 등록한 외부 API 키(Gemini, 쿠팡파트너스, Threads 등)의 사용 및 관리에 대한 책임을 집니다. 회사는 등록된 키를 암호화하여 저장하며, 회원의 명시적 요청에 의해서만 해당 API를 호출합니다.</p>
            <p>회사는 서비스의 안정적인 제공을 위해 노력하나, 외부 서비스(Meta Threads, Google Gemini, 쿠팡파트너스 등)의 정책 변경이나 장애로 인한 서비스 중단에 대해서는 책임을 지지 않습니다.</p>
          </div>
        </section>

        <section id="privacy">
          <h1 className="text-xl font-black mb-4">개인정보처리방침</h1>
          <div className="text-sm text-neutral-600 leading-relaxed space-y-3">
            <p>회사는 회원의 이메일, 이름, 회사명 등 계정 정보를 서비스 제공 목적으로만 수집·이용합니다.</p>
            <p>회원이 등록한 외부 API 키는 AES-256-GCM 방식으로 암호화되어 데이터베이스에 저장되며, 회사 운영자를 포함한 누구도 평문으로 열람할 수 없습니다.</p>
            <p>회원 탈퇴 시 관련 개인정보 및 등록된 API 키는 지체 없이 파기됩니다.</p>
          </div>
        </section>

        <section id="support">
          <h1 className="text-xl font-black mb-4">도움말 및 지원</h1>
          <div className="text-sm text-neutral-600 leading-relaxed space-y-3">
            <p>서비스 이용 중 문의사항이 있으면 각 기능 페이지 상단의 &quot;사용법 보기&quot; 안내나, 대시보드 좌측 하단의 &quot;API 연동이 힘드신가요?&quot; 가이드를 참고해주세요.</p>
          </div>
        </section>

        <section id="status">
          <h1 className="text-xl font-black mb-4">API 상태</h1>
          <div className="text-sm text-neutral-600 leading-relaxed space-y-2">
            <div className="flex items-center justify-between border border-border px-4 py-2.5">
              <span>Supabase (DB/Auth)</span>
              <span className="text-emerald-600 font-bold text-xs">● 정상</span>
            </div>
            <div className="flex items-center justify-between border border-border px-4 py-2.5">
              <span>Gemini API</span>
              <span className="text-emerald-600 font-bold text-xs">● 정상</span>
            </div>
            <div className="flex items-center justify-between border border-border px-4 py-2.5">
              <span>Threads API</span>
              <span className="text-emerald-600 font-bold text-xs">● 정상</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
