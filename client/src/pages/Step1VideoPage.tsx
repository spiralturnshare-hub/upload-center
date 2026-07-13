import { useState, useRef } from 'react';
import { Video, CheckCircle2, ExternalLink } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import UploadZone from '@/components/UploadZone';
import {
  getRequiredVideoTypes,
  VIDEO_KIND_LABELS,
} from '@/lib/insoleConfig';
import type { VideoKind } from '@/lib/insoleConfig';
import { toast } from 'sonner';

// ============================================================
// Design: ビビッド・フォーム
// Step1VideoPage: 動画アップロード（STEP 1）
// ============================================================

const SHOOTING_GUIDE_URL = 'https://dataguide.insoleorder.jp/';

export default function Step1VideoPage() {
  const { setCurrentPage, uploadData, updateUploadData } = useUpload();
  const { selectedInsoles, videoFiles, videoUploaded } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);

  // 選択されたインソール種別から必要な動画種別を取得
  const requiredVideoTypes = getRequiredVideoTypes(selectedInsoles);

  const [uploadStatus, setUploadStatus] = useState<Record<VideoKind, 'idle' | 'uploading' | 'success' | 'error'>>({
    walk: 'idle', oneleg: 'idle', sidejump: 'idle', running: 'idle', swing: 'idle',
  });
  const [uploadProgress, setUploadProgress] = useState<Record<VideoKind, number>>({
    walk: 0, oneleg: 0, sidejump: 0, running: 0, swing: 0,
  });

  const handleFileChange = (kind: VideoKind, files: File[]) => {
    const newFiles = { ...videoFiles, [kind]: files[0] || null };
    updateUploadData({ videoFiles: newFiles });
    if (files.length === 0) {
      setUploadStatus(prev => ({ ...prev, [kind]: 'idle' }));
      setUploadProgress(prev => ({ ...prev, [kind]: 0 }));
      updateUploadData({ videoUploaded: { ...videoUploaded, [kind]: false } });
    } else {
      simulateUpload(kind);
    }
  };

  const simulateUpload = (kind: VideoKind) => {
    setUploadStatus(prev => ({ ...prev, [kind]: 'uploading' }));
    setUploadProgress(prev => ({ ...prev, [kind]: 0 }));
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const next = prev[kind] + 10;
        if (next >= 100) {
          clearInterval(interval);
          setUploadStatus(s => ({ ...s, [kind]: 'success' }));
          // setTimeoutで次のレンダリングサイクルに延期して呼び出す
          setTimeout(() => {
            updateUploadData({ videoUploaded: { ...videoUploaded, [kind]: true } });
          }, 0);
          return { ...prev, [kind]: 100 };
        }
        return { ...prev, [kind]: next };
      });
    }, 200);
  };

  // 次へボタンの有効条件：全動画アップロード済み
  const canProceed = selectedInsoles.length > 0 && requiredVideoTypes.every(
    kind => videoUploaded[kind] || uploadStatus[kind] === 'success'
  );

  const handleNext = () => {
    layoutRef.current?.scrollToTop();
    if (!canProceed) {
      toast.error('全ての動画をアップロードしてください');
      return;
    }
    setCurrentPage('step2');
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="動画のアップロード"
      showBack
      onBack={() => setCurrentPage('home')}
      currentStep={1}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('home')} className="flex-1">
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
              1
            </div>
            <h2 className="text-base font-bold text-gray-800">動画のアップロードを行います</h2>
          </div>
        </div>

        {/* ─── 動画アップロードセクション ─── */}
        {requiredVideoTypes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
            <p className="text-sm text-gray-400">
              ホーム画面でインソール種別を選択してください
            </p>
          </div>
        ) : (
          requiredVideoTypes.map(kind => (
            <VideoUploadCard
              key={kind}
              kind={kind}
              file={videoFiles[kind] ?? null}
              status={uploadStatus[kind]}
              progress={uploadProgress[kind]}
              onFileChange={(files) => handleFileChange(kind, files)}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}

// 動画アップロードカード（種別ごと）
function VideoUploadCard({
  kind,
  file,
  status,
  progress,
  onFileChange,
}: {
  kind: VideoKind;
  file: File | null;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  onFileChange: (files: File[]) => void;
}) {
  const info = VIDEO_KIND_LABELS[kind];
  const isUploaded = status === 'success';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* カードヘッダー */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
        style={{ backgroundColor: isUploaded ? '#F0FDF4' : '#FAFAFA' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isUploaded ? '#DCFCE7' : '#FCE4F4' }}
        >
          {isUploaded
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <Video className="w-4 h-4" style={{ color: '#D62598' }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{info.title}</p>
          <p className="text-xs text-gray-400">
            {isUploaded ? 'アップロード済み' : 'アップロードされていません'}
          </p>
        </div>
        {/* 撮影方法を確認するボタン */}
        <a
          href={`${SHOOTING_GUIDE_URL}`}
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

      {/* アップロードゾーン */}
      <div className="p-4">
        <UploadZone
          accept="video/*"
          type="video"
          label={`${info.title}を選択`}
          hint=""
          files={file ? [file] : []}
          onFilesChange={onFileChange}
          status={status}
          uploadProgress={progress}
        />
      </div>
    </div>
  );
}
