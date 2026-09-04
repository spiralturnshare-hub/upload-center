import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { InsoleKind } from '@/lib/insoleConfig';
import {
  supabase, fetchMyCustomerId, ensureUploadRow, lastCustomerIdDiag,
  fetchMyProfile, fetchUploadForResume,
} from '@/lib/supabase';

// ホーム「注文一覧」からどのリストを開いているか
export type OrderListMode = 'needing' | 'in-progress' | 'completed';

// ============================================================
// Design: ビビッド・フォーム
// Upload wizard state management context
// ============================================================

export type UploadStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface PainEntry {
  id: string;
  locations: string[];
  otherLocation: string;
  side: string;
  faceScale: number | null;
  photos: File[];
}

export interface PainInfo {
  hasPain: boolean | null;
  entries: PainEntry[];
  // legacy fields kept for compatibility
  side: string;
  strength: number;
  faceScale: number | null;
  locations: string[];
  otherLocation: string;
}

export interface ShoeInfo {
  brand: string;
  otherBrand: string;
  size: string;
  insoleSize: string;
  fit: 'tight' | 'just' | 'loose' | '';
  shoeFiles: File[];
}

export interface PurposeInfo {
  purposes: string[];
  lifestyle: string;
  playstyle: string;
  otherPurpose: string;
  leftFocusItems: string[];
  rightFocusItems: string[];
}

export interface TakoInfo {
  positions: number[]; // legacy
  leftPositions: number[];
  rightPositions: number[];
  otherNote: string;      // その他自由記述
  attachments: File[];    // 添付ファイル（複数可）
}

// アカウントプロフィール（登録済みの住所情報）
export interface AccountProfile {
  firstName: string;       // 姓
  lastName: string;        // 名
  firstNameKana: string;   // 姓（フリガナ）
  lastNameKana: string;    // 名（フリガナ）
  phone: string;
  isOverseas: boolean;     // 海外在住かどうか
  // 日本国内
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
  // 海外
  country: string;
  overseasZip: string;
  overseasState: string;
  overseasCity: string;
  overseasAddress: string;
}

export interface CustomerInfo {
  userName: string;
  userKana: string;
  shipCountry: 'domestic' | 'overseas';
  shipName: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
  phone: string;
}

export interface UploadData {
  uploadId: string;
  // インソール種別（最大2つ）
  selectedInsoles: InsoleKind[];
  // Step 1: Video（種別ごとのアップロード状態）
  videoFiles: Record<string, File | null>;
  videoUploaded: Record<string, boolean>;
  // Step 2: Photo (foot)
  footPhotoFiles: File[];
  footPhotosUploaded: boolean;
  // Step 2: Photo (shoes per insole)
  shoePhotoFiles: Record<string, File[]>;
  shoePhotosUploaded: Record<string, boolean>;
  // Step 3: Shoes（インソールごと）
  shoeInfos: Record<string, ShoeInfo>;
  // Step 3: Room color（ルーム用のみ）
  roomColor: string;
  // Step 4: Pain
  painInfo: PainInfo;
  // Step 5: Purpose
  purposeInfo: PurposeInfo;
  // Step 6: Tako (foot sole)
  takoInfo: TakoInfo;
  // Step 7: Customer info
  customerInfo: CustomerInfo;
}

interface UploadContextType {
  currentStep: UploadStep;
  setCurrentStep: (step: UploadStep) => void;
  uploadData: UploadData;
  updateUploadData: (data: Partial<UploadData>) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userEmail: string;
  setUserEmail: (v: string) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  returnToPage: string;
  setReturnToPage: (page: string) => void;
  accountProfile: AccountProfile | null;
  setAccountProfile: (profile: AccountProfile | null) => void;
  isProfileRegistered: boolean;
  isGuestUpload: boolean;
  setIsGuestUpload: (v: boolean) => void;
  orderId: string;
  setOrderId: (v: string) => void;
  orderName: string;
  setOrderName: (v: string) => void;
  // EditUploadPage を「注文ではなく upload ID で開く」ためのフック(注文なしのゲストアップロード等)
  editUploadId: string | null;
  setEditUploadId: (v: string | null) => void;
  userId: string | null;          // auth.users.id (= auth.uid())
  customerId: string | null;      // public.users.id(= 顧客ID。uploads.user_id はこれ)
  /**
   * アップロード開始時に呼ぶ。uploadId(UUID)を生成し、uploads 行を draft で先に作成する
   * (親行が無いと Step1〜7 の uploads_files INSERT が FK 違反で失敗するため)。
   * 生成した uploadId を返す。呼び出し側は await すること。
   */
  initUploadSession: (opts?: {
    orderId?: string;
    orderName?: string;
    selectedInsoles?: InsoleKind[];
    isGuest?: boolean;
  }) => Promise<string>;
  /**
   * 途中まで進んだアップロードを「続きから」再開する。
   * uploads 行の JSON 各列 + uploads_files(is_current)を UploadData に復元し、
   * uploadId は既存のものを使う(新規作成しない)。最初の未完ステップへ遷移する。
   */
  resumeUploadSession: (uploadId: string, opts?: { orderId?: string; orderName?: string }) => Promise<void>;
  // ホーム「注文一覧」で開いているリスト種別
  orderListMode: OrderListMode;
  setOrderListMode: (m: OrderListMode) => void;
  // アカウント情報の DB 再読込(保存後などに呼ぶ)
  reloadAccountProfile: () => Promise<void>;
}

