'use client'

import { useState, useEffect } from 'react'
import { AppShell } from './app-shell'
import { announcementAPI } from '@/lib/api'
import { User, Calendar, Eye, ExternalLink } from 'lucide-react'

interface Announcement {
  id: number
  notice_no: number | null
  title: string
  content: string | null
  category: string
  writer: string | null
  notice_date: string | null
  views: number
  external_url: string | null
  is_new: number
  created_at: string
}

interface AnnouncementsScreenProps {
  onBack: () => void
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  '학사': { bg: '#DBEAFE', text: '#3B82F6' },
  '일반': { bg: '#E2E8F0', text: '#64748B' },
  '장학': { bg: '#D1FAE5', text: '#10B981' },
  '행사': { bg: '#FEF3C7', text: '#F59E0B' },
  '취업': { bg: '#FCE7F3', text: '#EC4899' },
}

export function AnnouncementsScreen({ onBack }: AnnouncementsScreenProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const data = await announcementAPI.getAnnouncements()
        setAnnouncements(data)
      } catch (error) {
        console.error('공지사항 로딩 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAnnouncements()
  }, [])

  const handleAnnouncementClick = async (announcement: Announcement) => {
    // 이미 content가 있으면 바로 보여줌
    if (announcement.content) {
      setSelectedAnnouncement(announcement)
      return
    }

    // content가 없으면 상세 조회
    setIsLoadingDetail(true)
    try {
      const detail = await announcementAPI.getAnnouncement(announcement.id)
      setSelectedAnnouncement(detail)
    } catch (error) {
      console.error('공지사항 상세 로딩 실패:', error)
      // 상세 로딩 실패해도 외부 URL이 있으면 열기
      if (announcement.external_url) {
        window.open(announcement.external_url, '_blank')
      }
    } finally {
      setIsLoadingDetail(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell title="공지사항" onBack={onBack}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  // 상세 화면
  if (selectedAnnouncement) {
    const colors = categoryColors[selectedAnnouncement.category] || categoryColors['일반']

    return (
      <AppShell
        title="공지사항"
        onBack={() => setSelectedAnnouncement(null)}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 정보 */}
          <div className="p-4 bg-card border-b border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {selectedAnnouncement.category}
              </span>
              {selectedAnnouncement.is_new === 1 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                  NEW
                </span>
              )}
            </div>
            <h1 className="text-base font-bold text-foreground leading-snug mb-3">
              {selectedAnnouncement.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {selectedAnnouncement.writer && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{selectedAnnouncement.writer}</span>
                </div>
              )}
              {selectedAnnouncement.notice_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{selectedAnnouncement.notice_date}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>{selectedAnnouncement.views.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="flex-1 overflow-auto p-4">
            {selectedAnnouncement.content ? (
              <div
                className="prose prose-sm max-w-none text-foreground
                  prose-headings:text-foreground prose-p:text-foreground
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-img:rounded-lg prose-img:max-w-full prose-img:h-auto
                  prose-table:text-sm prose-th:bg-muted prose-td:border-border
                  [&_img]:!max-w-full [&_img]:!h-auto
                  [&_table]:w-full [&_table]:border-collapse
                  [&_td]:p-2 [&_td]:border [&_td]:border-border
                  [&_th]:p-2 [&_th]:border [&_th]:border-border"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">내용을 불러올 수 없습니다</p>
                {selectedAnnouncement.external_url && (
                  <button
                    onClick={() => window.open(selectedAnnouncement.external_url!, '_blank')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    원문 보기
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </AppShell>
    )
  }

  // 목록 화면
  return (
    <AppShell title="공지사항" onBack={onBack}>
      <div className="p-4 flex flex-col gap-3">
        {isLoadingDetail && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {announcements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">공지사항이 없습니다</p>
          </div>
        ) : (
          announcements.map((item) => {
            const colors = categoryColors[item.category] || categoryColors['일반']
            return (
              <button
                key={item.id}
                onClick={() => handleAnnouncementClick(item)}
                className="w-full text-left p-4 bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {item.category}
                      </span>
                      {item.is_new === 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {item.writer && <span>{item.writer}</span>}
                      {item.notice_date && <span>{item.notice_date}</span>}
                      <span>조회 {item.views.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
