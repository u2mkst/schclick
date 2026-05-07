
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        {children}
        <FirebaseErrorListener />
        <Toaster />
      </body>
    </html>
  );
}
