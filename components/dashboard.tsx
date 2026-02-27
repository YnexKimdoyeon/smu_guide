'use client'

import { Calendar, MessageCircle, MapPin, Bell, Phone, Users, LogOut, User } from 'lucide-react'
import type { User as UserType } from '@/lib/store'

export type AppId = 'timetable' | 'chat' | 'commute' | 'announcements' | 'phonebook' | 'friends'

interface DashboardProps {
  user: UserType
  onOpenApp: (appId: AppId) => void
  onLogout: () => void
}

const apps: { id: AppId; label: string; icon: typeof Calendar; color: string; bgColor: string }[] = [
  { id: 'timetable', label: '내 시간표', icon: Calendar, color: '#3B82F6', bgColor: '#DBEAFE' },
  { id: 'chat', label: '익명 채팅', icon: MessageCircle, color: '#0EA5E9', bgColor: '#E0F2FE' },
  { id: 'commute', label: '등하교 메이트', icon: MapPin, color: '#10B981', bgColor: '#D1FAE5' },
  { id: 'announcements', label: '공지사항', icon: Bell, color: '#F59E0B', bgColor: '#FEF3C7' },
  { id: 'phonebook', label: '전화번호부', icon: Phone, color: '#8B5CF6', bgColor: '#EDE9FE' },
  { id: 'friends', label: '친구 관리', icon: Users, color: '#EC4899', bgColor: '#FCE7F3' },
]

export function Dashboard({ user, onOpenApp, onLogout }: DashboardProps) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header - 고정 */}
      <header className="flex-shrink-0 px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">{user.name}님({user.studentId})</p>
            <p className="text-xs text-muted-foreground">{user.department}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-sm border border-border hover:bg-muted transition-colors"
          aria-label="로그아웃"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </button>
      </header>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* Welcome Card */}
        <div className="px-5 mb-6">
          <div className="rounded-2xl bg-primary p-5 shadow-lg">
            <p className="text-primary-foreground/80 text-sm font-medium">{'오늘도 즐거운 캠퍼스 생활!'}</p>
            <h2 className="text-primary-foreground text-xl font-bold mt-1">{'선문대학교 가이드'}</h2>
            <p className="text-primary-foreground/70 text-xs mt-2">{'필요한 기능을 선택해주세요'}</p>
          </div>
        </div>

        {/* App Grid */}
        <div className="px-5">
          <div className="grid grid-cols-3 gap-4">
            {apps.map((app) => {
              const Icon = app.icon
              return (
                <button
                  key={app.id}
                  onClick={() => onOpenApp(app.id)}
                  className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card shadow-sm border border-border/50 hover:shadow-md hover:scale-[1.02] active:scale-[0.97] transition-all"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: app.bgColor }}
                  >
                    <Icon className="w-7 h-7" style={{ color: app.color }} />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">
                    {app.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom Branding */}
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">{'Sunmoon University Guide v1.0'}</p>
          <p className="text-xs text-muted-foreground mt-1">{'Developed by (주) 와이넥스'}</p>
        </div>
      </div>
    </div>
  )
}
