'use client'

import { useState } from 'react'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'

interface LoginScreenProps {
  onLogin: (studentId: string, password: string) => Promise<{ success: boolean; error?: string }>
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId || !password) {
      setError('학번과 비밀번호를 입력해주세요.')
      return
    }
    setIsLoading(true)
    setError('')

    const result = await onLogin(studentId, password)

    if (!result.success) {
      setError(result.error || '로그인에 실패했습니다.')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <GraduationCap className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">
              {'선문대학교 가이드'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {'캠퍼스 생활의 모든 것'}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="studentId" className="text-sm font-medium text-foreground">
              {'선문대 포털 ID'}
            </label>
            <input
              id="studentId"
              type="text"
              placeholder="포털 아이디를 입력하세요"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              {'선문대 포털 비밀번호'}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-md"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {'선문대 로그인 중...'}
              </span>
            ) : (
              '선문대 계정으로 로그인'
            )}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {'선문대학교 종합정보시스템 계정으로 로그인됩니다'}
        </p>

        <p className="text-xs text-muted-foreground text-center mt-6">
          {'Sunmoon University Guide v1.0'}
          <br />
          {'Developed by (주) 와이넥스'}
        </p>
      </div>
    </div>
  )
}
