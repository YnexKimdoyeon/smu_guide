'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, CalendarCheck, RefreshCw } from 'lucide-react'
import { earsAPI } from '@/lib/api'

interface WeekAttendance {
  week: number
  date: string
  status: string
  status_code: string
}

interface TimeSlot {
  sugang_code: string
  weekday: string
  start_time: string
  weeks: WeekAttendance[]
}

interface CourseInfo {
  sugang_code: string
  course_name: string
  subject_code: string
  department: string
  professor: string
  classroom: string
  credits: string
}

interface WeeklySummary {
  week: number
  attend: number
  absent: number
  late: number
  early: number
  none: number
}

interface AttendanceData {
  course_info: CourseInfo
  time_slots: TimeSlot[]
  weekly_summary: WeeklySummary[]
  color: string | null
}

const COURSE_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-amber-500',
]

interface AttendanceScreenProps {
  onBack: () => void
}

export function AttendanceScreen({ onBack }: AttendanceScreenProps) {
  const [courses, setCourses] = useState<AttendanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAttendance()
  }, [])

  const loadAttendance = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await earsAPI.getAllAttendance()
      const coursesWithColors = (data.courses || []).map((c: AttendanceData, i: number) => ({
        ...c,
        color: COURSE_COLORS[i % COURSE_COLORS.length],
      }))
      setCourses(coursesWithColors)
    } catch (err: any) {
      console.error('출석 조회 실패:', err)
      setError(err.message || '출석 현황을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case '출석': case '출석(1차)': case '출석(위치X)': return 'bg-green-100 text-green-700 border-green-200'
      case '결석': return 'bg-red-100 text-red-700 border-red-200'
      case '지각': case '지각(1차)': case '지각(위치X)': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case '조퇴': return 'bg-orange-100 text-orange-700 border-orange-200'
      case '공결': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-gray-50 text-gray-400 border-gray-100'
    }
  }

  const getStatusBadge = (status: string) => {
    if (status.startsWith('출석')) return 'O'
    if (status === '결석') return 'X'
    if (status.startsWith('지각')) return '지'
    if (status === '조퇴') return '조'
    if (status === '공결') return '공'
    return '-'
  }

  // 과목 상세 출석 현황
  if (selectedIndex !== null && courses[selectedIndex]) {
    const data = courses[selectedIndex]
    const info = data.course_info
    const summary = data.weekly_summary

    const totalAttend = summary.reduce((sum, w) => sum + w.attend, 0)
    const totalAbsent = summary.reduce((sum, w) => sum + w.absent, 0)
    const totalLate = summary.reduce((sum, w) => sum + w.late, 0)
    const totalRecorded = summary.filter(w => w.attend > 0 || w.absent > 0 || w.late > 0 || w.early > 0).length

    return (
      <div className="fixed inset-0 bg-background flex flex-col z-50">
        <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
          <button
            onClick={() => setSelectedIndex(null)}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{info.course_name}</h1>
            <p className="text-xs text-muted-foreground">{info.professor} | {info.classroom}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 요약 카드 */}
          <div className="bg-primary rounded-2xl p-4 shadow-lg">
            <h3 className="text-primary-foreground font-semibold mb-3">출석 통계</h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{totalAttend}</p>
                <p className="text-[10px] text-white/80">출석</p>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{totalAbsent}</p>
                <p className="text-[10px] text-white/80">결석</p>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{totalLate}</p>
                <p className="text-[10px] text-white/80">지각</p>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{totalRecorded}/15</p>
                <p className="text-[10px] text-white/80">진행</p>
              </div>
            </div>
          </div>

          {/* 시간대별 주차별 출석 */}
          {data.time_slots.map((slot, slotIdx) => (
            <div key={slotIdx} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="px-4 py-3 bg-secondary/50 border-b border-border/30">
                <h4 className="font-medium text-foreground text-sm">
                  {slot.weekday}요일 {slot.start_time}
                </h4>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-5 gap-1.5">
                  {slot.weeks.map((week) => (
                    <div
                      key={week.week}
                      className={`rounded-lg p-2 text-center border ${getStatusColor(week.status)}`}
                    >
                      <p className="text-[10px] font-medium opacity-70">{week.week}주</p>
                      <p className="text-xs font-bold mt-0.5">{getStatusBadge(week.status)}</p>
                      <p className="text-[9px] opacity-60 mt-0.5">{week.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* 주차별 요약 테이블 */}
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-4 py-3 bg-secondary/50 border-b border-border/30">
              <h4 className="font-medium text-foreground text-sm">주차별 요약</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">주차</th>
                    <th className="px-3 py-2 text-center font-medium text-green-600">출석</th>
                    <th className="px-3 py-2 text-center font-medium text-red-600">결석</th>
                    <th className="px-3 py-2 text-center font-medium text-yellow-600">지각</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-400">미입력</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {summary.map((w) => {
                    const hasData = w.attend > 0 || w.absent > 0 || w.late > 0 || w.early > 0
                    return (
                      <tr key={w.week} className={hasData ? '' : 'opacity-40'}>
                        <td className="px-3 py-2 font-medium text-foreground">{w.week}주차</td>
                        <td className="px-3 py-2 text-center">
                          {w.attend > 0 && <span className="text-green-600 font-bold">{w.attend}</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {w.absent > 0 && <span className="text-red-600 font-bold">{w.absent}</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {w.late > 0 && <span className="text-yellow-600 font-bold">{w.late}</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {w.none > 0 && <span className="text-gray-400">{w.none}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 메인 출석 현황 목록
  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground flex-1">출석 현황</h1>
        <button
          onClick={loadAttendance}
          disabled={loading}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <CalendarCheck className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">출석 현황을 불러올 수 없습니다</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">{error}</p>
            <button
              onClick={loadAttendance}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              다시 시도
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <CalendarCheck className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">출석 데이터가 없습니다</h3>
            <p className="text-sm text-muted-foreground text-center">
              EARS에 등록된 수강과목이 없거나<br />출석 데이터를 가져올 수 없습니다.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {courses.map((course, idx) => {
              const info = course.course_info
              const summary = course.weekly_summary || []

              const totalAttend = summary.reduce((sum, w) => sum + w.attend, 0)
              const totalAbsent = summary.reduce((sum, w) => sum + w.absent, 0)
              const totalLate = summary.reduce((sum, w) => sum + w.late, 0)
              const totalRecorded = summary.filter(w => w.attend > 0 || w.absent > 0 || w.late > 0 || w.early > 0).length

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  className="w-full bg-card rounded-2xl border border-border/50 overflow-hidden text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${course.color || 'bg-gray-400'}`} />
                      <h4 className="font-semibold text-foreground text-sm truncate flex-1">
                        {info?.course_name || '과목명 없음'}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">{info?.professor}</span>
                      {info?.classroom && (
                        <>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-xs text-muted-foreground">{info?.classroom}</span>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {totalAttend > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          출석 {totalAttend}
                        </span>
                      )}
                      {totalAbsent > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          결석 {totalAbsent}
                        </span>
                      )}
                      {totalLate > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                          지각 {totalLate}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                        {totalRecorded}/15주 진행
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
