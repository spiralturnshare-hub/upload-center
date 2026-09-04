import React, { useState, useEffect, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import IncompleteNotice from '@/components/IncompleteNotice';
import { toast } from 'sonner';
import { UserCircle, MapPin, AlertCircle } from 'lucide-react';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ============================================================
// Design: ビビッド・フォーム
// Step7InfoPage: 配送先情報（STEP 7）
// - インソール利用者情報（氏名・フリガナ）
// - 配送先選択：「このアカウントの住所に郵送」「別の住所に郵送」
// - 未登録時：アカウント登録を促すUI
// - 日本：郵便番号自動入力
// - 海外：専用フォーム
// ============================================================

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
        {label}
        {required && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#2563EB' }}>必須</span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full h-11 px-3 rounded-xl border-2 border-gray-200 text-sm focus:outline-none transition-colors";

function TextInput({ value, onChange, placeholder, type = 'text', inputMode, disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClass + (disabled ? ' bg-gray-50 text-gray-500 cursor-not-allowed' : '')}
      onFocus={e => { if (!disabled) e.target.style.borderColor = '#2563EB'; }}
      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
    />
  );
}

export default function Step7InfoPage() {
  const {
    setCurrentPage,
    setReturnToPage,
    uploadData,
    updateUploadData,
    accountProfile,
    isProfileRegistered,
    isLoggedIn,
  } = useUpload();

  const { customerInfo } = uploadData;
  const layoutRef = useRef<AppLayoutHandle>(null);

  // エラー状態
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  // 「次へ」を押して進めなかったときに未入力項目を具体名で残す
  const [missingItems, setMissingItems] = useState<string[]>([]);

  // 配送先選択: 'account' | 'other'
  const [shipMode, setShipMode] = useState<'account' | 'other'>('account');
  const [zipLoading, setZipLoading] = useState(false);

  // 別住所フォーム用ローカル状態
  const [altForm, setAltForm] = useState({
    shipName: customerInfo.shipName,
    phone: customerInfo.phone,
    isOverseas: customerInfo.shipCountry === 'overseas',
    postalCode: customerInfo.postalCode,
    prefecture: customerInfo.prefecture,
    city: customerInfo.city,
    address: customerInfo.address,
    building: customerInfo.building,
    country: '',
    overseasZip: '',
    overseasState: '',
    overseasCity: '',
    overseasAddress: '',
  });

  const updateAlt = (data: Partial<typeof altForm>) => {
    setAltForm(prev => ({ ...prev, ...data }));
    if (missingItems.length > 0) setMissingItems([]); // 入力し始めたら案内バナーを消す(次へで再判定)
  };

  // アカウント住所を選択したとき、customerInfoに反映
  useEffect(() => {
    if (shipMode === 'account' && accountProfile) {
      const fullName = `${accountProfile.firstName}　${accountProfile.lastName}`;
      updateUploadData({
        customerInfo: {
          ...customerInfo,
          shipName: fullName,
          phone: accountProfile.phone,
          shipCountry: accountProfile.isOverseas ? 'overseas' : 'domestic',
          postalCode: accountProfile.postalCode,
          prefecture: accountProfile.prefecture,
          city: accountProfile.city,
          address: accountProfile.address,
          building: accountProfile.building,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipMode, accountProfile]);

  // 郵便番号から住所を自動入力
  const fetchAddress = async (zip: string) => {
    const cleaned = zip.replace(/[^0-9]/g, '');
    if (cleaned.length !== 7) return;
    setZipLoading(true);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`);
      const json = await res.json();
      if (json.results && json.results.length > 0) {
        const r = json.results[0];
        updateAlt({ prefecture: r.address1, city: r.address2 + r.address3 });
        toast.success('住所を自動入力しました');
      } else {
        toast.error('郵便番号が見つかりませんでした');
      }
    } catch {
      toast.error('住所の取得に失敗しました');
    } finally {
      setZipLoading(false);
    }
  };

  // 次へ進む前にcustomerInfoを更新
  const KATAKANA_REGEX = /^[ァ-ヶー　 ]+$/;

  const handleNext = () => {
    layoutRef.current?.scrollToTop();
    const newErrors: Record<string, boolean> = {};
    const missing: string[] = [];
    let hasError = false;

    if (!customerInfo.userName) {
      newErrors.userName = true;
      hasError = true;
      missing.push('インソール利用者のお名前');
    }
    if (!customerInfo.userKana) {
      newErrors.userKana = true;
      hasError = true;
      missing.push('インソール利用者のフリガナ');
    } else if (!KATAKANA_REGEX.test(customerInfo.userKana)) {
      newErrors.userKana = true;
      hasError = true;
      missing.push('フリガナ（カタカナで入力してください）');
    }
    if (shipMode === 'other' || !isLoggedIn || !isProfileRegistered) {
      if (!altForm.shipName) { newErrors.shipName = true; hasError = true; missing.push('配送先のお名前'); }
      if (!altForm.phone) { newErrors.phone = true; hasError = true; missing.push('配送先の電話番号'); }
      if (!altForm.isOverseas && !altForm.postalCode) { newErrors.postalCode = true; hasError = true; missing.push('配送先の郵便番号'); }
    }

    setFieldErrors(newErrors);
    setMissingItems(missing);

    if (hasError) {
      toast.error(`未入力の項目があります:${missing.join('・')}`);
      return;
    }

    if (shipMode === 'other' || !isLoggedIn || !isProfileRegistered) {
      updateUploadData({
        customerInfo: {
          ...customerInfo,
          shipName: altForm.shipName,
          phone: altForm.phone,
          shipCountry: altForm.isOverseas ? 'overseas' : 'domestic',
          postalCode: altForm.postalCode,
          prefecture: altForm.prefecture,
          city: altForm.city,
          address: altForm.address,
          building: altForm.building,
        },
      });
    }
    setCurrentPage('step8');
  };

  // アカウントの住所サマリー表示
  const accountSummary = accountProfile
    ? accountProfile.isOverseas
      ? `${accountProfile.country} ${accountProfile.overseasZip} ${accountProfile.overseasState} ${accountProfile.overseasCity} ${accountProfile.overseasAddress}`
      : `〒${accountProfile.postalCode} ${accountProfile.prefecture}${accountProfile.city}${accountProfile.address}${accountProfile.building ? ' ' + accountProfile.building : ''}`
    : '';

  const showAltForm = !isLoggedIn || !isProfileRegistered || shipMode === 'other';

  return (
    <AppLayout
      ref={layoutRef}
      title="配送先情報"
      showBack
      onBack={() => setCurrentPage('step6')}
      currentStep={7}
      totalSteps={8}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage('step6')} className="flex-1">
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
          show={missingItems.length > 0}
          heading={`次に進むには、あと ${missingItems.length} 項目の入力が必要です。`}
          items={missingItems}
          hint="下の該当項目を入力してください（赤く表示されています）。"
        />

        {/* Step header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#2563EB' }}>7</div>
            <h2 className="text-base font-bold text-gray-800">配送先情報</h2>
          </div>
          <p className="text-xs text-gray-400 ml-8">インソールの利用者情報と配送先を入力してください</p>
        </div>

        {/* インソール利用者情報 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">インソール利用者情報</h3>
          <Field label="インソールをご利用いただく方のお名前" required>
            <input
              type="text"
              value={customerInfo.userName}
              onChange={e => { updateUploadData({ customerInfo: { ...customerInfo, userName: e.target.value } }); if (fieldErrors.userName) setFieldErrors(p => ({ ...p, userName: false })); if (missingItems.length > 0) setMissingItems([]); }}
              placeholder="例）鈴木 太郎"
              className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
              style={{ borderColor: fieldErrors.userName ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.userName ? ERROR_BG : 'white' }}
              onFocus={e => (e.target.style.borderColor = fieldErrors.userName ? ERROR_BORDER : '#2563EB')}
              onBlur={e => (e.target.style.borderColor = fieldErrors.userName ? ERROR_BORDER : '#E5E7EB')}
            />
            {fieldErrors.userName && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>お名前を入力してください</p>}
          </Field>
          <Field label="フリガナ" required>
            <input
              type="text"
              value={customerInfo.userKana}
              onChange={e => { updateUploadData({ customerInfo: { ...customerInfo, userKana: e.target.value } }); if (fieldErrors.userKana) setFieldErrors(p => ({ ...p, userKana: false })); if (missingItems.length > 0) setMissingItems([]); }}
              placeholder="例）スズキ タロウ"
              className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
              style={{ borderColor: fieldErrors.userKana ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.userKana ? ERROR_BG : 'white' }}
              onFocus={e => (e.target.style.borderColor = fieldErrors.userKana ? ERROR_BORDER : '#2563EB')}
              onBlur={e => (e.target.style.borderColor = fieldErrors.userKana ? ERROR_BORDER : '#E5E7EB')}
            />
            {fieldErrors.userKana && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>{customerInfo.userKana ? 'フリガナはカタカナで入力してください' : 'フリガナを入力してください'}</p>}
          </Field>
        </div>

        {/* 配送先 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">配送先</h3>

          {/* アカウント未登録 or 未ログイン時の警告 */}
          {(!isLoggedIn || !isProfileRegistered) && (
            <div className="rounded-xl p-3 flex items-start gap-3" style={{ backgroundColor: '#FFF3CD' }}>
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {!isLoggedIn ? 'サインインしていません' : 'アカウント情報が未登録です'}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  アカウント情報を登録すると、次回以降の配送先入力が省略できます。
                </p>
                <button
                  onClick={() => { if (!isLoggedIn) { setCurrentPage('signin'); } else { setReturnToPage('step7'); setCurrentPage('account-profile'); } }}
                  className="mt-2 text-xs font-semibold underline text-amber-800"
                >
                  {!isLoggedIn ? 'サインインする →' : 'アカウント情報を登録する →'}
                </button>
              </div>
            </div>
          )}

          {/* 配送先選択ボタン（アカウント登録済みの場合のみ） */}
          {isLoggedIn && isProfileRegistered && (
            <div className="space-y-2">
              <button
                onClick={() => setShipMode('account')}
                className="w-full rounded-xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.99]"
                style={{
                  borderColor: shipMode === 'account' ? '#2563EB' : '#E5E7EB',
                  backgroundColor: shipMode === 'account' ? '#DBEAFE' : 'white',
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: shipMode === 'account' ? '#2563EB' : '#9CA3AF' }}>
                    {shipMode === 'account' && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2563EB' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <UserCircle className="w-4 h-4" style={{ color: '#2563EB' }} />
                      <span className="text-sm font-semibold" style={{ color: '#2563EB' }}>このアカウントの住所に郵送</span>
                    </div>
                    {accountProfile && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{accountSummary}</p>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setShipMode('other')}
                className="w-full rounded-xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.99]"
                style={{
                  borderColor: shipMode === 'other' ? '#2563EB' : '#E5E7EB',
                  backgroundColor: shipMode === 'other' ? '#DBEAFE' : 'white',
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: shipMode === 'other' ? '#2563EB' : '#9CA3AF' }}>
                    {shipMode === 'other' && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2563EB' }} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" style={{ color: '#2563EB' }} />
                    <span className="text-sm font-semibold" style={{ color: '#2563EB' }}>別の住所に郵送</span>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* アカウント住所の確認表示 */}
          {isLoggedIn && isProfileRegistered && shipMode === 'account' && accountProfile && (
            <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor: '#F9FAFB' }}>
              <p className="text-xs font-semibold text-gray-600">配送先住所</p>
              <p className="text-sm text-gray-800">
                {accountProfile.firstName}　{accountProfile.lastName}
                {accountProfile.firstNameKana && (
                  <span className="text-xs text-gray-400 ml-2">（{accountProfile.firstNameKana}　{accountProfile.lastNameKana}）</span>
                )}
              </p>
              <p className="text-sm text-gray-700">{accountSummary}</p>
              <p className="text-sm text-gray-700">TEL: {accountProfile.phone}</p>
              <button
                onClick={() => { setReturnToPage('step7'); setCurrentPage('account-profile'); }}
                className="text-xs font-semibold underline mt-1"
                style={{ color: '#2563EB' }}
              >
                住所を変更する →
              </button>
            </div>
          )}

          {/* 別の住所フォーム（未登録時 or 「別の住所」選択時） */}
          {showAltForm && (
            <div className="space-y-4 pt-2">
              <Field label="お名前" required>
                <input
                  type="text"
                  value={altForm.shipName}
                  onChange={e => { updateAlt({ shipName: e.target.value }); if (fieldErrors.shipName) setFieldErrors(p => ({ ...p, shipName: false })); }}
                  placeholder="例）鈴木 太郎"
                  className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                  style={{ borderColor: fieldErrors.shipName ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.shipName ? ERROR_BG : 'white' }}
                  onFocus={e => (e.target.style.borderColor = fieldErrors.shipName ? ERROR_BORDER : '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = fieldErrors.shipName ? ERROR_BORDER : '#E5E7EB')}
                />
                {fieldErrors.shipName && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>お名前を入力してください</p>}
              </Field>
              <Field label="電話番号" required>
                <input
                  type="tel"
                  inputMode="tel"
                  value={altForm.phone}
                  onChange={e => { updateAlt({ phone: e.target.value }); if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: false })); }}
                  placeholder="例）090-1234-5678"
                  className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                  style={{ borderColor: fieldErrors.phone ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.phone ? ERROR_BG : 'white' }}
                  onFocus={e => (e.target.style.borderColor = fieldErrors.phone ? ERROR_BORDER : '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = fieldErrors.phone ? ERROR_BORDER : '#E5E7EB')}
                />
                {fieldErrors.phone && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>電話番号を入力してください</p>}
              </Field>

              <Field label="居住地">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '日本国内', value: false },
                    { label: '海外', value: true },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => updateAlt({ isOverseas: opt.value })}
                      className="h-11 rounded-xl text-sm font-medium border-2 transition-all duration-150 active:scale-[0.97]"
                      style={{
                        borderColor: altForm.isOverseas === opt.value ? '#2563EB' : '#E5E7EB',
                        backgroundColor: altForm.isOverseas === opt.value ? '#DBEAFE' : 'white',
                        color: altForm.isOverseas === opt.value ? '#2563EB' : '#374151',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 日本国内フォーム */}
              {!altForm.isOverseas && (
                <>
                  <Field label="郵便番号" required>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={altForm.postalCode}
                        onChange={e => { updateAlt({ postalCode: e.target.value }); if (fieldErrors.postalCode) setFieldErrors(p => ({ ...p, postalCode: false })); }}
                        placeholder="例）123-4567"
                        className="h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors flex-1"
                        style={{ borderColor: fieldErrors.postalCode ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.postalCode ? ERROR_BG : 'white' }}
                        onFocus={e => (e.target.style.borderColor = fieldErrors.postalCode ? ERROR_BORDER : '#2563EB')}
                        onBlur={e => (e.target.style.borderColor = fieldErrors.postalCode ? ERROR_BORDER : '#E5E7EB')}
                      />
                      <button
                        onClick={() => fetchAddress(altForm.postalCode)}
                        disabled={zipLoading}
                        className="h-11 px-4 rounded-xl text-sm font-medium text-white whitespace-nowrap active:scale-[0.97] disabled:opacity-60"
                        style={{ backgroundColor: '#2563EB' }}
                      >
                        {zipLoading ? '検索中…' : '住所検索'}
                      </button>
                    </div>
                    {fieldErrors.postalCode && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>郵便番号を入力してください</p>}
                  </Field>
                  <Field label="都道府県">
                    <select
                      value={altForm.prefecture}
                      onChange={e => updateAlt({ prefecture: e.target.value })}
                      className={inputClass}
                      onFocus={e => (e.target.style.borderColor = '#2563EB')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                    >
                      <option value="">選択してください</option>
                      {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="市区町村">
                    <TextInput value={altForm.city} onChange={v => updateAlt({ city: v })} placeholder="例）渋谷区恵比寿" />
                  </Field>
                  <Field label="番地">
                    <TextInput value={altForm.address} onChange={v => updateAlt({ address: v })} placeholder="例）1-2-3" />
                  </Field>
                  <Field label="建物名・部屋番号">
                    <TextInput value={altForm.building} onChange={v => updateAlt({ building: v })} placeholder="例）○○マンション101号室" />
                  </Field>
                </>
              )}

              {/* 海外フォーム */}
              {altForm.isOverseas && (
                <>
                  <Field label="国名" required>
                    <TextInput value={altForm.country} onChange={v => updateAlt({ country: v })} placeholder="例）United States" />
                  </Field>
                  <Field label="郵便番号 / ZIP Code">
                    <TextInput value={altForm.overseasZip} onChange={v => updateAlt({ overseasZip: v })} placeholder="例）90210" />
                  </Field>
                  <Field label="州 / Province">
                    <TextInput value={altForm.overseasState} onChange={v => updateAlt({ overseasState: v })} placeholder="例）California" />
                  </Field>
                  <Field label="市 / City">
                    <TextInput value={altForm.overseasCity} onChange={v => updateAlt({ overseasCity: v })} placeholder="例）Los Angeles" />
                  </Field>
                  <Field label="住所 / Street Address">
                    <TextInput value={altForm.overseasAddress} onChange={v => updateAlt({ overseasAddress: v })} placeholder="例）123 Main St" />
                  </Field>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
