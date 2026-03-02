'use client'

import { useState, useEffect } from 'react'
import { Bus, RefreshCw, Info, MapPin } from 'lucide-react'
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
  const [notice, setNotice] = useState<string>('')
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

  const fetchSchedule = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await shuttleAPI.getSchedule(dayType, selectedRoute)
      setTableHtml(data.table_html || '')
      setRouteInfo(data.route_info || '')
      setNotice(data.notice || '')
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

        {/* 새로고침 버튼 */}
        <div className="px-4 py-2">
          <button
            onClick={fetchSchedule}
            disabled={isLoading}
            className="w-full h-9 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* 시간표 테이블 */}
        <div className="px-4 pb-4">
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
              className="shuttle-table-container bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden"
              dangerouslySetInnerHTML={{ __html: tableHtml }}
            />
          )}
        </div>

        {/* 안내사항 */}
        {notice && (
          <div className="px-4 pb-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed whitespace-pre-line">
                  {notice}
                </div>
              </div>
            </div>
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
        .shuttle-table-container table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .shuttle-table-container thead {
          background: hsl(var(--primary) / 0.1);
        }
        .shuttle-table-container th,
        .shuttle-table-container td {
          padding: 6px 4px;
          text-align: center;
          border: 1px solid hsl(var(--border) / 0.3);
          white-space: nowrap;
        }
        .shuttle-table-container th {
          font-weight: 600;
          color: hsl(var(--foreground));
        }
        .shuttle-table-container td {
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
