'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock, Users, ArrowLeft, Send, Check, RefreshCw, Info, Ban, Flag, AlertTriangle, CheckCircle2, Plus, MapPin, LogOut, X } from 'lucide-react'
import { AppShell } from './app-shell'
import { commuteAPI, quickRoomAPI, blockAPI } from '@/lib/api'

interface Schedule {
  day: string
  commute_type: string
  time: string
}

interface GroupMember {
  user_id: number
  name: string
  department: string
  is_confirmed: number
}

interface CommuteGroup {
  id: number
  match_date: string
  day: string
  commute_type: string
  location?: string
  time_slot: string
  members: GroupMember[]
  member_count: number
}

interface ChatMessage {
  id: number
  user_id?: number
  sender: string
  message: string
  is_mine: boolean
  is_system?: number
  created_at: string
}

interface QuickRoom {
  id: number
  creator_id: number
  title: string
  departure: string
  destination: string
  depart_time: string
  max_members: number
  is_active: number
  current_members: number
  members: { user_id: number; name: string; department: string; is_confirmed: number }[]
  is_joined: boolean
  created_at: string
}

interface UserAction {
  userId: number
  userName: string
  messageId?: number
}

const REPORT_REASONS = [
  { value: 'spam', label: '스팸/광고' },
  { value: 'abuse', label: '욕설/비방' },
  { value: 'harassment', label: '성희롱/괴롭힘' },
  { value: 'inappropriate', label: '부적절한 내용' },
  { value: 'other', label: '기타' },
]

interface CommuteScreenProps {
  onBack: () => void
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const TIMES = [
  '06:00', '06:10', '06:20', '06:30', '06:40', '06:50',
  '07:00', '07:10', '07:20', '07:30', '07:40', '07:50',
  '08:00', '08:10', '08:20', '08:30', '08:40', '08:50',
  '09:00', '09:10', '09:20', '09:30', '09:40', '09:50',
  '10:00', '10:10', '10:20', '10:30', '10:40', '10:50',
  '11:00', '11:10', '11:20', '11:30', '11:40', '11:50',
  '12:00', '12:10', '12:20', '12:30', '12:40', '12:50',
  '13:00', '13:10', '13:20', '13:30', '13:40', '13:50',
  '14:00', '14:10', '14:20', '14:30', '14:40', '14:50',
  '15:00', '15:10', '15:20', '15:30', '15:40', '15:50',
  '16:00', '16:10', '16:20', '16:30', '16:40', '16:50',
  '17:00', '17:10', '17:20', '17:30', '17:40', '17:50',
  '18:00', '18:10', '18:20', '18:30', '18:40', '18:50',
  '19:00', '19:10', '19:20', '19:30', '19:40', '19:50',
  '20:00', '20:10', '20:20', '20:30', '20:40', '20:50',
  '21:00', '21:10', '21:20', '21:30', '21:40', '21:50',
  '22:00'
]
const LOCATIONS = ['탕정역', '아산역', '온양온천역', '천안역', '천안터미널', '트라팰리스']

type TabType = 'schedule' | 'groups' | 'quick'
type ViewType = 'list' | 'chat'

export function CommuteScreen({ onBack }: CommuteScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('schedule')
  const [viewType, setViewType] = useState<ViewType>('list')

  // 스케줄 설정
  const [schedules, setSchedules] = useState<Record<string, { 등교: string, 하교: string, 등교장소: string, 하교장소: string }>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // 매칭 그룹
  const [groups, setGroups] = useState<CommuteGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<CommuteGroup | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 채팅
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 차단/신고 모달 상태
  const [actionModal, setActionModal] = useState<UserAction | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetail, setReportDetail] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>([])

  // 출석 확인 상태
  const [isConfirming, setIsConfirming] = useState(false)

  // 급하게 매칭 상태
  const [quickRooms, setQuickRooms] = useState<QuickRoom[]>([])
  const [selectedQuickRoom, setSelectedQuickRoom] = useState<QuickRoom | null>(null)
  const [quickMessages, setQuickMessages] = useState<ChatMessage[]>([])
  const [quickNewMessage, setQuickNewMessage] = useState('')
  const [isQuickLoading, setIsQuickLoading] = useState(false)
  const [isQuickSending, setIsQuickSending] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', departure: '', destination: '', depart_time: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [isQuickConfirming, setIsQuickConfirming] = useState(false)
  const quickViewType = selectedQuickRoom ? 'chat' : 'list'
  const quickMessagesEndRef = useRef<HTMLDivElement>(null)

