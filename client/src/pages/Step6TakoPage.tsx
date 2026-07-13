import React, { useRef } from 'react';
import { X, Paperclip, Camera } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';

// ============================================================
// Design: ビビッド・フォーム
// Step6TakoPage: 足の裏に関する情報（STEP 6）
// - Dartオリジナル足の裏画像（左右）を使用
// - 画像の下に番号選択ボタンを配置（Dartと同じ方式）
// - 左足・右足を縦に並べて表示
// - その他自由記述欄 + データ添付欄（複数可）
// ============================================================

const FOOT_LABELS: Record<number, string> = {
  1: '①',
  2: '②',
  3: '③',
  4: '④',
  5: '⑤',
  6: '⑥',
  7: '⑦',
};

const LEFT_FOOT_IMG = '/manus-storage/foot_left_08402453.png';
const RIGHT_FOOT_IMG = '/manus-storage/foot_right_f9193245.png';

// ---- 足の裏コンポーネント ----
interface FootSectionProps {
  side: '左' | '右';
  imageSrc: string;
  selected: number[];
  onToggle: (id: number) => void;
}

function FootSection({ side, imageSrc, selected, onToggle }: FootSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">{side}足の裏</h3>
        {selected.length > 0 && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#FCE4F4', color: '#D62598' }}
          >
            {selected.length}箇所選択中
          </span>
        )}
      </div>

      {/* 足の裏画像（参照用） */}
      <div className="px-4 pt-4">
        <img
          src={imageSrc}
          alt={`${side}足の裏`}
          className="w-full object-contain select-none rounded-xl"
          style={{ maxHeight: 220 }}
          draggable={false}
        />
      </div>

      {/* 番号選択ボタン（画像の下） */}
      <div className="px-4 pt-3 pb-4">
        <p className="text-xs text-gray-400 mb-2 text-center">
          タコや痛みがある番号をタップしてください（複数選択可）
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7].map(id => {
            const isSelected = selected.includes(id);
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold transition-all duration-150 active:scale-90"
                style={{
                  backgroundColor: isSelected ? '#D62598' : '#F3F4F6',
                  color: isSelected ? 'white' : '#D62598',
                  border: `2px solid ${isSelected ? '#D62598' : '#E5E7EB'}`,
                  boxShadow: isSelected ? '0 0 0 3px rgba(214,37,152,0.2)' : 'none',
                }}
                aria-label={`${id}番`}
              >
                {id}
              </button>
            );
          })}
        </div>

        {/* 選択中の部位タグ */}
        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {selected.sort((a, b) => a - b).map(id => (
              <span
                key={id}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#FCE4F4', color: '#D62598' }}
              >
                {FOOT_LABELS[id]} 番
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- メインページ ----
export default function Step6TakoPage() {
  const { setCurrentPage, uploadData, updateUploadData } = useUpload();
  const { takoInfo } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleLeft = (id: number) => {
    const next = takoInfo.leftPositions.includes(id)
      ? takoInfo.leftPositions.filter(p => p !== id)
      : [...takoInfo.leftPositions, id];
    updateUploadData({ takoInfo: { ...takoInfo, leftPositions: next } });
  };

  const toggleRight = (id: number) => {
    const next = takoInfo.rightPositions.includes(id)
      ? takoInfo.rightPositions.filter(p => p !== id)
      : [...takoInfo.rightPositions, id];
    updateUploadData({ takoInfo: { ...takoInfo, rightPositions: next } });
  };

  const handleOtherNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateUploadData({ takoInfo: { ...takoInfo, otherNote: e.target.value } });
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      updateUploadData({ takoInfo: { ...takoInfo, attachments: [...takoInfo.attachments, ...files] } });
    }
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    updateUploadData({
      takoInfo: { ...takoInfo, attachments: takoInfo.attachments.filter((_, i) => i !== idx) }
    });
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="足の裏に関する情報"
      showBack
      onBack={() => setCurrentPage('step5')}
      currentStep={6}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step5')} className="flex-1">
            戻る
          </PinkButton>
          <PinkButton size="md" onClick={() => { layoutRef.current?.scrollToTop(); setCurrentPage('step7'); }} className="flex-1">
            次へ
          </PinkButton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Section header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: '#D62598' }}
            >
              6
            </div>
            <h2 className="text-base font-bold text-gray-800">足の裏に関する情報</h2>
          </div>
          <p className="text-xs text-gray-400 ml-8">
            足裏のタコや痛みがある部位の番号をタップしてください
          </p>
        </div>

        {/* 左足 */}
        <FootSection
          side="左"
          imageSrc={LEFT_FOOT_IMG}
          selected={takoInfo.leftPositions}
          onToggle={toggleLeft}
        />

        {/* 右足 */}
        <FootSection
          side="右"
          imageSrc={RIGHT_FOOT_IMG}
          selected={takoInfo.rightPositions}
          onToggle={toggleRight}
        />

        {/* その他・自由記述 + データ添付 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#FAFAFA' }}>
            <p className="text-sm font-semibold text-gray-800">その他</p>
            <p className="text-xs text-gray-400 mt-0.5">
              気になることがあれば自由にご記入ください
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* 自由記述欄 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                自由記述
              </label>
              <textarea
                value={takoInfo.otherNote}
                onChange={handleOtherNoteChange}
                placeholder="タコや魚の目、その他気になる症状などをご記入ください"
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none transition-colors"
                onFocus={e => (e.target.style.borderColor = '#D62598')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* データ添付欄 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                データを添付してください（必要に応じてデータを添付してください。フットプリントもこちらから）
                <span className="ml-1 text-gray-400">※複数可</span>
              </label>

              {/* 添付済みファイル一覧 */}
              {takoInfo.attachments.length > 0 && (
                <div className="mb-3 space-y-2">
                  {takoInfo.attachments.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-100 p-3"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#FCE4F4' }}
                      >
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <Paperclip className="w-4 h-4" style={{ color: '#D62598' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 添付ボタン */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic"
                multiple
                className="hidden"
                onChange={handleAttachmentChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 w-full h-14 rounded-xl border-2 border-dashed justify-center text-sm font-medium transition-all active:scale-[0.97]"
                style={{ borderColor: '#D62598', color: '#D62598', backgroundColor: '#FDF0FA' }}
              >
                <Camera className="w-4 h-4" />
                <span>ファイルを追加する</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
