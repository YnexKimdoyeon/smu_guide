'use client'

import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface AppShellProps {
  title: string
  onBack: () => void
  children: ReactNode
  headerRight?: ReactNode
}

export function AppShell({ title, onBack, children, headerRight }: AppShellProps) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col animate-in slide-in-from-right-4 duration-300">
      {/* Header - 항상 고정 */}
      <header className="flex-shrink-0 z-10 bg-card/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">{title}</h1>
        {headerRight && <div>{headerRight}</div>}
      </header>

      {/* Content - 내부만 스크롤 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
