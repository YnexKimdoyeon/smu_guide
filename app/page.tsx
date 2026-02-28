'use client'

import { useState, useEffect } from 'react'
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
import { authAPI, getToken, removeToken } from '@/lib/api'
import type { User } from '@/lib/store'

type Screen = 'login' | 'dashboard' | AppId

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login')
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
        } catch {
          removeToken()
        }
      }
      setIsLoading(false)
    }
    checkAuth()
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
    setCurrentScreen(appId)
  }

  const handleBack = () => {
    setCurrentScreen('dashboard')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background max-w-md mx-auto flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative overflow-hidden shadow-xl">
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
    </div>
  )
}
