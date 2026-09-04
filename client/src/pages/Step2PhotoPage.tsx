import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Info, Footprints, Shirt, CheckCircle2, ExternalLink, Camera } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import UploadZone from '@/components/UploadZone';
import IncompleteNotice from '@/components/IncompleteNotice';
import { getRequiredImageTypes, INSOLE_DISPLAY_NAMES } from '@/lib/insoleConfig';
import { toast } from 'sonner';
import { uploadFileToStorage, insertUploadFile, supabase, fetchCurrentUploadFiles } from '@/lib/supabase';

// 音声ガイダンス撮影アプリ(foot-guidance)の公開オリジン。postMessage の検証にも使う。
const FOOT_GUIDANCE_ORIGIN = 'https://foot-guidance.vercel.app';

// ============================================================
// Design: ビビッド・フォーム
// Step2PhotoPage: 画像のアップロード（STEP 2）
// インソール種別に応じて足の写真・靴の写真を動的に表示
// foot: 常に表示
// shoes: ルーム用以外のインソールが含まれる場合に表示（インソールごと）
// ============================================================

const SHOOTING_GUIDE_URL = 'https://dataguide.insoleorder.jp/';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Step2PhotoPage() {
  const { setCurrentPage, uploadData, updateUploadData, userId, orderId, orderName } = useUpload();
  const { selectedInsoles, footPhotoFiles, footPhotosUploaded, shoePhotoFiles, shoePhotosUploaded, uploadId } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);

  const requiredImageTypes = getRequiredImageTypes(selectedInsoles);
  const needsShoePhoto = requiredImageTypes.includes('shoes');

  // 靴の写真が必要なインソール（room以外）
  const shoePhotoInsoles = selectedInsoles.filter(k => k !== 'room');

  const [footStatus, setFootStatus] = useState<UploadStatus>('idle');
  const [footProgress, setFootProgress] = useState<number>(0);
  const [shoeStatus, setShoeStatus] = useState<Record<string, UploadStatus>>({});
  const [shoeProgress, setShoeProgress] = useState<Record<string, number>>({});

  /**
   * 足の写真をStorageにアップロードする
   */
  const doUploadFoot = async (files: File[]) => {
    setFootStatus('uploading');
    setFootProgress(0);
    const fakeInterval = setInterval(() => {
      setFootProgress(prev => Math.min(prev + 8, 90));
    }, 300);
    try {
      for (const file of files) {
        const fileId = crypto.randomUUID();
        // path = 実際の保存パス({fileId}.{ext})。file.name で組み立てると実体名と食い違い後工程で 404。2026-09-04 修正
        const { path } = await uploadFileToStorage(file, uploadId, 'foot', fileId, userId);
        await insertUploadFile({
          upload_id: uploadId,
          order_id: orderId || null,
          user_id: userId,
          file_type: 'image',
          kind: 'foot',
          url: path,
        });
      }
      clearInterval(fakeInterval);
      setFootProgress(100);
      setFootStatus('success');
      updateUploadData({ footPhotosUploaded: true });
    } catch (err) {
      clearInterval(fakeInterval);
      console.error('足の写真アップロードエラー:', err);
      setFootStatus('error');
      setFootProgress(0);
      toast.error(`足の写真のアップロードに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  };

  /**
   * 靴の写真をStorageにアップロードする（インソール種別ごと）
   */
  const doUploadShoe = async (insoleKind: string, files: File[]) => {
    setShoeStatus(prev => ({ ...prev, [insoleKind]: 'uploading' }));
    setShoeProgress(prev => ({ ...prev, [insoleKind]: 0 }));
    const fakeInterval = setInterval(() => {
      setShoeProgress(prev => ({ ...prev, [insoleKind]: Math.min((prev[insoleKind] ?? 0) + 8, 90) }));
    }, 300);
    try {
      for (const file of files) {
        const fileId = crypto.randomUUID();
        // path = 実際の保存パス({fileId}.{ext})。file.name で組み立てると実体名と食い違い後工程で 404。2026-09-04 修正
        const { path } = await uploadFileToStorage(file, uploadId, 'shoe', fileId, userId);
        await insertUploadFile({
          upload_id: uploadId,
          order_id: orderId || null,
          file_type: 'image',
          // file_kind enum に 'shoe_walk' 等は無い。kind は 'shoes' 固定にし、
          // どのインソール用の靴かは insole_sku 列に持たせる(uploads_files.insole_sku)。
          kind: 'shoes',
          insole_sku: insoleKind,
          url: path,
        });
      }
      clearInterval(fakeInterval);
      setShoeProgress(prev => ({ ...prev, [insoleKind]: 100 }));
      setShoeStatus(prev => ({ ...prev, [insoleKind]: 'success' }));
      updateUploadData({ shoePhotosUploaded: { ...shoePhotosUploaded, [insoleKind]: true } });
    } catch (err) {
      clearInterval(fakeInterval);
      console.error('靴の写真アップロードエラー:', err);
      setShoeStatus(prev => ({ ...prev, [insoleKind]: 'error' }));
      setShoeProgress(prev => ({ ...prev, [insoleKind]: 0 }));
      toast.error(`靴の写真のアップロードに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  };

  const handleFootFilesChange = (files: File[]) => {
    updateUploadData({ footPhotoFiles: files });
    if (files.length === 0) {
      setFootStatus('idle');
      setFootProgress(0);
      updateUploadData({ footPhotosUploaded: false });
    } else {
      doUploadFoot(files);
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
    doUploadShoe(insoleKind, files);
  };

  // 足の画像を「アップロード済み」状態にする(撮影アプリから戻ってきたとき用)
  const markFootUploaded = useCallback(() => {
    setFootStatus('success');
    setFootProgress(100);
    updateUploadData({ footPhotosUploaded: true });
  }, [updateUploadData]);

  /**
   * かんたん撮影アプリ(foot-guidance)を新しいタブで起動する。
   * 顧客コンテキスト(注文番号・注文名・uploadId・userId)と、ログイン中なら
   * Supabase セッションを渡す。撮影完了で foot-guidance が画像を Green Storage /
   * uploads_files へ入れ、window.opener.postMessage で本画面に通知してくる。
   */
  const launchFootGuidance = useCallback(async () => {
    if (!uploadId) {
      toast.error('アップロード情報が見つかりません。最初からやり直してください。');
      return;
    }
    const params = new URLSearchParams({
      from: 'upload-center',
      uploadid: uploadId,
      origin: window.location.origin,
    });
    if (orderId) params.set('orderid', orderId);
    if (orderName) params.set('ordername', orderName);
    if (userId) params.set('userid', userId);

    let url = `${FOOT_GUIDANCE_ORIGIN}/?${params.toString()}`;
    try {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (s?.access_token && s?.refresh_token) {
        url += `#access_token=${encodeURIComponent(s.access_token)}&refresh_token=${encodeURIComponent(s.refresh_token)}`;
      }
    } catch {
      // セッション取得に失敗しても起動自体は続行(RLS 上は匿名でも書き込める)
    }
    // window.opener 経由で結果を受け取るため noopener は付けない
    window.open(url, '_blank');
  }, [uploadId, orderId, orderName, userId]);

  // foot-guidance からの完了通知(postMessage)を受ける
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== FOOT_GUIDANCE_ORIGIN) return;
      const d = e.data;
      if (!d || d.source !== 'foot-guidance' || d.status !== 'uploaded' || d.kind !== 'foot') return;
      if (d.uploadId && uploadId && d.uploadId !== uploadId) return;
      markFootUploaded();
      toast.success('撮影アプリから足の画像を受け取りました');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [uploadId, markFootUploaded]);

  // postMessage が届かなかった場合の保険: タブに戻ってきたら uploads_files を再確認
  useEffect(() => {
    const recheck = async () => {
      if (document.visibilityState !== 'visible' || !uploadId || footPhotosUploaded) return;
      try {
        const files = await fetchCurrentUploadFiles(uploadId);
        if (files.some((f) => f.kind === 'foot')) markFootUploaded();
      } catch {
        // 取得失敗は無視(手動アップロードの導線は残っている)
      }
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [uploadId, footPhotosUploaded, markFootUploaded]);

  // 全ての必要な写真がアップロード済みかチェック
  const footDone = footPhotosUploaded || footStatus === 'success' || footPhotoFiles.length > 0;
  const shoeDone = !needsShoePhoto || shoePhotoInsoles.every(
    k => shoePhotosUploaded[k] || (shoeStatus[k] === 'success') || ((shoePhotoFiles[k]?.length ?? 0) > 0)
  );
  const canProceed = footDone && shoeDone;

  // 「次へ」を押して進めなかったことがあるか
  const [triedNext, setTriedNext] = useState(false);

  // まだアップロードされていない写真を具体名で(足 / 靴＜インソール名＞)
  const missingPhotoItems = [
    ...(footDone ? [] : ['足の写真']),
    ...(needsShoePhoto
      ? shoePhotoInsoles
          .filter(
            k =>
              !(
                shoePhotosUploaded[k] ||
                shoeStatus[k] === 'success' ||
                (shoePhotoFiles[k]?.length ?? 0) > 0
              )
          )
          .map(k => `靴の写真（${INSOLE_DISPLAY_NAMES[k] ?? k}）`)
      : []),
  ];

  const handleNext = () => {
    layoutRef.current?.scrollToTop();
    if (selectedInsoles.length === 0) {
      setTriedNext(true);
      toast.error('先にホーム画面でインソールの種類を選択してください');
      return;
    }
    if (!canProceed) {
      setTriedNext(true);
      toast.error(`次の写真がまだアップロードされていません:${missingPhotoItems.join('・')}`);
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
        <IncompleteNotice
          show={triedNext && !canProceed}
          heading={
            selectedInsoles.length === 0
              ? 'まだ次に進めません。先にホーム画面で「インソールの種類」を選択してください。'
              : `次に進むには、あと ${missingPhotoItems.length} 件の写真をアップロードしてください。`
          }
          items={selectedInsoles.length === 0 ? [] : missingPhotoItems}
          hint="下の該当エリアで写真を選ぶ（または「かんたん撮影アプリ」で撮影する）とアップロードされます。"
        />

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
            {/* かんたん撮影アプリ(音声ガイダンス+撮影枠)への導線 */}
            <button
              type="button"
              onClick={launchFootGuidance}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: '#D62598' }}
            >
              <Camera className="w-4 h-4" />
              かんたん撮影アプリを起動
            </button>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              音声ガイダンスと撮影枠に従って撮るだけ。撮影後この画面に自動で取り込まれ、端末にも保存されます。
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">または手動で選択</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
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
