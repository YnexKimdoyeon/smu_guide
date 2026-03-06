'use client'

import { useState, useEffect } from 'react'
import { adminAPI, removeAdminToken } from '@/lib/api'
import { Lock, Users, MessageCircle, Calendar, UserPlus, Building2, Heart, AlertTriangle, ChevronLeft, ChevronRight, Search, LogOut, Bell, Send, Image, X, Upload, Trash2, Nut } from 'lucide-react'

interface Stats {
  total_users: number
  total_schedules: number
  total_chat_messages: number
  total_random_messages: number
  total_friends: number
  total_clubs: number
  total_meetings: number
  total_reports: number
}

interface UserSummary {
  id: number
  student_id: string
  name: string
  department: string
  created_at: string | null
  schedule_count: number
  chat_count: number
  friend_count: number
}

interface UserDetail {
  user: {
    id: number
    student_id: string
    name: string
    department: string
    profile_image: string | null
    dotori_point: number
    created_at: string | null
    updated_at: string | null
  }
  schedules: Array<{
    id: number
    day: string
    start_time: string
    end_time: string
    subject: string
    professor: string | null
    room: string | null
  }>
  chat_messages: Array<{
    id: number
    room_name: string
    message: string
    created_at: string | null
  }>
  random_chat_messages: Array<{
    id: number
    room_id: number
    message: string
    created_at: string | null
  }>
  friends: Array<{
    id: number
    direction: string
    friend_name: string
    friend_student_id: string
    status: string
    created_at: string | null
  }>
  commute_schedules: Array<{
    id: number
    day: string
    commute_type: string
    time: string
    location: string | null
    is_active: number
  }>
  commute_chats: Array<{
    id: number
    group_id: number
    message: string
    created_at: string | null
  }>
  clubs_created: Array<{
    id: number
    name: string
    description: string
    created_at: string | null
  }>
  club_applications: Array<{
    id: number
    club_name: string
    created_at: string | null
  }>
  meetings_created: Array<{
    id: number
    department: string
    member_count: number
    description: string | null
    status: string
    created_at: string | null
  }>
  meeting_applications: Array<{
    id: number
    meeting_department: string
    message: string | null
    is_matched: number
    created_at: string | null
  }>
  reports_sent: Array<{
    id: number
    reported_user: string
    reason: string
    detail: string | null
    status: string
    created_at: string | null
  }>
  reports_received: Array<{
    id: number
    reporter: string
    reason: string
    detail: string | null
    status: string
    created_at: string | null
  }>
  blocks: Array<{
    id: number
    blocked_user: string
    blocked_student_id: string
    created_at: string | null
  }>
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 선택 삭제 관련 상태
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  // 도토리 지급 관련 상태
  const [showDotoriModal, setShowDotoriModal] = useState(false)
  const [dotoriTargetUser, setDotoriTargetUser] = useState<UserSummary | null>(null)
  const [dotoriAmount, setDotoriAmount] = useState('')
  const [dotoriReason, setDotoriReason] = useState('')
  const [isGrantingDotori, setIsGrantingDotori] = useState(false)

  // 도토리 설정 (유저 상세)
  const [dotoriEditValue, setDotoriEditValue] = useState('')
  const [isSettingDotori, setIsSettingDotori] = useState(false)

  // 푸시 알림 관련 상태
  const [showPushModal, setShowPushModal] = useState(false)
  const [pushTarget, setPushTarget] = useState<'single' | 'all'>('single')
  const [pushTargetUser, setPushTargetUser] = useState<UserSummary | null>(null)
  const [pushTitle, setPushTitle] = useState('')
  const [pushContent, setPushContent] = useState('')
  const [isSendingPush, setIsSendingPush] = useState(false)

  // 배너/팝업 관련 상태
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [bannerType, setBannerType] = useState<'main' | 'popup'>('main')
  const [bannerImageData, setBannerImageData] = useState<string | null>(null)
  const [bannerLinkUrl, setBannerLinkUrl] = useState('')
  const [bannerTitle, setBannerTitle] = useState('')
  const [bannerIsActive, setBannerIsActive] = useState(true)
  const [isSavingBanner, setIsSavingBanner] = useState(false)
  const [currentMainBanner, setCurrentMainBanner] = useState<any>(null)
  const [currentPopup, setCurrentPopup] = useState<any>(null)