  // 차단 목록 로드
  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        const data = await blockAPI.getBlockedIds()
        setBlockedUserIds(data.blocked_ids || [])
      } catch (error) {
        console.error('차단 목록 로딩 실패:', error)
      }
    }
    loadBlockedUsers()
  }, [])

  const handleUserClick = (userId: number, userName: string, messageId?: number) => {
    setActionModal({ userId, userName, messageId })
  }

  const handleBlock = async () => {
    if (!actionModal || isProcessing) return
    setIsProcessing(true)
    try {
      await blockAPI.blockUser(actionModal.userId)
      setBlockedUserIds(prev => [...prev, actionModal.userId])
      setMessages(prev => prev.filter(m => m.user_id !== actionModal.userId))
      setQuickMessages(prev => prev.filter(m => m.user_id !== actionModal.userId))
      alert('차단되었습니다.')
      setActionModal(null)
    } catch (error: any) {
      alert(error.message || '차단에 실패했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenReport = () => {
    setShowReportModal(true)
  }

  const handleReport = async () => {
    if (!actionModal || !reportReason || isProcessing) return
    setIsProcessing(true)
    try {
      await blockAPI.reportUser({
        reported_user_id: actionModal.userId,
        reason: reportReason,
        detail: reportDetail || undefined,
        message_id: actionModal.messageId,
        room_type: 'commute',
      })
      alert('신고가 접수되었습니다.')
      setShowReportModal(false)
      setReportReason('')
      setReportDetail('')
      setActionModal(null)
    } catch (error: any) {
      alert(error.message || '신고에 실패했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  const closeModals = () => {
    setActionModal(null)
    setShowReportModal(false)
    setReportReason('')
    setReportDetail('')
  }

  // 스케줄 초기화
  useEffect(() => {
    const initSchedules: Record<string, { 등교: string, 하교: string, 등교장소: string, 하교장소: string }> = {}
    DAYS.forEach(day => {
      initSchedules[day] = { 등교: '', 하교: '', 등교장소: '', 하교장소: '' }
    })
    setSchedules(initSchedules)

    // 기존 스케줄 로드
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    try {
      const data = await commuteAPI.getSchedules()
      const loaded: Record<string, { 등교: string, 하교: string, 등교장소: string, 하교장소: string }> = {}
      DAYS.forEach(day => {
        loaded[day] = { 등교: '', 하교: '', 등교장소: '', 하교장소: '' }
      })
      data.forEach((s: any) => {
        if (loaded[s.day]) {
          if (s.commute_type === '등교') {
            loaded[s.day].등교 = s.time
            loaded[s.day].등교장소 = s.location || ''
          } else {
            loaded[s.day].하교 = s.time
            loaded[s.day].하교장소 = s.location || ''
          }
        }
      })
      setSchedules(loaded)
    } catch (error) {
      console.error('스케줄 로드 실패:', error)
    }
  }

  const loadGroups = async () => {
    setIsLoading(true)
    try {
      const data = await commuteAPI.getTodayGroups()
      setGroups(data)
    } catch (error) {
      console.error('그룹 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'groups') {
      loadGroups()
    }
    if (activeTab === 'quick') {
      loadQuickRooms()
    }
  }, [activeTab])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    quickMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [quickMessages])

  // 채팅 메시지 폴링 (기존 매칭)
  useEffect(() => {
    if (viewType !== 'chat' || !selectedGroup) return

    const pollMessages = async () => {
      try {
        const data = await commuteAPI.getGroupMessages(selectedGroup.id)
        // 차단된 사용자 메시지 필터링
        const filtered = data.filter((m: ChatMessage) => !m.user_id || !blockedUserIds.includes(m.user_id))
        setMessages(filtered)
      } catch (error) {
        console.error('메시지 폴링 실패:', error)
      }
    }

    pollMessages()
    const interval = setInterval(pollMessages, 3000)
    return () => clearInterval(interval)
  }, [viewType, selectedGroup])

  // 급하게 매칭 채팅 폴링
  useEffect(() => {
    if (!selectedQuickRoom) return

    const pollMessages = async () => {
      try {
        const data = await quickRoomAPI.getMessages(selectedQuickRoom.id)
        const filtered = data.filter((m: ChatMessage) => !m.user_id || !blockedUserIds.includes(m.user_id))
        setQuickMessages(filtered)
      } catch (error) {
        console.error('메시지 폴링 실패:', error)
      }
    }

    pollMessages()
    const interval = setInterval(pollMessages, 3000)
    return () => clearInterval(interval)
  }, [selectedQuickRoom])

  // 급하게 매칭 방 목록 자동 새로고침 (5초)
  useEffect(() => {
    if (activeTab !== 'quick' || selectedQuickRoom) return

    const interval = setInterval(loadQuickRooms, 5000)
    return () => clearInterval(interval)
  }, [activeTab, selectedQuickRoom])

  const handleTimeChange = (day: string, field: string, value: string) => {
    setSchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
  }

  const handleSaveSchedules = async () => {
    setIsSaving(true)
    setSaveMessage('')
    try {
      const scheduleList: Array<{ day: string, commute_type: string, time: string, location?: string }> = []
      Object.entries(schedules).forEach(([day, data]) => {
        if (data.등교 && data.등교장소) {
          scheduleList.push({ day, commute_type: '등교', time: data.등교, location: data.등교장소 })
        }
        if (data.하교 && data.하교장소) {
          scheduleList.push({ day, commute_type: '하교', time: data.하교, location: data.하교장소 })
        }
      })
      await commuteAPI.saveSchedules(scheduleList)
      setSaveMessage('저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 2000)
    } catch (error) {
      console.error('저장 실패:', error)
      setSaveMessage('저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectGroup = async (group: CommuteGroup) => {
    setSelectedGroup(group)
    setViewType('chat')
    try {
      const data = await commuteAPI.getGroupMessages(group.id)
      setMessages(data)
    } catch (error) {
      console.error('메시지 로드 실패:', error)
    }
  }

  // 현재 사용자 ID 가져오기
  const getCurrentUserId = () => {
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('user_id')
      return userId ? parseInt(userId) : null
    }
    return null
  }

  // 현재 사용자의 확인 상태
  const getMyConfirmStatus = () => {
    if (!selectedGroup) return false
    const userId = getCurrentUserId()
    if (!userId) return false
    const member = selectedGroup.members.find(m => m.user_id === userId)
    return member?.is_confirmed === 1
  }

  // 출석 확인 토글
  const handleToggleConfirm = async () => {
    if (!selectedGroup || isConfirming) return
    setIsConfirming(true)
    try {
      const isConfirmed = getMyConfirmStatus()
      if (isConfirmed) {
        await commuteAPI.cancelAttendance(selectedGroup.id)
      } else {
        await commuteAPI.confirmAttendance(selectedGroup.id)
      }
      // 그룹 정보 새로고침
      const updatedGroup = await commuteAPI.getGroup(selectedGroup.id)
      setSelectedGroup(updatedGroup)
      // groups 리스트도 업데이트
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g))
    } catch (error) {
      console.error('출석 확인 실패:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup || isSending) return

    setIsSending(true)
    try {
      const sent = await commuteAPI.sendGroupMessage(selectedGroup.id, newMessage)
      setMessages([...messages, sent])
      setNewMessage('')
    } catch (error) {
      console.error('메시지 전송 실패:', error)
    } finally {
      setIsSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  // === 급하게 매칭 관련 ===
  const loadQuickRooms = async () => {
    setIsQuickLoading(true)
    try {
      const data = await quickRoomAPI.getRooms()
      setQuickRooms(data)
    } catch (error) {
      console.error('급하게 매칭 방 로드 실패:', error)
    } finally {
      setIsQuickLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!createForm.title.trim() || !createForm.departure.trim() || !createForm.destination.trim() || !createForm.depart_time) {
      alert('모든 항목을 입력해주세요')
      return
    }
    setIsCreating(true)
    try {
      const room = await quickRoomAPI.createRoom(createForm)
      setQuickRooms(prev => [room, ...prev])
      setShowCreateRoom(false)
      setCreateForm({ title: '', departure: '', destination: '', depart_time: '' })
      // 바로 채팅방으로 이동
      setSelectedQuickRoom(room)
    } catch (error: any) {
      alert(error.message || '방 생성에 실패했습니다')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinQuickRoom = async (room: QuickRoom) => {
    if (room.is_joined) {
      // 이미 참여 중이면 바로 채팅으로
      setSelectedQuickRoom(room)
      return
    }
    if (room.current_members >= room.max_members) {
      alert('방이 가득 찼습니다')
      return
    }
    try {
      await quickRoomAPI.joinRoom(room.id)
      const updated = await quickRoomAPI.getRoom(room.id)
      setQuickRooms(prev => prev.map(r => r.id === updated.id ? updated : r))
      setSelectedQuickRoom(updated)
    } catch (error: any) {
      alert(error.message || '참여에 실패했습니다')
    }
  }

  const handleLeaveQuickRoom = async () => {
    if (!selectedQuickRoom) return
    if (!confirm('정말 이 방을 나가시겠습니까?')) return
    try {
      await quickRoomAPI.leaveRoom(selectedQuickRoom.id)
      setSelectedQuickRoom(null)
      setQuickMessages([])
      loadQuickRooms()
    } catch (error: any) {
      alert(error.message || '나가기에 실패했습니다')
    }
  }

  const handleSendQuickMessage = async () => {
    if (!quickNewMessage.trim() || !selectedQuickRoom || isQuickSending) return
    setIsQuickSending(true)
    try {
      const sent = await quickRoomAPI.sendMessage(selectedQuickRoom.id, quickNewMessage)
      setQuickMessages(prev => [...prev, sent])
      setQuickNewMessage('')
    } catch (error) {
      console.error('메시지 전송 실패:', error)
    } finally {
      setIsQuickSending(false)
    }
  }

  // 급하게 매칭 - 꼭 갈거에요 확인 상태
  const getMyQuickConfirmStatus = () => {
    if (!selectedQuickRoom) return false
    const userId = getCurrentUserId()
    if (!userId) return false
    const member = selectedQuickRoom.members.find(m => m.user_id === userId)
    return member?.is_confirmed === 1
  }

  const handleToggleQuickConfirm = async () => {
    if (!selectedQuickRoom || isQuickConfirming) return
    setIsQuickConfirming(true)
    try {
      const isConfirmed = getMyQuickConfirmStatus()
      if (isConfirmed) {
        await quickRoomAPI.cancelAttendance(selectedQuickRoom.id)
      } else {
        await quickRoomAPI.confirmAttendance(selectedQuickRoom.id)
      }
      const updated = await quickRoomAPI.getRoom(selectedQuickRoom.id)
      setSelectedQuickRoom(updated)
      setQuickRooms(prev => prev.map(r => r.id === updated.id ? updated : r))
    } catch (error) {
      console.error('출석 확인 실패:', error)
    } finally {
      setIsQuickConfirming(false)
    }
  }

  // 차단/신고 모달 렌더링
  const renderModals = () => (
    <>
      {/* 차단/신고 선택 모달 */}
      {actionModal && !showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={closeModals}>
          <div
            className="bg-card rounded-t-2xl w-full max-w-lg p-4 pb-8 animate-in slide-in-from-bottom duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            <p className="text-center text-sm text-muted-foreground mb-4">{actionModal.userName}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleBlock}
                disabled={isProcessing}
                className="flex items-center gap-3 w-full p-4 rounded-xl bg-secondary hover:bg-muted transition-colors"
              >
                <Ban className="w-5 h-5 text-orange-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">차단하기</p>
                  <p className="text-xs text-muted-foreground">이 사용자의 메시지를 더 이상 보지 않습니다</p>
                </div>
              </button>
              <button
                onClick={handleOpenReport}
                disabled={isProcessing}
                className="flex items-center gap-3 w-full p-4 rounded-xl bg-secondary hover:bg-muted transition-colors"
              >
                <Flag className="w-5 h-5 text-red-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">신고하기</p>
                  <p className="text-xs text-muted-foreground">부적절한 행위를 신고합니다</p>
                </div>
              </button>
            </div>
            <button
              onClick={closeModals}
              className="w-full mt-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      {showReportModal && actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModals}>
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">신고하기</h3>
                <p className="text-xs text-muted-foreground">{actionModal.userName}</p>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">신고 사유</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason.value}
                    onClick={() => setReportReason(reason.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      reportReason === reason.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-muted'
                    }`}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">상세 내용 (선택)</p>
              <textarea
                value={reportDetail}
                onChange={e => setReportDetail(e.target.value)}
                placeholder="추가적인 내용을 입력해주세요"
                className="w-full h-20 px-3 py-2 rounded-xl bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground font-medium hover:bg-muted transition-colors"
              >
                뒤로
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason || isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isProcessing ? '처리중...' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // 급하게 매칭 채팅 화면
  if (selectedQuickRoom) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        <header className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { setSelectedQuickRoom(null); setQuickMessages([]) }}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {selectedQuickRoom.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedQuickRoom.departure} → {selectedQuickRoom.destination} · {selectedQuickRoom.depart_time} · {selectedQuickRoom.current_members}/{selectedQuickRoom.max_members}명
            </p>
          </div>
          <button
            onClick={handleLeaveQuickRoom}
            className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4 text-red-500" />
          </button>
        </header>

        {/* 멤버 목록 */}
        <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
          <div className="flex flex-wrap gap-2">
            {selectedQuickRoom.members.map((member) => (
              <div
                key={member.user_id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                  member.is_confirmed === 1
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-card border border-border/50'
                }`}
              >
                {member.is_confirmed === 1 && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${member.is_confirmed === 1 ? 'text-green-600' : 'text-foreground'}`}>{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.department}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 출석 확인 버튼 */}
        <div className="px-4 py-3 bg-card border-b border-border/30">
          <button
            onClick={handleToggleQuickConfirm}
            disabled={isQuickConfirming}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
              getMyQuickConfirmStatus()
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isQuickConfirming ? (
              '처리 중...'
            ) : getMyQuickConfirmStatus() ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                확인 완료! (취소하려면 클릭)
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                저는 꼭 갈거에요!
              </>
            )}
          </button>
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {quickMessages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            quickMessages.map((msg) => (
              msg.is_system ? (
                <div key={msg.id} className="flex justify-center">
                  <span className="px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                    {msg.message}
                  </span>
                </div>
              ) : (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${msg.is_mine ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  {!msg.is_mine && (
                    <button
                      onClick={() => msg.user_id && handleUserClick(msg.user_id, msg.sender, msg.id)}
                      className="text-[10px] text-muted-foreground mb-1 ml-1 hover:text-primary hover:underline transition-colors"
                    >
                      {msg.sender}
                    </button>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.is_mine
                        ? 'bg-primary text-primary-foreground rounded-tr-md'
                        : 'bg-card border border-border/50 text-foreground rounded-tl-md'
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 mx-1">{formatTime(msg.created_at)}</span>
                </div>
              )
            ))
          )}
          <div ref={quickMessagesEndRef} />
        </div>

        {/* 입력 */}
        <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="메시지를 입력하세요..."
              value={quickNewMessage}
              onChange={(e) => setQuickNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuickMessage()}
              className="flex-1 h-10 px-4 rounded-full bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button
              onClick={handleSendQuickMessage}
              disabled={!quickNewMessage.trim() || isQuickSending}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>

        {renderModals()}
      </div>
    )
  }

  // 기존 매칭 채팅 화면
  if (viewType === 'chat' && selectedGroup) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        <header className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { setViewType('list'); setSelectedGroup(null) }}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">
              {selectedGroup.commute_type} 메이트
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedGroup.commute_type === '등교'
                ? `${selectedGroup.location} → 선문대`
                : `선문대 → ${selectedGroup.location}`
              } · {selectedGroup.time_slot} · {selectedGroup.member_count}명
            </p>
          </div>
        </header>

        {/* 멤버 목록 */}
        <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
          <div className="flex flex-col gap-2">
            {selectedGroup.members.map((member) => (
              <div
                key={member.user_id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                  member.is_confirmed === 1
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-card border border-border/50'
                }`}
              >
                {member.is_confirmed === 1 && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${member.is_confirmed === 1 ? 'text-green-600' : 'text-foreground'}`}>
                    {member.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{member.department}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 출석 확인 버튼 */}
        <div className="px-4 py-3 bg-card border-b border-border/30">
          <button
            onClick={handleToggleConfirm}
            disabled={isConfirming}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
              getMyConfirmStatus()
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isConfirming ? (
              '처리 중...'
            ) : getMyConfirmStatus() ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                확인 완료! (취소하려면 클릭)
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                저는 꼭 갈거에요!
              </>
            )}
          </button>
        </div>

        {/* 자동 삭제 안내 */}
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">이 채팅방은 다음 날 자정에 자동으로 삭제됩니다.</p>
          </div>
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${msg.is_mine ? 'self-end items-end' : 'self-start items-start'}`}
              >
                {!msg.is_mine && (
                  <button
                    onClick={() => msg.user_id && handleUserClick(msg.user_id, msg.sender, msg.id)}
                    className="text-[10px] text-muted-foreground mb-1 ml-1 hover:text-primary hover:underline transition-colors"
                  >
                    {msg.sender}
                  </button>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.is_mine
                      ? 'bg-primary text-primary-foreground rounded-tr-md'
                      : 'bg-card border border-border/50 text-foreground rounded-tl-md'
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 mx-1">{formatTime(msg.created_at)}</span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 - 하단 고정 */}
        <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="메시지를 입력하세요..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 h-10 px-4 rounded-full bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>

        {renderModals()}
      </div>
    )
  }

  return (
    <AppShell title="등하교 메이트" onBack={onBack}>
      <div className="flex flex-col">
        {/* 탭 */}
        <div className="flex border-b border-border/50 px-2">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            스케줄 설정
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${
              activeTab === 'groups'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            오늘의 매칭
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${
              activeTab === 'quick'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            급하게 매칭
          </button>
        </div>

        {/* 스케줄 설정 탭 */}
        {activeTab === 'schedule' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">요일별 등하교 시간</h3>
              <p className="text-xs text-muted-foreground mb-4">
                설정한 시간 ±10분 내의 사람들과 자동 매칭됩니다
              </p>

              <div className="flex flex-col gap-4">
                {DAYS.map((day) => (
                  <div key={day} className="p-3 bg-secondary/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 text-sm font-bold text-foreground">{day}</span>
                    </div>

                    {/* 등교 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-orange-600 font-medium w-10">등교</span>
                      <select
                        value={schedules[day]?.등교장소 || ''}
                        onChange={(e) => handleTimeChange(day, '등교장소', e.target.value)}
                        className="flex-1 h-8 px-2 rounded-lg bg-card border border-border/50 text-xs text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">출발지</option>
                        {LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-xs text-foreground font-medium">선문대</span>
                      <select
                        value={schedules[day]?.등교 || ''}
                        onChange={(e) => handleTimeChange(day, '등교', e.target.value)}
                        className="w-20 h-8 px-2 rounded-lg bg-card border border-border/50 text-xs text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">시간</option>
                        {TIMES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* 하교 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-600 font-medium w-10">하교</span>
                      <span className="text-xs text-foreground font-medium">선문대</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <select
                        value={schedules[day]?.하교장소 || ''}
                        onChange={(e) => handleTimeChange(day, '하교장소', e.target.value)}
                        className="flex-1 h-8 px-2 rounded-lg bg-card border border-border/50 text-xs text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">도착지</option>
                        {LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <select
                        value={schedules[day]?.하교 || ''}
                        onChange={(e) => handleTimeChange(day, '하교', e.target.value)}
                        className="w-20 h-8 px-2 rounded-lg bg-card border border-border/50 text-xs text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">시간</option>
                        {TIMES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveSchedules}
                disabled={isSaving}
                className="mt-4 w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  '저장 중...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    저장하기
                  </>
                )}
              </button>

              {saveMessage && (
                <p className={`mt-2 text-center text-sm ${saveMessage.includes('실패') ? 'text-destructive' : 'text-green-600'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 오늘의 매칭 탭 */}
        {activeTab === 'groups' && (
          <div className="p-4 flex flex-col gap-4">
            {/* 자동 매칭 안내 */}
            <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">자동 매칭 시스템</p>
                <p className="text-xs text-muted-foreground mt-1">
                  설정한 등하교 시간 1시간 전에 자동으로 매칭됩니다.
                  같은 시간대(±10분), 같은 출발지/도착지의 메이트와 매칭됩니다.
                </p>
              </div>
            </div>

            {/* 새로고침 버튼 */}
            <button
              onClick={loadGroups}
              disabled={isLoading}
              className="w-full h-10 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </button>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">아직 매칭된 그룹이 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">등하교 시간 1시간 전에 자동 매칭됩니다</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="w-full text-left p-4 bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                        group.commute_type === '등교'
                          ? 'bg-orange-500/20'
                          : 'bg-indigo-500/20'
                      }`}>
                        <Clock className={`w-5 h-5 ${
                          group.commute_type === '등교'
                            ? 'text-orange-500'
                            : 'text-indigo-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            group.commute_type === '등교'
                              ? 'bg-orange-500/20 text-orange-600'
                              : 'bg-indigo-500/20 text-indigo-600'
                          }`}>
                            {group.commute_type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {group.commute_type === '등교'
                              ? `${group.location} → 선문대`
                              : `선문대 → ${group.location}`
                            }
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {group.time_slot}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
                          {group.members.slice(0, 3).map((member) => (
                            <div
                              key={member.user_id}
                              className={`text-xs flex items-center gap-1 ${
                                member.is_confirmed === 1 ? 'text-green-600 font-medium' : 'text-muted-foreground'
                              }`}
                            >
                              {member.is_confirmed === 1 && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                              <span className="font-medium">{member.name}</span>
                              <span className="text-muted-foreground">({member.department})</span>
                            </div>
                          ))}
                          {group.members.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              외 {group.members.length - 3}명
                            </span>
                          )}
                        </div>
                        {/* 확인 현황 */}
                        {group.members.some(m => m.is_confirmed === 1) && (
                          <div className="mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 font-medium">
                              {group.members.filter(m => m.is_confirmed === 1).length}/{group.members.length}명 확인
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-semibold">{group.member_count}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 급하게 매칭 탭 */}
        {activeTab === 'quick' && (
          <div className="p-4 flex flex-col gap-4">
            {/* 안내 */}
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">급하게 매칭</p>
                <p className="text-xs text-muted-foreground mt-1">
                  지금 당장 같이 갈 사람이 필요할 때! 방을 만들거나 참여하세요. (최대 4명)
                </p>
              </div>
            </div>

            {/* 방 만들기 버튼 */}
            <button
              onClick={() => setShowCreateRoom(true)}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              방 만들기
            </button>

            {/* 새로고침 */}
            <button
              onClick={loadQuickRooms}
              disabled={isQuickLoading}
              className="w-full h-10 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isQuickLoading ? 'animate-spin' : ''}`} />
              새로고침
            </button>

            {/* 방 목록 */}
            {isQuickLoading && quickRooms.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : quickRooms.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">아직 만들어진 방이 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">첫 번째 방을 만들어보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {quickRooms.filter(room => !blockedUserIds.includes(room.creator_id)).map((room) => (
                  <button
                    key={room.id}
                    onClick={() => handleJoinQuickRoom(room)}
                    className="w-full text-left p-4 bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{room.title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">{room.departure}</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className="text-xs text-muted-foreground">{room.destination}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-600">
                            {room.depart_time} 출발
                          </span>
                          {room.is_joined && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-600">
                              참여중
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1 text-primary">
                          <Users className="w-4 h-4" />
                          <span className="text-sm font-semibold">{room.current_members}/{room.max_members}</span>
                        </div>
                        {room.current_members >= room.max_members && !room.is_joined && (
                          <span className="text-[10px] text-red-500 font-medium">만석</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 방 만들기 모달 */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateRoom(false)}>
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">방 만들기</h3>
              <button onClick={() => setShowCreateRoom(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">방 제목</p>
                <input
                  type="text"
                  placeholder="예: 탕정역에서 같이 갈 사람!"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">출발지</p>
                <select
                  value={createForm.departure}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, departure: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border/50 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">출발지 선택</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                  <option value="선문대">선문대</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">도착지</p>
                <select
                  value={createForm.destination}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, destination: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border/50 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">도착지 선택</option>
                  <option value="선문대">선문대</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">출발 시간</p>
                <select
                  value={createForm.depart_time}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, depart_time: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border/50 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">시간 선택</option>
                  {TIMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="mt-4 w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? '생성 중...' : '방 만들기'}
            </button>
          </div>
        </div>
      )}

      {renderModals()}
    </AppShell>
  )
}
