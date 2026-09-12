import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchOrgBranding, type OrgBranding } from '@/lib/supabase';

// ============================================================
// BrandContext ― OEM テナント別ブランディング(色 + ロゴ)
// docs/38(spiralturn-green-integration)/ Bacon_Brain「アップロードアプリのマルチテナント化」
//
// ThemeContext(light/dark)とは役割が別:こちらは「どのテナント(自社/OEM)の色・ロゴを出すか」。
//
// 【テナント判定の優先順位】(起動時に1回だけ解決。upload-center は URL ルーティングが無い
//  SPA なので、内部の画面遷移(currentPage)では再判定しない)
//   1. URL のサブドメインラベル(例: pk.insoleorder.jp → "pk")。
//      本番ドメインが insoleorder.jp へカットオーバーするまでは通常ヒットしない(現状は
//      upload-center-murex.vercel.app 等の固定ドメインのため)。将来そのまま使える形にしておく。
//   2. `?org=<slug>` クエリパラメータ。ドメインカットオーバー前の現行の主経路。
//      OEM の Shopify / LINE公式リッチメニュー / QR からのハンドオフリンクにこの形で埋め込む想定。
//   3. sessionStorage に記憶した直近の slug(内部 state 遷移中も URL を再パースしないため)。
//   4. 解決できなければ自社(既定の見た目のまま。ブランド上書き無し)。
//
// 【今回のスコープ外(次の一手)】
//   ログイン後、実際の注文(orders.organization_id)からブランドを補強/上書きする経路は未実装。
//   今回は「URL 由来の slug」だけで完結させる(docs/38 参照)。
// ============================================================

const SESSION_KEY = 'spiralturn_org_slug';

/** ドメインのサブドメインラベルを抜き出す。*.vercel.app 等の共有ドメインでは使わない。 */
function subdomainFromHostname(hostname: string): string | null {
  // "murex.vercel.app" のような Vercel 共有ドメイン・"localhost"・素の "insoleorder.jp" は対象外。
  if (hostname === 'localhost' || hostname.endsWith('.vercel.app')) return null;
  const parts = hostname.split('.');
  // 例: pk.insoleorder.jp → ["pk", "insoleorder", "jp"] → 先頭が slug
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0];
  return null;
}

function resolveTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;

  const fromHost = subdomainFromHostname(window.location.hostname);
  if (fromHost) {
    sessionStorage.setItem(SESSION_KEY, fromHost);
    return fromHost;
  }

  const fromQuery = new URLSearchParams(window.location.search).get('org');
  if (fromQuery) {
    sessionStorage.setItem(SESSION_KEY, fromQuery);
    return fromQuery;
  }

  const fromSession = sessionStorage.getItem(SESSION_KEY);
  if (fromSession) return fromSession;

  return null;
}

/** --primary(および color-mix() で自動計算される派生色)を上書きする。index.css 参照。 */
function applyBrandColor(hex: string | null) {
  const root = document.documentElement;
  if (hex) {
    root.style.setProperty('--primary', hex);
  } else {
    root.style.removeProperty('--primary'); // 自社の既定色に戻す
  }
}

interface BrandContextType {
  brand: OrgBranding | null;
  loading: boolean;
}

const BrandContext = createContext<BrandContextType>({ brand: null, loading: true });

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const slug = resolveTenantSlug();
      if (!slug) { setLoading(false); return; }
      const b = await fetchOrgBranding(slug);
      if (cancelled) return;
      setBrand(b);
      applyBrandColor(b?.brandColor ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <BrandContext.Provider value={{ brand, loading }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
