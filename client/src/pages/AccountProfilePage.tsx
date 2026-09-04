import React, { useState, useEffect, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import type { AccountProfile } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import { toast } from 'sonner';
import { saveMyProfile } from '@/lib/supabase';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ============================================================
// Design: ビビッド・フォーム
// AccountProfilePage: アカウント情報登録・編集画面
// - 氏名（漢字・フリガナ）
// - 電話番号
// - 居住地（日本国内 / 海外）
// - 日本：郵便番号（自動入力）→ 都道府県・市区町村・番地・建物名
// - 海外：国名・郵便番号・州・市・住所
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

const defaultProfile: AccountProfile = {
  firstName: '',
  lastName: '',
  firstNameKana: '',
  lastNameKana: '',
  phone: '',
  isOverseas: false,
  postalCode: '',
  prefecture: '',
  city: '',
  address: '',
  building: '',
  country: '',
  overseasZip: '',
  overseasState: '',
  overseasCity: '',
  overseasAddress: '',
};

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
const inputStyle = { '--focus-color': '#2563EB' } as React.CSSProperties;

function TextInput({ value, onChange, placeholder, type = 'text', inputMode }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
      style={inputStyle}
      onFocus={e => (e.target.style.borderColor = '#2563EB')}
      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
    />
  );
}

