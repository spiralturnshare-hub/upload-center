import React, { useState, useRef } from 'react';
import { Info, Footprints, Shirt, CheckCircle2, ExternalLink } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import UploadZone from '@/components/UploadZone';
import { getRequiredImageTypes, INSOLE_DISPLAY_NAMES } from '@/lib/insoleConfig';
import { toast } from 'sonner';

// ============================================================
// Design: ビビッド・フォーム
// Step2PhotoPage: 画像のアップロード（STEP 2）
// インソール種別に応じて足の写真・靴の写真を動的に表示
// foot: 常に表示（ピンク枠のアップロードゾーンは削除）
// shoes: ルーム用以外のインソールが含まれる場合に表示（インソールごと）
// 撮影方法ボタン: 動画STEPと同じ「撮影方法を確認する」ボタンで統一
// ============================================================

const SHOOTING_GUIDE_URL = 'https://dataguide.insoleorder.jp/';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Step2PhotoPage() {
  const { setCurrentPage, uploadData, updateUploadData } = useUpload();
  const { selectedInsoles, footPhotoFiles, footPhotosUploaded, shoePhotoFiles, shoePhotosUploaded } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);

  const requiredImageTypes = getRequiredImageTypes(selectedInsoles);
  const needsShoePhoto = requiredImageTypes.includes('shoes');

  // 靴の写真が必要なインソール（room以外）
  const shoePhotoInsoles = selectedInsoles.filter(k => k !== 'room');

  const [footStatus, setFootStatus] = useState<UploadStatus>('idle');
  const [footProgress, setFootProgress] = useState<number>(0);
  const [shoeStatus, setShoeStatus] = useState<Record<string, UploadStatus>>({});
  const [shoeProgress, setShoeProgress] = useState<Record<string, number>>({});

  const simulateUpload = (
    setStatus: (s: UploadStatus) => void,
    setProgress: React.Dispatch<React.SetStateAction<number>>,
    onDone: () => void
  ) => {
    setStatus('uploading');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 15;
        if (next >= 100) {
          clearInterval(interval);
          setStatus('success');
          // setTimeoutで次のレンダリングサイクルに延期して呼び出す
          setTimeout(() => onDone(), 0);
          return 100;
        }
        return next;
      });
    }, 150);
  };

  const handleFootFilesChange = (files: File[]) => {
    updateUploadData({ footPhotoFiles: files });
    if (files.length === 0) {
      setFootStatus('idle');
      setFootProgress(0);
      updateUploadData({ footPhotosUploaded: false });
    } else {
      simulateUpload(setFootStatus, setFootProgress, () => {
        updateUploadData({ footPhotosUploaded: true });
      });
    }
  };

  const handleShoeFilesChange = (insoleKind: string, files: File[]) => {
    const newFiles = { ...shoePhotoFiles, [insoleKind]: files };
    updateUploadData({ shoePhotoFiles: newFiles });
    if (files.length === 0) {
      setShoeStatus(prev => ({ ...prev, [insoleKind]: 'idle' }));
      setShoeProgress(prev => ({ ...prev, [insoleKind]: 0 }));
      updateUploadData({ shoePhotosUploaded: { ...shoePhotosUploaded, [insoleKind]: false } });
      return;
    }
    if (files.length > 0) {
      setShoeStatus(prev => ({ ...prev, [insoleKind]: 'uploading' }));
      setShoeProgress(prev => ({ ...prev, [insoleKind]: 0 }));
      const interval = setInterval(() => {
        setShoeProgress(prev => {
          const next = (prev[insoleKind] ?? 0) + 15;
          if (next >= 100) {
            clearInterval(interval);
            setShoeStatus(s => ({ ...s, [insoleKind]: 'success' }));
            // setTimeoutで次のレンダリングサイクルに延期して呼び出す
            setTimeout(() => {
              updateUploadData({ shoePhotosUploaded: { ...shoePhotosUploaded, [insoleKind]: true } });
            }, 0);
            return { ...prev, [insoleKind]: 100 };
          }
          return { ...prev, [insoleKind]: next };
        });
      }, 150);
    }
  };

  // 全ての必要な写真がアップロード済みかチェック
  const footDone = footPhotosUploaded || footStatus === 'success' || footPhotoFiles.length > 0;
  const shoeDone = !needsShoePhoto || shoePhotoInsoles.every(
    k => shoePhotosUploaded[k] || (shoeStatus[k] === 'success') || ((shoePhotoFiles[k]?.length ?? 0) > 0)
  );
  const canProceed = footDone && shoeDone;

  const handleNext = () => {
    layoutRef.current?.scrollToTop();
    if (!canProceed) {
      toast.error('全ての画像をアップロードしてください');
      return;
    }
    setCurrentPage('step3');
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="画像のアップロード"
      showBack
      onBack={() => setCurrentPage('step1')}
      currentStep={2}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step1')} className="flex-1">
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
              2
            </div>
            <h2 className="text-base font-bold text-gray-800">画像のアップロードを行います</h2>
          </div>
        </div>

        {/* ① 足の画像 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ backgroundColor: footDone ? '#F0FDF4' : '#FAFAFA' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: footDone ? '#DCFCE7' : '#FCE4F4' }}
            >
              {footDone
                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                : <Footprints className="w-4 h-4" style={{ color: '#D62598' }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">足の画像</p>
              <p className="text-xs text-gray-400">
                {footDone ? 'アップロード済み' : 'アップロードされていません'}
              </p>
            </div>
            <a
              href={SHOOTING_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 hover:opacity-80 active:scale-[0.97] flex-shrink-0"
              style={{ borderColor: '#D62598', color: '#D62598', backgroundColor: '#FCE4F4' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              <span>撮影方法を確認する</span>
            </a>
          </div>

          <div className="p-4 space-y-3">
            <UploadZone
              accept="image/*"
              type="photo"
              label="足の画像を選択（1枚）"
              hint=""
              files={footPhotoFiles.slice(0, 1)}
              onFilesChange={(f) => handleFootFilesChange(f.slice(0, 1))}
              status={footStatus}
              uploadProgress={footProgress}
            />
          </div>
        </div>

        {/* ② 靴の画像 */}
        {needsShoePhoto && shoePhotoInsoles.map(insoleKind => {
          const files = shoePhotoFiles[insoleKind] ?? [];
          const status = shoeStatus[insoleKind] ?? 'idle';
          const progress = shoeProgress[insoleKind] ?? 0;
          const done = shoePhotosUploaded[insoleKind] || status === 'success' || files.length > 0;

          return (
            <div key={insoleKind} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
                style={{ backgroundColor: done ? '#F0FDF4' : '#FAFAFA' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: done ? '#DCFCE7' : '#FCE4F4' }}
                >
                  {done
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Shirt className="w-4 h-4" style={{ color: '#D62598' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {INSOLE_DISPLAY_NAMES[insoleKind]}で利用する靴の画像
                  </p>
                  <p className="text-xs text-gray-400">
                    {done ? 'アップロード済み' : 'アップロードされていません'}
                  </p>
                </div>
                <a
                  href={SHOOTING_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 hover:opacity-80 active:scale-[0.97] flex-shrink-0"
                  style={{ borderColor: '#D62598', color: '#D62598', backgroundColor: '#FCE4F4' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>撮影方法を確認する</span>
                </a>
              </div>

              <div className="p-4">
                <UploadZone
                  accept="image/*"
                  type="photo"
                  label="靴の画像を選択（1枚）"
                  hint=""
                  files={files.slice(0, 1)}
                  onFilesChange={(f) => handleShoeFilesChange(insoleKind, f.slice(0, 1))}
                  status={status}
                  uploadProgress={progress}
                />
              </div>
            </div>
          );
        })}

        {/* Info */}
        <div className="rounded-xl p-4 flex gap-3" style={{ backgroundColor: '#FCE4F4' }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#D62598' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#a81b77' }}>
            ※ 中敷きが糊付けされ取り外しづらい場合は、ドライヤーで適度に温めてから取り外してください
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
