import { useState, useRef } from 'react';
import { Video, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import UploadZone from '@/components/UploadZone';
import ShootingGuideButton from '@/components/ShootingGuideButton';
import {
  getRequiredVideoTypes,
  VIDEO_KIND_LABELS,
} from '@/lib/insoleConfig';
import type { VideoKind } from '@/lib/insoleConfig';
import { toast } from 'sonner';
import { uploadFileToStorage, insertUploadFile } from '@/lib/supabase';

// ============================================================
// Design: ビビッド・フォーム
// Step1VideoPage: 動画アップロード（STEP 1）
// ============================================================

export default function Step1VideoPage() {
  const { setCurrentPage, uploadData, updateUploadData, userId, orderId } = useUpload();
  const { selectedInsoles, videoFiles, videoUploaded, uploadId } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);

  // 選択されたインソール種別から必要な動画種別を取得
  const requiredVideoTypes = getRequiredVideoTypes(selectedInsoles);

  // 再開(resumeUploadSession)時は videoUploaded が既に埋まっているので、
  // ローカルの表示状態も 'success' で初期化してカードを「済み」表示にする。
  const [uploadStatus, setUploadStatus] = useState<Record<VideoKind, 'idle' | 'uploading' | 'success' | 'error'>>(() => ({
    walk: videoUploaded.walk ? 'success' : 'idle',
    oneleg: videoUploaded.oneleg ? 'success' : 'idle',
    sidejump: videoUploaded.sidejump ? 'success' : 'idle',
    running: videoUploaded.running ? 'success' : 'idle',
    swing: videoUploaded.swing ? 'success' : 'idle',
  }));
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
      doUpload(kind, files[0]);
    }
  };

  /**
   * Supabase Storage（upsys）への実際のアップロード処理
   * ファイルパス: {userId}/live/{uploadId}/{kind}/{fileId}/{filename}
   */
  const doUpload = async (kind: VideoKind, file: File) => {
    setUploadStatus(prev => ({ ...prev, [kind]: 'uploading' }));
    setUploadProgress(prev => ({ ...prev, [kind]: 0 }));

    // プログレスバーをアニメーション（実際のアップロードは非同期）
    const fakeInterval = setInterval(() => {
      setUploadProgress(prev => {
        const next = Math.min(prev[kind] + 5, 90);
        return { ...prev, [kind]: next };
      });
    }, 300);

    try {
      const fileId = crypto.randomUUID();
      // uploadFileToStorage は実際の保存パスを path で返す(ファイル名は {fileId}.{ext}。
      // 元ファイル名 file.name で URL を組み立てると Storage の実体名と食い違い、
      // 後工程(計測・動画確認)が uploads_files.url で取りに行くと 404 になる。2026-09-04 修正)
      const { path } = await uploadFileToStorage(file, uploadId, kind, fileId, userId);

      // uploads_files テーブルにメタデータを記録
      await insertUploadFile({
        upload_id: uploadId,
        order_id: orderId || null,
        user_id: userId,
        file_type: 'video',
        kind,
        url: path,
      });

      clearInterval(fakeInterval);
      setUploadProgress(prev => ({ ...prev, [kind]: 100 }));
      setUploadStatus(prev => ({ ...prev, [kind]: 'success' }));
      updateUploadData({ videoUploaded: { ...videoUploaded, [kind]: true } });
    } catch (err) {
      clearInterval(fakeInterval);
      console.error('動画アップロードエラー:', err);
      setUploadStatus(prev => ({ ...prev, [kind]: 'error' }));
      setUploadProgress(prev => ({ ...prev, [kind]: 0 }));
      toast.error(`動画のアップロードに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  };

  // 「次へ」を押したのに進めなかったことがあるか(押して初めて未完了を明示する)
  const [triedNext, setTriedNext] = useState(false);

  // まだアップロードされていない必須動画の種別リスト(顧客に「何が足りないか」を具体名で見せる)
  const missingKinds = requiredVideoTypes.filter(
    kind => !(videoUploaded[kind] || uploadStatus[kind] === 'success')
  );
  // アップロード中の種別(あれば「完了までお待ちください」を出す)
  const uploadingKinds = requiredVideoTypes.filter(kind => uploadStatus[kind] === 'uploading');

  const canProceed = selectedInsoles.length > 0 && missingKinds.length === 0;

  const handleNext = () => {
    layoutRef.current?.scrollToTop();

    // インソール種別が未選択(ホームに戻ってもらう)
    if (selectedInsoles.length === 0) {
      setTriedNext(true);
      toast.error('先にホーム画面でインソールの種類を選択してください');
      return;
    }
    // アップロード中
    if (uploadingKinds.length > 0) {
      setTriedNext(true);
      toast.error('動画のアップロードが完了するまでお待ちください');
      return;
    }
    // 未アップロードの必須動画がある → 具体的にどれかを名前で伝える
    if (missingKinds.length > 0) {
      setTriedNext(true);
      const names = missingKinds.map(k => VIDEO_KIND_LABELS[k].title).join('・');
      toast.error(`次の動画がまだアップロードされていません:${names}`);
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
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#2563EB' }}>
              1
            </div>
            <h2 className="text-base font-bold text-gray-800">動画のアップロードを行います</h2>
          </div>
        </div>

        {/* ─── 「次へ」を押したのに進めなかったときの案内(何が足りないかを具体名で・消えない) ─── */}
        {triedNext && !canProceed && (
          <div className="rounded-2xl border-2 p-4 shadow-sm" style={{ borderColor: '#F5A623', backgroundColor: '#FFF8EC' }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#E8890C' }} />
              <div className="flex-1 min-w-0">
                {selectedInsoles.length === 0 ? (
                  <p className="text-sm font-bold text-gray-800">
                    まだ次に進めません。先にホーム画面で「インソールの種類」を選択してください。
                  </p>
                ) : uploadingKinds.length > 0 ? (
                  <p className="text-sm font-bold text-gray-800">
                    動画をアップロード中です。完了(緑のチェック)になるまでお待ちください。
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-800 mb-1">
                      次に進むには、あと {missingKinds.length} 本の動画をアップロードしてください。
                    </p>
                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {missingKinds.map(k => (
                        <li key={k} className="flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#E8890C' }} />
                          <span className="font-semibold">{VIDEO_KIND_LABELS[k].title}</span>
                          <span className="text-gray-400">— 未アップロード</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500 mt-1.5">
                      下の該当カードで動画ファイルを選ぶとアップロードが始まります。
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

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
              highlightMissing={triedNext && missingKinds.includes(kind)}
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
  highlightMissing = false,
}: {
  kind: VideoKind;
  file: File | null;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  onFileChange: (files: File[]) => void;
  highlightMissing?: boolean;
}) {
  const info = VIDEO_KIND_LABELS[kind];
  const isUploaded = status === 'success';
  // 「次へ」を押したのに未アップロードだったカードは枠を強調して視線を誘導する
  const showMissing = highlightMissing && !isUploaded;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden border"
      style={showMissing
        ? { borderColor: '#E8890C', borderWidth: 2, boxShadow: '0 0 0 3px rgba(245,166,35,0.15)' }
        : { borderColor: '#F3F4F6' }}
    >
      {/* カードヘッダー */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
        style={{ backgroundColor: isUploaded ? '#F0FDF4' : showMissing ? '#FFF8EC' : '#FAFAFA' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isUploaded ? '#DCFCE7' : showMissing ? '#FDE9CC' : '#DBEAFE' }}
        >
          {isUploaded
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : showMissing
              ? <AlertTriangle className="w-4 h-4" style={{ color: '#E8890C' }} />
              : <Video className="w-4 h-4" style={{ color: '#2563EB' }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{info.title}</p>
          <p className="text-xs" style={{ color: showMissing ? '#B45309' : '#9CA3AF' }}>
            {isUploaded ? 'アップロード済み' : showMissing ? 'この動画が未アップロードです' : 'アップロードされていません'}
          </p>
        </div>
        {/* 撮影方法を確認するボタン */}
        <ShootingGuideButton />
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