export default function AccountProfilePage({ returnTo }: { returnTo?: string }) {
  const { setCurrentPage, accountProfile, setAccountProfile, isLoggedIn, reloadAccountProfile } = useUpload();
  const [form, setForm] = useState<AccountProfile>(accountProfile ?? defaultProfile);
  const [zipLoading, setZipLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const layoutRef = useRef<AppLayoutHandle>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (accountProfile) setForm(accountProfile);
  }, [accountProfile]);

  const update = (data: Partial<AccountProfile>) => setForm(prev => ({ ...prev, ...data }));

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
        update({
          prefecture: r.address1,
          city: r.address2 + r.address3,
        });
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

  const KATAKANA_REGEX = /^[ァ-ヶー　 ]+$/;

  const handleSave = async () => {
    layoutRef.current?.scrollToTop();
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!form.firstName && !form.lastName) { newErrors.firstName = true; newErrors.lastName = true; hasError = true; }
    if (!form.firstNameKana) { newErrors.firstNameKana = true; hasError = true; }
    else if (!KATAKANA_REGEX.test(form.firstNameKana)) { newErrors.firstNameKana = true; hasError = true; }
    if (!form.lastNameKana) { newErrors.lastNameKana = true; hasError = true; }
    else if (!KATAKANA_REGEX.test(form.lastNameKana)) { newErrors.lastNameKana = true; hasError = true; }
    if (!form.phone) { newErrors.phone = true; hasError = true; }
    if (!form.isOverseas && !form.postalCode) { newErrors.postalCode = true; hasError = true; }

    setFieldErrors(newErrors);

    if (hasError) {
      toast.error('未入力の項目があります');
      return;
    }

    // React state を即時反映しつつ、public.users に永続化(再サインインで復元される)
    setSaving(true);
    setAccountProfile(form);
    try {
      await saveMyProfile(form);
      await reloadAccountProfile();
      toast.success('アカウント情報を保存しました');
      setTimeout(() => setCurrentPage(returnTo ?? 'home'), 500);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `保存に失敗しました: ${e.message}`
          : '保存に失敗しました。サインインし直してお試しください。',
      );
    } finally {
      setSaving(false);
    }
  };

  const isEditing = accountProfile !== null;

  return (
    <AppLayout
      ref={layoutRef}
      title={isEditing ? 'アカウント情報の編集' : 'アカウント情報の登録'}
      showBack
      onBack={() => setCurrentPage(returnTo ?? 'home')}
      footer={
        <div className="flex gap-3">
          <PinkButton variant="outline" size="md" onClick={() => setCurrentPage(returnTo ?? 'home')} className="flex-1" disabled={saving}>
            キャンセル
          </PinkButton>
          <PinkButton size="md" onClick={handleSave} className="flex-1" disabled={saving}>
            {saving ? '保存中…' : isEditing ? '変更を保存' : '登録する'}
          </PinkButton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* ヘッダー */}
        <div className="rounded-2xl p-4 text-sm text-gray-600" style={{ backgroundColor: '#DBEAFE' }}>
          {isEditing
            ? 'アカウントに登録されている住所・連絡先情報を編集できます。'
            : 'インソールの配送先として使用するアカウント情報を登録してください。一度登録すると次回以降自動入力されます。'}
        </div>

        {/* 氏名 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">氏名</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓" required>
              <input type="text" value={form.firstName}
                onChange={e => { update({ firstName: e.target.value }); if (fieldErrors.firstName) setFieldErrors(p => ({ ...p, firstName: false })); }}
                placeholder="例）鈴木"
                className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                style={{ borderColor: fieldErrors.firstName ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.firstName ? ERROR_BG : 'white' }}
                onFocus={e => (e.target.style.borderColor = fieldErrors.firstName ? ERROR_BORDER : '#2563EB')}
                onBlur={e => (e.target.style.borderColor = fieldErrors.firstName ? ERROR_BORDER : '#E5E7EB')}
              />
            </Field>
            <Field label="名" required>
              <input type="text" value={form.lastName}
                onChange={e => { update({ lastName: e.target.value }); if (fieldErrors.lastName) setFieldErrors(p => ({ ...p, lastName: false })); }}
                placeholder="例）太郎"
                className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                style={{ borderColor: fieldErrors.lastName ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.lastName ? ERROR_BG : 'white' }}
                onFocus={e => (e.target.style.borderColor = fieldErrors.lastName ? ERROR_BORDER : '#2563EB')}
                onBlur={e => (e.target.style.borderColor = fieldErrors.lastName ? ERROR_BORDER : '#E5E7EB')}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="姓（フリガナ）" required>
              <input type="text" value={form.firstNameKana}
                onChange={e => { update({ firstNameKana: e.target.value }); if (fieldErrors.firstNameKana) setFieldErrors(p => ({ ...p, firstNameKana: false })); }}
                placeholder="例）スズキ"
                className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                style={{ borderColor: fieldErrors.firstNameKana ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.firstNameKana ? ERROR_BG : 'white' }}
                onFocus={e => (e.target.style.borderColor = fieldErrors.firstNameKana ? ERROR_BORDER : '#2563EB')}
                onBlur={e => (e.target.style.borderColor = fieldErrors.firstNameKana ? ERROR_BORDER : '#E5E7EB')}
              />
              {fieldErrors.firstNameKana && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>{form.firstNameKana ? 'カタカナで入力してください' : '姓（フリガナ）を入力してください'}</p>}
            </Field>
            <Field label="名（フリガナ）" required>
              <input type="text" value={form.lastNameKana}
                onChange={e => { update({ lastNameKana: e.target.value }); if (fieldErrors.lastNameKana) setFieldErrors(p => ({ ...p, lastNameKana: false })); }}
                placeholder="例）タロウ"
                className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                style={{ borderColor: fieldErrors.lastNameKana ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.lastNameKana ? ERROR_BG : 'white' }}
                onFocus={e => (e.target.style.borderColor = fieldErrors.lastNameKana ? ERROR_BORDER : '#2563EB')}
                onBlur={e => (e.target.style.borderColor = fieldErrors.lastNameKana ? ERROR_BORDER : '#E5E7EB')}
              />
              {fieldErrors.lastNameKana && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>{form.lastNameKana ? 'カタカナで入力してください' : '名（フリガナ）を入力してください'}</p>}
            </Field>
          </div>
        </div>

        {/* 電話番号 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">連絡先</h3>
          <Field label="電話番号" required>
            <input type="tel" inputMode="tel" value={form.phone}
              onChange={e => { update({ phone: e.target.value }); if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: false })); }}
              placeholder="例）090-1234-5678"
              className="w-full h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
              style={{ borderColor: fieldErrors.phone ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.phone ? ERROR_BG : 'white' }}
              onFocus={e => (e.target.style.borderColor = fieldErrors.phone ? ERROR_BORDER : '#2563EB')}
              onBlur={e => (e.target.style.borderColor = fieldErrors.phone ? ERROR_BORDER : '#E5E7EB')}
            />
            {fieldErrors.phone && <p className="text-xs font-medium mt-1" style={{ color: ERROR_BORDER }}>電話番号を入力してください</p>}
          </Field>
        </div>

        {/* 居住地 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">居住地</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '日本国内', value: false },
              { label: '海外', value: true },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => update({ isOverseas: opt.value })}
                className="h-11 rounded-xl text-sm font-medium border-2 transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: form.isOverseas === opt.value ? '#2563EB' : '#E5E7EB',
                  backgroundColor: form.isOverseas === opt.value ? '#DBEAFE' : 'white',
                  color: form.isOverseas === opt.value ? '#2563EB' : '#374151',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 日本国内フォーム */}
          {!form.isOverseas && (
            <div className="space-y-3">
              <Field label="郵便番号" required>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.postalCode}
                    onChange={e => { update({ postalCode: e.target.value }); if (fieldErrors.postalCode) setFieldErrors(p => ({ ...p, postalCode: false })); }}
                    placeholder="例）123-4567"
                    className="h-11 px-3 rounded-xl border-2 text-sm focus:outline-none transition-colors flex-1"
                    style={{ borderColor: fieldErrors.postalCode ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldErrors.postalCode ? ERROR_BG : 'white' }}
                    onFocus={e => (e.target.style.borderColor = fieldErrors.postalCode ? ERROR_BORDER : '#2563EB')}
                    onBlur={e => (e.target.style.borderColor = fieldErrors.postalCode ? ERROR_BORDER : '#E5E7EB')}
                  />
                  <button
                    onClick={() => fetchAddress(form.postalCode)}
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
                  value={form.prefecture}
                  onChange={e => update({ prefecture: e.target.value })}
                  className={inputClass}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                >
                  <option value="">選択してください</option>
                  {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="市区町村">
                <TextInput value={form.city} onChange={v => update({ city: v })} placeholder="例）渋谷区恵比寿" />
              </Field>
              <Field label="番地">
                <TextInput value={form.address} onChange={v => update({ address: v })} placeholder="例）1-2-3" />
              </Field>
              <Field label="建物名・部屋番号">
                <TextInput value={form.building} onChange={v => update({ building: v })} placeholder="例）○○マンション101号室" />
              </Field>
            </div>
          )}

          {/* 海外フォーム */}
          {form.isOverseas && (
            <div className="space-y-3">
              <Field label="国名" required>
                <TextInput value={form.country} onChange={v => update({ country: v })} placeholder="例）United States" />
              </Field>
              <Field label="郵便番号 / ZIP Code">
                <TextInput value={form.overseasZip} onChange={v => update({ overseasZip: v })} placeholder="例）90210" inputMode="text" />
              </Field>
              <Field label="州 / Province">
                <TextInput value={form.overseasState} onChange={v => update({ overseasState: v })} placeholder="例）California" />
              </Field>
              <Field label="市 / City">
                <TextInput value={form.overseasCity} onChange={v => update({ overseasCity: v })} placeholder="例）Los Angeles" />
              </Field>
              <Field label="住所 / Street Address">
                <TextInput value={form.overseasAddress} onChange={v => update({ overseasAddress: v })} placeholder="例）123 Main St" />
              </Field>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
