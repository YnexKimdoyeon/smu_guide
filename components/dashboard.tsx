'use client'

import { useState, useEffect } from 'react'
import { Calendar, MessageCircle, MapPin, Users, LogOut, User, UserX, GraduationCap, Building2, Heart, Award, Bus, X } from 'lucide-react'
import type { User as UserType } from '@/lib/store'
import { authAPI, notificationAPI, bannerAPI } from '@/lib/api'
import { Chatbot } from './chatbot'

export type AppId = 'timetable' | 'chat' | 'commute' | 'announcements' | 'phonebook' | 'friends' | 'elearning' | 'academic-calendar' | 'sunmoon-info' | 'cafeteria' | 'community' | 'scholarship' | 'shuttle'

interface DashboardProps {
  user: UserType
  onOpenApp: (appId: AppId) => void
  onLogout: () => void
}

const apps: { id: AppId; label: string; icon: typeof Calendar; color: string; bgColor: string }[] = [
  { id: 'timetable', label: '내 시간표', icon: Calendar, color: '#3B82F6', bgColor: '#DBEAFE' },
  { id: 'elearning', label: 'E-러닝', icon: GraduationCap, color: '#6366F1', bgColor: '#E0E7FF' },
  { id: 'sunmoon-info', label: '선문대 정보', icon: Building2, color: '#059669', bgColor: '#D1FAE5' },
  { id: 'shuttle', label: '셔틀버스', icon: Bus, color: '#14B8A6', bgColor: '#CCFBF1' },
  { id: 'scholarship', label: '장학금', icon: Award, color: '#F59E0B', bgColor: '#FEF3C7' },
  { id: 'community', label: '동아리/과팅', icon: Heart, color: '#F43F5E', bgColor: '#FFE4E6' },
  { id: 'chat', label: '익명 채팅', icon: MessageCircle, color: '#0EA5E9', bgColor: '#E0F2FE' },
  { id: 'commute', label: '등하교 메이트', icon: MapPin, color: '#10B981', bgColor: '#D1FAE5' },
  { id: 'friends', label: '친구 관리', icon: Users, color: '#EC4899', bgColor: '#FCE7F3' },
]

