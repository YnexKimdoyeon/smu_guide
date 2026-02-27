'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock, Users, ArrowLeft, Send, Check, RefreshCw, Info } from 'lucide-react'
import { AppShell } from './app-shell'
import { commuteAPI } from '@/lib/api'

interface Schedule {
  day: string
  commute_type: string
  time: string
}

interface GroupMember {
  user_id: number
  name: string
  department: string
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
  sender: string
  message: string
  is_mine: boolean
  created_at: string
}

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
const LOCATIONS = ['탕정역', '아산역', '천안역', '천안터미널', '트라팰리스']

type TabType = 'schedule' | 'groups'
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
  }, [activeTab])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 채팅 메시지 폴링
  useEffect(() => {
    if (viewType !== 'chat' || !selectedGroup) return

    const pollMessages = async () => {
      try {
        const data = await commuteAPI.getGroupMessages(selectedGroup.id)
        setMessages(data)
      } catch (error) {
        console.error('메시지 폴링 실패:', error)
      }
    }

    pollMessages()
    const interval = setInterval(pollMessages, 3000)
    return () => clearInterval(interval)
  }, [viewType, selectedGroup])

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

  // 채팅 화면
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
        <div className="px-4 py-2 bg-muted/30 border-b border-border/30">
          <div className="flex flex-wrap gap-2">
            {selectedGroup.members.map((member) => (
              <span
                key={member.user_id}
                className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {member.name}
              </span>
            ))}
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
                  <span className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.sender}</span>
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
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {group.members.slice(0, 3).map((member) => (
                            <span
                              key={member.user_id}
                              className="text-xs text-muted-foreground"
                            >
                              {member.name}
                            </span>
                          ))}
                          {group.members.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              외 {group.members.length - 3}명
                            </span>
                          )}
                        </div>
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
      </div>
    </AppShell>
  )
}
