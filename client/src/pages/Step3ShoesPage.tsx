import React, { useState, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import { INSOLE_DISPLAY_NAMES, ROOM_SHOE_COLORS } from '@/lib/insoleConfig';
import type { ShoeInfo } from '@/contexts/UploadContext';
import { toast } from 'sonner';

// ============================================================
// Design: ビビッド・フォーム
// Step3ShoesPage: 靴情報の入力（STEP 3）
// - ルーム用: RoomComponent（シューズの色選択）
// - その他: ShoesComponent（ブランド・サイズ・フィット感）
// インソール種別ごとに独立したコンポーネントを表示
// ============================================================

const SHOE_BRANDS = [
  'アシックス', 'アディダス', 'エコー', 'キャロウェイ', 'スケッチャーズ',
  'ダンロップ', 'ナイキ', 'ニューバランス', 'フットジョイ', 'プーマ', 'ミズノ', 'その他',
];

const FIT_OPTIONS = [
  { value: 'tight', label: 'きつめ' },
  { value: 'just', label: 'ぴったり' },
  { value: 'loose', label: '緩め' },
];

const defaultShoeInfoLocal: ShoeInfo = {
  brand: '',
  otherBrand: '',
  size: '',
  insoleSize: '',
  fit: '',
  shoeFiles: [],
};

// エラーカラー定数
const ERROR_BORDER = '#F97316'; // オレンジ
const ERROR_BG = '#FFF7ED';

// 靴情報コンポーネント（ルーム用以外）
function ShoesComponent({ insoleKind, info, onChange, errors }: {
  insoleKind: string;
  info: ShoeInfo;
  onChange: (info: ShoeInfo) => void;
  errors: { brand?: boolean; size?: boolean; fit?: boolean };
}) {
  const update = (data: Partial<ShoeInfo>) => onChange({ ...info, ...data });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#FAFAFA' }}>
        <p className="text-sm font-semibold text-gray-800">
          {INSOLE_DISPLAY_NAMES[insoleKind as keyof typeof INSOLE_DISPLAY_NAMES] ?? insoleKind}の靴情報
        </p>
      </div>
      <div className="p-4 space-y-4">
        {/* ブランド */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">
            靴のブランド <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#D62598' }}>必須</span>
          </label>
          <div
            className="grid grid-cols-3 gap-2 rounded-xl p-2 transition-all"
            style={errors.brand ? { backgroundColor: ERROR_BG, outline: `2px solid ${ERROR_BORDER}`, outlineOffset: '0px' } : {}}
          >
            {SHOE_BRANDS.map(brand => (
              <button
                key={brand}
                onClick={() => update({ brand, otherBrand: '' })}
                className="h-10 rounded-xl text-xs font-medium border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: info.brand === brand ? '#D62598' : '#E5E7EB',
                  backgroundColor: info.brand === brand ? '#FCE4F4' : 'white',
                  color: info.brand === brand ? '#D62598' : '#374151',
                }}
              >
                {brand}
              </button>
            ))}
          </div>
          {errors.brand && (
            <p className="text-xs mt-1 font-medium" style={{ color: ERROR_BORDER }}>ブランドを選択してください</p>
          )}
          {info.brand === 'その他' && (
            <input
              type="text"
              value={info.otherBrand}
              onChange={e => update({ otherBrand: e.target.value })}
              placeholder="その他のブランド名を入力"
              className="mt-2 w-full h-11 px-4 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none transition-all"
              onFocus={e => (e.target.style.borderColor = '#D62598')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          )}
        </div>

        {/* 靴のサイズ */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            靴の表記サイズ <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#D62598' }}>必須</span>
          </label>
          <input
            type="text"
            value={info.size}
            onChange={e => update({ size: e.target.value })}
            placeholder="例）24.5cm / US8"
            className="w-full h-11 px-4 rounded-xl border-2 text-sm bg-white focus:outline-none transition-all"
            style={{
              borderColor: errors.size ? ERROR_BORDER : '#E5E7EB',
              backgroundColor: errors.size ? ERROR_BG : 'white',
            }}
            onFocus={e => (e.target.style.borderColor = errors.size ? ERROR_BORDER : '#D62598')}
            onBlur={e => (e.target.style.borderColor = errors.size ? ERROR_BORDER : '#E5E7EB')}
          />
          {errors.size && (
            <p className="text-xs mt-1 font-medium" style={{ color: ERROR_BORDER }}>靴のサイズを入力してください</p>
          )}
        </div>

        {/* 中底サイズ */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">中底サイズ（mm）</label>
          <input
            type="number"
            value={info.insoleSize}
            onChange={e => update({ insoleSize: e.target.value })}
            placeholder="例）245"
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none transition-all"
            onFocus={e => (e.target.style.borderColor = '#D62598')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
          <p className="text-xs text-gray-400 mt-1">※ なるべくmmでご記入ください</p>
        </div>

        {/* フィット感 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">
            靴のフィット感（主観） <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#D62598' }}>必須</span>
          </label>
          <div
            className="grid grid-cols-3 gap-2 rounded-xl p-1 transition-all"
            style={errors.fit ? { backgroundColor: ERROR_BG, outline: `2px solid ${ERROR_BORDER}`, outlineOffset: '0px' } : {}}
          >
            {FIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ fit: opt.value as 'tight' | 'just' | 'loose' })}
                className="h-11 rounded-xl text-sm font-medium border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: info.fit === opt.value ? '#D62598' : errors.fit ? ERROR_BORDER : '#E5E7EB',
                  backgroundColor: info.fit === opt.value ? '#FCE4F4' : 'white',
                  color: info.fit === opt.value ? '#D62598' : '#374151',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {errors.fit && (
            <p className="text-xs mt-1 font-medium" style={{ color: ERROR_BORDER }}>フィット感を選択してください</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ルーム用シューズ：3色まとめた1枚の画像
const ROOM_SHOE_ALL_IMAGE = '/manus-storage/room_shoe_notxt_9afb1c1b.png';

const ROOM_SHOE_BORDER_COLORS: Record<string, string> = {
  pink: '#D62598',
  light_gray: '#9CA3AF',
  navy: '#1E3A5F',
};

const ROOM_SHOE_BG_COLORS: Record<string, string> = {
  pink: '#FCE4F4',
  light_gray: '#F3F4F6',
  navy: '#1E3A5F',
};

const ROOM_SHOE_TEXT_COLORS: Record<string, string> = {
  pink: '#D62598',
  light_gray: '#374151',
  navy: '#ffffff',
};

// ルーム用コンポーネント（1枚画像＋選択ボタン）
function RoomComponent({ color, onChange, hasError }: {
  color: string;
  onChange: (color: string) => void;
  hasError: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#FAFAFA' }}>
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">ルームシューズの色 <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#D62598' }}>必須</span></p>
        <p className="text-xs text-gray-400 mt-0.5">ご希望のシューズの色を選択してください</p>
      </div>
      <div className="p-4 space-y-4">
        {/* 3色まとめた参考画像 */}
        <div className="rounded-xl overflow-hidden border border-gray-100">
          <img
            src={ROOM_SHOE_ALL_IMAGE}
            alt="ルームシューズカラーバリエーション（ピンク・ライトグレー・ネイビー）"
            className="w-full object-contain"
          />
        </div>

        {/* 色選択ボタン */}
        <div>
          <div
            className="grid grid-cols-3 gap-2 rounded-xl p-1.5 transition-all"
            style={hasError ? { backgroundColor: ERROR_BG, outline: `2px solid ${ERROR_BORDER}` } : {}}
          >
            {ROOM_SHOE_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => onChange(c.value)}
                className="h-11 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: color === c.value ? ROOM_SHOE_BORDER_COLORS[c.value] : hasError ? ERROR_BORDER : '#E5E7EB',
                  borderWidth: color === c.value ? '3px' : '2px',
                  backgroundColor: color === c.value ? ROOM_SHOE_BG_COLORS[c.value] : 'white',
                  color: color === c.value ? ROOM_SHOE_TEXT_COLORS[c.value] : '#374151',
                }}
              >
                {color === c.value && (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {c.label}
              </button>
            ))}
          </div>
          {hasError && (
            <p className="text-xs mt-1 font-medium" style={{ color: ERROR_BORDER }}>シューズの色を選択してください</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Step3ShoesPage() {
  const { setCurrentPage, uploadData, updateUploadData } = useUpload();
  const { selectedInsoles, shoeInfos, roomColor } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);

  // エラー状態管理
  const [shoeErrors, setShoeErrors] = useState<Record<string, { brand?: boolean; size?: boolean; fit?: boolean }>>({});
  const [roomError, setRoomError] = useState(false);

  const handleShoeInfoChange = (kind: string, info: ShoeInfo) => {
    updateUploadData({ shoeInfos: { ...shoeInfos, [kind]: info } });
    // 入力されたらエラーをクリア
    if (shoeErrors[kind]) {
      setShoeErrors(prev => ({
        ...prev,
        [kind]: {
          brand: info.brand ? false : prev[kind]?.brand,
          size: info.size ? false : prev[kind]?.size,
          fit: info.fit ? false : prev[kind]?.fit,
        },
      }));
    }
  };

  const handleRoomColorChange = (color: string) => {
    updateUploadData({ roomColor: color });
    if (roomError) setRoomError(false);
  };

  const handleNext = () => {
    layoutRef.current?.scrollToTop();

    let hasError = false;
    const newShoeErrors: Record<string, { brand?: boolean; size?: boolean }> = {};

    selectedInsoles.forEach(kind => {
      if (kind === 'room') {
        if (!roomColor) {
          setRoomError(true);
          hasError = true;
        }
      } else {
        const info = shoeInfos[kind] ?? defaultShoeInfoLocal;
        const errs: { brand?: boolean; size?: boolean; fit?: boolean } = {};
        if (!info.brand) { errs.brand = true; hasError = true; }
        if (!info.size) { errs.size = true; hasError = true; }
        if (!info.fit) { errs.fit = true; hasError = true; }
        if (Object.keys(errs).length > 0) newShoeErrors[kind] = errs;
      }
    });

    setShoeErrors(newShoeErrors);

    if (hasError) {
      toast.error('未入力の項目があります');
      return;
    }

    setCurrentPage('step4');
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="靴の情報入力"
      showBack
      onBack={() => setCurrentPage('step2')}
      currentStep={3}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step2')} className="flex-1">
            戻る
          </PinkButton>
          <PinkButton size="md" onClick={handleNext} className="flex-1">
            次へ
          </PinkButton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Section header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#D62598' }}>
              3
            </div>
            <h2 className="text-base font-bold text-gray-800">靴の情報を入力します</h2>
          </div>
        </div>

        {selectedInsoles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">ホーム画面でインソール種別を選択してください</p>
          </div>
        ) : (
          selectedInsoles.map(kind =>
            kind === 'room'
              ? <RoomComponent key={kind} color={roomColor} onChange={handleRoomColorChange} hasError={roomError} />
              : <ShoesComponent
                  key={kind}
                  insoleKind={kind}
                  info={shoeInfos[kind] ?? defaultShoeInfoLocal}
                  onChange={info => handleShoeInfoChange(kind, info)}
                  errors={shoeErrors[kind] ?? {}}
                />
          )
        )}
      </div>
    </AppLayout>
  );
}