export function Dashboard({ user, onOpenApp, onLogout }: DashboardProps) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})

  // 배너/팝업 상태
  const [mainBanner, setMainBanner] = useState<any>(null)
  const [popup, setPopup] = useState<any>(null)
  const [showPopup, setShowPopup] = useState(false)

  // Swing2App 사용자 연동 (푸시 알림용)
  useEffect(() => {
    if (user.studentId && user.name) {
      // Swing2App에 사용자 등록
      if (typeof window !== 'undefined') {
        const swingPlugin = (window as any).swingWebViewPlugin
        if (swingPlugin?.app?.login?.doAppLogin) {
          try {
            swingPlugin.app.login.doAppLogin(user.studentId, user.name)
            console.log('[Swing2App] 사용자 등록 성공:', user.studentId, user.name)
          } catch (e) {
            console.error('[Swing2App] 사용자 등록 실패:', e)
          }
        } else {
          console.log('[Swing2App] SDK 미로드 (웹 브라우저에서 실행 중)')
        }
      }
    }
  }, [user.studentId, user.name])

  // 배너/팝업 로드
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const [bannerData, popupData] = await Promise.all([
          bannerAPI.getMainBanner(),
          bannerAPI.getPopup()
        ])

        if (bannerData.is_active) {
          setMainBanner(bannerData)
        }

        if (popupData.is_active) {
          // 오늘 하루 안보기 체크
          const dismissedDate = localStorage.getItem('popup_dismissed_date')
          const today = new Date().toDateString()

          if (dismissedDate !== today) {
            setPopup(popupData)
            setShowPopup(true)
          }
        }
      } catch (err) {
        // 무시
      }
    }
    loadBanners()
  }, [])

  const handleDismissPopupToday = () => {
    const today = new Date().toDateString()
    localStorage.setItem('popup_dismissed_date', today)
    setShowPopup(false)
  }

  const handleClosePopup = () => {
    setShowPopup(false)
  }

  // 알림 배지 조회
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const data = await notificationAPI.getBadges()
        setBadges(data)
      } catch {
        // 무시
      }
    }
    fetchBadges()
    // 30초마다 배지 갱신
    const interval = setInterval(fetchBadges, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleOpenApp = async (appId: AppId) => {
    // 앱 열 때 조회 기록 저장
    try {
      await notificationAPI.markViewed(appId)
      setBadges(prev => {
        const newBadges = { ...prev }
        delete newBadges[appId]
        return newBadges
      })
    } catch {
      // 무시
    }
    onOpenApp(appId)
  }

  const handleLogout = () => {
    // Swing2App 로그아웃
    if (typeof window !== 'undefined') {
      const swingPlugin = (window as any).swingWebViewPlugin
      if (swingPlugin?.app?.login?.doAppLogout) {
        try {
          swingPlugin.app.login.doAppLogout()
          console.log('[Swing2App] 로그아웃 성공')
        } catch (e) {
          console.error('[Swing2App] 로그아웃 실패:', e)
        }
      }
    }
    onLogout()
  }

  const handleWithdraw = async () => {
    if (isWithdrawing) return
    setIsWithdrawing(true)
    try {
      await authAPI.withdraw()
      alert('회원탈퇴가 완료되었습니다.')
      handleLogout()
    } catch (error) {
      alert('회원탈퇴 중 오류가 발생했습니다.')
      setIsWithdrawing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* 팝업 모달 */}
      {showPopup && popup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-card rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl">
            {popup.title && (
              <div className="px-4 py-3 border-b border-border/50">
                <h3 className="font-semibold text-foreground text-center">{popup.title}</h3>
              </div>
            )}
            {popup.link_url ? (
              <a href={popup.link_url} target="_blank" rel="noopener noreferrer">
                <img src={popup.image_url} alt="팝업" className="w-full object-contain" />
              </a>
            ) : (
              <img src={popup.image_url} alt="팝업" className="w-full object-contain" />
            )}
            <div className="flex border-t border-border/50">
              <button
                onClick={handleDismissPopupToday}
                className="flex-1 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors border-r border-border/50"
              >
                오늘 하루 안보기
              </button>
              <button
                onClick={handleClosePopup}
                className="flex-1 py-3 text-sm font-medium text-primary hover:bg-muted transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - 고정 */}
      <header className="flex-shrink-0 px-4 sm:px-5 pt-4 sm:pt-6 pb-3 sm:pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-semibold text-foreground truncate">{user.name}님({user.studentId})</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{user.department}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card flex items-center justify-center shadow-sm border border-border hover:bg-muted transition-colors shrink-0"
          aria-label="로그아웃"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </button>
      </header>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* Welcome Card */}
        <div className="px-4 sm:px-5 mb-4 sm:mb-6">
          <div className="rounded-xl sm:rounded-2xl bg-primary p-4 sm:p-5 shadow-lg">
            <p className="text-primary-foreground/80 text-xs sm:text-sm font-medium">{'오늘도 즐거운 캠퍼스 생활!'}</p>
            <h2 className="text-primary-foreground text-lg sm:text-xl font-bold mt-1">{'선문대학교 가이드'}</h2>
            <p className="text-primary-foreground/70 text-[10px] sm:text-xs mt-1 sm:mt-2">{'필요한 기능을 선택해주세요'}</p>
          </div>
        </div>

        {/* 메인 배너 */}
        {mainBanner && mainBanner.image_url && (
          <div className="px-4 sm:px-5 mb-4 sm:mb-6">
            {mainBanner.link_url ? (
              <a href={mainBanner.link_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={mainBanner.image_url}
                  alt="배너"
                  className="w-full rounded-xl sm:rounded-2xl shadow-sm object-contain"
                />
              </a>
            ) : (
              <img
                src={mainBanner.image_url}
                alt="배너"
                className="w-full rounded-xl sm:rounded-2xl shadow-sm object-contain"
              />
            )}
          </div>
        )}

        {/* App Grid */}
        <div className="px-4 sm:px-5">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {apps.map((app) => {
              const Icon = app.icon
              const badgeCount = badges[app.id]
              return (
                <button
                  key={app.id}
                  onClick={() => handleOpenApp(app.id)}
                  className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card shadow-sm border border-border/50 hover:shadow-md hover:scale-[1.02] active:scale-[0.97] transition-all relative min-touch-target"
                >
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center relative shrink-0"
                    style={{ backgroundColor: app.bgColor }}
                  >
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: app.color }} />
                    {badgeCount && badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4 sm:min-w-5 h-4 sm:h-5 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-foreground text-center leading-tight line-clamp-2 break-keep">
                    {app.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom Branding */}
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">{'Sunmoon University Guide v1.0'}</p>
          <p className="text-xs text-muted-foreground mt-1">{'Developed by (주) 와이넥스'}</p>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-3 text-xs text-red-400 hover:text-red-500 underline"
          >
            회원탈퇴
          </button>
        </div>
      </div>

      {/* 회원탈퇴 확인 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <UserX className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-center text-foreground mb-2">회원탈퇴</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              정말 탈퇴하시겠습니까?<br />
              모든 데이터가 삭제되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
                disabled={isWithdrawing}
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isWithdrawing ? '처리중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPT 챗봇 */}
      <Chatbot />
    </div>
  )
}
