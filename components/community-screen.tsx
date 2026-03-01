'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Plus, Users, Heart, Edit2, Trash2, ChevronRight, UserPlus, Check, X, MessageCircle, Send } from 'lucide-react'
import { clubAPI, meetingAPI, chatAPI } from '@/lib/api'

interface CommunityScreenProps {
  onBack: () => void
  userDepartment: string
  userName: string
  userStudentId: string
}

type Tab = 'club' | 'meeting'
type View = 'list' | 'detail' | 'write' | 'edit' | 'apply' | 'applications' | 'chat'

interface ChatMessage {
  id: number
  room_id: number
  user_id: number
  message: string
  created_at: string
  is_mine?: boolean
}

interface Club {
  id: number
  user_id: number
  name: string
  description: string
  qna_questions: string[] | null
  created_at: string
  author_name: string
  application_count: number
  is_mine: boolean
  has_applied?: boolean
}

interface ClubApplication {
  id: number
  club_id: number
  user_id: number
  name: string
  student_id: string
  qna_answers: Record<string, string> | null
  created_at: string
}

interface Meeting {
  id: number
  user_id: number
  department: string
  member_count: number
  description: string | null
  status: string
  chat_room_id: number | null
  created_at: string
  application_count: number
  is_mine: boolean
  has_applied?: boolean
  my_application_id?: number
}

interface MeetingApplication {
  id: number
  meeting_id: number
  user_id: number
  department: string
  member_count: number
  message: string | null
  is_matched: number
  created_at: string
}

