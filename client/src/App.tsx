import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UploadProvider, useUpload } from "./contexts/UploadContext";
import ErrorBoundary from "./components/ErrorBoundary";

import { useEffect } from "react";

// Pages
import HomePage from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import Step1VideoPage from "./pages/Step1VideoPage";
import Step2PhotoPage from "./pages/Step2PhotoPage";
import Step3ShoesPage from "./pages/Step3ShoesPage";
import Step4PainPage from "./pages/Step4PainPage";
import Step5PurposePage from "./pages/Step5PurposePage";
import Step6TakoPage from "./pages/Step6TakoPage";
import Step7InfoPage from "./pages/Step7InfoPage";
import Step8ConfirmPage from "./pages/Step8ConfirmPage";
import CompletePage from "./pages/CompletePage";
import AccountProfilePage from "./pages/AccountProfilePage";
import PaymentIdUploadPage from "./pages/PaymentIdUploadPage";
import GuestUploadPage from "./pages/GuestUploadPage";

// ============================================================
// Design: ビビッド・フォーム
// App: PANTONE Pink C (#D62598) イメージカラー
// Single-page context-based navigation (no URL routing)
// ============================================================

function AccountProfilePageWrapper() {
  const { returnToPage } = useUpload();
  return <AccountProfilePage returnTo={returnToPage} />;
}

function AppRouter() {
  const { currentPage } = useUpload();

  // ページが切り替わるたびに画面最上部へスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
    // スクロール可能な全コンテナもリセット
    document.querySelectorAll('[data-scroll-container]').forEach(el => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [currentPage]);

  switch (currentPage) {
    case 'home':
      return <HomePage />;
    case 'signin':
      return <SignInPage />;
    case 'step1':
      return <Step1VideoPage />;
    case 'step2':
      return <Step2PhotoPage />;
    case 'step3':
      return <Step3ShoesPage />;
    case 'step4':
      return <Step4PainPage />;
    case 'step5':
      return <Step5PurposePage />;
    case 'step6':
      return <Step6TakoPage />;
    case 'step7':
      return <Step7InfoPage />;
    case 'step8':
      return <Step8ConfirmPage />;
    case 'complete':
      return <CompletePage />;
    case 'account-profile':
      return <AccountProfilePageWrapper />;
    case 'payment-id-upload':
      return <PaymentIdUploadPage />;
    case 'guest-upload':
      return <GuestUploadPage />;
    default:
      return <HomePage />;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <UploadProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </UploadProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
