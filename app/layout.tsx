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
                if (window.Android && window.Android.doAppLogin) {
                  window.Android.doAppLogin(userId, userName);
                } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doAppLogin) {
                  window.webkit.messageHandlers.doAppLogin.postMessage({userId: userId, userName: userName});
                }
                console.log('[Swing2App] 사용자 연동:', userId, userName);
              }
              function doAppLogout() {
                if (window.Android && window.Android.doAppLogout) {
                  window.Android.doAppLogout();
                } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.doAppLogout) {
                  window.webkit.messageHandlers.doAppLogout.postMessage({});
                }
                console.log('[Swing2App] 로그아웃');
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