const defaultShoeInfo: ShoeInfo = {
  brand: '',
  otherBrand: '',
  size: '',
  insoleSize: '',
  fit: '',
  shoeFiles: [],
};

const defaultUploadData: UploadData = {
  uploadId: '',
  selectedInsoles: [],
  videoFiles: {},
  videoUploaded: {},
  footPhotoFiles: [],
  footPhotosUploaded: false,
  shoePhotoFiles: {},
  shoePhotosUploaded: {},
  shoeInfos: {},
  roomColor: '',
  painInfo: {
    hasPain: null,
    entries: [{ id: '1', locations: [], otherLocation: '', side: '', faceScale: null, photos: [] }],
    side: '', strength: 3, faceScale: null, locations: [], otherLocation: '',
  },
  purposeInfo: { purposes: [], lifestyle: '', playstyle: '', otherPurpose: '', leftFocusItems: [], rightFocusItems: [] },
  takoInfo: { positions: [], leftPositions: [], rightPositions: [], otherNote: '', attachments: [] },
  customerInfo: {
    userName: '',
    userKana: '',
    shipCountry: 'domestic',
    shipName: '',
    postalCode: '',
    prefecture: '',
    city: '',
    address: '',
    building: '',
    phone: '',
  },
};

export { defaultShoeInfo };

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<UploadStep>(1);
  const [uploadData, setUploadData] = useState<UploadData>(defaultUploadData);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState('home');
  const [returnToPage, setReturnToPage] = useState('home');
  const [isGuestUpload, setIsGuestUpload] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderName, setOrderName] = useState('');
  const [editUploadId, setEditUploadId] = useState<string | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderListMode, setOrderListMode] = useState<OrderListMode>('needing');

  // アカウント情報を public.users から読み直す(サインイン時・保存後)
  const reloadAccountProfile = async () => {
    try {
      const prof = await fetchMyProfile();
      setAccountProfile(prof);
    } catch {
      // 読み込み失敗は致命的でない(未登録扱いで進める)
    }
  };

  // Supabase Auth のセッションを監視して:
  //   - userId(auth.uid)/ customerId(public.users.id)を解決
  //   - isLoggedIn / userEmail をセッションから復元(リロードで「ログアウト扱い」になっていた)
  //   - アカウント情報(public.users)をロード ── 再サインインで復元される(2026-09-04)
  useEffect(() => {
    const sync = async (session: { user?: { id?: string; email?: string } } | null) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      setIsLoggedIn(!!uid);
      setUserEmail(session?.user?.email ?? '');
      if (uid) {
        setCustomerId(await fetchMyCustomerId());
        await reloadAccountProfile();
      } else {
        setCustomerId(null);
        setAccountProfile(null);
      }
    };
    supabase.auth.getSession().then(({ data }) => { void sync(data.session ?? null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void sync(session ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const updateUploadData = (data: Partial<UploadData>) => {
    setUploadData(prev => ({ ...prev, ...data }));
  };

  /**
   * アップロードセッションを初期化する。
   * (1) 新しい uploadId を UUID で生成
   * (2) uploads 行を status='draft' で先に作成(ensureUploadRow)
   *     ── これが無いと Step1〜7 の uploads_files INSERT が
   *        FK(uploads_files.upload_id → uploads.id)違反で全滅する
   * (3) Context に uploadId と受け取った文脈(order/insole/guest)を反映
   * Step1 へ遷移する全経路(Home / GuestUpload / PaymentIdUpload)から await で呼ぶ。
   */
  const initUploadSession = async (opts?: {
    orderId?: string;
    orderName?: string;
    selectedInsoles?: InsoleKind[];
    isGuest?: boolean;
  }): Promise<string> => {
    const newId = crypto.randomUUID();
    const insoles = opts?.selectedInsoles ?? uploadData.selectedInsoles ?? [];

    // customerId(public.users.id)を呼び出し時点で確定させる。
    // Context state はセッション監視の非同期解決待ちで null のことがある
    // (利用者のタップが先行するとこれで「開始に失敗」していた ─ 2026-08-28)。
    // state に無ければその場で解決し直し、取れたら state にも反映する。
    let cid = customerId;
    if (!cid) {
      cid = await fetchMyCustomerId();
      if (cid) setCustomerId(cid);
    }
    if (!cid && !(opts?.isGuest ?? isGuestUpload)) {
      // 顧客IDが最後まで取れない場合は、理由を添えて投げる(原因の可視化)
      throw new Error(`顧客ID未取得: ${lastCustomerIdDiag || '理由不明'}`);
    }

    await ensureUploadRow({
      uploadId: newId,
      customerId: cid,
      // Context の orderId / orderName state は初期値が ''(空文字)。
      // `??` は null/undefined しか変換しないため '' がそのまま uuid 列に渡り
      // [22P02] invalid input syntax for type uuid: "" になっていた(2026-08-28)。
      // `|| null` で空文字も null に落とす。
      orderId: (opts?.orderId ?? orderId) || null,
      orderName: (opts?.orderName ?? orderName) || null,
      selectedInsoles: insoles,
      isGuest: opts?.isGuest ?? isGuestUpload,
    });
    setUploadData(prev => ({
      ...prev,
      uploadId: newId,
      ...(opts?.selectedInsoles ? { selectedInsoles: opts.selectedInsoles } : {}),
    }));
    return newId;
  };

  /**
   * 途中まで進んだアップロードを再開する。
   * uploads 行の JSON 各列 + uploads_files(is_current)を UploadData へ復元し、
   * currentPage を step1 にする(各 Step は Context から描画するので、
   * アップロード済み項目は「済み」表示になる)。
   */
  const resumeUploadSession = async (
    uploadId: string,
    opts?: { orderId?: string; orderName?: string },
  ): Promise<void> => {
    const { upload, files } = await fetchUploadForResume(uploadId);

    // uploads_files の種別からアップロード済みフラグを組み立てる
    const videoUploaded: Record<string, boolean> = {};
    const shoePhotosUploaded: Record<string, boolean> = {};
    let footPhotosUploaded = false;
    for (const f of files) {
      const k = f.kind ?? '';
      if (f.file_type === 'video') {
        videoUploaded[k] = true;
      } else if (k === 'foot') {
        footPhotosUploaded = true;
      } else if (k === 'shoes') {
        // insole_sku 単位で「この種別の靴写真あり」
        if (f.insole_sku) shoePhotosUploaded[f.insole_sku] = true;
      }
    }

    const asObj = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    const painJson = asObj(upload.pain_info);
    const purposeJson = asObj(upload.purpose_info);
    const takoJson = asObj(upload.tako_info);
    const custJson = asObj(upload.customer_info);
    const shoeJson = asObj(upload.shoe_infos) as Record<string, ShoeInfo>;

    setUploadData(prev => ({
      ...prev,
      uploadId,
      selectedInsoles: (upload.selected_insoles as InsoleKind[]) ?? prev.selectedInsoles,
      videoUploaded,
      footPhotosUploaded,
      shoePhotosUploaded,
      shoeInfos: Object.keys(shoeJson).length ? shoeJson : prev.shoeInfos,
      roomColor: upload.room_color ?? prev.roomColor,
      painInfo: { ...prev.painInfo, ...(painJson as Partial<typeof prev.painInfo>) },
      purposeInfo: { ...prev.purposeInfo, ...(purposeJson as Partial<typeof prev.purposeInfo>) },
      takoInfo: { ...prev.takoInfo, ...(takoJson as Partial<typeof prev.takoInfo>) },
      customerInfo: {
        ...prev.customerInfo,
        ...(custJson as Partial<typeof prev.customerInfo>),
        userName: upload.insole_user_name ?? (custJson.userName as string) ?? prev.customerInfo.userName,
        userKana: upload.insole_user_kana ?? (custJson.userKana as string) ?? prev.customerInfo.userKana,
      },
    }));
    if (opts?.orderId) setOrderId(opts.orderId);
    if (opts?.orderName) setOrderName(opts.orderName);
    else if (upload.order_name) setOrderName(upload.order_name);
    if (upload.order_id) setOrderId(upload.order_id);

    setCurrentPage('step1');
  };

  const isProfileRegistered = accountProfile !== null &&
    (accountProfile.firstName !== '' || accountProfile.lastName !== '');

  return (
    <UploadContext.Provider value={{
      currentStep, setCurrentStep,
      uploadData, updateUploadData,
      isLoggedIn, setIsLoggedIn,
      userEmail, setUserEmail,
      currentPage, setCurrentPage,
      returnToPage, setReturnToPage,
      accountProfile, setAccountProfile,
      isProfileRegistered,
      isGuestUpload, setIsGuestUpload,
      orderId, setOrderId,
      orderName, setOrderName,
      editUploadId, setEditUploadId,
      userId,
      customerId,
      initUploadSession,
      resumeUploadSession,
      orderListMode, setOrderListMode,
      reloadAccountProfile,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}
