'use client'

import { useState } from 'react'
import { X, Nut, Palette, Tag, Check } from 'lucide-react'
import { dotoriAPI } from '@/lib/api'

interface DotoriShopProps {
  isOpen: boolean
  onClose: () => void
  dotoriPoint: number
  currentColor: string | null
  currentTitle: string | null
  onPurchaseComplete: (newPoint: number, itemType: string, itemValue: string) => void
}

// 미리 정의된 색상 팔레트
const colorPalette = [
  { name: '빨강', value: '#E53935' },
  { name: '주황', value: '#FB8C00' },
  { name: '노랑', value: '#FDD835' },
  { name: '초록', value: '#43A047' },
  { name: '파랑', value: '#1E88E5' },
  { name: '남색', value: '#3949AB' },
  { name: '보라', value: '#8E24AA' },
  { name: '분홍', value: '#D81B60' },
  { name: '청록', value: '#00ACC1' },
  { name: '라임', value: '#7CB342' },
  { name: '갈색', value: '#6D4C41' },
  { name: '회색', value: '#757575' },
]

// 가격
const PRICE_COLOR = 200
const PRICE_TITLE = 300

export function DotoriShop({
  isOpen,
  onClose,
  dotoriPoint,
  currentColor,
  currentTitle,
  onPurchaseComplete,
}: DotoriShopProps) {
  const [selectedTab, setSelectedTab] = useState<'color' | 'title'>('color')
  const [selectedColor, setSelectedColor] = useState<string>(currentColor || '')
  const [customTitle, setCustomTitle] = useState<string>(currentTitle || '')
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const canPurchaseColor = dotoriPoint >= PRICE_COLOR
  const canPurchaseTitle = dotoriPoint >= PRICE_TITLE

  const handlePurchase = async () => {
    if (isPurchasing) return
    setError(null)
    setIsPurchasing(true)

    try {
      if (selectedTab === 'color') {
        if (!selectedColor) {
          setError('색상을 선택해주세요')
          setIsPurchasing(false)
          return
        }
        if (!canPurchaseColor) {
          setError('도토리가 부족합니다')
          setIsPurchasing(false)
          return
        }

        const result = await dotoriAPI.purchaseItem('nickname_color', selectedColor)
        if (result.success) {
          onPurchaseComplete(result.remaining_point, 'nickname_color', selectedColor)
          alert(result.message)
          onClose()
        } else {
          setError(result.message)
        }
      } else {
        if (!customTitle.trim()) {
          setError('칭호를 입력해주세요')
          setIsPurchasing(false)
          return
        }
        if (customTitle.trim().length > 3) {
          setError('칭호는 3글자 이하여야 합니다')
          setIsPurchasing(false)
          return
        }
        if (!canPurchaseTitle) {
          setError('도토리가 부족합니다')
          setIsPurchasing(false)
          return
        }

        const result = await dotoriAPI.purchaseItem('title', customTitle.trim())
        if (result.success) {
          onPurchaseComplete(result.remaining_point, 'title', customTitle.trim())
          alert(result.message)
          onClose()
        } else {
          setError(result.message)
        }
      }
    } catch (err: any) {
      setError(err.message || '구매 실패')
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h2 className="text-lg font-bold text-foreground">도토리 상점</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-100 px-3 py-1.5 rounded-full">
              <Nut className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-bold text-amber-800">{dotoriPoint}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => { setSelectedTab('color'); setError(null) }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              selectedTab === 'color'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Palette className="w-4 h-4" />
            닉네임 색상
            <span className="text-xs opacity-70">({PRICE_COLOR})</span>
          </button>
          <button
            onClick={() => { setSelectedTab('title'); setError(null) }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              selectedTab === 'title'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tag className="w-4 h-4" />
            칭호
            <span className="text-xs opacity-70">({PRICE_TITLE})</span>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-4">
          {selectedTab === 'color' ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                채팅에서 표시되는 닉네임 색상을 변경합니다.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {colorPalette.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                      selectedColor === color.value
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full shadow-sm relative"
                      style={{ backgroundColor: color.value }}
                    >
                      {selectedColor === color.value && (
                        <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{color.name}</span>
                  </button>
                ))}
              </div>

              {/* 현재 색상 표시 */}
              {currentColor && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>현재 색상:</span>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: currentColor }}
                  />
                </div>
              )}

              {/* 미리보기 */}
              {selectedColor && (
                <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">미리보기</p>
                  <p className="text-sm font-medium" style={{ color: selectedColor }}>
                    익명123
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                채팅에서 닉네임 앞에 표시되는 칭호를 설정합니다.
              </p>
              <input
                type="text"
                maxLength={3}
                placeholder="칭호 입력 (3글자 이하)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-[10px] text-muted-foreground mt-2 text-right">
                {customTitle.length}/3
              </p>

              {/* 현재 칭호 표시 */}
              {currentTitle && (
                <div className="mt-2 text-xs text-muted-foreground">
                  현재 칭호: <span className="font-medium text-primary">[{currentTitle}]</span>
                </div>
              )}

              {/* 미리보기 */}
              {customTitle.trim() && (
                <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">미리보기</p>
                  <p className="text-sm">
                    <span className="text-primary font-medium">[{customTitle.trim()}]</span>
                    <span className="text-foreground ml-1">익명123</span>
                  </p>
                </div>
              )}
            </>
          )}

          {/* 에러 메시지 */}
          {error && (
            <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
          )}

          {/* 구매 버튼 */}
          <button
            onClick={handlePurchase}
            disabled={isPurchasing || (selectedTab === 'color' ? !canPurchaseColor : !canPurchaseTitle)}
            className={`w-full mt-4 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
              (selectedTab === 'color' ? canPurchaseColor : canPurchaseTitle)
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isPurchasing ? (
              '구매 중...'
            ) : (
              <>
                <Nut className="w-4 h-4" />
                {selectedTab === 'color' ? PRICE_COLOR : PRICE_TITLE} 도토리로 구매
              </>
            )}
          </button>

          {/* 포인트 부족 안내 */}
          {(selectedTab === 'color' ? !canPurchaseColor : !canPurchaseTitle) && (
            <p className="mt-2 text-xs text-center text-muted-foreground">
              도토리가 부족합니다. (필요: {selectedTab === 'color' ? PRICE_COLOR : PRICE_TITLE})
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
