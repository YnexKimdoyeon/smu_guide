'use client'

import { useState, useEffect } from 'react'
import { Bus, MapPin, Calendar, AlertTriangle } from 'lucide-react'
import { AppShell } from './app-shell'
import { shuttleAPI } from '@/lib/api'

interface ShuttleScreenProps {
  onBack: () => void
}

type DayType = 'weekday' | 'saturday' | 'sunday'

interface RouteInfo {
  id: string
  name: string
  dayTypes: DayType[]
}

interface NoticeData {
  holidays: string[]
  bus_info: string[]
  general: string[]
}

const ROUTES: RouteInfo[] = [
  { id: 'asan_ktx', name: '아산(KTX)역', dayTypes: ['weekday', 'saturday', 'sunday'] },
  { id: 'cheonan_station', name: '천안역', dayTypes: ['weekday', 'saturday', 'sunday'] },
  { id: 'cheonan_terminal', name: '천안터미널', dayTypes: ['weekday', 'saturday', 'sunday'] },
  { id: 'onyang', name: '온양역/터미널', dayTypes: ['weekday'] },
  { id: 'cheonan_campus', name: '천안캠퍼스', dayTypes: ['weekday'] },
]

const DAY_LABELS: Record<DayType, string> = {
  weekday: '평일',
  saturday: '토요일/공휴일',
  sunday: '일요일',
}

