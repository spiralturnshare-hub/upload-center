import React, { useState } from 'react';
import { X, Video, ExternalLink } from 'lucide-react';
import PinkButton from '@/components/PinkButton';
import { toast } from 'sonner';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ============================================================
// Design: ビビッド・フォーム
// PreShootingDialog: アップロード開始前の事前撮影確認ダイアログ
// Primary: PANTONE Pink C (#2563EB)
//
// 元のDartコード: confirm_dialog_take_photo_required
// リンク先: https://dataguide.insoleorder.jp/
// ============================================================

const SHOOTING_GUIDE_URL = 'https://dataguide.insoleorder.jp/';

interface PreShootingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PreShootingDialog({ open, onClose, onConfirm }: PreShootingDialogProps) {
  const [checked, setChecked] = useState(false);
  const [checkError, setCheckError] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    if (!checked) {
      setCheckError(true);
      toast.error('撮影完了のチェックを入れてください');
      return;
    }
    setCheckError(false);
    onConfirm();
  };

  return (
    /* オーバーレイ */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ダイアログ本体 */}
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ animation: 'dialogIn 0.2s cubic-bezier(0.23,1,0.32,1)' }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">確認</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 本文 */}
        <div className="px-5 py-5 space-y-4">
          {/* メッセージ */}
          <p className="text-sm font-bold text-gray-800 text-center leading-relaxed">
            事前に必要な動画・画像の撮影を<br />行う必要があります。
          </p>

          {/* 撮影方法ボタン */}
          <a
            href={SHOOTING_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all duration-150 active:scale-[0.97] hover:opacity-80"
            style={{ borderColor: '#2563EB', color: '#2563EB' }}
          >
            <Video className="w-4 h-4 flex-shrink-0" />
            <span>撮影方法を確認する</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
          </a>

          {/* 区切り線 */}
          <div className="border-t border-gray-100" />

          {/* チェックボックス */}
          <button
            onClick={() => { setChecked(!checked); setCheckError(false); }}
            className="w-full flex items-start gap-3 text-left rounded-xl p-2 transition-all"
            style={{ backgroundColor: checkError ? ERROR_BG : 'transparent', outline: checkError ? `2px solid ${ERROR_BORDER}` : 'none' }}
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all duration-150 mt-0.5"
              style={{
                borderColor: checked ? '#2563EB' : checkError ? ERROR_BORDER : '#E5E7EB',
                backgroundColor: checked ? '#2563EB' : 'transparent',
              }}
            >
              {checked && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-xs text-gray-600 leading-relaxed">
              必要な動画・画像の撮影が終わっています。
            </span>
          </button>
        </div>

        {/* フッター */}
        <div className="px-5 pb-5">
          {checkError && <p className="text-xs font-medium mb-2 text-center" style={{ color: ERROR_BORDER }}>撮影完了のチェックを入れてください</p>}
          <PinkButton
            size="md"
            onClick={handleConfirm}
            className="w-full"
          >
            次へ
          </PinkButton>
        </div>
      </div>

      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
