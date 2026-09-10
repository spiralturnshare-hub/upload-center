import { useEffect, useRef } from 'react';

// ============================================================
// Cloudflare Turnstile ウィジェット(不正な自動送信=SMSポンピング対策)
// ============================================================
// 何をする / なぜ必要か:
//   電話番号ログインの「確認コードを送信」はボタン1つで Twilio 経由の SMS を発火させる。
//   公開アプリなのでボット/スクリプトに乱打されると SMS 課金が膨らむ(SMSポンピング攻撃)。
//   Turnstile のトークンを取得し signInWithOtp({ options:{ captchaToken } }) に添付する。
//   サーバ側(Supabase Auth > Attack Protection > Enable Captcha protection = Turnstile)を
//   ON にすると、トークンの無い/無効なリクエストは Supabase が拒否する。これが本丸の防御で、
//   このウィジェットは正規ユーザーがトークンを得るための入口。
//
// どこと繋がるか:
//   - client/index.html が読み込む https://challenges.cloudflare.com/turnstile/v0/api.js(window.turnstile)。
//   - サイトキー: import.meta.env.VITE_TURNSTILE_SITE_KEY(Vercel 環境変数。公開して良い値)。
//   - 対応する秘密キーは Supabase 管理画面側にのみ入れる(コードには置かない)。
//
// なぜこう作ったか:
//   npm 依存を増やさず(Vercel の pnpm frozen-lockfile 問題を避ける・checkpoints 参照)、
//   スクリプトタグ + window.turnstile.render の明示レンダリングで最小実装。
//   サイトキー未設定時はウィジェットを出さず素通り(プレビュー/ローカルで詰まらせない)。
//   本番では必ずキーを設定し、Supabase 側 Captcha protection を ON にすること。
// ============================================================

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'flexible' | 'compact';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface Props {
  /** トークン取得時に呼ばれる。期限切れ/エラー時は null で呼ばれる。 */
  onToken: (token: string | null) => void;
}

export default function Turnstile({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) {
      // サイトキー未設定: captcha なしで進める(本番では必ず設定する)
      if (import.meta.env.PROD) {
        console.warn('[Turnstile] VITE_TURNSTILE_SITE_KEY 未設定。SMS送信のボット保護が無効です。');
      }
      return;
    }

    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!window.turnstile || !el) {
        window.setTimeout(tryRender, 200); // api.js のロード待ち
        return;
      }
      if (widgetIdRef.current) return; // 二重レンダリング防止
      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        size: 'flexible',
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      });
    };
    tryRender();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* 破棄失敗は無視 */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  /** 送信後にウィジェットを使い回すためのリセット(呼び出し側から ref 経由でなく再マウントで対応する場合は不要) */
  // 明示リセットが要る場合は key を変えて再マウントする運用にしている(SignInPage 参照)。

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}

/** Supabase にトークンを渡す必要があるか(サイトキーが設定されているか) */
export const turnstileEnabled = Boolean(SITE_KEY);
