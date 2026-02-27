// API 클라이언트
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// 토큰 저장/조회
export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token')
  }
  return null
}

export const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token)
  }
}

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_id')
  }
}

// API 요청 헬퍼
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '요청 실패' }))
    throw new Error(error.detail || '요청 실패')
  }

  // 204 No Content
  if (response.status === 204) {
    return null
  }

  return response.json()
}

// 인증 API
export const authAPI = {
  // 선문대 로그인
  loginWithSunmoon: async (studentId: string, password: string) => {
    const data = await fetchAPI('/sunmoon/login', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, password }),
    })
    setToken(data.access_token)
    if (data.user_id) {
      localStorage.setItem('user_id', String(data.user_id))
    }
    return data
  },

  // 일반 로그인
  login: async (studentId: string, password: string) => {
    const data = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, password }),
    })
    setToken(data.access_token)
    if (data.user_id) {
      localStorage.setItem('user_id', String(data.user_id))
    }
    return data
  },

  // 회원가입
  register: async (studentId: string, password: string, name: string, department: string) => {
    return fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, password, name, department }),
    })
  },

  // 내 정보
  getMe: async () => {
    return fetchAPI('/auth/me')
  },

  // 로그아웃
  logout: () => {
    removeToken()
  },

  // 회원탈퇴
  withdraw: async () => {
    const result = await fetchAPI('/auth/withdraw', {
      method: 'DELETE',
    })
    removeToken()
    return result
  },
}

// 시간표 API
export const scheduleAPI = {
  // 내 시간표 조회
  getMySchedules: async () => {
    return fetchAPI('/schedules')
  },

  // 시간표 추가
  createSchedule: async (schedule: {
    day: string
    start_time: string
    end_time: string
    subject: string
    professor?: string
    room?: string
    color?: string
  }) => {
    return fetchAPI('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    })
  },

  // 시간표 삭제
  deleteSchedule: async (id: number) => {
    return fetchAPI(`/schedules/${id}`, {
      method: 'DELETE',
    })
  },
}

// 채팅 API
export const chatAPI = {
  // 채팅방 목록
  getRooms: async () => {
    return fetchAPI('/chat/rooms')
  },

  // 채팅방 생성
  createRoom: async (name: string, description?: string) => {
    return fetchAPI('/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  },

  // 채팅방 참여
  joinRoom: async (roomId: number) => {
    return fetchAPI(`/chat/rooms/${roomId}/join`, {
      method: 'POST',
    })
  },

  // 메시지 조회
  getMessages: async (roomId: number) => {
    return fetchAPI(`/chat/rooms/${roomId}/messages`)
  },

  // 메시지 전송
  sendMessage: async (roomId: number, message: string) => {
    return fetchAPI('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId, message }),
    })
  },
}

// 등하교 메이트 API
export const commuteAPI = {
  // 내 스케줄 조회
  getSchedules: async () => {
    return fetchAPI('/commute/schedules')
  },

  // 스케줄 저장
  saveSchedules: async (schedules: Array<{day: string, commute_type: string, time: string, location?: string}>) => {
    return fetchAPI('/commute/schedules', {
      method: 'POST',
      body: JSON.stringify({ schedules }),
    })
  },

  // 오늘의 매칭 그룹 조회
  getTodayGroups: async () => {
    return fetchAPI('/commute/groups/today')
  },

  // 매칭 실행
  runMatch: async () => {
    return fetchAPI('/commute/match', { method: 'POST' })
  },

  // 그룹 상세 조회
  getGroup: async (groupId: number) => {
    return fetchAPI(`/commute/groups/${groupId}`)
  },

  // 그룹 메시지 조회
  getGroupMessages: async (groupId: number) => {
    return fetchAPI(`/commute/groups/${groupId}/messages`)
  },

  // 그룹 메시지 전송
  sendGroupMessage: async (groupId: number, message: string) => {
    return fetchAPI('/commute/groups/messages', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, message }),
    })
  },
}

// 공지사항 API
export const announcementAPI = {
  // 목록 조회
  getAnnouncements: async (category?: string) => {
    const query = category ? `?category=${category}` : ''
    return fetchAPI(`/announcements${query}`)
  },

  // 상세 조회
  getAnnouncement: async (id: number) => {
    return fetchAPI(`/announcements/${id}`)
  },
}

// 전화번호부 API
export const phonebookAPI = {
  // 목록 조회
  getEntries: async (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return fetchAPI(`/phonebook${query}`)
  },
}

// 친구 API
export const friendAPI = {
  // 친구 목록
  getFriends: async () => {
    return fetchAPI('/friends')
  },

  // 친구 요청 목록
  getRequests: async () => {
    return fetchAPI('/friends/requests')
  },

  // 친구 요청 보내기
  sendRequest: async (friendId: number) => {
    return fetchAPI('/friends', {
      method: 'POST',
      body: JSON.stringify({ friend_id: friendId }),
    })
  },

  // 학번으로 친구 요청 보내기
  sendRequestByStudentId: async (studentId: string) => {
    return fetchAPI(`/friends/request-by-student-id?student_id=${encodeURIComponent(studentId)}`, {
      method: 'POST',
    })
  },

  // 친구 요청 수락
  acceptRequest: async (requestId: number) => {
    return fetchAPI(`/friends/${requestId}/accept`, {
      method: 'PUT',
    })
  },

  // 친구 요청 거절
  rejectRequest: async (requestId: number) => {
    return fetchAPI(`/friends/${requestId}/reject`, {
      method: 'PUT',
    })
  },

  // 공강 비교
  compareFreeTime: async (friendIds: number[]) => {
    return fetchAPI('/friends/free-time', {
      method: 'POST',
      body: JSON.stringify(friendIds),
    })
  },

  // 사용자 검색
  searchUsers: async (query: string) => {
    return fetchAPI(`/friends/search?q=${encodeURIComponent(query)}`)
  },
}

// 랜덤 채팅 API
export const randomChatAPI = {
  // 랜덤 채팅 시작 (매칭 대기)
  start: async () => {
    return fetchAPI('/random-chat/start', { method: 'POST' })
  },

  // 현재 상태 확인
  getStatus: async () => {
    return fetchAPI('/random-chat/status')
  },

  // 대기 취소
  cancel: async () => {
    return fetchAPI('/random-chat/cancel', { method: 'POST' })
  },

  // 연결 끊기
  disconnect: async () => {
    return fetchAPI('/random-chat/disconnect', { method: 'POST' })
  },

  // 메시지 조회
  getMessages: async (roomId: number) => {
    return fetchAPI(`/random-chat/messages/${roomId}`)
  },

  // 메시지 전송
  sendMessage: async (roomId: number, message: string) => {
    return fetchAPI('/random-chat/messages', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId, message }),
    })
  },

  // 채팅방 상태 확인 (상대방이 나갔는지)
  getRoomStatus: async (roomId: number) => {
    return fetchAPI(`/random-chat/room-status/${roomId}`)
  },
}
