'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Award, RefreshCw, Info } from 'lucide-react'
import { scholarshipAPI } from '@/lib/api'

interface ScholarshipScreenProps {
  onBack: () => void
}

interface MileageData {
  s_subject: number
  s_self_diagnosis: number
  s_career_counseling: number
  s_certification: number
  s_extracurricular: number
  s_total: number
  t_subject: number
  t_awards: number
  t_extracurricular: number
  t_total: number
  a_subject: number
  a_volunteer: number
  a_language_test: number
  a_language_training: number
  a_internship: number
  a_extracurricular: number
  a_total: number
  r_subject: number
  r_student_council: number
  r_club: number
  r_extracurricular: number
  r_total: number
  total: number
}

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]

export function ScholarshipScreen({ onBack }: ScholarshipScreenProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [mileageData, setMileageData] = useState<MileageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMileage = async (year: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await scholarshipAPI.getMileage(year)
      setMileageData(result.data)
    } catch (err: any) {
      setError(err.message || '마일리지 정보를 불러올 수 없습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMileage(selectedYear)
  }, [selectedYear])

  const handleRefresh = () => {
    loadMileage(selectedYear)
  }

  const calculateScholarship = (total: number) => {
    if (total < 100) return 0
    return Math.floor(total / 10) * 10000
  }

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
          <h1 className="text-lg font-semibold text-foreground">마일리지 조회</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 연도 선택 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
        <div className="flex gap-2">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
                selectedYear === year
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-card text-muted-foreground border border-border/50 hover:bg-muted'
              }`}
            >
              {year}년
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* 안내 문구 */}
        <div className="px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 space-y-1">
              <p>100점 이상부터 10점당 1만원으로 환산되어 장학금이 입금됩니다.</p>
              <p>4학년은 장학금 지급이 되지 않습니다.</p>
              <p>높은 점수의 장학생 순서대로 장학금이 지급됩니다. 점수가 낮을 경우 예산상의 이유로 장학금 지급이 되지 않을 수도 있습니다.</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <Award className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm"
            >
              다시 시도
            </button>
          </div>
        ) : mileageData ? (
          <div className="p-4 space-y-4">
            {/* 총점 카드 */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">총 마일리지</p>
                  <p className="text-4xl font-bold mt-1">{mileageData.total}점</p>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Award className="w-8 h-8" />
                </div>
              </div>
              {mileageData.total >= 100 && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-amber-100 text-sm">예상 장학금</p>
                  <p className="text-2xl font-bold">{calculateScholarship(mileageData.total).toLocaleString()}원</p>
                </div>
              )}
            </div>

            {/* STAR 카테고리별 점수 */}
            <div className="grid grid-cols-2 gap-3">
              {/* S */}
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-blue-500">S</span>
                  <span className="text-lg font-semibold text-foreground">{mileageData.s_total}점</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">교과목</span>
                    <span className="text-foreground">{mileageData.s_subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">자기진단</span>
                    <span className="text-foreground">{mileageData.s_self_diagnosis}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">취업상담</span>
                    <span className="text-foreground">{mileageData.s_career_counseling}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">자격증취득</span>
                    <span className="text-foreground">{mileageData.s_certification}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">비교과활동</span>
                    <span className="text-foreground">{mileageData.s_extracurricular}</span>
                  </div>
                </div>
              </div>

              {/* T */}
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-green-500">T</span>
                  <span className="text-lg font-semibold text-foreground">{mileageData.t_total}점</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">교과목</span>
                    <span className="text-foreground">{mileageData.t_subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">수상경력</span>
                    <span className="text-foreground">{mileageData.t_awards}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">비교과활동</span>
                    <span className="text-foreground">{mileageData.t_extracurricular}</span>
                  </div>
                </div>
              </div>

              {/* A */}
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-purple-500">A</span>
                  <span className="text-lg font-semibold text-foreground">{mileageData.a_total}점</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">교과목</span>
                    <span className="text-foreground">{mileageData.a_subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">봉사활동</span>
                    <span className="text-foreground">{mileageData.a_volunteer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">어학시험</span>
                    <span className="text-foreground">{mileageData.a_language_test}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">어학연수</span>
                    <span className="text-foreground">{mileageData.a_language_training}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">현장실습·인턴십</span>
                    <span className="text-foreground">{mileageData.a_internship}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">비교과활동</span>
                    <span className="text-foreground">{mileageData.a_extracurricular}</span>
                  </div>
                </div>
              </div>

              {/* R */}
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-red-500">R</span>
                  <span className="text-lg font-semibold text-foreground">{mileageData.r_total}점</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">교과목</span>
                    <span className="text-foreground">{mileageData.r_subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">학생회활동</span>
                    <span className="text-foreground">{mileageData.r_student_council}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">동아리활동</span>
                    <span className="text-foreground">{mileageData.r_club}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">비교과활동</span>
                    <span className="text-foreground">{mileageData.r_extracurricular}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </div>
  )
}
