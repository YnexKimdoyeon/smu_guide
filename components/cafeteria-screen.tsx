'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, UtensilsCrossed, Clock, RefreshCw } from 'lucide-react'
import { cafeteriaAPI } from '@/lib/api'

interface CafeteriaScreenProps {
  onBack: () => void
}

interface DailyMenu {
  date: string
  menus: string[][]
}

interface MenuData {
  cafeteria_name: string
  cafeteria_type: string
  operating_info: string[]
  date_range: string
  menu_categories: string[]
  daily_menus: DailyMenu[]
}

const cafeteriaTypes = [
  { type: 'student', name: '학생회관', color: '#3B82F6' },
  { type: 'orange', name: '오렌지', color: '#F97316' },
  { type: 'staff', name: '교직원', color: '#8B5CF6' },
]

export function CafeteriaScreen({ onBack }: CafeteriaScreenProps) {
  const [selectedType, setSelectedType] = useState('student')
  const [menuData, setMenuData] = useState<MenuData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMenu = async (type: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await cafeteriaAPI.getMenu(type)
      setMenuData(data)
    } catch (err) {
      setError('식단 정보를 불러올 수 없습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMenu(selectedType)
  }, [selectedType])

  const handleRefresh = () => {
    loadMenu(selectedType)
  }

  const getTodayDate = () => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${month}.${day}`
  }

  const todayDate = getTodayDate()

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
          <h1 className="text-lg font-semibold text-foreground">식단 정보</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 식당 탭 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
        <div className="flex gap-2">
          {cafeteriaTypes.map((cafe) => (
            <button
              key={cafe.type}
              onClick={() => setSelectedType(cafe.type)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
                selectedType === cafe.type
                  ? 'text-white shadow-md'
                  : 'bg-card text-muted-foreground border border-border/50 hover:bg-muted'
              }`}
              style={{
                backgroundColor: selectedType === cafe.type ? cafe.color : undefined,
              }}
            >
              {cafe.name}
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm"
            >
              다시 시도
            </button>
          </div>
        ) : menuData ? (
          <div className="p-4 space-y-4">
            {/* 운영 정보 */}
            {menuData.operating_info.length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">운영 정보</span>
                </div>
                <div className="space-y-1">
                  {menuData.operating_info.map((info, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">{info}</p>
                  ))}
                </div>
              </div>
            )}

            {/* 기간 */}
            {menuData.date_range && (
              <p className="text-xs text-muted-foreground text-center">{menuData.date_range}</p>
            )}

            {/* 일별 메뉴 */}
            {menuData.daily_menus.length > 0 ? (
              <div className="space-y-3">
                {menuData.daily_menus.map((day, dayIdx) => {
                  const isToday = day.date.startsWith(todayDate)
                  return (
                    <div
                      key={dayIdx}
                      className={`bg-card rounded-xl border overflow-hidden ${
                        isToday ? 'border-primary ring-2 ring-primary/20' : 'border-border/50'
                      }`}
                    >
                      {/* 날짜 헤더 */}
                      <div className={`px-4 py-2.5 ${isToday ? 'bg-primary text-white' : 'bg-muted/50'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold text-sm ${isToday ? 'text-white' : 'text-foreground'}`}>
                            {day.date}
                          </span>
                          {isToday && (
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">오늘</span>
                          )}
                        </div>
                      </div>

                      {/* 메뉴 내용 */}
                      <div className="p-4">
                        {day.menus.length > 0 && day.menus.some(m => m.length > 0) ? (
                          <div className="grid gap-3" style={{
                            gridTemplateColumns: `repeat(${Math.min(day.menus.filter(m => m.length > 0).length, 3)}, 1fr)`
                          }}>
                            {day.menus.map((menuItems, menuIdx) => {
                              if (menuItems.length === 0) return null
                              const categoryName = menuData.menu_categories[menuIdx] || `메뉴 ${menuIdx + 1}`
                              return (
                                <div key={menuIdx} className="space-y-2">
                                  <p className="text-xs font-medium text-primary px-2 py-1 bg-primary/10 rounded-lg text-center">
                                    {categoryName}
                                  </p>
                                  <div className="space-y-0.5">
                                    {menuItems.map((item, itemIdx) => (
                                      <p key={itemIdx} className="text-xs text-foreground leading-relaxed">
                                        {item}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-2">식단 정보 없음</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <UtensilsCrossed className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">등록된 식단이 없습니다</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
