'use client'

import { useState, useEffect } from 'react'
import { Calendar, MessageCircle, MapPin, Users, LogOut, User, UserX, GraduationCap, Building2, Heart, Award, Bus, X, Nut, ShoppingBag } from 'lucide-react'
import type { User as UserType } from '@/lib/store'
import { authAPI, notificationAPI, bannerAPI, dotoriAPI } from '@/lib/api'
import { Chatbot } from './chatbot'
import { DotoriShop } from './dotori-shop'

interface DotoriInfo {
  point: number
  nickname_color: string | null
  title: string | null
  can_attend_today: boolean
}

interface DepartmentRanking {
  rank: number
  department: string
  total_dotori: number
  user_count: number
}

interface ReceivedGift {
  id: number
  sender_id: number
  sender_name: string
  amount: number
  created_at: string
}

export type AppId = 'timetable' | 'chat' | 'commute' | 'announcements' | 'phonebook' | 'friends' | 'elearning' | 'academic-calendar' | 'sunmoon-info' | 'cafeteria' | 'community' | 'scholarship' | 'shuttle'

interface DashboardProps {
  user: UserType
  onOpenApp: (appId: AppId) => void
  onLogout: () => void
}

// 앱스토어 심사용: 숨길 앱 ID 목록 (심사 통과 후 빈 배열로 변경)
const hiddenApps: AppId[] = ['chat']

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
].filter(app => !hiddenApps.includes(app.id))

