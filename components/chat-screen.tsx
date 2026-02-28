'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Users, ArrowLeft, Globe, BookOpen, Shuffle, X, Loader2, Ban, Flag, AlertTriangle, Settings, Trash2 } from 'lucide-react'
import { AppShell } from './app-shell'
import { chatAPI, randomChatAPI, blockAPI } from '@/lib/api'

interface ChatRoom {
  id: number
  name: string
  description?: string
  room_type: string
  participants: number
  last_message?: string
  last_time?: string
}

interface ChatMessage {
  id: number
  user_id?: number
  sender: string
  message: string
  created_at: string
  is_mine: boolean
}

interface UserAction {
  userId: number
  userName: string
  messageId?: number
  roomType: 'chat' | 'random'
}

const REPORT_REASONS = [
  { value: 'spam', label: '스팸/광고' },
  { value: 'abuse', label: '욕설/비방' },
  { value: 'harassment', label: '성희롱/괴롭힘' },
  { value: 'inappropriate', label: '부적절한 내용' },
  { value: 'other', label: '기타' },
]

interface ChatScreenProps {
  onBack: () => void
}

type ChatMode = 'list' | 'room' | 'random-waiting' | 'random-chat'

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // 랜덤 채팅 상태
  const [chatMode, setChatMode] = useState<ChatMode>('list')
  const [randomMessages, setRandomMessages] = useState<ChatMessage[]>([])
  const [partnerLeft, setPartnerLeft] = useState(false)
  const [randomRoomId, setRandomRoomId] = useState<number | null>(null)
  const randomWsRef = useRef<WebSocket | null>(null)

  // 차단/신고 모달 상태
  const [actionModal, setActionModal] = useState<UserAction | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetail, setReportDetail] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>([])

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

  const handleUserClick = (userId: number, userName: string, messageId?: number, roomType: 'chat' | 'random' = 'chat') => {
    if (userName === '나') return
    setActionModal({ userId, userName, messageId, roomType })
  }

  const handleBlock = async () => {
    if (!actionModal || isProcessing) return
    setIsProcessing(true)
    try {
      await blockAPI.blockUser(actionModal.userId)
      setBlockedUserIds(prev => [...prev, actionModal.userId])
      // 차단된 사용자의 메시지 필터링
      if (actionModal.roomType === 'chat') {
        setMessages(prev => prev.filter(m => m.user_id !== actionModal.userId))
      } else {
        setRandomMessages(prev => prev.filter(m => m.user_id !== actionModal.userId))
      }
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
        room_type: actionModal.roomType,
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

  // 차단 관리 모달
  const [showBlockListModal, setShowBlockListModal] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<{id: number, blocked_user_id: number, anon_name: string, created_at: string}[]>([])
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false)

  const handleOpenBlockList = async () => {
    setShowBlockListModal(true)
    setIsLoadingBlocks(true)
    try {
      const data = await blockAPI.getBlockedUsers()
      setBlockedUsers(data)
    } catch (error) {
      console.error('차단 목록 로딩 실패:', error)
    } finally {
      setIsLoadingBlocks(false)
    }
  }

  const handleUnblock = async (blockedUserId: number) => {
    try {
      await blockAPI.unblockUser(blockedUserId)
      setBlockedUsers(prev => prev.filter(u => u.blocked_user_id !== blockedUserId))
      setBlockedUserIds(prev => prev.filter(id => id !== blockedUserId))
      alert('차단이 해제되었습니다.')
    } catch (error: any) {
      alert(error.message || '차단 해제에 실패했습니다.')
    }
  }

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await chatAPI.getRooms()
        setRooms(data)
      } catch (error) {
        console.error('채팅방 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRooms()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, randomMessages])

  // WebSocket 연결 해제
  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const disconnectRandomWs = useCallback(() => {
    if (randomWsRef.current) {
      randomWsRef.current.close()
      randomWsRef.current = null
    }
  }, [])

  // 컴포넌트 언마운트 시 연결 해제
  useEffect(() => {
    return () => {
      disconnectWs()
      disconnectRandomWs()
    }
  }, [disconnectWs, disconnectRandomWs])

  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room)
    setChatMode('room')

    // 기존 메시지 로드
    try {
      await chatAPI.joinRoom(room.id)
      const data = await chatAPI.getMessages(room.id)
      setMessages(data)
    } catch (error) {
      console.error('메시지 로딩 실패:', error)
    }

    // WebSocket 연결
    const token = localStorage.getItem('access_token')
    if (!token) return

    const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/${room.id}?token=${token}`)

    ws.onopen = () => {
      console.log('WebSocket 연결됨')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'message') {
        const userId = parseInt(localStorage.getItem('user_id') || '0')
        // 차단된 사용자의 메시지는 무시
        if (blockedUserIds.includes(data.user_id)) return
        setMessages(prev => [...prev, {
          id: data.id,
          user_id: data.user_id,
          sender: data.user_id === userId ? '나' : data.sender,
          message: data.message,
          created_at: data.created_at,
          is_mine: data.user_id === userId
        }])
      } else if (data.type === 'system') {
        setOnlineCount(data.online_count || 0)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket 오류:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket 연결 종료')
    }

    wsRef.current = ws
  }

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return

    if (chatMode === 'room' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        message: newMessage
      }))
      setNewMessage('')
    } else if (chatMode === 'random-chat' && randomWsRef.current && randomWsRef.current.readyState === WebSocket.OPEN) {
      randomWsRef.current.send(JSON.stringify({
        type: 'message',
        message: newMessage
      }))
      setNewMessage('')
    }
  }

  const handleStartRandomChat = async () => {
    setChatMode('random-waiting')
    setRandomMessages([])
    setPartnerLeft(false)

    const token = localStorage.getItem('access_token')
    if (!token) {
      setChatMode('list')
      return
    }

    const ws = new WebSocket(`${WS_BASE_URL}/ws/random?token=${token}`)

    ws.onopen = () => {
      console.log('랜덤 채팅 WebSocket 연결됨')
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'waiting') {
        setChatMode('random-waiting')
      } else if (data.type === 'matched') {
        setChatMode('random-chat')
        setPartnerLeft(false)
        setRandomRoomId(data.room_id)
      } else if (data.type === 'message') {
        setRandomMessages(prev => [...prev, {
          id: data.id,
          user_id: data.user_id,
          sender: data.sender,
          message: data.message,
          created_at: data.created_at,
          is_mine: data.is_mine
        }])
      } else if (data.type === 'partner_left') {
        setPartnerLeft(true)
      }
    }

    ws.onerror = (error) => {
      console.error('랜덤 채팅 WebSocket 오류:', error)
      setChatMode('list')
    }

    ws.onclose = () => {
      console.log('랜덤 채팅 WebSocket 종료')
    }

    randomWsRef.current = ws
  }

  const handleCancelRandomChat = () => {
    if (randomWsRef.current) {
      randomWsRef.current.send(JSON.stringify({ type: 'disconnect' }))
      randomWsRef.current.close()
      randomWsRef.current = null
    }
    setRandomRoomId(null)
    setChatMode('list')
  }

  const handleDisconnectRandomChat = () => {
    if (randomWsRef.current) {
      randomWsRef.current.send(JSON.stringify({ type: 'disconnect' }))
      randomWsRef.current.close()
      randomWsRef.current = null
    }
    setRandomMessages([])
    setRandomRoomId(null)
    setChatMode('list')
  }

  const handleNewRandomChat = () => {
    if (randomWsRef.current) {
      randomWsRef.current.close()
      randomWsRef.current = null
    }
    handleStartRandomChat()
  }

  const handleBackToList = () => {
    disconnectWs()
    setSelectedRoom(null)
    setChatMode('list')
    setMessages([])
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const globalRooms = rooms.filter(r => r.room_type === 'global')
  const subjectRooms = rooms.filter(r => r.room_type === 'subject')

  // 랜덤 채팅 대기 화면
  if (chatMode === 'random-waiting') {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        <div className="bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleCancelRandomChat}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">랜덤 채팅</p>
            <p className="text-xs text-muted-foreground">상대를 찾는 중...</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <p className="text-lg font-semibold text-foreground">매칭 중...</p>
          <p className="text-sm text-muted-foreground text-center">
            다른 사용자가 입장하면<br />자동으로 연결됩니다
          </p>
          <button
            onClick={handleCancelRandomChat}
            className="mt-4 px-6 py-2 rounded-full bg-secondary text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  // 랜덤 채팅 화면
  if (chatMode === 'random-chat') {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        {/* 헤더 - 상단 고정 */}
        <div className="bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleDisconnectRandomChat}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center">
            <Shuffle className="w-4 h-4 text-pink-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">랜덤 채팅</p>
            <p className="text-xs text-muted-foreground">
              {partnerLeft ? '상대방이 나갔습니다' : '익명의 상대와 대화 중'}
            </p>
          </div>
          <button
            onClick={handleOpenBlockList}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
            title="차단 관리"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleDisconnectRandomChat}
            className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
          >
            나가기
          </button>
        </div>

        {/* 메시지 영역 - 스크롤 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            {randomMessages.length === 0 && !partnerLeft ? (
              <div className="h-full flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">첫 메시지를 보내보세요!</p>
              </div>
            ) : (
              randomMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${msg.is_mine ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  {!msg.is_mine && (
                    <button
                      onClick={() => msg.user_id && handleUserClick(msg.user_id, msg.sender, msg.id, 'random')}
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

            {partnerLeft && (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-muted-foreground">상대방이 채팅을 종료했습니다</p>
                <button
                  onClick={handleNewRandomChat}
                  className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  새로운 상대 찾기
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 입력창 - 하단 고정 */}
        {!partnerLeft && (
          <div className="bg-card/80 backdrop-blur-lg border-t border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="메시지를 입력하세요..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 h-10 px-4 rounded-full bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || isSending}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
              >
                <Send className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </div>
        )}

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

        {/* 차단 관리 모달 */}
        {showBlockListModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBlockListModal(false)}>
            <div
              className="bg-card rounded-2xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">차단 관리</h3>
                  <p className="text-xs text-muted-foreground">차단한 사용자 목록</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoadingBlocks ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">차단한 사용자가 없습니다</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {blockedUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.anon_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString('ko-KR')} 차단
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnblock(user.blocked_user_id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
                        >
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowBlockListModal(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-secondary text-foreground font-medium hover:bg-muted transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 일반 채팅방 화면
  if (chatMode === 'room' && selectedRoom) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col animate-in slide-in-from-right-4 duration-300">
        {/* 헤더 - 상단 고정 */}
        <div className="bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{
            backgroundColor: selectedRoom.room_type === 'global' ? '#10B98120' : '#3B82F620'
          }}>
            {selectedRoom.room_type === 'global' ? (
              <Globe className="w-4 h-4 text-emerald-500" />
            ) : (
              <BookOpen className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{selectedRoom.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedRoom.room_type === 'global' ? '전체 참여 가능' : selectedRoom.description}
              {onlineCount > 0 && ` · 접속 ${onlineCount}명`}
            </p>
          </div>
          <button
            onClick={handleOpenBlockList}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
            title="차단 관리"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 메시지 영역 - 스크롤 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center py-20">
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
                      onClick={() => msg.user_id && handleUserClick(msg.user_id, msg.sender, msg.id, 'chat')}
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
        </div>

        {/* 입력창 - 하단 고정 */}
        <div className="bg-card/80 backdrop-blur-lg border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="익명으로 메시지 보내기..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 h-10 px-4 rounded-full bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || isSending}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>

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

        {/* 차단 관리 모달 */}
        {showBlockListModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBlockListModal(false)}>
            <div
              className="bg-card rounded-2xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">차단 관리</h3>
                  <p className="text-xs text-muted-foreground">차단한 사용자 목록</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoadingBlocks ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">차단한 사용자가 없습니다</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {blockedUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.anon_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString('ko-KR')} 차단
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnblock(user.blocked_user_id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
                        >
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowBlockListModal(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-secondary text-foreground font-medium hover:bg-muted transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 로딩 화면
  if (isLoading) {
    return (
      <AppShell title="익명 채팅" onBack={onBack}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  // 채팅방 목록 화면
  return (
    <AppShell title="익명 채팅" onBack={onBack}>
      <div className="p-4 flex flex-col gap-4">
        {/* 랜덤 채팅 */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground px-1">랜덤 채팅</h3>
          <button
            onClick={handleStartRandomChat}
            className="w-full text-left p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-2xl border border-pink-500/20 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                <Shuffle className="w-5 h-5 text-pink-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">랜덤 채팅</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  익명의 상대와 1:1 대화
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-600 text-xs font-medium">
                시작하기
              </div>
            </div>
          </button>
        </div>

        {/* 전체 채팅 */}
        {globalRooms.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-1">전체 채팅</h3>
            {globalRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className="w-full text-left p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-500/20 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{room.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {room.last_message || '누구나 참여할 수 있는 채팅방'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <span className="text-[10px] text-muted-foreground">{room.last_time || ''}</span>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-medium">{room.participants}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 과목별 채팅 */}
        {subjectRooms.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-1">내 수업 채팅</h3>
            {subjectRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className="w-full text-left p-4 bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{room.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {room.description || '같은 수업을 듣는 학생들과 채팅'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <span className="text-[10px] text-muted-foreground">{room.last_time || ''}</span>
                    <div className="flex items-center gap-1 text-blue-600">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-medium">{room.participants}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {rooms.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">채팅방이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">시간표를 먼저 등록해주세요</p>
          </div>
        )}
      </div>

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
    </AppShell>
  )
}
