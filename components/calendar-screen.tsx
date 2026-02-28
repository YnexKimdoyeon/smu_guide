'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

interface CalendarEvent {
  title: string
  start: string
  end: string
}

interface CalendarScreenProps {
  onBack: () => void
}

// 학사일정 데이터 (선문대학교 공식 데이터)
const academicEvents: CalendarEvent[] = [
  {"title":"삼일절","start":"2025/03/01","end":"2025/03/01"},
  {"title":"삼일절 대체공휴일","start":"2025/03/03","end":"2025/03/03"},
  {"title":"수강신청 최종정정, 복수․부전공, 조기졸업, 대체교과목 신청","start":"2025/03/04","end":"2025/03/10"},
  {"title":"개강일, 학기개시일, 입학일","start":"2025/03/04","end":"2025/03/04"},
  {"title":"수강과목 포기","start":"2025/03/24","end":"2025/03/26"},
  {"title":"참부모의 날(음3.1)","start":"2025/03/29","end":"2025/03/29"},
  {"title":"수업일수 30일","start":"2025/04/02","end":"2025/04/02"},
  {"title":"중간고사","start":"2025/04/22","end":"2025/04/28"},
  {"title":"근로자의날","start":"2025/05/01","end":"2025/05/01"},
  {"title":"수업일수 60일","start":"2025/05/02","end":"2025/05/02"},
  {"title":"부처님오신날 대체공휴일","start":"2025/05/06","end":"2025/05/06"},
  {"title":"선문대동제(축제)","start":"2025/05/21","end":"2025/05/22"},
  {"title":"수업일수 90일","start":"2025/06/01","end":"2025/06/01"},
  {"title":"제21대 대통령 선거일","start":"2025/06/03","end":"2025/06/03"},
  {"title":"기말고사","start":"2025/06/10","end":"2025/06/16"},
  {"title":"하계방학/계절학기 시작","start":"2025/06/17","end":"2025/06/17"},
  {"title":"성적공고/이의신청 및 정정","start":"2025/06/24","end":"2025/06/26"},
  {"title":"휴학신청(1차), 복학, 전과, 유급신청","start":"2025/07/14","end":"2025/07/16"},
  {"title":"2025-2학기 수강신청","start":"2025/08/07","end":"2025/08/11"},
  {"title":"2024-후기 졸업일","start":"2025/08/14","end":"2025/08/14"},
  {"title":"2025-2 등록기간","start":"2025/08/22","end":"2025/08/29"},
  {"title":"2025-2 휴학신청(2차)","start":"2025/08/25","end":"2025/08/29"},
  {"title":"수강신청 최종정정, 복수․부전공, 조기졸업, 대체교과목 신청","start":"2025/09/01","end":"2025/09/05"},
  {"title":"개강일, 학기개시일, 입학일","start":"2025/09/01","end":"2025/09/01"},
  {"title":"신입학 수시모집 원서접수","start":"2025/09/08","end":"2025/09/12"},
  {"title":"수강과목 포기","start":"2025/09/22","end":"2025/09/24"},
  {"title":"수업일수 30일","start":"2025/09/30","end":"2025/09/30"},
  {"title":"수시 면접고사","start":"2025/10/18","end":"2025/10/18"},
  {"title":"수시 실기고사","start":"2025/10/25","end":"2025/10/26"},
  {"title":"중간고사","start":"2025/10/27","end":"2025/11/04"},
  {"title":"개교기념일","start":"2025/10/28","end":"2025/10/28"},
  {"title":"수업일수 60일","start":"2025/10/30","end":"2025/10/30"},
  {"title":"수시 합격자 발표","start":"2025/11/19","end":"2025/11/19"},
  {"title":"참자녀의 날(음10.1)","start":"2025/11/20","end":"2025/11/20"},
  {"title":"수업일수 90일","start":"2025/11/29","end":"2025/11/29"},
  {"title":"기말고사","start":"2025/12/08","end":"2025/12/12"},
  {"title":"수시 문서등록","start":"2025/12/15","end":"2025/12/17"},
  {"title":"동계방학/계절학기 시작","start":"2025/12/15","end":"2025/12/15"},
  {"title":"성적공고/이의신청 및 정정","start":"2025/12/22","end":"2025/12/24"},
  {"title":"수시 미등록 충원 마감","start":"2025/12/24","end":"2025/12/24"},
  {"title":"신입학 정시모집 원서접수","start":"2025/12/29","end":"2025/12/31"},
  {"title":"2026-1 휴학신청(1차), 복학, 전과, 유급신청","start":"2026/01/21","end":"2026/01/23"},
  {"title":"정시 실기고사","start":"2026/01/22","end":"2026/01/22"},
  {"title":"정시 합격자 발표","start":"2026/01/29","end":"2026/01/29"},
  {"title":"신입학 본등록(등록금 납부)","start":"2026/02/03","end":"2026/02/05"},
  {"title":"2026-1학기 수강신청","start":"2026/02/05","end":"2026/02/09"},
  {"title":"2025-전기 졸업일","start":"2026/02/12","end":"2026/02/12"},
  {"title":"정시 미등록 충원 마감","start":"2026/02/13","end":"2026/02/13"},
  {"title":"2026-1 재학생 등록 기간","start":"2026/02/19","end":"2026/02/27"},
  {"title":"신입학 추가모집","start":"2026/02/20","end":"2026/02/27"},
  {"title":"2026-1 휴학신청(2차)","start":"2026/02/23","end":"2026/02/27"},
  {"title":"신입생 오리엔테이션, 입학식","start":"2026/02/24","end":"2026/02/24"},
  {"title":"삼일절 대체공휴일","start":"2026/03/02","end":"2026/03/02"},
  {"title":"수강신청 최종정정, 복수·부전공, 조기졸업, 대체교과목 신청","start":"2026/03/03","end":"2026/03/09"},
  {"title":"개강일, 학기개시일, 입학일","start":"2026/03/03","end":"2026/03/03"},
  {"title":"수강과목 포기","start":"2026/03/23","end":"2026/03/25"},
  {"title":"수업일수 1/4 (개강 후 19일째)","start":"2026/03/27","end":"2026/03/27"},
  {"title":"학기개시 30일","start":"2026/04/01","end":"2026/04/01"},
  {"title":"수업일수 1/3 (개강 후 25일째)","start":"2026/04/06","end":"2026/04/06"},
  {"title":"참부모의 날 (음 3.1)","start":"2026/04/17","end":"2026/04/17"},
  {"title":"중간고사","start":"2026/04/21","end":"2026/04/27"},
  {"title":"수업일수 1/2 (개강 후 38일째)","start":"2026/04/23","end":"2026/04/23"},
  {"title":"근로자의 날","start":"2026/05/01","end":"2026/05/01"},
  {"title":"학기개시 60일","start":"2026/05/01","end":"2026/05/01"},
  {"title":"어린이날","start":"2026/05/05","end":"2026/05/05"},
  {"title":"전공박람회","start":"2026/05/12","end":"2026/05/12"},
  {"title":"선문대동제(축제)","start":"2026/05/13","end":"2026/05/14"},
  {"title":"부처님오신날 대체공휴일","start":"2026/05/25","end":"2026/05/25"},
  {"title":"학기개시 90일","start":"2026/05/31","end":"2026/05/31"},
  {"title":"지방선거","start":"2026/06/03","end":"2026/06/03"},
  {"title":"현충일","start":"2026/06/06","end":"2026/06/06"},
  {"title":"기말고사","start":"2026/06/09","end":"2026/06/15"},
  {"title":"하계방학/계절학기 시작","start":"2026/06/16","end":"2026/06/16"},
  {"title":"성적공고/이의신청 및 정정","start":"2026/06/23","end":"2026/06/25"},
  {"title":"2026-2 휴학신청(1차), 복학, 전과, 유급신청","start":"2026/07/13","end":"2026/07/15"},
  {"title":"2026-2학기 수강신청","start":"2026/08/06","end":"2026/08/10"},
  {"title":"2025-후기 졸업일","start":"2026/08/13","end":"2026/08/13"},
  {"title":"2026-2 등록기간","start":"2026/08/24","end":"2026/08/28"},
  {"title":"2026-2 휴학신청(2차)","start":"2026/08/25","end":"2026/08/31"},
  {"title":"개강일, 학기개시일, 입학일","start":"2026/09/01","end":"2026/09/01"},
  {"title":"수강신청 최종정정, 복수·부전공, 조기졸업, 대체교과목 신청","start":"2026/09/01","end":"2026/09/07"},
  {"title":"신입학 수시모집 원서접수","start":"2026/09/07","end":"2026/09/11"},
  {"title":"수강과목 포기","start":"2026/09/28","end":"2026/09/30"},
  {"title":"수업일수 1/4 (개강 후 19일째)","start":"2026/09/29","end":"2026/09/29"},
  {"title":"학기개시 30일","start":"2026/09/30","end":"2026/09/30"},
  {"title":"수업일수 1/3 (개강 후 25일째)","start":"2026/10/08","end":"2026/10/08"},
  {"title":"중간고사","start":"2026/10/20","end":"2026/10/26"},
  {"title":"수시 실기고사","start":"2026/10/24","end":"2026/10/24"},
  {"title":"개교기념일","start":"2026/10/28","end":"2026/10/28"},
  {"title":"수업일수 1/2 (개강 후 38일째)","start":"2026/10/29","end":"2026/10/29"},
  {"title":"학기개시 60일","start":"2026/10/30","end":"2026/10/30"},
  {"title":"수시 면접고사","start":"2026/10/31","end":"2026/10/31"},
  {"title":"참자녀의 날 (음 10.1)","start":"2026/11/09","end":"2026/11/09"},
  {"title":"수시 합격자 발표","start":"2026/11/25","end":"2026/11/25"},
  {"title":"학기개시 90일","start":"2026/11/29","end":"2026/11/29"},
  {"title":"기말고사","start":"2026/12/08","end":"2026/12/14"},
  {"title":"동계방학/계절학기 시작","start":"2026/12/15","end":"2026/12/15"},
  {"title":"수시 최초합격자 문서등록","start":"2026/12/21","end":"2026/12/23"},
  {"title":"성적공고/이의신청 및 정정","start":"2026/12/22","end":"2026/12/24"},
  {"title":"성탄절","start":"2026/12/25","end":"2026/12/25"},
  {"title":"수시 미등록 충원 마감","start":"2026/12/30","end":"2026/12/30"},
]

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarScreen({ onBack }: CalendarScreenProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 이번 달의 첫 날과 마지막 날
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDay = firstDayOfMonth.getDay()

  // 이전/다음 달로 이동
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  // 날짜 문자열을 Date 객체로 변환
  const parseDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('/').map(Number)
    return new Date(y, m - 1, d)
  }

  // 특정 날짜에 해당하는 이벤트 찾기
  const getEventsForDate = (date: Date) => {
    return academicEvents.filter(event => {
      const start = parseDate(event.start)
      const end = parseDate(event.end)
      return date >= start && date <= end
    })
  }

  // 이번 달의 이벤트 (리스트용)
  const monthEvents = useMemo(() => {
    return academicEvents.filter(event => {
      const start = parseDate(event.start)
      const end = parseDate(event.end)
      return (start.getFullYear() === year && start.getMonth() === month) ||
             (end.getFullYear() === year && end.getMonth() === month) ||
             (start < firstDayOfMonth && end > lastDayOfMonth)
    }).sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime())
  }, [year, month])

  // 선택한 날짜의 이벤트
  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []

  // 날짜에 이벤트가 있는지 확인
  const hasEvents = (day: number) => {
    const date = new Date(year, month, day)
    return getEventsForDate(date).length > 0
  }

  // 오늘인지 확인
  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  // 선택된 날짜인지 확인
  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()
  }

  // 날짜 포맷팅
  const formatEventDate = (event: CalendarEvent) => {
    const start = parseDate(event.start)
    const end = parseDate(event.end)
    const startStr = `${start.getMonth() + 1}.${start.getDate()}(${DAYS[start.getDay()]})`

    if (event.start === event.end) {
      return startStr
    }
    const endStr = `${end.getMonth() + 1}.${end.getDate()}(${DAYS[end.getDay()]})`
    return `${startStr} ~ ${endStr}`
  }

  // 캘린더 그리드 생성
  const calendarDays = []
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
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
        <h1 className="text-lg font-semibold text-foreground">학사일정</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 캘린더 */}
        <div className="p-4">
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            {/* 월 네비게이션 */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary">
              <button
                onClick={goToPrevMonth}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <h2 className="text-lg font-bold text-white">
                {year}.{String(month + 1).padStart(2, '0')}
              </h2>
              <button
                onClick={goToNextMonth}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-border/30">
              {DAYS.map((day, i) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-medium ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => (
                <button
                  key={index}
                  disabled={day === null}
                  onClick={() => day && setSelectedDate(new Date(year, month, day))}
                  className={`aspect-square flex flex-col items-center justify-center relative ${
                    day === null ? '' : 'hover:bg-muted/50 transition-colors'
                  }`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-sm ${
                          isSelected(day)
                            ? 'w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center'
                            : isToday(day)
                            ? 'w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold'
                            : index % 7 === 0
                            ? 'text-red-500'
                            : index % 7 === 6
                            ? 'text-blue-500'
                            : 'text-foreground'
                        }`}
                      >
                        {day}
                      </span>
                      {hasEvents(day) && !isSelected(day) && (
                        <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 선택된 날짜의 일정 */}
        {selectedDate && (
          <div className="px-4 pb-4">
            <div className="bg-card rounded-2xl border border-border/50 p-4">
              <h3 className="font-semibold text-foreground mb-3">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({DAYS[selectedDate.getDay()]})
              </h3>
              {selectedEvents.length > 0 ? (
                <div className="space-y-2">
                  {selectedEvents.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                      <div className="w-1 h-full min-h-[2.5rem] rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{event.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatEventDate(event)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">일정이 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {/* 이번 달 일정 목록 */}
        <div className="px-4 pb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
            {month + 1}월 학사일정
          </h3>
          {monthEvents.length > 0 ? (
            <div className="space-y-2">
              {monthEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="bg-card rounded-xl border border-border/50 p-4"
                  onClick={() => setSelectedDate(parseDate(event.start))}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatEventDate(event)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">이번 달 일정이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