export function CommunityScreen({ onBack, userDepartment, userName, userStudentId }: CommunityScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('club')
  const [view, setView] = useState<View>('list')
  const [clubs, setClubs] = useState<Club[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [myMeetings, setMyMeetings] = useState<Meeting[]>([])
  const [showMyMeetings, setShowMyMeetings] = useState(false)
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [clubApplications, setClubApplications] = useState<ClubApplication[]>([])
  const [meetingApplications, setMeetingApplications] = useState<MeetingApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 채팅 상태
  const [chatRoomId, setChatRoomId] = useState<number | null>(null)
  const [chatRoomName, setChatRoomName] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatPollingRef = useRef<NodeJS.Timeout | null>(null)

  // 폼 상태
  const [clubForm, setClubForm] = useState({ name: '', description: '', qna_questions: [''] })
  const [meetingForm, setMeetingForm] = useState({ department: userDepartment, member_count: 2, description: '' })
  const [applyForm, setApplyForm] = useState<{ name: string; student_id: string; qna_answers: Record<string, string> }>({
    name: userName,
    student_id: userStudentId,
    qna_answers: {}
  })
  const [meetingApplyForm, setMeetingApplyForm] = useState({
    department: userDepartment,
    member_count: 2,
    message: ''
  })

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'club') {
        const data = await clubAPI.getClubs()
        setClubs(data)
      } else {
        const [allData, myData] = await Promise.all([
          meetingAPI.getMeetings(),
          meetingAPI.getMyMeetings()
        ])
        setMeetings(allData)
        setMyMeetings(myData)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewClub = async (club: Club) => {
    try {
      const detail = await clubAPI.getClub(club.id)
      setSelectedClub(detail)
      setView('detail')
    } catch (err) {
      alert('동아리 정보를 불러올 수 없습니다.')
    }
  }

  const handleViewMeeting = async (meeting: Meeting) => {
    try {
      const detail = await meetingAPI.getMeeting(meeting.id)
      setSelectedMeeting(detail)
      setView('detail')
    } catch (err) {
      alert('과팅 정보를 불러올 수 없습니다.')
    }
  }

  const handleCreateClub = async () => {
    if (!clubForm.name.trim() || !clubForm.description.trim()) {
      alert('동아리 이름과 설명을 입력해주세요.')
      return
    }
    try {
      const questions = clubForm.qna_questions.filter(q => q.trim())
      await clubAPI.createClub({
        name: clubForm.name,
        description: clubForm.description,
        qna_questions: questions.length > 0 ? questions : undefined
      })
      setClubForm({ name: '', description: '', qna_questions: [''] })
      setView('list')
      loadData()
    } catch (err) {
      alert('등록에 실패했습니다.')
    }
  }

  const handleUpdateClub = async () => {
    if (!selectedClub) return
    try {
      const questions = clubForm.qna_questions.filter(q => q.trim())
      await clubAPI.updateClub(selectedClub.id, {
        name: clubForm.name,
        description: clubForm.description,
        qna_questions: questions.length > 0 ? questions : undefined
      })
      setView('list')
      loadData()
    } catch (err) {
      alert('수정에 실패했습니다.')
    }
  }

  const handleDeleteClub = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await clubAPI.deleteClub(id)
      setView('list')
      loadData()
    } catch (err) {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleApplyClub = async () => {
    if (!selectedClub) return
    try {
      await clubAPI.applyClub(selectedClub.id, {
        name: applyForm.name,
        student_id: applyForm.student_id,
        qna_answers: Object.keys(applyForm.qna_answers).length > 0 ? applyForm.qna_answers : undefined
      })
      alert('신청이 완료되었습니다.')
      setView('list')
      loadData()
    } catch (err: any) {
      alert(err.message || '신청에 실패했습니다.')
    }
  }

  const handleViewClubApplications = async (club: Club) => {
    try {
      const apps = await clubAPI.getApplications(club.id)
      setClubApplications(apps)
      setSelectedClub(club)
      setView('applications')
    } catch (err) {
      alert('신청 목록을 불러올 수 없습니다.')
    }
  }

  const handleCreateMeeting = async () => {
    if (meetingForm.member_count < 1) {
      alert('인원수를 입력해주세요.')
      return
    }
    try {
      await meetingAPI.createMeeting({
        department: meetingForm.department,
        member_count: meetingForm.member_count,
        description: meetingForm.description || undefined
      })
      setMeetingForm({ department: userDepartment, member_count: 2, description: '' })
      setView('list')
      loadData()
    } catch (err) {
      alert('등록에 실패했습니다.')
    }
  }

  const handleUpdateMeeting = async () => {
    if (!selectedMeeting) return
    try {
      await meetingAPI.updateMeeting(selectedMeeting.id, {
        member_count: meetingForm.member_count,
        description: meetingForm.description || undefined
      })
      setView('list')
      loadData()
    } catch (err) {
      alert('수정에 실패했습니다.')
    }
  }

  const handleDeleteMeeting = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await meetingAPI.deleteMeeting(id)
      setView('list')
      loadData()
    } catch (err) {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleApplyMeeting = async () => {
    if (!selectedMeeting) return
    try {
      await meetingAPI.applyMeeting(selectedMeeting.id, {
        department: meetingApplyForm.department,
        member_count: meetingApplyForm.member_count,
        message: meetingApplyForm.message || undefined
      })
      alert('신청이 완료되었습니다.')
      setView('list')
      loadData()
    } catch (err: any) {
      alert(err.message || '신청에 실패했습니다.')
    }
  }

  const handleViewMeetingApplications = async (meeting: Meeting) => {
    try {
      const apps = await meetingAPI.getApplications(meeting.id)
      setMeetingApplications(apps)
      setSelectedMeeting(meeting)
      setView('applications')
    } catch (err) {
      alert('신청 목록을 불러올 수 없습니다.')
    }
  }

  const handleMatchMeeting = async (applicationId: number) => {
    if (!selectedMeeting) return
    if (!confirm('이 신청자와 매칭하시겠습니까?')) return
    try {
      const result = await meetingAPI.matchMeeting(selectedMeeting.id, applicationId)
      alert('매칭이 완료되었습니다! 채팅방이 생성되었습니다.')
      setView('list')
      loadData()
    } catch (err: any) {
      alert(err.message || '매칭에 실패했습니다.')
    }
  }

  const startEdit = (item: Club | Meeting) => {
    if (activeTab === 'club') {
      const club = item as Club
      setClubForm({
        name: club.name,
        description: club.description,
        qna_questions: club.qna_questions || ['']
      })
      setSelectedClub(club)
    } else {
      const meeting = item as Meeting
      setMeetingForm({
        department: meeting.department,
        member_count: meeting.member_count,
        description: meeting.description || ''
      })
      setSelectedMeeting(meeting)
    }
    setView('edit')
  }

  const startApply = (item: Club | Meeting) => {
    if (activeTab === 'club') {
      const club = item as Club
      setSelectedClub(club)
      setApplyForm({
        name: userName,
        student_id: userStudentId,
        qna_answers: {}
      })
    } else {
      const meeting = item as Meeting
      setSelectedMeeting(meeting)
      setMeetingApplyForm({
        department: userDepartment,
        member_count: 2,
        message: ''
      })
    }
    setView('apply')
  }

  const goBack = () => {
    if (view === 'chat') {
      // 채팅 폴링 중지
      if (chatPollingRef.current) {
        clearInterval(chatPollingRef.current)
        chatPollingRef.current = null
      }
      setView('list')
      setShowMyMeetings(true)
    } else if (view === 'list') {
      onBack()
    } else {
      setView('list')
      setSelectedClub(null)
      setSelectedMeeting(null)
    }
  }

  // 채팅 관련 함수
  const openChatRoom = async (roomId: number, roomName: string) => {
    setChatRoomId(roomId)
    setChatRoomName(roomName)
    setChatMessages([])
    setView('chat')
    await loadChatMessages(roomId)
    startChatPolling(roomId)
  }

  const loadChatMessages = async (roomId: number) => {
    try {
      const messages = await chatAPI.getMessages(roomId)
      const userId = localStorage.getItem('user_id')
      const messagesWithMine = messages.map((msg: ChatMessage) => ({
        ...msg,
        is_mine: String(msg.user_id) === userId
      }))
      setChatMessages(messagesWithMine)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error('메시지 로드 실패:', err)
    }
  }

  const startChatPolling = (roomId: number) => {
    if (chatPollingRef.current) {
      clearInterval(chatPollingRef.current)
    }
    chatPollingRef.current = setInterval(() => {
      loadChatMessages(roomId)
    }, 3000)
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatRoomId || isSending) return
    setIsSending(true)
    try {
      await chatAPI.sendMessage(chatRoomId, chatInput.trim())
      setChatInput('')
      await loadChatMessages(chatRoomId)
    } catch (err) {
      alert('메시지 전송에 실패했습니다.')
    } finally {
      setIsSending(false)
    }
  }

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (chatPollingRef.current) {
        clearInterval(chatPollingRef.current)
      }
    }
  }, [])

  const addQuestion = () => {
    setClubForm(prev => ({ ...prev, qna_questions: [...prev.qna_questions, ''] }))
  }

  const removeQuestion = (index: number) => {
    setClubForm(prev => ({
      ...prev,
      qna_questions: prev.qna_questions.filter((_, i) => i !== index)
    }))
  }

  const updateQuestion = (index: number, value: string) => {
    setClubForm(prev => ({
      ...prev,
      qna_questions: prev.qna_questions.map((q, i) => i === index ? value : q)
    }))
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* 헤더 */}
      <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <button
          onClick={goBack}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          {view === 'list' && '커뮤니티'}
          {view === 'detail' && (activeTab === 'club' ? selectedClub?.name : `${selectedMeeting?.department} 과팅`)}
          {view === 'write' && (activeTab === 'club' ? '동아리 등록' : '과팅 등록')}
          {view === 'edit' && (activeTab === 'club' ? '동아리 수정' : '과팅 수정')}
          {view === 'apply' && (activeTab === 'club' ? '동아리 신청' : '과팅 신청')}
          {view === 'applications' && '신청 목록'}
          {view === 'chat' && chatRoomName}
        </h1>
      </header>

      {/* 탭 (리스트 뷰에서만) */}
      {view === 'list' && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('club')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'club'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-card text-muted-foreground border border-border/50 hover:bg-muted'
              }`}
            >
              <Users className="w-4 h-4" />
              동아리 홍보
            </button>
            <button
              onClick={() => setActiveTab('meeting')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'meeting'
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'bg-card text-muted-foreground border border-border/50 hover:bg-muted'
              }`}
            >
              <Heart className="w-4 h-4" />
              과팅 찾기
            </button>
          </div>
        </div>
      )}

      {/* 컨텐츠 */}
      <div className={`flex-1 ${view === 'chat' ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {/* 리스트 뷰 */}
        {view === 'list' && (
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeTab === 'club' ? (
              clubs.length === 0 ? (
                <div className="text-center py-20">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">등록된 동아리가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clubs.map(club => (
                    <div
                      key={club.id}
                      className="bg-card rounded-xl p-4 border border-border/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1" onClick={() => handleViewClub(club)}>
                          <h3 className="font-semibold text-foreground">{club.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{club.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-muted-foreground">작성자: {club.author_name}</span>
                            <span className="text-xs text-primary">신청 {club.application_count}명</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                      {club.is_mine && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                          <button
                            onClick={() => handleViewClubApplications(club)}
                            className="flex-1 py-2 text-xs font-medium text-primary bg-primary/10 rounded-lg"
                          >
                            신청 목록 ({club.application_count})
                          </button>
                          <button
                            onClick={() => startEdit(club)}
                            className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClub(club.id)}
                            className="px-3 py-2 text-xs font-medium text-red-500 bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-4">
                {/* 내 과팅 / 전체 과팅 토글 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMyMeetings(false)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                      !showMyMeetings ? 'bg-pink-500 text-white' : 'bg-card text-muted-foreground border border-border/50'
                    }`}
                  >
                    전체 과팅
                  </button>
                  <button
                    onClick={() => setShowMyMeetings(true)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                      showMyMeetings ? 'bg-pink-500 text-white' : 'bg-card text-muted-foreground border border-border/50'
                    }`}
                  >
                    내 과팅 ({myMeetings.length})
                  </button>
                </div>

                {(showMyMeetings ? myMeetings : meetings).length === 0 ? (
                  <div className="text-center py-20">
                    <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {showMyMeetings ? '등록한 과팅이 없습니다' : '등록된 과팅이 없습니다'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showMyMeetings ? myMeetings : meetings).map(meeting => (
                      <div
                        key={meeting.id}
                        className={`bg-card rounded-xl p-4 border ${
                          meeting.status === 'matched' ? 'border-green-300 bg-green-50/50' : 'border-border/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1" onClick={() => handleViewMeeting(meeting)}>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{meeting.department}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
                                {meeting.member_count}명
                              </span>
                              {meeting.status === 'closed' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">마감</span>
                              )}
                              {meeting.status === 'matched' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">매칭완료</span>
                              )}
                            </div>
                            {meeting.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{meeting.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-pink-500">신청 {meeting.application_count}명</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        </div>
                        {/* 매칭 완료된 경우 채팅방 버튼 */}
                        {meeting.status === 'matched' && meeting.chat_room_id && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <button
                              onClick={() => openChatRoom(meeting.chat_room_id!, `${meeting.department} 과팅`)}
                              className="w-full py-2.5 text-sm font-medium text-white bg-green-500 rounded-lg flex items-center justify-center gap-2"
                            >
                              <MessageCircle className="w-4 h-4" />
                              채팅방 열기
                            </button>
                          </div>
                        )}
                        {meeting.is_mine && meeting.status !== 'matched' && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                          <button
                            onClick={() => handleViewMeetingApplications(meeting)}
                            className="flex-1 py-2 text-xs font-medium text-pink-500 bg-pink-50 rounded-lg"
                          >
                            신청 목록 ({meeting.application_count})
                          </button>
                          <button
                            onClick={() => startEdit(meeting)}
                            className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            className="px-3 py-2 text-xs font-medium text-red-500 bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 상세 뷰 */}
        {view === 'detail' && activeTab === 'club' && selectedClub && (
          <div className="p-4 space-y-4">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <h2 className="text-xl font-bold text-foreground">{selectedClub.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">작성자: {selectedClub.author_name}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <h3 className="font-semibold text-foreground mb-2">동아리 소개</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedClub.description}</p>
            </div>
            {selectedClub.qna_questions && selectedClub.qna_questions.length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <h3 className="font-semibold text-foreground mb-2">가입 시 질문</h3>
                <ul className="space-y-2">
                  {selectedClub.qna_questions.map((q, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {q}</li>
                  ))}
                </ul>
              </div>
            )}
            {!selectedClub.is_mine && !selectedClub.has_applied && (
              <button
                onClick={() => startApply(selectedClub)}
                className="w-full py-3 bg-primary text-white font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                신청하기
              </button>
            )}
            {selectedClub.has_applied && (
              <div className="text-center py-3 bg-muted rounded-xl text-muted-foreground">
                이미 신청하셨습니다
              </div>
            )}
          </div>
        )}

        {view === 'detail' && activeTab === 'meeting' && selectedMeeting && (
          <div className="p-4 space-y-4">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{selectedMeeting.department}</h2>
                <span className="text-sm px-3 py-1 rounded-full bg-pink-100 text-pink-600">
                  {selectedMeeting.member_count}명
                </span>
              </div>
              {selectedMeeting.status !== 'open' && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedMeeting.status === 'matched' ? '매칭 완료' : '모집 마감'}
                </p>
              )}
            </div>
            {selectedMeeting.description && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <h3 className="font-semibold text-foreground mb-2">소개</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedMeeting.description}</p>
              </div>
            )}
            {!selectedMeeting.is_mine && !selectedMeeting.has_applied && selectedMeeting.status === 'open' && (
              <button
                onClick={() => startApply(selectedMeeting)}
                className="w-full py-3 bg-pink-500 text-white font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <Heart className="w-5 h-5" />
                과팅 신청하기
              </button>
            )}
            {selectedMeeting.has_applied && (
              <div className="text-center py-3 bg-muted rounded-xl text-muted-foreground">
                이미 신청하셨습니다
              </div>
            )}
          </div>
        )}

        {/* 글쓰기 뷰 */}
        {view === 'write' && activeTab === 'club' && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">동아리 이름</label>
                <input
                  type="text"
                  value={clubForm.name}
                  onChange={(e) => setClubForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                  placeholder="동아리 이름을 입력하세요"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">동아리 설명</label>
                <textarea
                  value={clubForm.description}
                  onChange={(e) => setClubForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground min-h-[120px]"
                  placeholder="동아리에 대해 설명해주세요"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">가입 질문 (선택)</label>
                  <button
                    onClick={addQuestion}
                    className="text-xs text-primary"
                  >
                    + 질문 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {clubForm.qna_questions.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                        className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                        placeholder={`질문 ${i + 1}`}
                      />
                      {clubForm.qna_questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(i)}
                          className="px-3 text-red-500"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleCreateClub}
              className="w-full py-3 bg-primary text-white font-medium rounded-xl"
            >
              등록하기
            </button>
          </div>
        )}

        {view === 'write' && activeTab === 'meeting' && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">우리 과</label>
                <input
                  type="text"
                  value={meetingForm.department}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                  placeholder="학과를 입력하세요"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">인원수</label>
                <input
                  type="number"
                  min="1"
                  value={meetingForm.member_count}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, member_count: parseInt(e.target.value) || 1 }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">소개 (선택)</label>
                <textarea
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground min-h-[100px]"
                  placeholder="간단한 소개를 입력하세요"
                />
              </div>
            </div>
            <button
              onClick={handleCreateMeeting}
              className="w-full py-3 bg-pink-500 text-white font-medium rounded-xl"
            >
              등록하기
            </button>
          </div>
        )}

        {/* 수정 뷰 */}
        {view === 'edit' && activeTab === 'club' && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">동아리 이름</label>
                <input
                  type="text"
                  value={clubForm.name}
                  onChange={(e) => setClubForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">동아리 설명</label>
                <textarea
                  value={clubForm.description}
                  onChange={(e) => setClubForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground min-h-[120px]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">가입 질문</label>
                  <button onClick={addQuestion} className="text-xs text-primary">+ 질문 추가</button>
                </div>
                <div className="space-y-2">
                  {clubForm.qna_questions.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                        className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                      />
                      {clubForm.qna_questions.length > 1 && (
                        <button onClick={() => removeQuestion(i)} className="px-3 text-red-500">
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={handleUpdateClub} className="w-full py-3 bg-primary text-white font-medium rounded-xl">
              수정하기
            </button>
          </div>
        )}

        {view === 'edit' && activeTab === 'meeting' && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">우리 과</label>
                <input
                  type="text"
                  value={meetingForm.department}
                  disabled
                  className="w-full mt-1 px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">인원수</label>
                <input
                  type="number"
                  min="1"
                  value={meetingForm.member_count}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, member_count: parseInt(e.target.value) || 1 }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">소개</label>
                <textarea
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground min-h-[100px]"
                />
              </div>
            </div>
            <button onClick={handleUpdateMeeting} className="w-full py-3 bg-pink-500 text-white font-medium rounded-xl">
              수정하기
            </button>
          </div>
        )}

        {/* 신청 뷰 */}
        {view === 'apply' && activeTab === 'club' && selectedClub && (
          <div className="p-4 space-y-4">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <h3 className="font-semibold text-foreground">{selectedClub.name} 신청</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">이름</label>
                <input
                  type="text"
                  value={applyForm.name}
                  disabled
                  className="w-full mt-1 px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">학번</label>
                <input
                  type="text"
                  value={applyForm.student_id}
                  disabled
                  className="w-full mt-1 px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground cursor-not-allowed"
                />
              </div>
              {selectedClub.qna_questions && selectedClub.qna_questions.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">질문 답변</label>
                  {selectedClub.qna_questions.map((q, i) => (
                    <div key={i}>
                      <p className="text-sm text-muted-foreground mb-1">Q. {q}</p>
                      <textarea
                        value={applyForm.qna_answers[q] || ''}
                        onChange={(e) => setApplyForm(prev => ({
                          ...prev,
                          qna_answers: { ...prev.qna_answers, [q]: e.target.value }
                        }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground min-h-[80px]"
                        placeholder="답변을 입력하세요"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleApplyClub} className="w-full py-3 bg-primary text-white font-medium rounded-xl">
              신청하기
            </button>
          </div>
        )}

        {view === 'apply' && activeTab === 'meeting' && selectedMeeting && (
          <div className="p-4 space-y-4">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <h3 className="font-semibold text-foreground">{selectedMeeting.department} 과팅 신청</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">우리 과</label>
                <input
                  type="text"
                  value={meetingApplyForm.department}
                  onChange={(e) => setMeetingApplyForm(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">인원수</label>
                <input
                  type="number"
                  min="1"
                  value={meetingApplyForm.member_count}
                  onChange={(e) => setMeetingApplyForm(prev => ({ ...prev, member_count: parseInt(e.target.value) || 1 }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">메시지 (선택)</label>
                <textarea
                  value={meetingApplyForm.message}
                  onChange={(e) => setMeetingApplyForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground min-h-[100px]"
                  placeholder="간단한 소개나 메시지를 남겨주세요"
                />
              </div>
            </div>
            <button onClick={handleApplyMeeting} className="w-full py-3 bg-pink-500 text-white font-medium rounded-xl">
              신청하기
            </button>
          </div>
        )}

        {/* 신청 목록 뷰 */}
        {view === 'applications' && activeTab === 'club' && (
          <div className="p-4 space-y-3">
            {clubApplications.length === 0 ? (
              <div className="text-center py-20">
                <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">아직 신청자가 없습니다</p>
              </div>
            ) : (
              clubApplications.map(app => (
                <div key={app.id} className="bg-card rounded-xl p-4 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-foreground">{app.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">({app.student_id})</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm('이 신청을 삭제하시겠습니까?')) {
                          await clubAPI.deleteApplication(selectedClub!.id, app.id)
                          handleViewClubApplications(selectedClub!)
                        }
                      }}
                      className="text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {app.qna_answers && Object.keys(app.qna_answers).length > 0 && (
                    <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
                      {Object.entries(app.qna_answers).map(([q, a], i) => (
                        <div key={i}>
                          <p className="text-xs text-muted-foreground">Q. {q}</p>
                          <p className="text-sm text-foreground mt-0.5">A. {a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'applications' && activeTab === 'meeting' && (
          <div className="p-4 space-y-3">
            {meetingApplications.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">아직 신청자가 없습니다</p>
              </div>
            ) : (
              meetingApplications.map(app => (
                <div key={app.id} className="bg-card rounded-xl p-4 border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{app.department}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
                        {app.member_count}명
                      </span>
                      {app.is_matched === 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">매칭됨</span>
                      )}
                    </div>
                  </div>
                  {app.message && (
                    <p className="text-sm text-muted-foreground mt-2">{app.message}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                    {app.is_matched === 0 && selectedMeeting?.status !== 'matched' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMatchMeeting(app.id)}
                          className="px-4 py-1.5 text-xs font-medium text-white bg-pink-500 rounded-lg flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          매칭하기
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('이 신청을 삭제하시겠습니까?')) {
                              await meetingAPI.deleteApplication(selectedMeeting!.id, app.id)
                              handleViewMeetingApplications(selectedMeeting!)
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 채팅 뷰 */}
        {view === 'chat' && chatRoomId && (
          <>
            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10">
                  <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">아직 메시지가 없습니다</p>
                  <p className="text-sm text-muted-foreground mt-1">첫 메시지를 보내보세요!</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.is_mine
                          ? 'bg-green-500 text-white rounded-br-md'
                          : 'bg-card border border-border/50 text-foreground rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.is_mine ? 'text-green-100' : 'text-muted-foreground'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 메시지 입력 */}
            <div className="flex-shrink-0 p-4 border-t border-border/50 bg-background">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || isSending}
                  className="w-12 h-12 bg-green-500 text-white rounded-xl flex items-center justify-center disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 플로팅 버튼 (리스트 뷰에서만) */}
      {view === 'list' && (
        <button
          onClick={() => {
            if (activeTab === 'club') {
              setClubForm({ name: '', description: '', qna_questions: [''] })
            } else {
              setMeetingForm({ department: userDepartment, member_count: 2, description: '' })
            }
            setView('write')
          }}
          className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 ${
            activeTab === 'club' ? 'bg-primary' : 'bg-pink-500'
          }`}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  )
}
