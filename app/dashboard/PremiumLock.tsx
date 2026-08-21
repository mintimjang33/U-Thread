import Link from 'next/link';

export function PremiumLock({ message }: { message: string }) {
  return (
    <div className="border border-border bg-neutral-50 p-10 text-center max-w-lg mx-auto mt-10">
      <div className="text-3xl mb-4">🔒</div>
      <p className="text-sm text-neutral-600 leading-relaxed mb-6">{message}</p>
      <Link href="/purchase" className="inline-block bg-black text-white text-[11px] font-black px-6 py-3">
        프리미엄 구독하기
      </Link>
    </div>
  );
}
