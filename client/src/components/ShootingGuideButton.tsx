import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';

// ============================================================
// ShootingGuideOverlay / ShootingGuideButton: 「撮影方法を確認する」導線
//   2026-09-05 冨永社長指摘: 従来は target="_blank" で外部タブに遷移していたため、
//   ガイドページ側に「戻る」導線が無く、お客様が「どのタブ/画面だったか分からず
//   迷子になる」という声があった。ガイドページ(dataguide.insoleorder.jp)は
//   X-Frame-Options 等の埋め込みブロックが無いことを確認済みのため、
//   タブ遷移ではなくアプリ内オーバーレイ(iframe + 常時表示の「閉じる」)に変更。
//   ブラウザ・タブは1つのまま = 閉じるボタンを押すだけで確実に元の画面に戻れる。
//   (スマホでは window.open のサイズ指定によるポップアップは機能せず新規タブと
//    同じ挙動になるため、ポップアップ化は解決策にならない)
// ============================================================

const SHOOTING_GUIDE_URL = 'https://dataguide.insoleorder.jp/';

/** オーバーレイ本体(iframe + 閉じるボタン)。トリガーのボタンデザインが個別に違う画面向け */
export function ShootingGuideOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
        <span className="text-sm font-bold text-gray-800">撮影方法</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: '#2563EB' }}
        >
          <X className="w-3.5 h-3.5" />
          閉じる
        </button>
      </div>
      <iframe
        src={SHOOTING_GUIDE_URL}
        title="撮影方法"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}

/** 既定の小さいピル型ボタン(注文一覧の各項目で使う共通デザイン) */
export default function ShootingGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 hover:opacity-80 active:scale-[0.97] flex-shrink-0"
        style={{ borderColor: '#2563EB', color: '#2563EB', backgroundColor: '#DBEAFE' }}
      >
        <ExternalLink className="w-3 h-3" />
        <span>撮影方法を確認する</span>
      </button>
      <ShootingGuideOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
