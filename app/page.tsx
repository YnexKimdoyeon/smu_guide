'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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


export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login')
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showExitDialog, setShowExitDialog] = useState(false)
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
          // 히스토리 베이스 설정 + 뒤로가기를 잡기 위한 더미 엔트리 추가
          history.replaceState({ screen: 'dashboard' }, '')
          history.pushState({ screen: 'dashboard' }, '')
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

      // 대시보드나 로그인에서 뒤로가기 → 종료 확인 팝업
      if (screen === 'dashboard' || screen === 'login') {
        // 히스토리를 다시 쌓아서 다음 뒤로가기도 잡을 수 있게
        history.pushState({ screen }, '')
        setShowExitDialog(true)
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
      currentScreenRef.current = 'dashboard'
      history.replaceState({ screen: 'dashboard' }, '')
      history.pushState({ screen: 'dashboard' }, '')
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

  const handleExitApp = useCallback(() => {
    setShowExitDialog(false)
    if (typeof window !== 'undefined') {
      const swingPlugin = (window as any).swingWebViewPlugin
      if (swingPlugin?.app?.exit?.doAppExit) {
        swingPlugin.app.exit.doAppExit()
      } else {
        // 웹뷰 플러그인이 없는 경우 (브라우저 테스트 등)
        window.close()
      }
    }
  }, [])

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

      {/* 앱 종료 확인 팝업 */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 mx-8 max-w-sm w-full shadow-xl">
            <p className="text-center text-gray-800 text-lg font-medium mb-6">
              앱을 종료하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitDialog(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium text-base"
              >
                취소
              </button>
              <button
                onClick={handleExitApp}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium text-base"
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