  // 기존 세션 확인
  useEffect(() => {
    const checkExistingSession = async () => {
      if (adminAPI.isAuthenticated()) {
        try {
          await adminAPI.getStats()
          setIsAuthenticated(true)
          loadData()
        } catch {
          // 세션 만료됨
          removeAdminToken()
        }
      }
      setIsCheckingAuth(false)
    }
    checkExistingSession()
  }, [])

  const handleLogin = async () => {
    setIsLoading(true)
    setError('')
    try {
      await adminAPI.login(password)
      setIsAuthenticated(true)
      loadData()
    } catch (err) {
      setError('비밀번호가 올바르지 않습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    adminAPI.logout()
    setIsAuthenticated(false)
    setStats(null)
    setUsers([])
    setSelectedUser(null)
  }

  const loadData = async () => {
    try {
      const [statsData, usersData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers()
      ])
      setStats(statsData)
      setUsers(usersData)
      // 배너 데이터 로드
      loadBanners()
    } catch (err: any) {
      console.error('데이터 로드 실패:', err)
      // 인증 오류시 로그아웃
      if (err.message?.includes('인증') || err.message?.includes('세션')) {
        handleLogout()
      }
    }
  }

  const loadBanners = async () => {
    try {
      const [mainBanner, popup] = await Promise.all([
        adminAPI.getMainBanner(),
        adminAPI.getPopup()
      ])
      setCurrentMainBanner(mainBanner)
      setCurrentPopup(popup)
    } catch (err) {
      console.error('배너 로드 실패:', err)
    }
  }

  const loadUserDetail = async (userId: number) => {
    try {
      const detail = await adminAPI.getUserDetail(userId)
      setSelectedUser(detail)
    } catch (err: any) {
      console.error('유저 상세 로드 실패:', err)
      if (err.message?.includes('인증') || err.message?.includes('세션')) {
        handleLogout()
      }
    }
  }

  const openPushModal = (target: 'single' | 'all', user?: UserSummary) => {
    setPushTarget(target)
    setPushTargetUser(user || null)
    setPushTitle('')
    setPushContent('')
    setShowPushModal(true)
  }

  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushContent.trim()) {
      alert('제목과 내용을 입력하세요.')
      return
    }

