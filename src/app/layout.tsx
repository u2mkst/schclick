import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'SCHOOL CLICK - 우리 학교를 1위로!',
  description: '전국 학교 대항 클릭 게임. 우리 학교의 명예를 위해 클릭하세요!',
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
        <Script
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=619a98fc6bc8426aa8804d86591c7a6c&libraries=services&autoload=false"
          strategy="beforeInteractive"
        />
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://www.google.com/recaptcha/api.js?render=6LfWA-MsAAAAAHkBN0O36eVYQEUSWQOXzF0xz-k2"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}