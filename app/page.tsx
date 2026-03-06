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


export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login')
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
        } catch {
          removeToken()
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [])

  // 안드로이드 뒤로가기: 하위앱 → 대시보드 네비게이션
  useEffect(() => {
    const handlePopState = () => {
      const screen = currentScreenRef.current
      const prevScreen = previousScreenRef.current

      // 대시보드나 로그인에서는 웹뷰가 알아서 처리 (앱 종료)
      if (screen === 'dashboard' || screen === 'login') return

      // 하위 화면에서 뒤로가기 → 대시보드 또는 선문대 정보로
      if (sunmoonSubApps.includes(screen) && prevScreen === 'sunmoon-info') {
        setCurrentScreen('sunmoon-info')
        currentScreenRef.current = 'sunmoon-info'
        history.pushState(null, '')
      } else {
        setCurrentScreen('dashboard')
        currentScreenRef.current = 'dashboard'
        history.pushState(null, '')
      }
      setPreviousScreen(null)
      previousScreenRef.current = null
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
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
    history.pushState(null, '')
  }

  const handleBack = () => {
    history.back()
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
            history.pushState(null, '')
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
