'use client'

import { useState, useEffect } from 'react'
import { Search, Phone as PhoneIcon } from 'lucide-react'
import { AppShell } from './app-shell'
import { phonebookAPI } from '@/lib/api'

interface PhoneEntry {
  id: number
  department: string
  name: string
  phone: string
  extension?: string
}

interface PhonebookScreenProps {
  onBack: () => void
}

export function PhonebookScreen({ onBack }: PhonebookScreenProps) {
  const [entries, setEntries] = useState<PhoneEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const data = await phonebookAPI.getEntries()
        setEntries(data)
      } catch (error) {
        console.error('전화번호부 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEntries()
  }, [])

  const filteredEntries = entries.filter(
    (entry) =>
      entry.department.includes(searchQuery) ||
      entry.name.includes(searchQuery) ||
      entry.phone.includes(searchQuery)
  )

  const grouped = filteredEntries.reduce<Record<string, typeof filteredEntries>>((acc, entry) => {
    if (!acc[entry.department]) {
      acc[entry.department] = []
    }
    acc[entry.department].push(entry)
    return acc
  }, {})

  if (isLoading) {
    return (
      <AppShell title="전화번호부" onBack={onBack}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="전화번호부" onBack={onBack}>
      <div className="p-4 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="부서명, 이름, 전화번호 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* Directory */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">검색 결과가 없습니다</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dept, deptEntries]) => (
            <div key={dept}>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wide mb-2 px-1">
                {dept}
              </h3>
              <div className="flex flex-col gap-2">
                {deptEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3.5 bg-card rounded-xl border border-border/50 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.phone}</p>
                    </div>
                    <a
                      href={`tel:${entry.phone}`}
                      className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      aria-label={`${entry.name}에 전화하기`}
                    >
                      <PhoneIcon className="w-4 h-4 text-primary" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  )
}
