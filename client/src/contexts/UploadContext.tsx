import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { InsoleKind } from '@/lib/insoleConfig';

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
  // ===== 開発確認用ダミーデータ（本番前に削除すること） =====
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [userEmail, setUserEmail] = useState('demo@example.com');
  const [currentPage, setCurrentPage] = useState('home');
  const [returnToPage, setReturnToPage] = useState('home');
  const [isGuestUpload, setIsGuestUpload] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>({
    firstName: '山田',
    lastName: '太郎',
    firstNameKana: 'ヤマダ',
    lastNameKana: 'タロウ',
    phone: '090-1234-5678',
    isOverseas: false,
    postalCode: '150-0013',
    prefecture: '東京都',
    city: '渋谷区恵比寿',
    address: '1-2-3',
    building: '恵比寿マンション101号室',
    country: '',
    overseasZip: '',
    overseasState: '',
    overseasCity: '',
    overseasAddress: '',
  });
  // ===== ダミーデータここまで =====

  const updateUploadData = (data: Partial<UploadData>) => {
    setUploadData(prev => ({ ...prev, ...data }));
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
