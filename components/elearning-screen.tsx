'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, BookOpen, Video, FileText, MessageSquare, CheckCircle2, Clock, AlertCircle, Lock, Loader2, Bell, ChevronRight, LayoutList } from 'lucide-react'
import { canvasAPI } from '@/lib/api'

interface TodoItem {
  section_id: number
  unit_id: number
  component_id: number
  component_type: string
  title: string
  due_date: string
  commons_type?: string
}

interface CourseActivity {
  total_unread_announcements: number
  total_announcements: number
  total_incompleted_movies: number
  total_unsubmitted_assignments: number
  total_unsubmitted_quizzes: number
  total_unsubmitted_discussion_topics: number
}

interface CourseTodo {
  course_id: number
  activities: CourseActivity
  todo_list: TodoItem[]
}

interface TodosResponse {
  to_dos: CourseTodo[]
  total_unread_messages: number
  total_count: number
}

interface Course {
  id: number
  name: string
  course_code?: string
}

interface Announcement {
  id: number
  title: string
  message: string
  posted_at: string
  user_name: string
}

interface AnnouncementDetail {
  title: string
  author: string
  course_name: string
  content: string
}

interface ElearningScreenProps {
  onBack: () => void
}

interface Board {
  id: number
  title: string
  type: string
  total_post_count: number
  description?: string
}

interface BoardPost {
  id: number
  title: string
  user_name?: string
  created_at: string
  view_count?: number
  comment_count?: number
}

type CourseTab = 'todo' | 'announcements' | 'boards'

// Canvas 자격 증명 저장/조회 (자동 재로그인용)
const CANVAS_CREDS_KEY = 'canvas_credentials'

const saveCanvasCredentials = (username: string, password: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CANVAS_CREDS_KEY, JSON.stringify({ username, password }))
  }
}

const getCanvasCredentials = (): { username: string; password: string } | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(CANVAS_CREDS_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }
  }
  return null
}

const clearCanvasCredentials = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CANVAS_CREDS_KEY)
  }
}

