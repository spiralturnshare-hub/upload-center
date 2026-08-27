/**
 * GuestUploadPage.tsx
 * ゲストアップロード画面（4ステップ）
 * Step 1: アンケート（理由選択）
 * Step 2: アップロード方法選択（決済IDあり/なし）
 * Step 3: インソール種別選択（STEP 1の前の画面）
 * Step 4: ゲスト確認・撮影チェック
 * Design: Dart UIに準拠
 */
import { useState, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { ArrowLeft, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import InsoleSelector from '@/components/InsoleSelector';
import type { InsoleKind } from '@/lib/insoleConfig';
import { toast } from 'sonner';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

type Step = 'questionnaire' | 'method-select' | 'insole-select' | 'guest-confirm';

const REASONS = [
  'システムエラーにより決済が正常に行えなかった',
  '決済は完了したが、決済完了IDのメールが届かない・見当たらない',
  'アップロード方法がわからない',
  'ゲストアップロードを使うように依頼された',
  'その他',
];

export default function GuestUploadPage() {
  const { setCurrentPage, setIsGuestUpload, updateUploadData, initUploadSession } = useUpload();
  const [step, setStep] = useState<Step>('questionnaire');
  const [selectedReason, setSelectedReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const [photoChecked, setPhotoChecked] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [reasonError, setReasonError] = useState(false);
  const [otherTextError, setOtherTextError] = useState(false);
  const [insoleError, setInsoleError] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // インソール種別選択用の状態（ゲストアップロード画面内で管理）
  const [selectedInsoles, setSelectedInsoles] = useState<InsoleKind[]>([]);

  const scrollToTop = () => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    window.scrollTo({ top: 0 });
  };

  const handleNextFromQuestionnaire = () => {
    scrollToTop();
    let hasError = false;
    if (!selectedReason) { setReasonError(true); hasError = true; }
    if (selectedReason === 'その他' && !otherText.trim()) { setOtherTextError(true); hasError = true; }
    if (hasError) { toast.error('選択してください'); return; }
    setStep('method-select');
  };

  const handleGoToPaymentId = () => {
    setCurrentPage('payment-id-upload');
  };

  const handleGuestConfirm = () => {
    setStep('insole-select');
  };

  const handleNextFromInsoleSelect = () => {
    scrollToTop();
    if (selectedInsoles.length === 0) { setInsoleError(true); toast.error('インソール種別を選択してください'); return; }
    setStep('guest-confirm');
  };

  const handleStartGuestUpload = async () => {
    scrollToTop();
    if (!photoChecked) { setPhotoError(true); toast.error('撮影完了のチェックを入れてください'); return; }
    setIsGuestUpload(true);
    updateUploadData({ selectedInsoles });
    try {
      // uploadId 生成 + uploads 行を draft(guest_tf=true)で先に作成(FK対策)
      await initUploadSession({ selectedInsoles, isGuest: true });
      setCurrentPage('step1');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'アップロードの開始に失敗しました。');
    }
  };

  const handleBack = () => {
    if (step === 'questionnaire') setCurrentPage('home');
    else if (step === 'method-select') setStep('questionnaire');
    else if (step === 'insole-select') setStep('method-select');
    else if (step === 'guest-confirm') setStep('insole-select');
  };

  const stepTitle: Record<Step, string> = {
    'questionnaire': 'アンケート',
    'method-select': 'アップロード方法を選択',
    'insole-select': 'インソール種別を選択',
    'guest-confirm': '確認',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">
          {stepTitle[step]}
        </h1>
      </div>

      {/* コンテンツ */}
      <div ref={contentRef} data-scroll-container className="flex-1 p-4 max-w-lg mx-auto w-full overflow-y-auto">

        {/* ─── STEP 1: アンケート ─── */}
        {step === 'questionnaire' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
            <p className="text-sm font-semibold text-center text-gray-700 mb-6 leading-relaxed">
              ゲストアップロードを行う理由を<br />
              下記よりお選びください
            </p>

            {reasonError && <p className="text-xs font-medium mb-3 px-1" style={{ color: ERROR_BORDER }}>理由を選択してください</p>}
            <div className="space-y-2 mb-6">
              {REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setSelectedReason(reason);
                    setReasonError(false);
                    if (reason !== 'その他') setOtherText('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                    selectedReason === reason
                      ? 'border-pink-400 bg-pink-50'
                      : reasonError ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      selectedReason === reason
                        ? 'border-pink-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedReason === reason && (
                      <div className="w-2 h-2 rounded-full bg-pink-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-700 leading-snug">{reason}</span>
                </button>
              ))}
            </div>

            {selectedReason === 'その他' && (
              <div className="mb-6">
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  自由記載欄
                </Label>
                <Textarea
                  value={otherText}
                  onChange={(e) => { setOtherText(e.target.value); setOtherTextError(false); }}
                  placeholder="理由をご記入ください"
                  rows={3}
                  className="text-sm"
                  autoFocus
                  style={{ borderColor: otherTextError ? ERROR_BORDER : undefined, backgroundColor: otherTextError ? ERROR_BG : undefined }}
                />
                {otherTextError && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>理由を入力してください</p>}
              </div>
            )}

            <Button
              onClick={handleNextFromQuestionnaire}
              className="w-full font-semibold"
              style={{ backgroundColor: '#D62598' }}
            >
              次へ
            </Button>
          </div>
        )}

        {/* ─── STEP 2: アップロード方法選択 ─── */}
        {step === 'method-select' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
            <p className="text-sm text-center text-gray-600 mb-6">
              ご回答ありがとうございます
            </p>

            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-4 leading-relaxed">
                決済完了IDは決済後に登録したEmailアドレスに届きます。<br />
                決済完了IDをお持ちの場合は下記よりアップロードください。
              </p>
              <Button
                onClick={handleGoToPaymentId}
                className="w-full font-semibold"
                style={{ backgroundColor: '#D62598' }}
              >
                決済完了IDでアップロード
              </Button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400">または</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-4">
                決済完了IDをお持ちでない場合
              </p>
              <Button
                variant="outline"
                onClick={handleGuestConfirm}
                className="w-full font-semibold border-gray-300"
              >
                ゲストアップロードに進む
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: インソール種別選択 ─── */}
        {step === 'insole-select' && (
          <div className="mt-4 space-y-4">
            {/* 説明カード */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                ご注文のインソール種別を選択してください
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                選択した種別に応じて、アップロードに必要な動画・画像が決まります。最大2つまで選択できます。
              </p>
            </div>

            {/* InsoleSelectorコンポーネント（トップ画面と同じUI） */}
            <InsoleSelector
              value={selectedInsoles}
              onChange={setSelectedInsoles}
              maxCount={2}
            />

            {insoleError && <p className="text-xs font-medium mb-2 text-center" style={{ color: ERROR_BORDER }}>インソール種別を1つ以上選択してください</p>}
            <Button
              onClick={handleNextFromInsoleSelect}
              className="w-full font-semibold"
              style={{ backgroundColor: '#D62598' }}
            >
              次へ
            </Button>
          </div>
        )}

        {/* ─── STEP 4: ゲスト確認・撮影チェック ─── */}
        {step === 'guest-confirm' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
            {/* 警告バナー */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-amber-800 leading-relaxed">
                事前に必要な動画・画像の撮影を行う必要があります。
              </p>
            </div>

            {/* 撮影方法リンク */}
            <a
              href="https://dataguide.insoleorder.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all mb-6"
            >
              <ExternalLink className="w-4 h-4" />
              撮影方法はこちら
            </a>

            <div className="border-t border-gray-100 mb-6" />

            {/* 撮影完了チェックボックス */}
            <button
              onClick={() => { setPhotoChecked(!photoChecked); setPhotoError(false); }}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-lg border transition-all ${
                photoChecked
                  ? 'border-pink-400 bg-pink-50'
                  : photoError ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {photoChecked ? (
                <CheckSquare className="w-5 h-5 text-pink-500 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 shrink-0" />
              )}
              <span className="text-sm font-medium text-gray-700 text-left leading-snug">
                必要な動画・画像の撮影が終わっています。
              </span>
            </button>

            <div className="mt-6">
              {photoError && <p className="text-xs font-medium mb-2 text-center" style={{ color: ERROR_BORDER }}>撮影完了のチェックを入れてください</p>}
              <Button
                onClick={handleStartGuestUpload}
                className="w-full font-semibold"
                style={{ backgroundColor: '#D62598' }}
              >
                アップロードを開始する
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
