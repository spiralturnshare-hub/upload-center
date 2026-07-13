import React, { useState, useRef, useEffect } from 'react';
import {
  User, Footprints, Video, Camera,
  Heart, Target, Leaf, Edit3, ChevronRight
} from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import { INSOLE_DISPLAY_NAMES, getRequiredVideoTypes, VIDEO_KIND_LABELS } from '@/lib/insoleConfig';

// ============================================================
// Design: ビビッド・フォーム
// Step8ConfirmPage: 全入力内容確認画面（STEP 8）
// - 動画・写真はサムネイル表示
// - 各セクションに「修正する」ボタンを設置して対応STEPへ遷移
// ============================================================

const FIT_LABEL: Record<string, string> = { tight: 'きつめ', just: 'ぴったり', loose: '緩め' };
const ROOM_COLOR_LABEL: Record<string, string> = { pink: 'ピンク', light_gray: 'ライトグレー', navy: 'ネイビー' };
const TAKO_POSITION_LABEL: Record<number, string> = {
  1: '①（母趾球）', 2: '②（小趾球）', 3: '③（中足部内側）',
  4: '④（中足部外側）', 5: '⑤（踵内側）', 6: '⑥（踵外側）', 7: '⑦（踵中央）',
};

interface ConfirmRowProps {
  label: string;
  value: React.ReactNode;
}

function ConfirmRow({ label, value }: ConfirmRowProps) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-medium text-gray-700 flex-1 leading-relaxed">
        {value || <span className="text-gray-300">未入力</span>}
      </span>
    </div>
  );
}

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  stepLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}

function SectionCard({ icon, title, stepLabel, onEdit, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* カードヘッダー */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: '#FCE4F4' }}
      >
        {icon}
        <h3 className="text-sm font-semibold flex-1" style={{ color: '#D62598' }}>{title}</h3>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
          style={{ backgroundColor: '#D62598', color: 'white' }}
        >
          <Edit3 className="w-3 h-3" />
          修正する
        </button>
      </div>

      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