    setIsSendingPush(true)
    try {
      if (pushTarget === 'all') {
        const result = await adminAPI.sendPushAll(pushTitle, pushContent)
        if (result.success) {
          alert('전체 푸시 알림이 전송되었습니다.')
        } else {
          alert('푸시 알림 전송 실패')
        }
      } else if (pushTargetUser) {
        const result = await adminAPI.sendPush([pushTargetUser.id], pushTitle, pushContent)
        if (result.success) {
          alert(`${pushTargetUser.name}님에게 푸시 알림이 전송되었습니다.`)
        } else {
          alert('푸시 알림 전송 실패')
        }
      }
      setShowPushModal(false)
    } catch (err: any) {
      console.error('푸시 전송 실패:', err)
      alert('푸시 알림 전송 중 오류가 발생했습니다.')
    } finally {
      setIsSendingPush(false)
    }
  }

  // 선택 삭제
  const toggleSelectUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedUserIds.length === 0) return
    if (!confirm(`선택한 ${selectedUserIds.length}명의 회원과 관련된 모든 데이터를 삭제합니다.\n\n정말 삭제하시겠습니까?`)) return

    setIsDeleting(true)
    try {
      await adminAPI.deleteUsers(selectedUserIds)
      alert(`${selectedUserIds.length}명의 회원이 삭제되었습니다.`)
      setSelectedUserIds([])
      loadData()
    } catch (err: any) {
      alert('회원 삭제 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setIsDeleting(false)
    }
  }

  // 도토리 지급
  const openDotoriModal = (user: UserSummary) => {
    setDotoriTargetUser(user)
    setDotoriAmount('')
    setDotoriReason('')
    setShowDotoriModal(true)
  }

  const handleGrantDotori = async () => {
    if (!dotoriTargetUser || !dotoriAmount) return
    const amount = parseInt(dotoriAmount)
    if (isNaN(amount) || amount < 1) {
      alert('1개 이상 입력하세요.')
      return
    }

    setIsGrantingDotori(true)
    try {
      await adminAPI.grantDotori(dotoriTargetUser.id, amount, dotoriReason || undefined)
      alert(`${dotoriTargetUser.name}님에게 도토리 ${amount}개를 지급했습니다.`)
      setShowDotoriModal(false)
    } catch (err: any) {
      alert('도토리 지급 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setIsGrantingDotori(false)
    }
  }

  const openBannerModal = (type: 'main' | 'popup') => {
    setBannerType(type)
    if (type === 'main' && currentMainBanner?.is_active) {
      setBannerImageData(currentMainBanner.image_url)
      setBannerLinkUrl(currentMainBanner.link_url || '')
      setBannerIsActive(true)
    } else if (type === 'popup' && currentPopup?.is_active) {
      setBannerImageData(currentPopup.image_url)
      setBannerLinkUrl(currentPopup.link_url || '')
      setBannerTitle(currentPopup.title || '')
      setBannerIsActive(true)
    } else {
      setBannerImageData(null)
      setBannerLinkUrl('')
      setBannerTitle('')
      setBannerIsActive(true)
    }
    setShowBannerModal(true)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setBannerImageData(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveBanner = async () => {
    if (!bannerImageData) {
      alert('이미지를 업로드해주세요.')
      return
    }

    setIsSavingBanner(true)
    try {
      if (bannerType === 'main') {
        await adminAPI.updateMainBanner(bannerImageData, bannerLinkUrl || null, bannerIsActive)
        alert('메인 배너가 저장되었습니다.')
      } else {
        await adminAPI.updatePopup(bannerImageData, bannerLinkUrl || null, bannerIsActive, bannerTitle)
        alert('팝업이 저장되었습니다.')
      }
      setShowBannerModal(false)
      loadBanners()
    } catch (err) {
      console.error('배너 저장 실패:', err)
      alert('배너 저장에 실패했습니다.')
    } finally {
      setIsSavingBanner(false)
    }
  }

  const handleDeleteBanner = async (type: 'main' | 'popup') => {
    if (!confirm(type === 'main' ? '메인 배너를 삭제하시겠습니까?' : '팝업을 삭제하시겠습니까?')) {
      return
    }

    try {
      if (type === 'main') {
        await adminAPI.deleteMainBanner()
        alert('메인 배너가 삭제되었습니다.')
      } else {
        await adminAPI.deletePopup()
        alert('팝업이 삭제되었습니다.')
      }
      loadBanners()
    } catch (err) {
      console.error('배너 삭제 실패:', err)
      alert('배너 삭제에 실패했습니다.')
    }
  }

  // 인증 체크 중 로딩 표시
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const filteredUsers = users.filter(user =>
    user.name.includes(searchQuery) ||
    user.student_id.includes(searchQuery) ||
    user.department.includes(searchQuery)
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ko-KR')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-xl">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mx-auto mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">관리자 페이지</h1>
          <p className="text-gray-400 text-center mb-6 text-sm">비밀번호를 입력하세요</p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호"
            className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-primary focus:outline-none mb-4"
          />

          {error && (
            <p className="text-red-400 text-sm text-center mb-4">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading || !password}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </div>
      </div>
    )
  }

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
        <button
          onClick={() => setSelectedUser(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          목록으로
        </button>

        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">{selectedUser.user.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">학번:</span>
              <span className="ml-2">{selectedUser.user.student_id}</span>
            </div>
            <div>
              <span className="text-gray-400">학과:</span>
              <span className="ml-2">{selectedUser.user.department}</span>
            </div>
            <div>
              <span className="text-gray-400">가입일:</span>
              <span className="ml-2">{formatDate(selectedUser.user.created_at)}</span>
            </div>
            <div>
              <span className="text-gray-400">최근 수정:</span>
              <span className="ml-2">{formatDate(selectedUser.user.updated_at)}</span>
            </div>
          </div>

          {/* 도토리 설정 */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Nut className="w-4 h-4 text-amber-400" />
                <span className="text-gray-400 text-sm">도토리:</span>
                <span className="text-amber-400 font-bold">{selectedUser.user.dotori_point}개</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="변경할 값"
                  value={dotoriEditValue}
                  onChange={(e) => setDotoriEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-28 px-3 py-1.5 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={async () => {
                    const val = parseInt(dotoriEditValue)
                    if (isNaN(val) || val < 0) { alert('0 이상의 값을 입력하세요.'); return }
                    setIsSettingDotori(true)
                    try {
                      const result = await adminAPI.setDotori(selectedUser.user.id, val)
                      alert(result.message)
                      setSelectedUser({
                        ...selectedUser,
                        user: { ...selectedUser.user, dotori_point: val }
                      })
                      setDotoriEditValue('')
                    } catch (err: any) {
                      alert('실패: ' + (err.message || '알 수 없는 오류'))
                    } finally {
                      setIsSettingDotori(false)
                    }
                  }}
                  disabled={isSettingDotori || !dotoriEditValue}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {isSettingDotori ? '...' : '설정'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 시간표 */}
        <Section title="시간표" count={selectedUser.schedules.length}>
          {selectedUser.schedules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-3">요일</th>
                    <th className="text-left py-2 px-3">시간</th>
                    <th className="text-left py-2 px-3">과목</th>
                    <th className="text-left py-2 px-3">교수</th>
                    <th className="text-left py-2 px-3">강의실</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.schedules.map(s => (
                    <tr key={s.id} className="border-b border-gray-700/50">
                      <td className="py-2 px-3">{s.day}</td>
                      <td className="py-2 px-3">{s.start_time} - {s.end_time}</td>
                      <td className="py-2 px-3">{s.subject}</td>
                      <td className="py-2 px-3">{s.professor || '-'}</td>
                      <td className="py-2 px-3">{s.room || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 채팅 메시지 */}
        <Section title="익명 채팅 메시지" count={selectedUser.chat_messages.length}>
          {selectedUser.chat_messages.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedUser.chat_messages.map(m => (
                <div key={m.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{m.room_name}</span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  <p>{m.message}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 랜덤 채팅 메시지 */}
        <Section title="랜덤 채팅 메시지" count={selectedUser.random_chat_messages.length}>
          {selectedUser.random_chat_messages.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedUser.random_chat_messages.map(m => (
                <div key={m.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Room #{m.room_id}</span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  <p>{m.message}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 친구 */}
        <Section title="친구" count={selectedUser.friends.length}>
          {selectedUser.friends.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.friends.map(f => (
                <div key={f.id} className="bg-gray-700/50 rounded-lg p-3 text-sm flex justify-between items-center">
                  <div>
                    <span className="font-medium">{f.friend_name}</span>
                    <span className="text-gray-400 ml-2">({f.friend_student_id})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      f.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                      f.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {f.status === 'accepted' ? '수락됨' : f.status === 'pending' ? '대기중' : '거절됨'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {f.direction === 'sent' ? '보냄' : '받음'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 등하교 스케줄 */}
        <Section title="등하교 스케줄" count={selectedUser.commute_schedules.length}>
          {selectedUser.commute_schedules.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {selectedUser.commute_schedules.map(c => (
                <div key={c.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                  <div className="font-medium">{c.day} {c.commute_type}</div>
                  <div className="text-gray-400">{c.time}</div>
                  {c.location && <div className="text-xs text-gray-500">{c.location}</div>}
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 등하교 채팅 */}
        <Section title="등하교 채팅" count={selectedUser.commute_chats.length}>
          {selectedUser.commute_chats.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedUser.commute_chats.map(m => (
                <div key={m.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Group #{m.group_id}</span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  <p>{m.message}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 동아리 */}
        <Section title="생성한 동아리" count={selectedUser.clubs_created.length}>
          {selectedUser.clubs_created.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.clubs_created.map(c => (
                <div key={c.id} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="font-medium">{c.name}</div>
                  <p className="text-sm text-gray-400 mt-1">{c.description}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        <Section title="동아리 신청" count={selectedUser.club_applications.length}>
          {selectedUser.club_applications.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.club_applications.map(a => (
                <div key={a.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                  <span className="font-medium">{a.club_name}</span>
                  <span className="text-gray-400 ml-2">{formatDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 과팅 */}
        <Section title="생성한 과팅" count={selectedUser.meetings_created.length}>
          {selectedUser.meetings_created.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.meetings_created.map(m => (
                <div key={m.id} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="font-medium">{m.department} ({m.member_count}명)</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      m.status === 'open' ? 'bg-green-500/20 text-green-400' :
                      m.status === 'matched' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                  {m.description && <p className="text-sm text-gray-400 mt-1">{m.description}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        <Section title="과팅 신청" count={selectedUser.meeting_applications.length}>
          {selectedUser.meeting_applications.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.meeting_applications.map(a => (
                <div key={a.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.meeting_department}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      a.is_matched ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {a.is_matched ? '매칭됨' : '대기중'}
                    </span>
                  </div>
                  {a.message && <p className="text-gray-400 mt-1">{a.message}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 신고 */}
        <Section title="보낸 신고" count={selectedUser.reports_sent.length}>
          {selectedUser.reports_sent.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.reports_sent.map(r => (
                <div key={r.id} className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>신고 대상: <strong>{r.reported_user}</strong></span>
                    <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="text-red-400">사유: {r.reason}</div>
                  {r.detail && <p className="text-gray-400 mt-1">{r.detail}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        <Section title="받은 신고" count={selectedUser.reports_received.length}>
          {selectedUser.reports_received.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.reports_received.map(r => (
                <div key={r.id} className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>신고자: <strong>{r.reporter}</strong></span>
                    <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="text-red-400">사유: {r.reason}</div>
                  {r.detail && <p className="text-gray-400 mt-1">{r.detail}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>

        {/* 차단 */}
        <Section title="차단 목록" count={selectedUser.blocks.length}>
          {selectedUser.blocks.length > 0 ? (
            <div className="space-y-2">
              {selectedUser.blocks.map(b => (
                <div key={b.id} className="bg-gray-700/50 rounded-lg p-3 text-sm flex justify-between">
                  <span>{b.blocked_user} ({b.blocked_student_id})</span>
                  <span className="text-xs text-gray-400">{formatDate(b.created_at)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">없음</p>}
        </Section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {/* 푸시 알림 모달 */}
      {showPushModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">푸시 알림 전송</h3>
                <p className="text-sm text-gray-400">
                  {pushTarget === 'all' ? '전체 사용자' : pushTargetUser?.name}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">제목</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="알림 제목"
                  className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">내용</label>
                <textarea
                  value={pushContent}
                  onChange={(e) => setPushContent(e.target.value)}
                  placeholder="알림 내용"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-primary focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPushModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSendPush}
                disabled={isSendingPush || !pushTitle.trim() || !pushContent.trim()}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSendingPush ? (
                  '전송 중...'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    전송
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배너 모달 */}
      {showBannerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Image className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-lg">
                  {bannerType === 'main' ? '메인 배너 설정' : '팝업 설정'}
                </h3>
              </div>
              <button
                onClick={() => setShowBannerModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 이미지 업로드 */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">이미지</label>
                {bannerImageData ? (
                  <div className="relative">
                    <img
                      src={bannerImageData}
                      alt="배너 미리보기"
                      className="w-full rounded-xl object-contain max-h-60"
                    />
                    <button
                      onClick={() => setBannerImageData(null)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-primary transition-colors">
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-sm text-gray-500">클릭하여 이미지 업로드</span>
                    <span className="text-xs text-gray-600 mt-1">최대 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 팝업 제목 (팝업일 때만) */}
              {bannerType === 'popup' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">팝업 제목</label>
                  <input
                    type="text"
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                    placeholder="팝업 제목 (선택)"
                    className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* 링크 URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">링크 URL (선택)</label>
                <input
                  type="url"
                  value={bannerLinkUrl}
                  onChange={(e) => setBannerLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-primary focus:outline-none"
                />
              </div>

              {/* 활성화 토글 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">활성화</span>
                <button
                  onClick={() => setBannerIsActive(!bannerIsActive)}
                  className={`w-12 h-6 rounded-full transition-colors ${bannerIsActive ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${bannerIsActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBannerModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveBanner}
                disabled={isSavingBanner || !bannerImageData}
                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingBanner ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openPushModal('all')}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm text-white transition-colors"
          >
            <Bell className="w-4 h-4" />
            전체 푸시
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* 배너/팝업 관리 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* 메인 배너 */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Image className="w-4 h-4" />
              메인 배너
            </h3>
            <div className="flex items-center gap-2">
              {currentMainBanner?.is_active && (
                <button
                  onClick={() => handleDeleteBanner('main')}
                  className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => openBannerModal('main')}
                className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
              >
                {currentMainBanner?.is_active ? '수정' : '설정'}
              </button>
            </div>
          </div>
          {currentMainBanner?.is_active && currentMainBanner?.image_url ? (
            <img src={currentMainBanner.image_url} alt="메인 배너" className="w-full rounded-lg object-contain max-h-32" />
          ) : (
            <div className="h-24 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-500 text-sm">
              배너 없음
            </div>
          )}
        </div>

        {/* 팝업 */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Image className="w-4 h-4" />
              팝업
            </h3>
            <div className="flex items-center gap-2">
              {currentPopup?.is_active && (
                <button
                  onClick={() => handleDeleteBanner('popup')}
                  className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => openBannerModal('popup')}
                className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
              >
                {currentPopup?.is_active ? '수정' : '설정'}
              </button>
            </div>
          </div>
          {currentPopup?.is_active && currentPopup?.image_url ? (
            <div>
              {currentPopup.title && <p className="text-sm text-gray-400 mb-2">{currentPopup.title}</p>}
              <img src={currentPopup.image_url} alt="팝업" className="w-full rounded-lg object-contain max-h-32" />
            </div>
          ) : (
            <div className="h-24 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-500 text-sm">
              팝업 없음
            </div>
          )}
        </div>
      </div>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="총 유저" value={stats.total_users} color="blue" />
          <StatCard icon={Calendar} label="시간표" value={stats.total_schedules} color="green" />
          <StatCard icon={MessageCircle} label="채팅 메시지" value={stats.total_chat_messages} color="purple" />
          <StatCard icon={MessageCircle} label="랜덤 채팅" value={stats.total_random_messages} color="pink" />
          <StatCard icon={UserPlus} label="친구 관계" value={stats.total_friends} color="cyan" />
          <StatCard icon={Building2} label="동아리" value={stats.total_clubs} color="orange" />
          <StatCard icon={Heart} label="과팅" value={stats.total_meetings} color="red" />
          <StatCard icon={AlertTriangle} label="신고" value={stats.total_reports} color="yellow" />
        </div>
      )}

      {/* 검색 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 학번, 학과로 검색..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 선택 삭제 바 */}
      {selectedUserIds.length > 0 && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 flex items-center justify-between">
          <span className="text-red-400 text-sm font-medium">
            {selectedUserIds.length}명 선택됨
          </span>
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? '삭제 중...' : '선택 회원 삭제'}
          </button>
        </div>
      )}

      {/* 유저 목록 */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-sm">
                <th className="py-4 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                </th>
                <th className="text-left py-4 px-4">ID</th>
                <th className="text-left py-4 px-4">학번</th>
                <th className="text-left py-4 px-4">이름</th>
                <th className="text-left py-4 px-4">학과</th>
                <th className="text-left py-4 px-4">가입일</th>
                <th className="text-center py-4 px-4">시간표</th>
                <th className="text-center py-4 px-4">채팅</th>
                <th className="text-center py-4 px-4">친구</th>
                <th className="text-center py-4 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${selectedUserIds.includes(user.id) ? 'bg-red-900/10' : ''}`}>
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 text-gray-400">{user.id}</td>
                  <td className="py-3 px-4">{user.student_id}</td>
                  <td className="py-3 px-4 font-medium">{user.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{user.department}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{formatDate(user.created_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">{user.schedule_count}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">{user.chat_count}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">{user.friend_count}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDotoriModal(user)}
                        className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                        title="도토리 지급"
                      >
                        <Nut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openPushModal('single', user)}
                        className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                        title="푸시 알림"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => loadUserDetail(user.id)}
                        className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-sm"
                      >
                        상세 <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            {searchQuery ? '검색 결과가 없습니다.' : '유저가 없습니다.'}
          </div>
        )}
      </div>

      {/* 도토리 지급 모달 */}
      {showDotoriModal && dotoriTargetUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Nut className="w-5 h-5 text-amber-400" />
                도토리 지급
              </h3>
              <button onClick={() => setShowDotoriModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              <span className="font-semibold text-white">{dotoriTargetUser.name}</span>
              <span className="text-gray-400 ml-1">({dotoriTargetUser.student_id})</span>
              님에게 도토리를 지급합니다.
            </p>

            <div className="flex flex-col gap-3 mb-4">
              <input
                type="tel"
                inputMode="numeric"
                placeholder="지급할 개수"
                value={dotoriAmount}
                onChange={(e) => setDotoriAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-amber-500 focus:outline-none"
                style={{ fontSize: '16px' }}
              />
              <input
                type="text"
                placeholder="사유 (선택)"
                value={dotoriReason}
                onChange={(e) => setDotoriReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-amber-500 focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDotoriModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                disabled={isGrantingDotori}
              >
                취소
              </button>
              <button
                onClick={handleGrantDotori}
                disabled={isGrantingDotori || !dotoriAmount}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {isGrantingDotori ? '지급 중...' : '지급하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Users
  label: string
  value: number
  color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

function Section({ title, count, children }: {
  title: string
  count: number
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(count > 0)

  return (
    <div className="bg-gray-800 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">{count}</span>
        </div>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  )
}
