'use client'

import { useState, useEffect } from 'react'
import { Bus, RefreshCw, Info, Clock, MapPin } from 'lucide-react'
import { AppShell } from './app-shell'
import { shuttleAPI } from '@/lib/api'

interface ShuttleSchedule {
  seq: number
  departure_campus?: string
  departure_station?: string
  intermediate_stop1?: string
  intermediate_stop2?: string
  arrival_campus?: string
  note?: string
}

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
  const [schedule, setSchedule] = useState<ShuttleSchedule[]>([])
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
      setSchedule(data.schedule || [])
      setRouteInfo(data.route_info || '')
      setNotice(data.notice || '')
    } catch (err) {
      console.error('셔틀 시간표 로드 실패:', err)
      setError('시간표를 불러오는데 실패했습니다.')
      setSchedule([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [dayType, selectedRoute])

  // 컬럼 헤더 결정
  const getColumnHeaders = () => {
    // 노선에 따라 컬럼 구성 변경
    switch (selectedRoute) {
      case 'cheonan_station':
        return ['순번', '캠퍼스 출발', '천안역 출발', '중간 경유', '캠퍼스 도착', '비고']
      case 'asan_ktx':
        return ['순번', '캠퍼스 출발', '아산역 출발', '중간 경유', '캠퍼스 도착', '비고']
      case 'cheonan_terminal':
        return ['순번', '캠퍼스 출발', '터미널 출발', '중간 경유', '캠퍼스 도착', '비고']
      case 'onyang':
        return ['순번', '캠퍼스 출발', '온양 출발', '중간 경유', '캠퍼스 도착', '비고']
      case 'cheonan_campus':
        return ['순번', '아산캠퍼스 출발', '천안캠퍼스 출발', '아산캠퍼스 도착', '비고']
      default:
        return ['순번', '캠퍼스 출발', '역/터미널 출발', '중간 경유', '캠퍼스 도착', '비고']
    }
  }

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
          ) : schedule.length === 0 ? (
            <div className="text-center py-12">
              <Bus className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">시간표 정보가 없습니다</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-primary/10">
                      {getColumnHeaders().map((header, idx) => (
                        <th
                          key={idx}
                          className="px-2 py-2.5 text-center font-semibold text-foreground whitespace-nowrap border-b border-border/30"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'} ${
                          item.note?.includes('학생회관') ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                        }`}
                      >
                        <td className="px-2 py-2 text-center text-muted-foreground border-b border-border/20">
                          {item.seq}
                        </td>
                        <td className="px-2 py-2 text-center font-medium text-foreground border-b border-border/20 whitespace-nowrap">
                          {item.departure_campus || '-'}
                        </td>
                        <td className="px-2 py-2 text-center font-medium text-primary border-b border-border/20 whitespace-nowrap">
                          {item.departure_station || '-'}
                        </td>
                        {selectedRoute !== 'cheonan_campus' && (
                          <td className="px-2 py-2 text-center text-muted-foreground border-b border-border/20 whitespace-nowrap">
                            {item.intermediate_stop1 || '-'}
                          </td>
                        )}
                        <td className="px-2 py-2 text-center text-foreground border-b border-border/20 whitespace-nowrap">
                          {item.arrival_campus || '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-muted-foreground border-b border-border/20 whitespace-nowrap">
                          {item.note || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
              <div className="w-4 h-4 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800" />
              <span>학생회관 승차 가능</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>시간은 교통상황에 따라 변동될 수 있습니다</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