export function ElearningScreen({ onBack }: ElearningScreenProps) {
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [todos, setTodos] = useState<CourseTodo[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false)

  // 과목 상세 관련 상태
  const [showCourseDetail, setShowCourseDetail] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [courseTab, setCourseTab] = useState<CourseTab>('todo')

  // 공지사항 관련 상태
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [showAnnouncementDetail, setShowAnnouncementDetail] = useState(false)
  const [announcementDetail, setAnnouncementDetail] = useState<AnnouncementDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 게시판 관련 상태
  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(false)
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  useEffect(() => {
    checkSessionAndLoad()
  }, [])

  // 저장된 자격 증명으로 자동 로그인 시도
  const tryAutoLogin = async (): Promise<boolean> => {
    const creds = getCanvasCredentials()
    if (!creds) return false

    try {
      console.log('[Canvas] 자동 재로그인 시도...')
      await canvasAPI.init(creds.username, creds.password)
      console.log('[Canvas] 자동 재로그인 성공')
      setIsSessionActive(true)
      return true
    } catch (err) {
      console.log('[Canvas] 자동 재로그인 실패, 자격 증명 삭제')
      clearCanvasCredentials()
      return false
    }
  }

  const checkSessionAndLoad = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const status = await canvasAPI.getStatus()
      setIsSessionActive(status.active)
      if (status.active) {
        await loadData()
      } else {
        // 세션이 없으면 저장된 자격 증명으로 자동 로그인 시도
        if (!autoLoginAttempted) {
          setAutoLoginAttempted(true)
          const success = await tryAutoLogin()
          if (success) {
            await loadData()
            return
          }
        }
        setShowLoginModal(true)
        setIsLoading(false)
      }
    } catch (err) {
      setIsSessionActive(false)
      // 에러 시에도 자동 로그인 시도
      if (!autoLoginAttempted) {
        setAutoLoginAttempted(true)
        const success = await tryAutoLogin()
        if (success) {
          await loadData()
          return
        }
      }
      setShowLoginModal(true)
      setIsLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const [todosData, coursesData] = await Promise.all([
        canvasAPI.getTodos(),
        canvasAPI.getCourses()
      ])
      setTodos(todosData.to_dos || [])
      setCourses(coursesData || [])
    } catch (err: any) {
      if (err.message?.includes('세션') || err.message?.includes('401')) {
        // 세션 만료 시 자동 재로그인 시도
        console.log('[Canvas] 세션 만료 감지, 자동 재로그인 시도...')
        const success = await tryAutoLogin()
        if (success) {
          // 재로그인 성공하면 데이터 다시 로드
          try {
            const [todosData, coursesData] = await Promise.all([
              canvasAPI.getTodos(),
              canvasAPI.getCourses()
            ])
            setTodos(todosData.to_dos || [])
            setCourses(coursesData || [])
            setIsLoading(false)
            return
          } catch {
            // 재시도도 실패하면 로그인 모달
          }
        }
        setIsSessionActive(false)
        setShowLoginModal(true)
      } else {
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleInitSession = async () => {
    if (!username.trim() || !password.trim() || isInitializing) return
    setIsInitializing(true)
    try {
      await canvasAPI.init(username, password)
      // 로그인 성공 시 자격 증명 저장 (자동 재로그인용)
      saveCanvasCredentials(username, password)
      setIsSessionActive(true)
      setShowLoginModal(false)
      setUsername('')
      setPassword('')
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Canvas 연결에 실패했습니다.')
    } finally {
      setIsInitializing(false)
    }
  }

  const getCourseName = (courseId: number): string => {
    const course = courses.find(c => c.id === courseId)
    return course?.name || `과목 ${courseId}`
  }

  const formatDueDate = (dateStr: string): { text: string; isUrgent: boolean; isPast: boolean } => {
    const due = new Date(dateStr)
    const now = new Date()
    const diff = due.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (diff < 0) {
      return { text: '기한 만료', isUrgent: false, isPast: true }
    } else if (hours < 24) {
      return { text: `${hours}시간 남음`, isUrgent: true, isPast: false }
    } else if (days < 3) {
      return { text: `${days}일 남음`, isUrgent: true, isPast: false }
    } else if (days < 7) {
      return { text: `${days}일 남음`, isUrgent: false, isPast: false }
    } else {
      return { text: due.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), isUrgent: false, isPast: false }
    }
  }

  const formatPostedDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getComponentIcon = (type: string, commonsType?: string) => {
    if (commonsType === 'mp4' || type === 'movie') {
      return <Video className="w-4 h-4" />
    } else if (type === 'assignment') {
      return <FileText className="w-4 h-4" />
    } else if (type === 'discussion_topic') {
      return <MessageSquare className="w-4 h-4" />
    }
    return <BookOpen className="w-4 h-4" />
  }

  // 과목 상세 보기
  const handleViewCourse = async (courseId: number, tab: CourseTab = 'todo') => {
    setSelectedCourseId(courseId)
    setShowCourseDetail(true)
    setCourseTab(tab)

    // 공지 탭일 경우 공지사항 로드
    if (tab === 'announcements') {
      await loadAnnouncements(courseId)
    }
  }

  // 탭 전환시 로드
  const handleCourseTabChange = async (tab: CourseTab) => {
    setCourseTab(tab)
    if (tab === 'announcements' && selectedCourseId && announcements.length === 0) {
      await loadAnnouncements(selectedCourseId)
    }
    if (tab === 'boards' && selectedCourseId && boards.length === 0) {
      await loadBoards(selectedCourseId)
    }
  }

  // 과목별 공지사항 목록 조회
  const loadAnnouncements = async (courseId: number) => {
    setLoadingAnnouncements(true)
    setAnnouncements([])

    try {
      const data = await canvasAPI.getCourseAnnouncements(courseId)
      setAnnouncements(data || [])
    } catch (err: any) {
      console.error('공지사항 목록 조회 실패:', err)
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  // 게시판 목록 조회
  const loadBoards = async (courseId: number) => {
    setLoadingBoards(true)
    setBoards([])
    try {
      const data = await canvasAPI.getCourseBoards(courseId)
      setBoards(data || [])
    } catch (err: any) {
      console.error('게시판 목록 조회 실패:', err)
    } finally {
      setLoadingBoards(false)
    }
  }

  // 게시판 게시글 조회
  const handleViewBoard = async (board: Board) => {
    if (!selectedCourseId) return
    setSelectedBoard(board)
    setLoadingPosts(true)
    setBoardPosts([])
    try {
      const data = await canvasAPI.getBoardPosts(selectedCourseId, board.id)
      // API가 posts 배열을 직접 반환하거나, data 안에 있을 수 있음
      const posts = Array.isArray(data) ? data : (data?.posts || data?.data || [])
      setBoardPosts(posts)
    } catch (err: any) {
      console.error('게시글 목록 조회 실패:', err)
    } finally {
      setLoadingPosts(false)
    }
  }

  const formatBoardDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  // 공지사항 상세 조회
  const handleViewAnnouncementDetail = async (topicId: number) => {
    if (!selectedCourseId) return

    setShowAnnouncementDetail(true)
    setLoadingDetail(true)
    setAnnouncementDetail(null)

    try {
      const data = await canvasAPI.getAnnouncement(selectedCourseId, topicId)
      setAnnouncementDetail(data)
    } catch (err: any) {
      console.error('공지사항 상세 조회 실패:', err)
      alert('공지사항 내용을 불러오지 못했습니다.')
      setShowAnnouncementDetail(false)
    } finally {
      setLoadingDetail(false)
    }
  }

  // 할 일이 있는 과목만 필터링
  const coursesWithTodos = todos.filter(t => t.todo_list.length > 0)

  // 전체 요약 계산
  const summary = todos.reduce((acc, course) => {
    acc.announcements += course.activities.total_unread_announcements
    acc.movies += course.activities.total_incompleted_movies
    acc.assignments += course.activities.total_unsubmitted_assignments
    acc.quizzes += course.activities.total_unsubmitted_quizzes
    acc.discussions += course.activities.total_unsubmitted_discussion_topics
    acc.todoCount += course.todo_list.length
    return acc
  }, { announcements: 0, movies: 0, assignments: 0, quizzes: 0, discussions: 0, todoCount: 0 })

  // 공지사항 상세 모달
  if (showAnnouncementDetail && announcementDetail) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
          <button
            onClick={() => {
              setShowAnnouncementDetail(false)
              setAnnouncementDetail(null)
            }}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground truncate flex-1">공지사항</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-4">
              <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/30">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    {announcementDetail.title}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{announcementDetail.author}</span>
                    {announcementDetail.course_name && (
                      <>
                        <span>·</span>
                        <span className="truncate">{announcementDetail.course_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="p-4 prose prose-sm max-w-none text-foreground
                    prose-p:my-2 prose-p:leading-relaxed
                    prose-strong:text-foreground
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: announcementDetail.content }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 과목 상세에서 뒤로 가면서 자동 리프레시
  const handleBackFromCourseDetail = () => {
    setShowCourseDetail(false)
    setAnnouncements([])
    setBoards([])
    setSelectedBoard(null)
    setBoardPosts([])
    setCourseTab('todo')
    loadData() // 자동 리프레시
  }

  // 선택된 과목의 할 일 목록 가져오기
  const getSelectedCourseTodos = () => {
    if (!selectedCourseId) return null
    return todos.find(t => t.course_id === selectedCourseId)
  }

  // 과목 상세 화면
  if (showCourseDetail && selectedCourseId) {
    const courseTodo = getSelectedCourseTodos()
    const todoList = courseTodo?.todo_list || []
    const activities = courseTodo?.activities

    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
          <button
            onClick={handleBackFromCourseDetail}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {getCourseName(selectedCourseId)}
            </h1>
          </div>
        </header>

        {/* 탭 */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-border/50">
          <div className="flex gap-2">
            <button
              onClick={() => handleCourseTabChange('todo')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                courseTab === 'todo'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <Clock className="w-4 h-4" />
              할 일
              {todoList.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  courseTab === 'todo' ? 'bg-white/20' : 'bg-primary/20 text-primary'
                }`}>
                  {todoList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleCourseTabChange('announcements')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                courseTab === 'announcements'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <Bell className="w-4 h-4" />
              공지
              {activities && activities.total_unread_announcements > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  courseTab === 'announcements' ? 'bg-white/20' : 'bg-red-500 text-white'
                }`}>
                  {activities.total_unread_announcements}
                </span>
              )}
            </button>
            <button
              onClick={() => handleCourseTabChange('boards')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                courseTab === 'boards'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              게시판
            </button>
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {courseTab === 'todo' && (
            /* 할 일 탭 */
            <div className="p-4">
              {todoList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                  <p className="text-foreground font-medium">모든 할 일을 완료했습니다!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todoList.map((item, idx) => {
                    const due = formatDueDate(item.due_date)
                    return (
                      <div key={idx} className="bg-card rounded-xl p-4 border border-border/50 flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg ${
                          due.isPast ? 'bg-red-100 text-red-600' :
                          due.isUrgent ? 'bg-orange-100 text-orange-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {getComponentIcon(item.component_type, item.commons_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className={`text-xs ${
                              due.isPast ? 'text-red-500' :
                              due.isUrgent ? 'text-orange-500' :
                              'text-muted-foreground'
                            }`}>
                              {due.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {courseTab === 'announcements' && (
            /* 공지 탭 */
            <div className="p-4">
              {loadingAnnouncements ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">공지사항이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.map((ann) => (
                    <button
                      key={ann.id}
                      onClick={() => handleViewAnnouncementDetail(ann.id)}
                      className="w-full bg-card rounded-xl p-4 border border-border/50 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground text-sm line-clamp-2">
                            {ann.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <span>{ann.user_name}</span>
                            <span>·</span>
                            <span>{formatPostedDate(ann.posted_at)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {courseTab === 'boards' && (
            /* 게시판 탭 */
            <div className="p-4">
              {selectedBoard ? (
                /* 게시글 목록 */
                <div>
                  <button
                    onClick={() => { setSelectedBoard(null); setBoardPosts([]) }}
                    className="flex items-center gap-2 text-sm text-primary mb-3 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    게시판 목록으로
                  </button>
                  <h3 className="text-sm font-semibold text-foreground mb-3">{selectedBoard.title}</h3>
                  {loadingPosts ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : boardPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">게시글이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {boardPosts.map((post) => (
                        <div
                          key={post.id}
                          className="bg-card rounded-xl p-4 border border-border/50"
                        >
                          <h4 className="font-medium text-foreground text-sm line-clamp-2">
                            {post.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            {post.user_name && <span>{post.user_name}</span>}
                            {post.user_name && post.created_at && <span>·</span>}
                            {post.created_at && <span>{formatBoardDate(post.created_at)}</span>}
                            {post.view_count !== undefined && (
                              <>
                                <span>·</span>
                                <span>조회 {post.view_count}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 게시판 목록 */
                loadingBoards ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : boards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <LayoutList className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">게시판이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {boards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => handleViewBoard(board)}
                        className="w-full bg-card rounded-xl p-4 border border-border/50 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm truncate">
                              {board.title}
                            </h3>
                            {board.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1"
                                dangerouslySetInnerHTML={{ __html: board.description }}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {board.total_post_count > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {board.total_post_count}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 로그인 모달
  if (showLoginModal) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">E-러닝</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Canvas LMS 로그인</h3>
          <p className="text-sm text-muted-foreground text-center mb-6">
            LMS 아이디와 비밀번호를 입력하세요<br />(학번이 아닌 LMS 계정)
          </p>
          <input
            type="text"
            placeholder="LMS 아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full max-w-xs h-12 px-4 rounded-xl bg-secondary border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInitSession()}
            className="w-full max-w-xs h-12 px-4 rounded-xl bg-secondary border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
          />
          <button
            onClick={handleInitSession}
            disabled={!username.trim() || !password.trim() || isInitializing}
            className="w-full max-w-xs h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isInitializing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                연결 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* 헤더 */}
      <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">E-러닝</h1>
      </header>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-muted-foreground text-center">{error}</p>
            <button
              onClick={checkSessionAndLoad}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* 요약 카드 */}
            <div className="bg-primary rounded-2xl p-4 shadow-lg">
              <h2 className="text-primary-foreground font-semibold mb-3">할 일 요약</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{summary.todoCount}</p>
                  <p className="text-xs text-white/80">미완료 콘텐츠</p>
                </div>
                <div className="bg-white/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{summary.announcements}</p>
                  <p className="text-xs text-white/80">새 공지</p>
                </div>
                <div className="bg-white/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{summary.movies}</p>
                  <p className="text-xs text-white/80">미수강 강의</p>
                </div>
              </div>
            </div>

            {/* 할 일 목록 */}
            {coursesWithTodos.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 text-center border border-border/50">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-foreground font-medium">모든 할 일을 완료했습니다!</p>
                <p className="text-sm text-muted-foreground mt-1">새로운 콘텐츠가 올라오면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground px-1">해야 할 것들</h3>
                {coursesWithTodos.map(course => (
                  <div key={course.course_id} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                    <div className="px-4 py-3 bg-secondary/50 border-b border-border/30">
                      <h4 className="font-medium text-foreground text-sm truncate">
                        {getCourseName(course.course_id)}
                      </h4>
                    </div>
                    <div className="divide-y divide-border/30">
                      {course.todo_list.map((item, idx) => {
                        const due = formatDueDate(item.due_date)
                        return (
                          <div key={idx} className="px-4 py-3 flex items-start gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-lg ${
                              due.isPast ? 'bg-red-100 text-red-600' :
                              due.isUrgent ? 'bg-orange-100 text-orange-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {getComponentIcon(item.component_type, item.commons_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className={`text-xs ${
                                  due.isPast ? 'text-red-500' :
                                  due.isUrgent ? 'text-orange-500' :
                                  'text-muted-foreground'
                                }`}>
                                  {due.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 과목별 현황 */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground px-1">과목별 현황</h3>
              {todos.map(course => {
                const act = course.activities
                const hasContent = act.total_unread_announcements > 0 ||
                  act.total_incompleted_movies > 0 ||
                  act.total_unsubmitted_assignments > 0 ||
                  act.total_unsubmitted_quizzes > 0

                return (
                  <button
                    key={course.course_id}
                    onClick={() => handleViewCourse(course.course_id)}
                    className="w-full bg-card rounded-xl p-4 border border-border/50 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground text-sm truncate flex-1 mr-2">
                        {getCourseName(course.course_id)}
                      </h4>
                      {!hasContent ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {hasContent ? (
                      <div className="flex flex-wrap gap-2">
                        {act.total_unread_announcements > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            공지 {act.total_unread_announcements}
                          </span>
                        )}
                        {act.total_incompleted_movies > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                            강의 {act.total_incompleted_movies}
                          </span>
                        )}
                        {act.total_unsubmitted_assignments > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">
                            과제 {act.total_unsubmitted_assignments}
                          </span>
                        )}
                        {act.total_unsubmitted_quizzes > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
                            퀴즈 {act.total_unsubmitted_quizzes}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">완료</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