export default function Step8ConfirmPage() {
  const { setCurrentPage, uploadData } = useUpload();
  const {
    customerInfo, shoeInfos, roomColor, painInfo, purposeInfo,
    takoInfo, selectedInsoles,
    videoFiles, footPhotoFiles, shoePhotoFiles,
  } = uploadData;
  const [submitting, setSubmitting] = useState(false);
  const layoutRef = useRef<AppLayoutHandle>(null);

  // 動画の中間フレームをCanvasでキャプチャしてdata URLとして保持
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  const [footPhotoUrls, setFootPhotoUrls] = useState<string[]>([]);
  const [shoePhotoUrls, setShoePhotoUrls] = useState<Record<string, string[]>>({});

  // 動画ファイルから指定秒数のフレームをdata URLとして取得するユーティリティ
  const captureVideoFrame = (file: File, seekRatio = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = url;

      const cleanup = () => URL.revokeObjectURL(url);

      video.addEventListener('loadedmetadata', () => {
        // 動画の中間付近にシーク
        const seekTime = Math.max(0.1, video.duration * seekRatio);
        video.currentTime = seekTime;
      });

      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            cleanup();
            resolve(dataUrl);
          } else {
            cleanup();
            reject(new Error('Canvas context unavailable'));
          }
        } catch (e) {
          cleanup();
          reject(e);
        }
      });

      video.addEventListener('error', () => {
        cleanup();
        reject(new Error('Video load error'));
      });
    });
  };

  useEffect(() => {
    let cancelled = false;

    // 動画サムネイル生成（並行処理）
    const generateThumbnails = async () => {
      const requiredKinds = getRequiredVideoTypes(selectedInsoles);
      const entries = requiredKinds
        .map(kind => ({ kind, file: videoFiles[kind] }))
        .filter((e): e is { kind: typeof e.kind; file: File } => e.file instanceof File);

      const results = await Promise.allSettled(
        entries.map(({ file }) => captureVideoFrame(file))
      );

      const thumbs: Record<string, string> = {};
      results.forEach((result, i) => {
        const kind = entries[i].kind;
        thumbs[kind] = result.status === 'fulfilled' ? result.value : '';
      });

      if (!cancelled) setVideoThumbnails(thumbs);
    };
    generateThumbnails();

    // 足の写真URL生成
    const fpUrls = (footPhotoFiles ?? []).map(f => URL.createObjectURL(f));
    setFootPhotoUrls(fpUrls);

    // 靴の写真URL生成
    const spUrls: Record<string, string[]> = {};
    Object.entries(shoePhotoFiles ?? {}).forEach(([kind, files]) => {
      spUrls[kind] = (files ?? []).map(f => URL.createObjectURL(f));
    });
    setShoePhotoUrls(spUrls);

    return () => {
      cancelled = true;
      fpUrls.forEach(u => URL.revokeObjectURL(u));
      Object.values(spUrls).flat().forEach(u => URL.revokeObjectURL(u));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    setCurrentPage('complete');
  };

  return (
    <AppLayout
      ref={layoutRef}
      title="内容確認"
      showBack
      onBack={() => setCurrentPage('step7')}
      currentStep={8}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step7')} className="flex-1">
            戻る
          </PinkButton>
          <PinkButton size="md" loading={submitting} onClick={handleSubmit} className="flex-1">
            送信
          </PinkButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Section header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: '#D62598' }}
            >
              8
            </div>
            <h2 className="text-base font-bold text-gray-800">ご確認ください</h2>
          </div>
          <p className="text-xs text-gray-400 ml-8">
            入力内容をご確認ください。修正が必要な場合は各セクションの「修正する」ボタンを押してください。
          </p>
        </div>

        {/* ─── STEP 1: 動画アップロード ─── */}
        <SectionCard
          icon={<Video className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 1：動画アップロード"
          stepLabel="STEP 1 に戻る"
          onEdit={() => setCurrentPage('step1')}
        >
          <div className="space-y-3 py-1">
            {getRequiredVideoTypes(selectedInsoles).map(kind => {
              const displayName = VIDEO_KIND_LABELS[kind]?.title ?? kind;
              const hasFile = !!videoFiles[kind];
              const thumb = videoThumbnails[kind];
              return (
                <div key={kind}>
                  <p className="text-xs text-gray-400 mb-1.5">{displayName}</p>
                  {hasFile ? (
                    thumb ? (
                      // キャプチャ成功：静止画サムネイルを表示
                      <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                        <img
                          src={thumb}
                          alt={`${displayName} 動画サムネイル`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      // キャプチャ中またはキャプチャ失敗：ローディング表示
                      <div
                        className="rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400"
                        style={{ aspectRatio: '16/9' }}
                      >
                        {Object.keys(videoThumbnails).includes(kind) ? '読み込み中...' : 'サムネイル生成中...'}
                      </div>
                    )
                  ) : (
                    <div
                      className="rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400"
                      style={{ aspectRatio: '16/9' }}
                    >
                      動画なし
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ─── STEP 2: 写真アップロード ─── */}
        <SectionCard
          icon={<Camera className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 2：写真アップロード"
          stepLabel="STEP 2 に戻る"
          onEdit={() => setCurrentPage('step2')}
        >
          <div className="space-y-4 py-1">
            {/* 足の写真 */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">足の写真</p>
              {footPhotoUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {footPhotoUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`足の写真 ${i + 1}`}
                      className="w-full rounded-xl object-cover"
                      style={{ aspectRatio: '1/1' }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400 py-6">
                  写真なし
                </div>
              )}
            </div>
            {/* 靴の写真（インソール種別ごと） */}
            {selectedInsoles.map(kind => {
              const displayName = INSOLE_DISPLAY_NAMES[kind as keyof typeof INSOLE_DISPLAY_NAMES] ?? kind;
              const urls = shoePhotoUrls[kind] ?? [];
              return (
                <div key={kind}>
                  <p className="text-xs text-gray-400 mb-1.5">{displayName} 靴の写真</p>
                  {urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`${displayName} 靴の写真 ${i + 1}`}
                          className="w-full rounded-xl object-cover"
                          style={{ aspectRatio: '1/1' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400 py-6">
                      写真なし
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ─── STEP 3: 靴情報 ─── */}
        <SectionCard
          icon={<Footprints className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 3：靴情報"
          stepLabel="STEP 3 に戻る"
          onEdit={() => setCurrentPage('step3')}
        >
          {selectedInsoles.map(kind => {
            const displayName = INSOLE_DISPLAY_NAMES[kind as keyof typeof INSOLE_DISPLAY_NAMES] ?? kind;
            if (kind === 'room') {
              return (
                <React.Fragment key={kind}>
                  <div className="py-2 text-xs font-bold text-gray-500 border-b border-gray-100">{displayName}</div>
                  <ConfirmRow label="シューズの色" value={ROOM_COLOR_LABEL[roomColor] ?? roomColor} />
                </React.Fragment>
              );
            }
            const info = shoeInfos[kind];
            if (!info) return null;
            return (
              <React.Fragment key={kind}>
                <div className="py-2 text-xs font-bold text-gray-500 border-b border-gray-100">{displayName}</div>
                <ConfirmRow label="ブランド" value={info.brand === 'その他' ? `その他：${info.otherBrand}` : info.brand} />
                <ConfirmRow label="表記サイズ" value={info.size} />
                <ConfirmRow label="中底サイズ" value={info.insoleSize ? `${info.insoleSize}mm` : ''} />
                <ConfirmRow label="フィット感" value={FIT_LABEL[info.fit] ?? ''} />
              </React.Fragment>
            );
          })}
        </SectionCard>

        {/* ─── STEP 4: 痛みに関する情報 ─── */}
        <SectionCard
          icon={<Heart className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 4：痛みに関する情報"
          stepLabel="STEP 4 に戻る"
          onEdit={() => setCurrentPage('step4')}
        >
          <ConfirmRow
            label="痛みの有無"
            value={painInfo.hasPain === true ? 'ある' : painInfo.hasPain === false ? 'ない' : '未回答'}
          />
          {painInfo.hasPain && painInfo.entries && painInfo.entries.length > 0 && (
            painInfo.entries.map((entry, i) => (
              <React.Fragment key={entry.id}>
                {painInfo.entries.length > 1 && (
                  <div className="py-1.5 text-xs font-bold text-gray-400 border-b border-gray-50">
                    痛み {i + 1}
                  </div>
                )}
                <ConfirmRow label="痛みの部位" value={
                  entry.locations.length > 0
                    ? entry.locations.join('、') + (entry.otherLocation ? `（${entry.otherLocation}）` : '')
                    : ''
                } />
                <ConfirmRow label="左右" value={entry.side} />
                <ConfirmRow label="痛みの強さ" value={
                  entry.faceScale !== null ? `フェイススケール ${entry.faceScale}` : ''
                } />
                {/* 痛みの部位写真サムネイル */}
                {entry.photos && entry.photos.length > 0 && (
                  <div className="py-2.5 border-b border-gray-50">
                    <span className="text-xs text-gray-400 block mb-1.5">部位の写真</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {entry.photos.map((photo, pi) => {
                        const photoUrl = URL.createObjectURL(photo);
                        return (
                          <img
                            key={pi}
                            src={photoUrl}
                            alt={`痛みの部位写真 ${pi + 1}`}
                            className="w-full rounded-lg object-cover"
                            style={{ aspectRatio: '1/1' }}
                            onLoad={() => URL.revokeObjectURL(photoUrl)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))
          )}
        </SectionCard>

        {/* ─── STEP 5: 作製目的 ─── */}
        <SectionCard
          icon={<Target className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 5：作製目的"
          stepLabel="STEP 5 に戻る"
          onEdit={() => setCurrentPage('step5')}
        >
          <ConfirmRow
            label="目的"
            value={
              purposeInfo.purposes.length > 0
                ? purposeInfo.purposes.map(p =>
                    p === 'その他' && purposeInfo.otherPurpose
                      ? `その他：${purposeInfo.otherPurpose}`
                      : p
                  ).join('、')
                : ''
            }
          />
          {purposeInfo.lifestyle && <ConfirmRow label="生活スタイル" value={purposeInfo.lifestyle} />}
          {purposeInfo.playstyle && <ConfirmRow label="プレイスタイル" value={purposeInfo.playstyle} />}
          {purposeInfo.rightFocusItems && purposeInfo.rightFocusItems.length > 0 && (
            <ConfirmRow label="右足の重視項目" value={purposeInfo.rightFocusItems.join('、')} />
          )}
          {purposeInfo.leftFocusItems && purposeInfo.leftFocusItems.length > 0 && (
            <ConfirmRow label="左足の重視項目" value={purposeInfo.leftFocusItems.join('、')} />
          )}
        </SectionCard>

        {/* ─── STEP 6: タコ・魚の目 ─── */}
        <SectionCard
          icon={<Leaf className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 6：タコ・魚の目の位置"
          stepLabel="STEP 6 に戻る"
          onEdit={() => setCurrentPage('step6')}
        >
          <ConfirmRow
            label="左足の位置"
            value={
              takoInfo.leftPositions.length > 0
                ? takoInfo.leftPositions.map(p => TAKO_POSITION_LABEL[p] ?? `位置${p}`).join('、')
                : 'なし'
            }
          />
          <ConfirmRow
            label="右足の位置"
            value={
              takoInfo.rightPositions.length > 0
                ? takoInfo.rightPositions.map(p => TAKO_POSITION_LABEL[p] ?? `位置${p}`).join('、')
                : 'なし'
            }
          />
          {takoInfo.otherNote && (
            <ConfirmRow label="その他メモ" value={takoInfo.otherNote} />
          )}
          {takoInfo.attachments && takoInfo.attachments.length > 0 && (
            <div className="py-2.5">
              <span className="text-xs text-gray-400 block mb-1.5">添付ファイル（{takoInfo.attachments.length}件）</span>
              <div className="grid grid-cols-3 gap-1.5">
                {takoInfo.attachments.map((file, i) => {
                  const isImage = file.type.startsWith('image/');
                  if (isImage) {
                    const url = URL.createObjectURL(file);
                    return (
                      <img
                        key={i}
                        src={url}
                        alt={file.name}
                        className="w-full rounded-lg object-cover"
                        style={{ aspectRatio: '1/1' }}
                        onLoad={() => URL.revokeObjectURL(url)}
                      />
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="rounded-lg bg-gray-100 flex items-center justify-center p-2"
                      style={{ aspectRatio: '1/1' }}
                    >
                      <span className="text-xs text-gray-500 text-center break-all leading-tight">{file.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ─── STEP 7: お客様情報・配送先 ─── */}
        <SectionCard
          icon={<User className="w-4 h-4" style={{ color: '#D62598' }} />}
          title="STEP 7：お客様情報・配送先"
          stepLabel="STEP 7 に戻る"
          onEdit={() => setCurrentPage('step7')}
        >
          <div className="py-1.5 text-xs font-bold text-gray-500 border-b border-gray-100">お客様情報</div>
          <ConfirmRow label="お名前" value={customerInfo.userName} />
          <ConfirmRow label="フリガナ" value={customerInfo.userKana} />
          <div className="py-1.5 text-xs font-bold text-gray-500 border-b border-gray-100 mt-1">配送先情報</div>
          <ConfirmRow label="配送先氏名" value={customerInfo.shipName} />
          <ConfirmRow
            label="在住"
            value={customerInfo.shipCountry === 'domestic' ? '日本国内' : '海外'}
          />
          {customerInfo.shipCountry === 'domestic' ? (
            <>
              <ConfirmRow label="郵便番号" value={customerInfo.postalCode} />
              <ConfirmRow label="都道府県" value={customerInfo.prefecture} />
              <ConfirmRow label="市区町村" value={customerInfo.city} />
              <ConfirmRow label="住所" value={customerInfo.address} />
              <ConfirmRow label="建物名" value={customerInfo.building} />
            </>
          ) : (
            <>
              <ConfirmRow label="国" value={(customerInfo as any).country ?? ''} />
              <ConfirmRow label="郵便番号" value={(customerInfo as any).overseasZip ?? ''} />
              <ConfirmRow label="州/省" value={(customerInfo as any).overseasState ?? ''} />
              <ConfirmRow label="市区町村" value={(customerInfo as any).overseasCity ?? ''} />
              <ConfirmRow label="住所" value={(customerInfo as any).overseasAddress ?? ''} />
            </>
          )}
          <ConfirmRow label="電話番号" value={customerInfo.phone} />
        </SectionCard>

        {/* 送信注意書き */}
        <div
          className="rounded-xl p-4 text-xs text-center leading-relaxed"
          style={{ backgroundColor: '#FFF7ED', color: '#92400E' }}
        >
          上記の内容をご確認の上、「送信」ボタンを押してください。<br />
          送信後の変更はできません。
        </div>
      </div>
    </AppLayout>
  );
}
