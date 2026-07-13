import React, { useRef, useState } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import { getRequiredQuestionTypes } from '@/lib/insoleConfig';
import { toast } from 'sonner';

// ============================================================
// Design: ビビッド・フォーム
// Step5PurposePage: 作製目的（STEP 5）
// インソール種別に応じた質問セクションを動的表示:
//   daily: 普段の生活スタイル（walk/room/kids/beauty）
//   normal: インソール作製目的・重視項目（walk/room/kids）
//   sports: スポーツプレイスタイル・目的（sports系）
//   golf: ゴルフ目的・プレイスタイル・左右足の重視項目（golf）
//   beauty: ビューティー目的（beauty）
// ============================================================

const LIFESTYLE_OPTIONS = ['歩くことが多い', '立っていることが多い', '同じくらい'];
const NORMAL_PURPOSE_OPTIONS = [
  '健康増進、障害予防', '疲れの軽減', '痛みの軽減', '美容',
  '身体の発達促進（お子様の場合）', 'スポーツのパフォーマンス向上', 'その他',
];
const SPORTS_PLAYSTYLE_OPTIONS = [
  'プロ・実業団選手としてプレーしている',
  'プロではないが常により高いレベルを目指している',
  '記録や成績より健康増進や楽しむことを重視している',
];
const SPORTS_PURPOSE_OPTIONS = [
  'スポーツのパフォーマンス向上', '怪我の予防', '疲れを軽減するため', 'その他',
];
const GOLF_PURPOSE_OPTIONS = [
  '足元からゴルフスイングを改善したい',
  '快適に歩いてゴルフを楽しみたい',
  'その中間',
];
const GOLF_PLAYSTYLE_OPTIONS = [
  'カートを使用することが多い', '歩いてプレイすることが多い', '同じくらい',
];
const RIGHT_FOOT_FOCUS_OPTIONS = [
  'バックスイング時右足にもっと体重を乗せたい',
  'バックスイング時に右方向へのSWAYを軽減したい',
  '右足は自由に動かせるようにしたい',
];
const LEFT_FOOT_FOCUS_OPTIONS = [
  'ダウンスイングからフォローにかけて左足にもっと体重を乗せたい',
  'ダウンスイングからフォローにかけて左方向へのSWAYを軽減したい',
  '左足は自由に動かせるようにしたい',
];
const BEAUTY_PURPOSE_OPTIONS = [
  '外反母趾・内反小趾の改善', '足のむくみ改善', '姿勢改善', '美脚・ウォーキング改善', 'その他',
];

function RadioGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-600 mb-2">{label}</label>}
      <div className="space-y-2">
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            className="w-full flex items-center gap-3 min-h-11 px-4 py-2 rounded-xl border-2 text-sm text-left transition-all duration-150 active:scale-[0.98]"
            style={{
              borderColor: value === opt ? '#D62598' : '#E5E7EB',
              backgroundColor: value === opt ? '#FCE4F4' : 'white',
              color: value === opt ? '#D62598' : '#374151',
            }}
          >
            <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{ borderColor: value === opt ? '#D62598' : '#D1D5DB' }}>
              {value === opt && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#D62598' }} />}
            </div>
            <span className="text-xs leading-tight">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({ label, options, values, onChange }: {
  label: string; options: string[]; values: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) onChange(values.filter(v => v !== opt));
    else onChange([...values, opt]);
  };
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-600 mb-2">{label}</label>}
      <div className="space-y-2">
        {options.map(opt => {
          const checked = values.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)}
              className="w-full flex items-center gap-3 min-h-11 px-4 py-2 rounded-xl border-2 text-sm text-left transition-all duration-150 active:scale-[0.98]"
              style={{
                borderColor: checked ? '#D62598' : '#E5E7EB',
                backgroundColor: checked ? '#FCE4F4' : 'white',
                color: checked ? '#D62598' : '#374151',
              }}
            >
              <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: checked ? '#D62598' : '#D1D5DB', backgroundColor: checked ? '#D62598' : 'transparent' }}>
                {checked && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs leading-tight">{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// エラーカラー定数
const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

export default function Step5PurposePage() {
  const { setCurrentPage, uploadData, updateUploadData } = useUpload();
  const { selectedInsoles, purposeInfo } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const requiredQuestionTypes = getRequiredQuestionTypes(selectedInsoles);
  const hasDaily = requiredQuestionTypes.includes('daily');
  const hasNormal = requiredQuestionTypes.includes('normal');
  const hasSports = requiredQuestionTypes.includes('sports');
  const hasGolf = requiredQuestionTypes.includes('golf');
  const hasBeauty = requiredQuestionTypes.includes('beauty');

  const update = (data: Partial<typeof purposeInfo>) => {
    updateUploadData({ purposeInfo: { ...purposeInfo, ...data } });
    // 入力されたらエラーをクリア
    if (data.purposes !== undefined && data.purposes.length > 0) setErrors(prev => ({ ...prev, purposes: false }));
    if (data.playstyle !== undefined && data.playstyle !== '') setErrors(prev => ({ ...prev, playstyle: false }));
  };

  const canProceed = (() => {
    if (hasGolf && purposeInfo.purposes.length === 0) return false;
    if (hasSports && (purposeInfo.playstyle === '' || purposeInfo.purposes.length === 0)) return false;
    if (hasNormal && purposeInfo.purposes.length === 0) return false;
    if (hasBeauty && purposeInfo.purposes.length === 0) return false;
    return selectedInsoles.length > 0;
  })();

  const handleNext = () => {
    layoutRef.current?.scrollToTop();
    if (!canProceed) {
      const newErrors: Record<string, boolean> = {};
      if ((hasGolf || hasNormal || hasSports || hasBeauty) && purposeInfo.purposes.length === 0) {
        newErrors.purposes = true;
      }
      if (hasSports && purposeInfo.playstyle === '') {
        newErrors.playstyle = true;
      }
      setErrors(newErrors);
      toast.error('未入力の項目があります');
      return;
    }
    setCurrentPage('step6');
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="インソールの作製目的"
      showBack
      onBack={() => setCurrentPage('step4')}
      currentStep={5}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step4')} className="flex-1">戻る</PinkButton>
          <PinkButton size="md" onClick={handleNext} className="flex-1">次へ</PinkButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#D62598' }}>5</div>
            <h2 className="text-base font-bold text-gray-800">インソールの作製目的</h2>
          </div>
          <p className="text-xs text-gray-400 ml-8">インソールの作製目的についてお聞きします</p>
        </div>

        {selectedInsoles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">ホーム画面でインソール種別を選択してください</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* daily: 普段の生活スタイル */}
            {hasDaily && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <RadioGroup
                  label="普段の生活スタイル"
                  options={LIFESTYLE_OPTIONS}
                  value={purposeInfo.lifestyle}
                  onChange={v => update({ lifestyle: v })}
                />
              </div>
            )}

            {/* normal: インソール作製目的（walk/room/kids） */}
            {hasNormal && (
              <div
                className="bg-white rounded-2xl border-2 p-4 shadow-sm space-y-4 transition-all"
                style={{ borderColor: errors.purposes ? ERROR_BORDER : '#F3F4F6', backgroundColor: errors.purposes ? ERROR_BG : 'white' }}
              >
                <CheckboxGroup
                  label="インソールの作製目的"
                  options={NORMAL_PURPOSE_OPTIONS}
                  values={purposeInfo.purposes}
                  onChange={v => update({ purposes: v })}
                />
                {purposeInfo.purposes.includes('その他') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">その他の内容を入力</label>
                    <textarea
                      value={purposeInfo.otherPurpose}
                      onChange={e => update({ otherPurpose: e.target.value })}
                      placeholder="その他の内容を記述してください"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none transition-all resize-none"
                      onFocus={e => (e.target.style.borderColor = '#D62598')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* sports: スポーツプレイスタイル・目的 */}
            {hasSports && (
              <div
                className="bg-white rounded-2xl border-2 p-4 shadow-sm space-y-4 transition-all"
                style={{ borderColor: (errors.playstyle || errors.purposes) ? ERROR_BORDER : '#F3F4F6', backgroundColor: (errors.playstyle || errors.purposes) ? ERROR_BG : 'white' }}
              >
                <RadioGroup
                  label="スポーツのプレイスタイル"
                  options={SPORTS_PLAYSTYLE_OPTIONS}
                  value={purposeInfo.playstyle}
                  onChange={v => update({ playstyle: v })}
                />
                <CheckboxGroup
                  label="インソールの作製目的"
                  options={SPORTS_PURPOSE_OPTIONS}
                  values={purposeInfo.purposes}
                  onChange={v => update({ purposes: v })}
                />
                {purposeInfo.purposes.includes('その他') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">その他の内容を入力</label>
                    <textarea
                      value={purposeInfo.otherPurpose}
                      onChange={e => update({ otherPurpose: e.target.value })}
                      placeholder="その他の内容を記述してください"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none transition-all resize-none"
                      onFocus={e => (e.target.style.borderColor = '#D62598')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* golf: ゴルフ目的・プレイスタイル・左右足の重視項目 */}
            {hasGolf && (
              <div
                className="bg-white rounded-2xl border-2 p-4 shadow-sm space-y-5 transition-all"
                style={{ borderColor: errors.purposes ? ERROR_BORDER : '#F3F4F6', backgroundColor: errors.purposes ? ERROR_BG : 'white' }}
              >
                <RadioGroup
                  label="インソールの作製目的"
                  options={GOLF_PURPOSE_OPTIONS}
                  value={purposeInfo.purposes[0] ?? ''}
                  onChange={v => update({ purposes: [v] })}
                />
                {purposeInfo.purposes[0] === 'その中間' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">その他の内容を入力</label>
                    <textarea
                      value={purposeInfo.otherPurpose}
                      onChange={e => update({ otherPurpose: e.target.value })}
                      placeholder="その他の内容を記述してください"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none transition-all resize-none"
                      onFocus={e => (e.target.style.borderColor = '#D62598')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                    />
                  </div>
                )}
                <RadioGroup
                  label="ゴルフのプレイスタイル"
                  options={GOLF_PLAYSTYLE_OPTIONS}
                  value={purposeInfo.playstyle}
                  onChange={v => update({ playstyle: v })}
                />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#D62598' }}>右</div>
                    <span className="text-xs font-semibold text-gray-600">右足で重視する項目</span>
                  </div>
                  <CheckboxGroup
                    label=""
                    options={RIGHT_FOOT_FOCUS_OPTIONS}
                    values={purposeInfo.rightFocusItems}
                    onChange={v => update({ rightFocusItems: v })}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#D62598' }}>左</div>
                    <span className="text-xs font-semibold text-gray-600">左足で重視する項目</span>
                  </div>
                  <CheckboxGroup
                    label=""
                    options={LEFT_FOOT_FOCUS_OPTIONS}
                    values={purposeInfo.leftFocusItems}
                    onChange={v => update({ leftFocusItems: v })}
                  />
                </div>
              </div>
            )}

            {/* beauty: ビューティー目的 */}
            {hasBeauty && (
              <div
                className="bg-white rounded-2xl border-2 p-4 shadow-sm transition-all"
                style={{ borderColor: errors.purposes ? ERROR_BORDER : '#F3F4F6', backgroundColor: errors.purposes ? ERROR_BG : 'white' }}
              >
                <CheckboxGroup
                  label="インソールの作製目的"
                  options={BEAUTY_PURPOSE_OPTIONS}
                  values={purposeInfo.purposes}
                  onChange={v => update({ purposes: v })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
