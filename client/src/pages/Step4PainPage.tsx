import React, { useRef, useState } from 'react';
import { Plus, X, Camera, Trash2 } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import type { PainEntry } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import IncompleteNotice from '@/components/IncompleteNotice';
import { toast } from 'sonner';

// ============================================================
// Design: ビビッド・フォーム
// Step4PainPage: 痛みに関する情報（STEP 4）
// 順序: 痛みの有無 → [エントリーカード（部位→左右→Faces Scale→画像）×最大3件]
//       → ＋痛みを追加ボタン
// ============================================================

const PAIN_LOCATIONS = [
  '足の裏', '足首', '膝', '股関節', '腰', 'スネや太ももの外側', 'その他',
];

const PAIN_SIDES = ['左側', '右側', '両側', '該当なし'];

const FACE_SCALE_DATA = [
  { value: 0, label: 'まったく痛みがなくとても幸せ', emoji: '😄' },
  { value: 1, label: 'ちょっとだけ痛い', emoji: '🙂' },
  { value: 2, label: '痛い', emoji: '😕' },
  { value: 3, label: 'かなり痛い', emoji: '😟' },
  { value: 4, label: 'なんとか我慢できる非常に強い痛み', emoji: '😣' },
  { value: 5, label: '想像できる人生でもっとも強い痛み', emoji: '😭' },
];

const MAX_ENTRIES = 3;

function newEntry(id: string): PainEntry {
  return { id, locations: [], otherLocation: '', side: '', faceScale: null, photos: [] };
}

// ---- 単一エントリーカード ----
interface EntryCardProps {
  entry: PainEntry;
  index: number;
  canDelete: boolean;
  onChange: (updated: PainEntry) => void;
  onDelete: () => void;
}

