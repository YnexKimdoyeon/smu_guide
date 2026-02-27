'use client'

import { useState, useEffect } from 'react'
import { AppShell } from './app-shell'
import { scheduleAPI } from '@/lib/api'

interface ScheduleItem {
  id: number
  day: string
  start_time: string
  end_time: string
  subject: string
  professor: string
  room: string
  color: string
}

const days = ['월', '화', '수', '목', '금']
const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

function timeToRow(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - 9) * 2 + (m >= 30 ? 1 : 0)
}

function rowSpan(start: string, end: string): number {
  return timeToRow(end) - timeToRow(start)
}

interface TimetableScreenProps {
  onBack: () => void
}

export function TimetableScreen({ onBack }: TimetableScreenProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const data = await scheduleAPI.getMySchedules()
        setSchedules(data)
      } catch (error) {
        console.error('시간표 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSchedules()
  }, [])

  // 마지막 수업 시간에 맞춰 시간 슬롯 조정
  const getVisibleTimeSlots = () => {
    if (schedules.length === 0) return timeSlots.slice(0, 8)

    let maxEndHour = 17
    schedules.forEach(s => {
      const endHour = parseInt(s.end_time.split(':')[0])
      if (endHour > maxEndHour) maxEndHour = endHour
    })

    const slotsNeeded = Math.min(maxEndHour - 9 + 1, timeSlots.length)
    return timeSlots.slice(0, Math.max(slotsNeeded, 8))
  }

  const visibleTimeSlots = getVisibleTimeSlots()

  if (isLoading) {
    return (
      <AppShell title="내 시간표" onBack={onBack}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="내 시간표" onBack={onBack}>
      <div className="p-4">
        {schedules.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">등록된 시간표가 없습니다</p>
          </div>
        ) : (
          <>
            {/* Timetable Grid */}
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-[48px_repeat(5,1fr)] border-b border-border/50">
                <div className="h-10 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">시간</span>
                </div>
                {days.map((day) => (
                  <div key={day} className="h-10 flex items-center justify-center border-l border-border/30">
                    <span className="text-sm font-semibold text-foreground">{day}</span>
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="grid grid-cols-[48px_repeat(5,1fr)]">
                {/* Time Labels */}
                <div className="flex flex-col">
                  {visibleTimeSlots.map((time) => (
                    <div key={time} className="h-16 flex items-start justify-center pt-1 border-t border-border/20">
                      <span className="text-[10px] text-muted-foreground">{time}</span>
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {days.map((day) => (
                  <div key={day} className="relative border-l border-border/30">
                    {/* Grid lines */}
                    {visibleTimeSlots.map((time) => (
                      <div key={time} className="h-16 border-t border-border/20" />
                    ))}

                    {/* Schedule Items */}
                    {schedules
                      .filter((item) => item.day === day)
                      .map((item) => {
                        const top = timeToRow(item.start_time) * 32
                        const height = rowSpan(item.start_time, item.end_time) * 32
                        return (
                          <div
                            key={item.id}
                            className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 overflow-hidden"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              backgroundColor: item.color + '20',
                              borderLeft: `3px solid ${item.color}`,
                            }}
                          >
                            <p className="text-[10px] font-bold leading-tight" style={{ color: item.color }}>
                              {item.subject}
                            </p>
                            <p className="text-[8px] text-muted-foreground mt-0.5 truncate">
                              {item.room}
                            </p>
                          </div>
                        )
                      })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">수업 목록</h3>
              <div className="flex flex-col gap-2">
                {[...new Map(schedules.map(s => [s.subject, s])).values()].map((item) => (
                  <div key={item.subject} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.subject}</p>
                      <p className="text-xs text-muted-foreground">{item.professor} | {item.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