export function Dashboard({ user, onOpenApp, onLogout }: DashboardProps) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})

  // 배너/팝업 상태
  const [mainBanner, setMainBanner] = useState<any>(null)
  const [popup, setPopup] = useState<any>(null)
  const [showPopup, setShowPopup] = useState(false)

  // 도토리 상태
  const [dotoriInfo, setDotoriInfo] = useState<DotoriInfo | null>(null)
  const [showShop, setShowShop] = useState(false)
  const [rankings, setRankings] = useState<DepartmentRanking[]>([])
  const [myDeptRanking, setMyDeptRanking] = useState<DepartmentRanking | null>(null)
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null)

  // 도토리 선물 팝업 상태
  const [receivedGifts, setReceivedGifts] = useState<ReceivedGift[]>([])
  const [showGiftPopup, setShowGiftPopup] = useState(false)
  const [currentGiftIndex, setCurrentGiftIndex] = useState(0)

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

  // 도토리 정보 로드 + 자동 출석 체크 + 선물 확인
  useEffect(() => {
    const loadDotoriData = async () => {
      try {
        // 먼저 정보 조회
        const info = await dotoriAPI.getInfo()

        // 출석 가능하면 자동 출석 체크
        if (info.can_attend_today) {
          try {
            const attendResult = await dotoriAPI.checkAttendance()
            if (attendResult.success) {
              setDotoriInfo({
                ...info,
                point: attendResult.total_point,
                can_attend_today: false
              })
              setAttendanceMessage(attendResult.message)
              // 3초 후 메시지 숨기기
              setTimeout(() => setAttendanceMessage(null), 3000)
            } else {
              setDotoriInfo(info)
            }
          } catch {
            setDotoriInfo(info)
          }
        } else {
          setDotoriInfo(info)
        }

        // 랭킹 조회
        const rankingData = await dotoriAPI.getRanking()
        setRankings(rankingData.rankings || [])
        setMyDeptRanking(rankingData.my_department || null)

        // 읽지 않은 선물 확인
        try {
          const giftsData = await dotoriAPI.getUnreadGifts()
          if (giftsData.gifts && giftsData.gifts.length > 0) {
            setReceivedGifts(giftsData.gifts)
            setCurrentGiftIndex(0)
            setShowGiftPopup(true)
          }
        } catch {
          // 무시
        }
      } catch {
        // 무시
      }
    }
    loadDotoriData()
  }, [])

  // 상점에서 구매 완료 시 도토리 정보 갱신
  const handlePurchaseComplete = (newPoint: number, itemType: string, itemValue: string) => {
    setDotoriInfo(prev => prev ? {
      ...prev,
      point: newPoint,
      nickname_color: itemType === 'nickname_color' ? itemValue : prev.nickname_color,
      title: itemType === 'title' ? itemValue : prev.title
    } : null)
  }

  // 선물 확인 처리
  const handleConfirmGift = async () => {
    const currentGift = receivedGifts[currentGiftIndex]
    if (!currentGift) return

    try {
      await dotoriAPI.markGiftAsRead(currentGift.id)

      // 도토리 잔액 갱신 (이미 받았으니 현재 info에서 가져오기)
      const info = await dotoriAPI.getInfo()
      setDotoriInfo(prev => prev ? { ...prev, point: info.point } : null)
    } catch {
      // 무시
    }

    // 다음 선물로 이동하거나 팝업 닫기
    if (currentGiftIndex < receivedGifts.length - 1) {
      setCurrentGiftIndex(currentGiftIndex + 1)
    } else {
      setShowGiftPopup(false)
      setReceivedGifts([])
      setCurrentGiftIndex(0)
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

      {/* 도토리 선물 받음 팝업 */}
      {showGiftPopup && receivedGifts[currentGiftIndex] && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-card rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <Nut className="w-10 h-10 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">도토리 선물!</h3>
              <p className="text-foreground mb-4">
                <span className="font-semibold text-primary">{receivedGifts[currentGiftIndex].sender_name}</span>님이<br />
                도토리 <span className="font-bold text-amber-600">{receivedGifts[currentGiftIndex].amount}개</span>를 선물했어요!
              </p>
              {receivedGifts.length > 1 && (
                <p className="text-xs text-muted-foreground mb-4">
                  {currentGiftIndex + 1} / {receivedGifts.length}
                </p>
              )}
            </div>
            <button
              onClick={handleConfirmGift}
              className="w-full py-4 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              확인
            </button>
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
        {/* 오른쪽: 도토리 + 상점 + 로그아웃 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 도토리 표시 (클릭 시 상점 열기) */}
          <button
            onClick={() => setShowShop(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-amber-100 hover:bg-amber-200 active:scale-95 transition-all"
            title="도토리 상점"
          >
            <Nut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700" />
            <span className="text-xs sm:text-sm font-semibold text-amber-800">
              {dotoriInfo?.point ?? 0}
            </span>
            <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
          </button>
          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-card flex items-center justify-center shadow-sm border border-border hover:bg-muted transition-colors shrink-0"
            aria-label="로그아웃"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* 출석 완료 토스트 */}
      {attendanceMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-full shadow-lg">
            <Nut className="w-4 h-4" />
            <span className="text-sm font-medium">{attendanceMessage}</span>
          </div>
        </div>
      )}

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

        {/* 학과별 도토리 랭킹 */}
        {rankings.length >= 3 && (
          <div className="px-4 sm:px-5 mt-6 sm:mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <span>학과별 도토리 랭킹</span>
              <span className="text-base">🏆</span>
            </h3>

            {/* 올림픽 단상 */}
            <div className="flex items-end justify-center gap-1.5 sm:gap-2 h-48 sm:h-52">
              {/* 2위 */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 flex items-center justify-center mb-2 shadow-md">
                  <span className="text-xl sm:text-2xl">🥈</span>
                </div>
                <div className="bg-gray-200 w-24 sm:w-28 h-20 sm:h-24 rounded-t-lg flex flex-col items-center justify-center px-1 py-1">
                  <span className="text-[8px] sm:text-[10px] font-bold text-gray-700 text-center leading-tight line-clamp-2 w-full break-keep px-0.5">
                    {rankings[1]?.department || '-'}
                  </span>
                  <div className="flex items-center gap-0.5 mt-1">
                    <Nut className="w-3 h-3 text-amber-600" />
                    <span className="text-[10px] sm:text-xs text-gray-600 font-medium">
                      {rankings[1]?.total_dotori || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1위 (가장 높음) */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-yellow-300 flex items-center justify-center mb-2 shadow-lg ring-2 ring-yellow-400">
                  <span className="text-2xl sm:text-3xl">🥇</span>
                </div>
                <div className="bg-yellow-300 w-28 sm:w-32 h-28 sm:h-32 rounded-t-lg flex flex-col items-center justify-center px-1 py-1">
                  <span className="text-[9px] sm:text-[11px] font-bold text-yellow-900 text-center leading-tight line-clamp-2 w-full break-keep px-0.5">
                    {rankings[0]?.department || '-'}
                  </span>
                  <div className="flex items-center gap-0.5 mt-1">
                    <Nut className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-xs sm:text-sm text-yellow-800 font-semibold">
                      {rankings[0]?.total_dotori || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3위 */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-600 flex items-center justify-center mb-2 shadow-md">
                  <span className="text-lg sm:text-xl">🥉</span>
                </div>
                <div className="bg-amber-600 w-22 sm:w-24 h-16 sm:h-20 rounded-t-lg flex flex-col items-center justify-center px-1 py-1">
                  <span className="text-[7px] sm:text-[9px] font-bold text-white text-center leading-tight line-clamp-2 w-full break-keep px-0.5">
                    {rankings[2]?.department || '-'}
                  </span>
                  <div className="flex items-center gap-0.5 mt-1">
                    <Nut className="w-3 h-3 text-amber-200" />
                    <span className="text-[10px] sm:text-xs text-amber-100 font-medium">
                      {rankings[2]?.total_dotori || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 내 학과 순위 */}
            {myDeptRanking && (
              <div className="mt-4 p-3 bg-primary/10 rounded-xl">
                <p className="text-sm text-center">
                  우리 학과 <span className="font-bold text-primary">{myDeptRanking.department}</span>는{' '}
                  <span className="font-bold text-primary">{myDeptRanking.rank}위</span>
                  <span className="text-muted-foreground ml-1">
                    ({myDeptRanking.total_dotori}개)
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

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

      {/* 도토리 상점 모달 */}
      <DotoriShop
        isOpen={showShop}
        onClose={() => setShowShop(false)}
        dotoriPoint={dotoriInfo?.point || 0}
        currentColor={dotoriInfo?.nickname_color || null}
        currentTitle={dotoriInfo?.title || null}
        onPurchaseComplete={handlePurchaseComplete}
      />

      {/* GPT 챗봇 */}
      <Chatbot />
    </div>
  )
}
