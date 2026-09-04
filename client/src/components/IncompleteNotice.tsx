import { AlertTriangle } from 'lucide-react';

// ============================================================
// IncompleteNotice: 「次へ」を押したのに進めなかったとき、
//   何が足りないかを "具体名で" 画面に残す共通バナー。
//   トースト(3秒で消える)だけだと顧客が理由を把握できずストレスで離脱する
//   ため、STEP1〜STEP7 で共通利用する(2026-09-04 冨永社長指摘)。
//   items が空 or show=false なら何も描画しない。
// ============================================================

export default function IncompleteNotice({
  show,
  heading,
  items,
  hint,
}: {
  show: boolean;
  heading: string;
  items: string[];
  hint?: string;
}) {
  if (!show || items.length === 0) return null;
  return (
    <div
      className="rounded-2xl border-2 p-4 shadow-sm"
      style={{ borderColor: '#F5A623', backgroundColor: '#FFF8EC' }}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#E8890C' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 mb-1">{heading}</p>
          <ul className="text-sm text-gray-700 space-y-0.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#E8890C' }}
                />
                <span className="font-semibold">{it}</span>
              </li>
            ))}
          </ul>
          {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
