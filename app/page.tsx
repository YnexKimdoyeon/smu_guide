'use client'

import { useState, useEffect, useRef } from 'react'
import { LoginScreen } from '@/components/login-screen'
import { Dashboard, type AppId } from '@/components/dashboard'
import { TimetableScreen } from '@/components/timetable-screen'
import { ChatScreen } from '@/components/chat-screen'
import { CommuteScreen } from '@/components/commute-screen'
import { AnnouncementsScreen } from '@/components/announcements-screen'
import { PhonebookScreen } from '@/components/phonebook-screen'
import { FriendsScreen } from '@/components/friends-screen'
import { ElearningScreen } from '@/components/elearning-screen'
import { CalendarScreen } from '@/components/calendar-screen'
import { SunmoonInfoScreen } from '@/components/sunmoon-info-screen'
import { CafeteriaScreen } from '@/components/cafeteria-screen'
import { CommunityScreen } from '@/components/community-screen'
import { ScholarshipScreen } from '@/components/scholarship-screen'
import { ShuttleScreen } from '@/components/shuttle-screen'
import { authAPI, getToken, removeToken } from '@/lib/api'
import type { User } from '@/lib/store'

type Screen = 'login' | 'dashboard' | AppId

// 선문대 정보 하위 앱들
const sunmoonSubApps: Screen[] = ['academic-calendar', 'announcements', 'phonebook', 'cafeteria']

