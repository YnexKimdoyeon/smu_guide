'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, CalendarDays, Bell, Phone, Building2 } from 'lucide-react'

type SubAppId = 'academic-calendar' | 'announcements' | 'phonebook'

interface SunmoonInfoScreenProps {
  onBack: () => void
  onOpenSubApp: (appId: SubAppId) => void
}

const subApps: { id: SubAppId; label: string; icon: typeof CalendarDays; color: string; bgColor: string; description: string }[] = [
  {
    id: 'academic-calendar',
    label: '학사일정',
    icon: CalendarDays,
    color: '#14B8A6',
    bgColor: '#CCFBF1',
    description: '학기별 주요 일정 확인'
  },
  {
    id: 'announcements',
    label: '공지사항',
    icon: Bell,
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    description: '학교 공지사항 확인'
  },
  {
    id: 'phonebook',
    label: '전화번호부',
    icon: Phone,
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    description: '학교 연락처 검색'
  },
]

export function SunmoonInfoScreen({ onBack, onOpenSubApp }: SunmoonInfoScreenProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [visibleItems, setVisibleItems] = useState<number[]>([])

  useEffect(() => {
    // 화면 진입 시 순차적으로 아이콘 표시
    setIsAnimating(true)

    subApps.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, index])
      }, 100 + index * 150)
    })

    return () => {
      setVisibleItems([])
    }
  }, [])

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
        <h1 className="text-lg font-semibold text-foreground">선문대 정보</h1>
      </header>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          {/* 헤더 카드 */}
          <div
            className={`bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 mb-6 shadow-lg transform transition-all duration-500 ${
              isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-white text-lg font-bold">선문대학교</h2>
                <p className="text-white/70 text-sm">SUN MOON UNIVERSITY</p>
              </div>
            </div>
            <p className="text-white/80 text-sm mt-3">
              학교 정보와 서비스를 한 곳에서 확인하세요
            </p>
          </div>

          {/* 서브 앱 그리드 */}
          <div className="space-y-3">
            {subApps.map((app, index) => {
              const Icon = app.icon
              const isVisible = visibleItems.includes(index)

              return (
                <button
                  key={app.id}
                  onClick={() => onOpenSubApp(app.id)}
                  className={`w-full bg-card rounded-2xl p-4 border border-border/50
                    flex items-center gap-4 text-left
                    hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                    transform transition-all duration-300 ease-out
                    ${isVisible
                      ? 'translate-x-0 opacity-100'
                      : 'translate-x-8 opacity-0'
                    }`}
                  style={{
                    transitionDelay: isVisible ? '0ms' : `${index * 100}ms`
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transform transition-transform duration-300 hover:rotate-6"
                    style={{ backgroundColor: app.bgColor }}
                  >
                    <Icon className="w-7 h-7" style={{ color: app.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-base">
                      {app.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {app.description}
                    </p>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: app.bgColor }}
                  >
                    <svg
                      className="w-4 h-4"
                      style={{ color: app.color }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 추가 정보 */}
          <div className={`mt-6 p-4 bg-muted/50 rounded-xl transform transition-all duration-500 delay-500 ${
            visibleItems.length === subApps.length ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <p className="text-xs text-muted-foreground text-center">
              선문대학교 주소: 충남 아산시 탕정면 선문로 221번길 70
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              대표전화: 041-530-2114
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
