'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, BookOpen, Video, FileText, MessageSquare, CheckCircle2, Clock, AlertCircle, RefreshCw, Lock, Loader2 } from 'lucide-react'
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

interface ElearningScreenProps {
  onBack: () => void
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

  useEffect(() => {
    checkSessionAndLoad()
  }, [])

  const checkSessionAndLoad = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const status = await canvasAPI.getStatus()
      setIsSessionActive(status.active)
      if (status.active) {
        await loadData()
      } else {
        setShowLoginModal(true)
        setIsLoading(false)
      }
    } catch (err) {
      setIsSessionActive(false)
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
      if (err.message?.includes('세션')) {
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
      <header className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">E-러닝</h1>
        </div>
        <button
          onClick={checkSessionAndLoad}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-5 h-5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
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
                  <div key={course.course_id} className="bg-card rounded-xl p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground text-sm truncate flex-1 mr-2">
                        {getCourseName(course.course_id)}
                      </h4>
                      {!hasContent && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    {hasContent ? (
                      <div className="flex flex-wrap gap-2">
                        {act.total_unread_announcements > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
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
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