// 뒤로가기 두 번 눌러야 종료 안내 토스트
function showBackToast() {
  const existing = document.getElementById('back-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'back-toast'
  toast.textContent = '뒤로가기를 한 번 더 누르면 종료됩니다'
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.75); color: white; padding: 10px 20px;
    border-radius: 24px; font-size: 14px; z-index: 99999;
    animation: fadeInOut 2s ease-in-out forwards;
    pointer-events: none; white-space: nowrap;
  `
  // 애니메이션 스타일 추가
  if (!document.getElementById('back-toast-style')) {
    const style = document.createElement('style')
    style.id = 'back-toast-style'
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
      }
    `
    document.head.appendChild(style)
  }
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2000)
}

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login')
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const backPressedOnce = useRef(false)
  const backTimerRef = useRef<NodeJS.Timeout | null>(null)
  // popstate 핸들러 내에서 최신 state를 참조하기 위한 ref
  const currentScreenRef = useRef<Screen>('login')
  const previousScreenRef = useRef<Screen | null>(null)

  // 앱 시작 시 토큰 확인
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken()
      if (token) {
        try {
          const userData = await authAPI.getMe()
          setUser({
            id: String(userData.id),
            name: userData.name,
            studentId: userData.student_id,
            department: userData.department,
          })
          setCurrentScreen('dashboard')
          currentScreenRef.current = 'dashboard'
          // 로그인 상태면 대시보드를 히스토리 베이스로 설정
          history.replaceState({ screen: 'dashboard' }, '')
        } catch {
          removeToken()
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [])

  // popstate 이벤트 (안드로이드 뒤로가기) 처리
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const screen = currentScreenRef.current
      const prevScreen = previousScreenRef.current

      // 대시보드나 로그인에서 뒤로가기 → 앱 종료 방지
      if (screen === 'dashboard' || screen === 'login') {
        // 히스토리를 다시 쌓아서 다음 뒤로가기도 잡을 수 있게
        history.pushState({ screen }, '')

        if (backPressedOnce.current) {
          // 두 번째 누름 → 네이티브 앱 종료 허용
          if (typeof window !== 'undefined') {
            const swingPlugin = (window as any).swingWebViewPlugin
            if (swingPlugin?.app?.exit?.doAppExit) {
              swingPlugin.app.exit.doAppExit()
            }
          }
          return
        }

        backPressedOnce.current = true
        // 토스트 메시지 표시 (간단한 alert 대신)
        showBackToast()
        backTimerRef.current = setTimeout(() => {
          backPressedOnce.current = false
        }, 2000)
        return
      }

      // 하위 화면에서 뒤로가기
      if (sunmoonSubApps.includes(screen) && prevScreen === 'sunmoon-info') {
        setCurrentScreen('sunmoon-info')
        currentScreenRef.current = 'sunmoon-info'
        // 선문대 정보도 하위 화면이므로 히스토리 유지
        history.pushState({ screen: 'sunmoon-info' }, '')
      } else {
        setCurrentScreen('dashboard')
        currentScreenRef.current = 'dashboard'
        // 대시보드에서 다음 뒤로가기를 잡을 수 있도록 히스토리 추가
        history.pushState({ screen: 'dashboard' }, '')
      }
      setPreviousScreen(null)
      previousScreenRef.current = null
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (backTimerRef.current) clearTimeout(backTimerRef.current)
    }
  }, [])

  const handleLogin = async (studentId: string, password: string) => {
    try {
      // 선문대 시스템으로 로그인
      const data = await authAPI.loginWithSunmoon(studentId, password)
      setUser({
        id: '1',
        name: data.name,
        studentId: data.student_id,
        department: data.department,
      })
      setCurrentScreen('dashboard')
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  const handleLogout = () => {
    authAPI.logout()
    setUser(null)
    setCurrentScreen('login')
  }

  const handleOpenApp = (appId: AppId) => {
    setPreviousScreen(currentScreen)
    previousScreenRef.current = currentScreen
    setCurrentScreen(appId)
    currentScreenRef.current = appId
    // 브라우저 히스토리에 추가 → 뒤로가기 버튼으로 돌아올 수 있게
    history.pushState({ screen: appId }, '')
  }

  const handleBack = () => {
    // 선문대 정보 하위 앱에서 뒤로가면 선문대 정보로
    if (sunmoonSubApps.includes(currentScreen) && previousScreen === 'sunmoon-info') {
      setCurrentScreen('sunmoon-info')
      currentScreenRef.current = 'sunmoon-info'
    } else {
      setCurrentScreen('dashboard')
      currentScreenRef.current = 'dashboard'
    }
    setPreviousScreen(null)
    previousScreenRef.current = null
    // UI 버튼 클릭 시 현재 히스토리를 교체 (popstate 발생 안 함)
    history.replaceState({ screen: currentScreenRef.current }, '')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {currentScreen === 'login' && (
        <LoginScreen onLogin={handleLogin} />
      )}
      {currentScreen === 'dashboard' && user && (
        <Dashboard
          user={user}
          onOpenApp={handleOpenApp}
          onLogout={handleLogout}
        />
      )}
      {currentScreen === 'timetable' && (
        <TimetableScreen onBack={handleBack} />
      )}
      {currentScreen === 'chat' && (
        <ChatScreen onBack={handleBack} />
      )}
      {currentScreen === 'commute' && (
        <CommuteScreen onBack={handleBack} />
      )}
      {currentScreen === 'announcements' && (
        <AnnouncementsScreen onBack={handleBack} />
      )}
      {currentScreen === 'phonebook' && (
        <PhonebookScreen onBack={handleBack} />
      )}
      {currentScreen === 'friends' && (
        <FriendsScreen onBack={handleBack} />
      )}
      {currentScreen === 'elearning' && (
        <ElearningScreen onBack={handleBack} />
      )}
      {currentScreen === 'academic-calendar' && (
        <CalendarScreen onBack={handleBack} />
      )}
      {currentScreen === 'sunmoon-info' && (
        <SunmoonInfoScreen
          onBack={handleBack}
          onOpenSubApp={(subAppId) => {
            setPreviousScreen('sunmoon-info')
            previousScreenRef.current = 'sunmoon-info'
            setCurrentScreen(subAppId)
            currentScreenRef.current = subAppId
            history.pushState({ screen: subAppId }, '')
          }}
        />
      )}
      {currentScreen === 'cafeteria' && (
        <CafeteriaScreen onBack={handleBack} />
      )}
      {currentScreen === 'community' && user && (
        <CommunityScreen
          onBack={handleBack}
          userDepartment={user.department}
          userName={user.name}
          userStudentId={user.studentId}
        />
      )}
      {currentScreen === 'scholarship' && (
        <ScholarshipScreen onBack={handleBack} />
      )}
      {currentScreen === 'shuttle' && (
        <ShuttleScreen onBack={handleBack} />
      )}
    </div>
  )
}