function EntryCard({ entry, index, canDelete, onChange, onDelete }: EntryCardProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (data: Partial<PainEntry>) => onChange({ ...entry, ...data });

  const selectLocation = (loc: string) => {
    // 1つのみ選択（同じものをタップしたら解除）
    const locs = entry.locations.includes(loc) ? [] : [loc];
    update({ locations: locs });
  };

  const addCustom = () => {
    if (customLocation.trim()) {
      update({ locations: [...entry.locations, customLocation.trim()] });
      setCustomLocation('');
      setShowCustomInput(false);
    }
  };

  const removeLocation = (loc: string) => {
    update({ locations: entry.locations.filter(l => l !== loc) });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      update({ photos: [...entry.photos, ...files] });
    }
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    update({ photos: entry.photos.filter((_, i) => i !== idx) });
  };

  return (
    <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
      style={{ borderColor: '#93C5FD' }}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: '#DBEAFE' }}>
        <span className="text-sm font-bold" style={{ color: '#2563EB' }}>
          痛み {index + 1}
        </span>
        {canDelete && (
          <button onClick={onDelete}
            className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            削除
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* 1. 部位 */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">痛みの部位</h4>
          <p className="text-xs text-gray-400">痛みや違和感がある部位を1つ選択してください</p>

          <div className="grid grid-cols-3 gap-2">
            {PAIN_LOCATIONS.map(loc => (
              <button key={loc}
                onClick={() => loc === 'その他' ? setShowCustomInput(true) : selectLocation(loc)}
                className="h-10 rounded-xl text-xs font-medium border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: entry.locations.includes(loc) ? '#2563EB' : '#E5E7EB',
                  backgroundColor: entry.locations.includes(loc) ? '#DBEAFE' : 'white',
                  color: entry.locations.includes(loc) ? '#2563EB' : '#374151',
                }}>
                {loc}
              </button>
            ))}
          </div>

          {showCustomInput && (
            <div className="flex gap-2">
              <input type="text" value={customLocation}
                onChange={e => setCustomLocation(e.target.value)}
                placeholder="部位を入力"
                className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none"
                onFocus={e => (e.target.style.borderColor = '#2563EB')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              <button onClick={() => {
                if (customLocation.trim()) {
                  update({ locations: [customLocation.trim()] });
                  setCustomLocation('');
                  setShowCustomInput(false);
                }
              }}
                className="h-10 px-4 rounded-xl text-sm font-medium text-white active:scale-[0.97]"
                style={{ backgroundColor: '#2563EB' }}>
                決定
              </button>
            </div>
          )}


        </section>

        {/* 2. 左右 */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">痛みの左右</h4>
          <div className="grid grid-cols-2 gap-2">
            {PAIN_SIDES.map(side => (
              <button key={side}
                onClick={() => update({ side })}
                className="h-11 rounded-xl text-sm font-medium border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: entry.side === side ? '#2563EB' : '#E5E7EB',
                  backgroundColor: entry.side === side ? '#DBEAFE' : 'white',
                  color: entry.side === side ? '#2563EB' : '#374151',
                }}>
                {side}
              </button>
            ))}
          </div>
        </section>

        {/* 3. Faces Pain Scale */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">痛みの強さ（Faces Pain Scale）</h4>
            <p className="text-xs text-gray-400 mt-0.5">顔の表情を参考に、痛みの強さを選んでください</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {FACE_SCALE_DATA.map(face => (
              <button key={face.value}
                onClick={() => update({ faceScale: face.value })}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: entry.faceScale === face.value ? '#2563EB' : '#E5E7EB',
                  backgroundColor: entry.faceScale === face.value ? '#DBEAFE' : 'white',
                }}>
                <span className="text-5xl leading-none">{face.emoji}</span>
                <span className="text-3xl font-bold leading-none"
                  style={{ color: entry.faceScale === face.value ? '#2563EB' : '#374151' }}>
                  {face.value}
                </span>
                <span className="text-sm leading-tight text-center"
                  style={{ color: entry.faceScale === face.value ? '#2563EB' : '#6B7280' }}>
                  {face.label}
                </span>
              </button>
            ))}
          </div>

          {entry.faceScale !== null && (
            <div className="rounded-xl p-3 flex items-center gap-2"
              style={{ backgroundColor: '#DBEAFE' }}>
              <span className="text-xl">
                {FACE_SCALE_DATA.find(f => f.value === entry.faceScale)?.emoji}
              </span>
              <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>
                {entry.faceScale}：{FACE_SCALE_DATA.find(f => f.value === entry.faceScale)?.label}
              </span>
            </div>
          )}
        </section>

        {/* 4. 画像アップロード */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">痛い箇所の写真</h4>
          <p className="text-xs text-gray-400">
            痛い部位を指さして撮影した写真をアップロードしてください（任意）
          </p>

          {/* プレビュー */}
          {entry.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entry.photos.map((file, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`痛み${index + 1}の写真${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 w-full h-14 rounded-xl border-2 border-dashed justify-center text-sm font-medium transition-all active:scale-[0.97]"
            style={{ borderColor: '#2563EB', color: '#2563EB', backgroundColor: '#FDF0FA' }}>
            <Camera className="w-5 h-5" />
            写真を追加（カメラ / ライブラリ）
          </button>
        </section>
      </div>
    </div>
  );
}

// ---- メインページ ----
export default function Step4PainPage() {
  const { setCurrentPage, uploadData, updateUploadData } = useUpload();
  const { painInfo } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);
  const [hasPainError, setHasPainError] = useState(false);

  const updateEntries = (entries: PainEntry[]) => {
    updateUploadData({ painInfo: { ...painInfo, entries } });
  };

  const updateEntry = (idx: number, updated: PainEntry) => {
    const next = [...painInfo.entries];
    next[idx] = updated;
    updateEntries(next);
  };

  const addEntry = () => {
    if (painInfo.entries.length >= MAX_ENTRIES) return;
    const id = String(Date.now());
    updateEntries([...painInfo.entries, newEntry(id)]);
  };

  const deleteEntry = (idx: number) => {
    updateEntries(painInfo.entries.filter((_, i) => i !== idx));
  };

  const setHasPain = (val: boolean) => {
    updateUploadData({ painInfo: { ...painInfo, hasPain: val } });
    setHasPainError(false);
  };

  const handleNext = () => {
    layoutRef.current?.scrollToTop();
    if (painInfo.hasPain === null) {
      setHasPainError(true);
      toast.error('痛みの有無を選択してください');
      return;
    }
    setCurrentPage('step5');
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="痛みに関する情報"
      showBack
      onBack={() => setCurrentPage('step3')}
      currentStep={4}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step3')} className="flex-1">
            戻る
          </PinkButton>
          <PinkButton
            size="md"
            onClick={handleNext}
            className="flex-1">
            次へ
          </PinkButton>
        </div>
      }
    >
      <div className="space-y-5">
        <IncompleteNotice
          show={hasPainError}
          heading="次に進むには、あと 1 項目の選択が必要です。"
          items={['痛み・違和感の有無']}
          hint="下の「痛み・違和感はありますか？」で「ある」または「ない」を選択してください。"
        />

        {/* Section header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: '#2563EB' }}>
            4
          </div>
          <h2 className="text-base font-bold text-gray-800">痛みに関する情報</h2>
        </div>

        {/* 痛みの有無 */}
        <div
          className="bg-white rounded-2xl border-2 p-4 shadow-sm space-y-3 transition-all"
          style={{ borderColor: hasPainError ? '#F97316' : '#F3F4F6', backgroundColor: hasPainError ? '#FFF7ED' : 'white' }}
        >
          <h3 className="text-sm font-semibold text-gray-700">身体に痛みはありますか？</h3>
          <div className="grid grid-cols-2 gap-3">
            {[{ value: true, label: 'ある' }, { value: false, label: 'ない' }].map(opt => (
              <button key={String(opt.value)}
                onClick={() => setHasPain(opt.value)}
                className="h-14 rounded-xl text-sm font-semibold border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: painInfo.hasPain === opt.value ? '#2563EB' : '#E5E7EB',
                  backgroundColor: painInfo.hasPain === opt.value ? '#DBEAFE' : 'white',
                  color: painInfo.hasPain === opt.value ? '#2563EB' : '#374151',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          {hasPainError && (
            <p className="text-xs font-medium" style={{ color: '#F97316' }}>痛みの有無を選択してください</p>
          )}
        </div>

        {/* 痛みエントリー（痛みがある場合のみ） */}
        {painInfo.hasPain === true && (
          <>
            {painInfo.entries.map((entry, idx) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                index={idx}
                canDelete={painInfo.entries.length > 1}
                onChange={updated => updateEntry(idx, updated)}
                onDelete={() => deleteEntry(idx)}
              />
            ))}

            {/* ＋痛みを追加ボタン（最大3件） */}
            {painInfo.entries.length < MAX_ENTRIES && (
              <button
                onClick={addEntry}
                className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl border-2 border-dashed text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ borderColor: '#2563EB', color: '#2563EB', backgroundColor: '#FDF0FA' }}>
                <Plus className="w-5 h-5" />
                ＋ 痛みを追加（{painInfo.entries.length}/{MAX_ENTRIES}）
              </button>
            )}

            {painInfo.entries.length >= MAX_ENTRIES && (
              <p className="text-center text-xs text-gray-400">
                痛みの情報は最大{MAX_ENTRIES}件まで追加できます
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
