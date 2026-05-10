import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'SCHOOL CLICK',
  description: '전국 학교 대항 클릭 게임. SCHOOL CLICK!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-body antialiased bg-background text-foreground">
        {children}
        <FirebaseErrorListener />
        <Toaster />
        {/* Kakao SDK for Sharing */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          strategy="afterInteractive"
        />
        {/* Google reCAPTCHA v3 */}
        <Script
          src="https://www.google.com/recaptcha/api.js?render=6LfWA-MsAAAAAHkBN0O36eVYQEUSWQOXzF0xz-k2"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
