'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Lock } from 'lucide-react'
import { gptAPI } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [rid, setRid] = useState(1)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 세션 상태 확인
  useEffect(() => {
    if (isOpen) {
      checkSession()
    }
  }, [isOpen])

  const checkSession = async () => {
    try {
      const status = await gptAPI.getStatus()
      setIsSessionActive(status.active)
      if (!status.active) {
        setShowPasswordModal(true)
      }
    } catch (error) {
      setIsSessionActive(false)
      setShowPasswordModal(true)
    }
  }

  const handleInitSession = async () => {
    if (!password.trim() || isInitializing) return
    setIsInitializing(true)
    try {
      await gptAPI.init(password)
      setIsSessionActive(true)
      setShowPasswordModal(false)
      setPassword('')
      setMessages([{
        role: 'assistant',
        content: '안녕하세요! 선문대 GPT입니다. 무엇이든 물어보세요.'
      }])
    } catch (error: any) {
      alert(error.message || 'GPT 연결에 실패했습니다.')
    } finally {
      setIsInitializing(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await gptAPI.chat(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        rid
      )
      setMessages([...newMessages, { role: 'assistant', content: response.answer }])
      setRid(response.rid)
    } catch (error: any) {
      if (error.message?.includes('세션')) {
        setIsSessionActive(false)
        setShowPasswordModal(true)
      } else {
        setMessages([...newMessages, { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.' }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setShowPasswordModal(false)
  }

  return (
    <>
      {/* 챗봇 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all z-40"
      >
        <MessageCircle className="w-6 h-6 text-primary-foreground" />
      </button>

      {/* 챗봇 창 */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 w-[calc(100%-2rem)] max-w-sm h-[70vh] max-h-[500px] bg-card rounded-2xl shadow-2xl border border-border/50 flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-primary rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">선문 GPT</p>
                <p className="text-[10px] text-white/70">AI 챗봇</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* 비밀번호 입력 모달 */}
          {showPasswordModal && (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">GPT 연결</h3>
              <p className="text-xs text-muted-foreground text-center mb-4">
                선문대 포털 비밀번호를 입력하여<br />GPT에 연결하세요
              </p>
              <input
                type="password"
                placeholder="포털 비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInitSession()}
                className="w-full h-10 px-4 rounded-xl bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
              />
              <button
                onClick={handleInitSession}
                disabled={!password.trim() || isInitializing}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    연결 중...
                  </>
                ) : (
                  '연결하기'
                )}
              </button>
            </div>
          )}

          {/* 메시지 영역 */}
          {!showPasswordModal && (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-3">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">무엇이든 물어보세요!</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-md'
                            : 'bg-secondary text-foreground rounded-tl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="self-start">
                      <div className="px-3 py-2 rounded-2xl rounded-tl-md bg-secondary">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* 입력창 */}
              <div className="p-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="메시지를 입력하세요..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={isLoading}
                    className="flex-1 h-10 px-4 rounded-full bg-secondary border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
