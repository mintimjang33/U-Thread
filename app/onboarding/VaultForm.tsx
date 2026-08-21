'use client';

import { useState } from 'react';

type Field = { key: string; label: string; placeholder?: string; type?: string };

export function VaultForm({ provider, serviceName, fields }: { provider: string; serviceName: string; fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="bg-white border border-border p-8 max-w-md w-full">
        <h1 className="font-black text-lg mb-4">유쓰레드 보안 볼트 (VAULT)</h1>
        <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
          BYOK 보안 프로토콜이 적용되었습니다. 귀하의 {serviceName} API 키는 데이터베이스에 통합 AES-256 암호화되어 저장됩니다.
        </p>

        <div className="space-y-3 mb-6">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-bold text-neutral-500 block mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={values[f.key] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-border px-3 py-2.5 text-sm"
              />
            </div>
          ))}
        </div>

        {error && <div className="text-xs text-red-500 mb-3">{error}</div>}
        {saved && <div className="text-xs text-green-600 mb-3">저장됐어요.</div>}

        <button onClick={handleSave} disabled={saving} className="w-full bg-black text-white text-[11px] font-black py-3">
          {saving ? '저장 중...' : '볼트에 저장하기'}
        </button>
      </div>
    </div>
  );
}
