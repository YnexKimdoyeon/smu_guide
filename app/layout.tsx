import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AlertProvider } from '@/components/alert-context'
import './globals.css'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  title: '선문대학교 가이드',
  description: '선문대학교 학생을 위한 올인원 캠퍼스 가이드 앱',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3B82F6',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Swing2App 푸시 알림 SDK */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Swing2App 사용자 연동 함수
              function doAppLogin(userId, userName) {
                console.log('[Swing2App] doAppLogin 호출:', userId, userName);
                console.log('[Swing2App] Android 존재:', !!window.Android);
                console.log('[Swing2App] webkit 존재:', !!(window.webkit && window.webkit.messageHandlers));

                var success = false;

                // Android
                if (window.Android && window.Android.doAppLogin) {
                  try {
                    window.Android.doAppLogin(userId, userName);
                    console.log('[Swing2App] Android doAppLogin 성공');
                    success = true;
                  } catch(e) {
                    console.error('[Swing2App] Android doAppLogin 오류:', e);
                  }
                }

                // iOS
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doAppLogin) {
                  try {
                    window.webkit.messageHandlers.doAppLogin.postMessage({userId: userId, userName: userName});
                    console.log('[Swing2App] iOS doAppLogin 성공');
                    success = true;
                  } catch(e) {
                    console.error('[Swing2App] iOS doAppLogin 오류:', e);
                  }
                }

                if (!success) {
                  console.warn('[Swing2App] 네이티브 브릿지가 없습니다. Swing2App 웹뷰에서 실행 중인지 확인하세요.');
                }

                return success;
              }

              function doAppLogout() {
                console.log('[Swing2App] doAppLogout 호출');

                if (window.Android && window.Android.doAppLogout) {
                  try {
                    window.Android.doAppLogout();
                  } catch(e) {
                    console.error('[Swing2App] Android doAppLogout 오류:', e);
                  }
                }

                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doAppLogout) {
                  try {
                    window.webkit.messageHandlers.doAppLogout.postMessage({});
                  } catch(e) {
                    console.error('[Swing2App] iOS doAppLogout 오류:', e);
                  }
                }
              }
            `,
          }}
        />
      </head>
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        <AlertProvider>
          {children}
        </AlertProvider>
        <Analytics />
      </body>
    </html>
  )
}
