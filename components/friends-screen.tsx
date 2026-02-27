'use client'

import { useState, useEffect } from 'react'
import { Search, UserPlus, Check, X, Clock, Calendar, User, Send } from 'lucide-react'
import { AppShell } from './app-shell'
import { friendAPI } from '@/lib/api'

interface Friend {
  id: number
  friend_id: number
  friend_name: string
  friend_student_id: string
  friend_department: string
  status: string
}

interface FreeTimeSlot {
  day: string
  start_time: string
  end_time: string
}

interface FriendsScreenProps {
  onBack: () => void
}

export function FriendsScreen({ onBack }: FriendsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<Friend[]>([])
  const [selectedFriends, setSelectedFriends] = useState<number[]>([])
  const [freeTimeResults, setFreeTimeResults] = useState<FreeTimeSlot[]>([])
  const [showFreeTime, setShowFreeTime] = useState(false)
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends')
  const [isLoading, setIsLoading] = useState(true)

  // 친구 신청 관련
  const [studentIdInput, setStudentIdInput] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [friendsData, requestsData] = await Promise.all([
          friendAPI.getFriends(),
          friendAPI.getRequests()
        ])
        setFriends(friendsData)
        setRequests(requestsData)
      } catch (error) {
        console.error('친구 목록 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredFriends = friends.filter(
    (f) =>
      f.friend_name.includes(searchQuery) || f.friend_student_id.includes(searchQuery)
  )

  const toggleFriend = (id: number) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    )
    setShowFreeTime(false)
  }

  const handleAccept = async (id: number) => {
    try {
      await friendAPI.acceptRequest(id)
      const request = requests.find(r => r.id === id)
      if (request) {
        setFriends([...friends, { ...request, status: 'accepted' }])
      }
      setRequests(requests.filter((r) => r.id !== id))
    } catch (error) {
      console.error('친구 수락 실패:', error)
    }
  }

  const handleReject = async (id: number) => {
    try {
      await friendAPI.rejectRequest(id)
      setRequests(requests.filter((r) => r.id !== id))
    } catch (error) {
      console.error('친구 거절 실패:', error)
    }
  }

  const handleCompare = async () => {
    if (selectedFriends.length === 0) return

    try {
      const friendIds = selectedFriends.map(id => {
        const friend = friends.find(f => f.id === id)
        return friend?.friend_id || id
      })
      const results = await friendAPI.compareFreeTime(friendIds)
      setFreeTimeResults(results)
      setShowFreeTime(true)
    } catch (error) {
      console.error('공강 비교 실패:', error)
    }
  }

  const handleSendRequest = async () => {
    if (!studentIdInput.trim()) {
      setRequestError('학번을 입력해주세요')
      return
    }

    setIsSending(true)
    setRequestError('')
    setRequestMessage('')

    try {
      const result = await friendAPI.sendRequestByStudentId(studentIdInput.trim())
      setRequestMessage(`${result.friend_name}님에게 친구 요청을 보냈습니다`)
      setStudentIdInput('')
    } catch (error) {
      setRequestError((error as Error).message)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell title="친구 관리" onBack={onBack}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="친구 관리" onBack={onBack}>
      <div className="flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-border/50 px-2">
          <button
            onClick={() => { setActiveTab('friends'); setShowFreeTime(false) }}
            className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${
              activeTab === 'friends'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            친구 목록
          </button>
          <button
            onClick={() => { setActiveTab('requests'); setShowFreeTime(false) }}
            className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors relative ${
              activeTab === 'requests'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            받은 요청
            {requests.length > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('add'); setShowFreeTime(false) }}
            className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${
              activeTab === 'add'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            친구 신청
          </button>
        </div>

        {/* 친구 신청 탭 */}
        {activeTab === 'add' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">학번으로 친구 신청</h3>
              <p className="text-xs text-muted-foreground">친구의 학번을 입력하여 친구 요청을 보내세요</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="학번 입력 (예: 2025560038)"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                  className="flex-1 h-11 px-4 rounded-xl bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <button
                  onClick={handleSendRequest}
                  disabled={isSending || !studentIdInput.trim()}
                  className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? '전송 중...' : '신청'}
                </button>
              </div>

              {requestMessage && (
                <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{requestMessage}</p>
              )}
              {requestError && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{requestError}</p>
              )}
            </div>
          </div>
        )}

        {/* 친구 목록 탭 */}
        {activeTab === 'friends' && !showFreeTime && (
          <div className="p-4 flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="이름 또는 학번으로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            {/* Selected count + Compare button */}
            {selectedFriends.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                <span className="text-sm text-primary font-medium">
                  {selectedFriends.length}명 선택됨
                </span>
                <button
                  onClick={handleCompare}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all"
                >
                  공강 비교하기
                </button>
              </div>
            )}

            {/* Friend List */}
            <div className="flex flex-col gap-2">
              {filteredFriends.length === 0 ? (
                <div className="text-center py-12">
                  <User className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">친구가 없습니다</p>
                  <p className="text-xs text-muted-foreground mt-1">친구 신청 탭에서 친구를 추가해보세요</p>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedFriends.includes(friend.id)
                  return (
                    <button
                      key={friend.id}
                      onClick={() => toggleFriend(friend.id)}
                      className={`w-full text-left p-3.5 rounded-xl border shadow-sm transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-card border-border/50 hover:shadow-md'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>

                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{friend.friend_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {friend.friend_student_id} | {friend.friend_department}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* 받은 요청 탭 */}
        {activeTab === 'requests' && (
          <div className="p-4 flex flex-col gap-3">
            {requests.length === 0 ? (
              <div className="py-12 text-center">
                <UserPlus className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">대기 중인 친구 요청이 없습니다</p>
              </div>
            ) : (
              requests.map((friend) => (
                <div
                  key={friend.id}
                  className="p-4 bg-card rounded-2xl border border-border/50 shadow-sm flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{friend.friend_name}</p>
                    <p className="text-xs text-muted-foreground">{friend.friend_student_id}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>수락 대기 중</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(friend.id)}
                      className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      aria-label="수락"
                    >
                      <Check className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => handleReject(friend.id)}
                      className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      aria-label="거절"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Free Time Results */}
        {showFreeTime && (
          <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">공통 공강 시간</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedFriends.length + 1}명 공통 공강
                </p>
              </div>
              <button
                onClick={() => setShowFreeTime(false)}
                className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-muted transition-colors"
              >
                목록으로
              </button>
            </div>

            {/* Selected Friends Chips */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                나
              </span>
              {selectedFriends.map((id) => {
                const friend = friends.find((f) => f.id === id)
                return friend ? (
                  <span
                    key={id}
                    className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium"
                  >
                    {friend.friend_name}
                  </span>
                ) : null
              })}
            </div>

            {/* Free Time Cards */}
            <div className="flex flex-col gap-2.5">
              {freeTimeResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">공통 공강 시간이 없습니다</p>
                </div>
              ) : (
                freeTimeResults.map((slot, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-card rounded-2xl border border-border/50 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{slot.day}</p>
                        <p className="text-xs text-primary font-medium mt-0.5">
                          {slot.start_time} ~ {slot.end_time}
                        </p>
                      </div>
                    </div>
                    <button className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm">
                      약속 잡기
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
