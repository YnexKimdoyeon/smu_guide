'use client'

import { useState, useEffect } from 'react'
import { Search, Phone as PhoneIcon, MapPin, Building2, Landmark, ChevronDown, ChevronRight } from 'lucide-react'
import { AppShell } from './app-shell'
import { phonebookAPI } from '@/lib/api'

interface PhoneEntry {
  id: number
  category: string
  department: string
  name: string
  phone: string
  location?: string
  fax?: string
}

interface PhonebookScreenProps {
  onBack: () => void
}

type TabType = 'dept' | 'admin'

export function PhonebookScreen({ onBack }: PhonebookScreenProps) {
  const [entries, setEntries] = useState<PhoneEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('dept')
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true)
      try {
        const data = await phonebookAPI.getEntries('', activeTab)
        setEntries(data)
        // 첫 번째 부서 자동 펼치기
        if (data.length > 0) {
          const firstDept = data[0].department
          setExpandedDepts(new Set([firstDept]))
        }
      } catch (error) {
        console.error('전화번호부 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEntries()
  }, [activeTab])

  const filteredEntries = entries.filter(
    (entry) =>
      entry.department.includes(searchQuery) ||
      entry.name.includes(searchQuery) ||
      entry.phone.includes(searchQuery)
  )

  const grouped = filteredEntries.reduce<Record<string, PhoneEntry[]>>((acc, entry) => {
    if (!acc[entry.department]) {
      acc[entry.department] = []
    }
    acc[entry.department].push(entry)
    return acc
  }, {})

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dept)) {
        newSet.delete(dept)
      } else {
        newSet.add(dept)
      }
      return newSet
    })
  }

  const formatPhoneForCall = (phone: string) => {
    // 첫 번째 전화번호만 추출 (콤마로 구분된 경우)
    const firstPhone = phone.split(',')[0].trim()
    // 041-530- 접두사 추가
    if (firstPhone.startsWith('530-')) {
      return `tel:041-${firstPhone}`
    }
    return `tel:041-530-${firstPhone.replace(/[^0-9]/g, '')}`
  }

  const formatPhoneDisplay = (phone: string) => {
    // 전화번호 표시용 - 041- 접두사 추가
    return phone.split(',').map(p => {
      const trimmed = p.trim()
      if (trimmed.startsWith('530-')) {
        return `041-${trimmed}`
      }
      return `041-530-${trimmed}`
    }).join(', ')
  }

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
      <div className="flex flex-col">
        {/* 탭 */}
        <div className="flex border-b border-border/50 px-2 bg-card/50">
          <button
            onClick={() => setActiveTab('dept')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'dept'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="w-4 h-4" />
            학과 및 단대
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'admin'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Landmark className="w-4 h-4" />
            행정부서
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === 'dept' ? "학과명, 전공, 전화번호 검색" : "부서명, 담당업무, 전화번호 검색"}
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
            <div className="flex flex-col gap-3">
              {Object.entries(grouped).map(([dept, deptEntries]) => {
                const isExpanded = expandedDepts.has(dept)
                return (
                  <div key={dept} className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                    {/* 부서 헤더 */}
                    <button
                      onClick={() => toggleDept(dept)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          {activeTab === 'dept' ? (
                            <Building2 className="w-4 h-4 text-primary" />
                          ) : (
                            <Landmark className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground">{dept}</span>
                        <span className="text-xs text-muted-foreground">({deptEntries.length})</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* 연락처 목록 */}
                    {isExpanded && (
                      <div className="divide-y divide-border/30">
                        {deptEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="px-4 py-3 flex items-start justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                              <div className="flex flex-col gap-1 mt-1">
                                <p className="text-xs text-primary font-medium">{formatPhoneDisplay(entry.phone)}</p>
                                {activeTab === 'dept' && entry.location && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{entry.location}</span>
                                  </div>
                                )}
                                {activeTab === 'admin' && entry.fax && (
                                  <p className="text-xs text-muted-foreground">
                                    FAX: {entry.fax}
                                  </p>
                                )}
                              </div>
                            </div>
                            <a
                              href={formatPhoneForCall(entry.phone)}
                              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95 flex-shrink-0"
                              aria-label={`${entry.name}에 전화하기`}
                            >
                              <PhoneIcon className="w-4 h-4 text-primary-foreground" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