export function ShuttleScreen({ onBack }: ShuttleScreenProps) {
  const [dayType, setDayType] = useState<DayType>('weekday')
  const [selectedRoute, setSelectedRoute] = useState<string>('cheonan_station')
  const [tableHtml, setTableHtml] = useState<string>('')
  const [routeInfo, setRouteInfo] = useState<string>('')
  const [notice, setNotice] = useState<NoticeData>({ holidays: [], bus_info: [], general: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 해당 요일 타입에서 사용 가능한 노선 필터링
  const availableRoutes = ROUTES.filter(r => r.dayTypes.includes(dayType))

  // 요일 타입 변경 시 선택된 노선이 없으면 첫 번째 노선 선택
  useEffect(() => {
    if (!availableRoutes.find(r => r.id === selectedRoute)) {
      setSelectedRoute(availableRoutes[0]?.id || 'cheonan_station')
    }
  }, [dayType])

  // 안내사항 문자열을 섹션별로 파싱
  const parseNotice = (noticeText: string): NoticeData => {
    const holidays: string[] = []
    const bus_info: string[] = []
    const general: string[] = []
    const seen = new Set<string>()

    if (!noticeText) return { holidays, bus_info, general }

    // *로 시작하는 항목 (공휴일 안내)
    const holidayMatches = noticeText.match(/\*[^*\n]+/g) || []
    holidayMatches.forEach(match => {
      const item = match.trim()
      if (item && !seen.has(item)) {
        holidays.push(item)
        seen.add(item)
      }
    })

    // - 로 시작하는 항목
    const dashMatches = noticeText.match(/-\s*[^-\n]+/g) || []
    dashMatches.forEach(match => {
      const item = match.trim()
      if (item && !seen.has(item)) {
        // 시내버스 관련
        if (item.includes('번') && (item.includes('터미널') || item.includes('역') || item.includes('환승'))) {
          bus_info.push(item)
        } else {
          general.push(item)
        }
        seen.add(item)
      }
    })

    return {
      holidays: holidays.slice(0, 10),
      bus_info: bus_info.slice(0, 10),
      general: general.slice(0, 10)
    }
  }

  const fetchSchedule = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await shuttleAPI.getSchedule(dayType, selectedRoute)
      setTableHtml(data.table_html || '')
      setRouteInfo(data.route_info || '')
      // notice가 문자열이면 파싱, 객체면 그대로 사용
      if (typeof data.notice === 'string') {
        setNotice(parseNotice(data.notice))
      } else if (data.notice && typeof data.notice === 'object') {
        setNotice(data.notice)
      } else {
        setNotice({ holidays: [], bus_info: [], general: [] })
      }
    } catch (err) {
      console.error('셔틀 시간표 로드 실패:', err)
      setError('시간표를 불러오는데 실패했습니다.')
      setTableHtml('')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [dayType, selectedRoute])

  return (
    <AppShell title="셔틀버스" onBack={onBack}>
      <div className="flex flex-col">
        {/* 요일 타입 탭 */}
        <div className="flex border-b border-border/50 px-2 bg-card/50">
          {(['weekday', 'saturday', 'sunday'] as DayType[]).map((dt) => (
            <button
              key={dt}
              onClick={() => setDayType(dt)}
              className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${
                dayType === dt
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {DAY_LABELS[dt]}
            </button>
          ))}
        </div>

        {/* 노선 선택 */}
        <div className="px-4 py-3 bg-card/30 border-b border-border/30">
          <div className="flex flex-wrap gap-2">
            {availableRoutes.map((route) => (
              <button
                key={route.id}
                onClick={() => setSelectedRoute(route.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedRoute === route.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-muted'
                }`}
              >
                {route.name}
              </button>
            ))}
          </div>
        </div>

        {/* 노선 정보 */}
        {routeInfo && (
          <div className="px-4 py-3 bg-primary/5 border-b border-border/30">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed">{routeInfo}</p>
            </div>
          </div>
        )}

        {/* 시간표 테이블 */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Bus className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          ) : !tableHtml ? (
            <div className="text-center py-12">
              <Bus className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">시간표 정보가 없습니다</p>
            </div>
          ) : (
            <div
              className="shuttle-table-container bg-card rounded-xl border border-border/50 shadow-sm overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: tableHtml }}
            />
          )}
        </div>

        {/* 안내사항 */}
        {(notice.holidays.length > 0 || notice.bus_info.length > 0 || notice.general.length > 0) && (
          <div className="px-4 pb-4 space-y-3">
            {/* 공휴일 운행 안내 */}
            {notice.holidays.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">공휴일 운행 안내</p>
                    <ul className="space-y-1">
                      {notice.holidays.map((item, idx) => (
                        <li key={idx} className="text-xs text-red-600 dark:text-red-200 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 시내버스 정보 */}
            {notice.bus_info.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Bus className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">시내버스 정보</p>
                    <ul className="space-y-1">
                      {notice.bus_info.map((item, idx) => (
                        <li key={idx} className="text-xs text-blue-600 dark:text-blue-200 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 일반 안내사항 */}
            {notice.general.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">안내사항</p>
                    <ul className="space-y-1">
                      {notice.general.map((item, idx) => (
                        <li key={idx} className="text-xs text-amber-600 dark:text-amber-200 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 범례 */}
        <div className="px-4 pb-6">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-yellow-200 dark:bg-yellow-600 border border-yellow-300 dark:border-yellow-500" />
              <span>학생회관 승차 가능</span>
            </div>
          </div>
        </div>
      </div>

      {/* 테이블 스타일 */}
      <style jsx global>{`
        .shuttle-table-container {
          -webkit-overflow-scrolling: touch;
        }
        .shuttle-table-container table {
          min-width: max-content;
          border-collapse: collapse;
          font-size: 11px;
        }
        .shuttle-table-container thead {
          background: hsl(var(--primary) / 0.1);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .shuttle-table-container th {
          padding: 8px 10px;
          text-align: center;
          border: 1px solid hsl(var(--border) / 0.3);
          white-space: nowrap;
          font-weight: 600;
          color: hsl(var(--foreground));
          background: hsl(var(--primary) / 0.1);
        }
        .shuttle-table-container td {
          padding: 6px 8px;
          text-align: center;
          border: 1px solid hsl(var(--border) / 0.3);
          white-space: nowrap;
          color: hsl(var(--foreground));
        }
        .shuttle-table-container tbody tr:nth-child(even) {
          background: hsl(var(--muted) / 0.3);
        }
        .shuttle-table-container span[style*="background-color: rgb(255, 255, 0)"],
        .shuttle-table-container span[style*="background-color:rgb(255, 255, 0)"] {
          background-color: rgb(254 240 138) !important;
          padding: 1px 4px;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .shuttle-table-container span[style*="background-color: rgb(255, 255, 0)"],
          .shuttle-table-container span[style*="background-color:rgb(255, 255, 0)"] {
            background-color: rgb(202 138 4) !important;
            color: white;
          }
        }
      `}</style>
    </AppShell>
  )
}
