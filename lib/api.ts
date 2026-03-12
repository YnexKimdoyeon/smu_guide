// API 클라이언트
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// 타임아웃 및 재시도 설정
const REQUEST_TIMEOUT = 30000 // 30초
const MAX_RETRIES = 2
const RETRY_DELAY = 1000 // 1초 (지수 백오프 적용)

// 타임아웃이 적용된 fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// 재시도 로직이 적용된 fetch
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options)
    } catch (error: any) {
      lastError = error

      // AbortError(타임아웃) 또는 네트워크 에러만 재시도
      const isRetryable =
        error.name === 'AbortError' ||
        error.name === 'TypeError' ||
        error.message?.includes('fetch')

      if (!isRetryable || attempt === retries) {
        break
      }

      // 지수 백오프: 1초, 2초, 4초...
      const delay = RETRY_DELAY * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // 사용자 친화적 에러 메시지
  if (lastError?.name === 'AbortError') {
    throw new Error('서버 응답 시간 초과. 네트워크 상태를 확인해주세요.')
  }
  throw lastError || new Error('네트워크 오류가 발생했습니다.')
}

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
    localStorage.removeItem('_cred')
  }
}

// 자격증명 저장/조회 (세션 자동 갱신용)
const saveCredentials = (studentId: string, password: string) => {
  if (typeof window !== 'undefined') {
    // Base64 인코딩 (간단한 난독화)
    const cred = btoa(JSON.stringify({ s: studentId, p: password }))
    localStorage.setItem('_cred', cred)
  }
}

const getCredentials = (): { studentId: string, password: string } | null => {
  if (typeof window !== 'undefined') {
    const cred = localStorage.getItem('_cred')
    if (cred) {
      try {
        const decoded = JSON.parse(atob(cred))
        return { studentId: decoded.s, password: decoded.p }
      } catch {
        return null
      }
    }
  }
  return null
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

  const response = await fetchWithRetry(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '요청 실패' }))
    const message = response.status === 401
      ? `401: ${error.detail || '인증 만료'}`
      : (error.detail || '요청 실패')
    throw new Error(message)
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
    // 자격증명 저장 (세션 자동 갱신용)
    saveCredentials(studentId, password)
    return data
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

  // 친구 시간표 조회
  getFriendSchedule: async (userId: number) => {
    return fetchAPI(`/schedules/user/${userId}`)
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

  // 출석 확인 (꼭 갈거에요!)
  confirmAttendance: async (groupId: number) => {
    return fetchAPI(`/commute/groups/${groupId}/confirm`, {
      method: 'POST',
    })
  },

  // 출석 확인 취소
  cancelAttendance: async (groupId: number) => {
    return fetchAPI(`/commute/groups/${groupId}/confirm`, {
      method: 'DELETE',
    })
  },
}

// 급하게 매칭 API
export const quickRoomAPI = {
  // 방 목록 조회
  getRooms: async () => {
    return fetchAPI('/quick-room/rooms')
  },

  // 방 생성
  createRoom: async (data: { title: string; departure: string; destination: string; depart_time: string }) => {
    return fetchAPI('/quick-room/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 방 상세 조회
  getRoom: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}`)
  },

  // 방 참여
  joinRoom: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}/join`, { method: 'POST' })
  },

  // 방 나가기
  leaveRoom: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}/leave`, { method: 'POST' })
  },

  // 방 마감
  closeRoom: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}`, { method: 'DELETE' })
  },

  // 메시지 조회
  getMessages: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}/messages`)
  },

  // 메시지 전송
  sendMessage: async (roomId: number, message: string) => {
    return fetchAPI('/quick-room/rooms/messages', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId, message }),
    })
  },

  // 출석 확인 (꼭 갈거에요!)
  confirmAttendance: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}/confirm`, { method: 'POST' })
  },

  // 출석 확인 취소
  cancelAttendance: async (roomId: number) => {
    return fetchAPI(`/quick-room/rooms/${roomId}/confirm`, { method: 'DELETE' })
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
  getEntries: async (search?: string, category?: string) => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (category) params.append('category', category)
    const query = params.toString() ? `?${params.toString()}` : ''
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

  // 친구 삭제
  deleteFriend: async (friendId: number) => {
    return fetchAPI(`/friends/${friendId}`, {
      method: 'DELETE',
    })
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

// GPT 세션 자동 재인증 래퍼
async function fetchGptWithAutoRetry(endpoint: string, options: RequestInit = {}) {
  try {
    return await fetchAPI(endpoint, options)
  } catch (error: any) {
    // 401 에러이고 저장된 자격증명이 있으면 재인증 시도
    if (error.message?.includes('세션') || error.message?.includes('401') || error.message?.includes('로그인')) {
      const creds = getCredentials()
      if (creds) {
        try {
          // GPT 세션 재초기화
          await fetchAPI('/gpt/init', {
            method: 'POST',
            body: JSON.stringify({ password: creds.password }),
          })
          // 원래 요청 재시도
          return await fetchAPI(endpoint, options)
        } catch (retryError) {
          throw error
        }
      }
    }
    throw error
  }
}

// GPT 챗봇 API
export const gptAPI = {
  // 세션 초기화
  init: async (password: string) => {
    return fetchAPI('/gpt/init', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  },

  // 세션 상태 확인
  getStatus: async () => {
    return fetchAPI('/gpt/status')
  },

  // GPT와 대화 (자동 재인증)
  chat: async (messages: { role: string; content: string }[], rid: number = 1) => {
    return fetchGptWithAutoRetry('/gpt/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, rid }),
    })
  },
}

// 차단/신고 API
export const blockAPI = {
  // 사용자 차단
  blockUser: async (blockedUserId: number) => {
    return fetchAPI('/block/block', {
      method: 'POST',
      body: JSON.stringify({ blocked_user_id: blockedUserId }),
    })
  },

  // 차단 해제
  unblockUser: async (blockedUserId: number) => {
    return fetchAPI(`/block/block/${blockedUserId}`, {
      method: 'DELETE',
    })
  },

  // 차단 목록 조회
  getBlockedUsers: async () => {
    return fetchAPI('/block/blocks')
  },

  // 차단 ID 목록 조회
  getBlockedIds: async () => {
    return fetchAPI('/block/blocked-ids')
  },

  // 사용자 신고
  reportUser: async (data: {
    reported_user_id: number
    reason: string
    detail?: string
    message_id?: number
    room_type?: string
  }) => {
    return fetchAPI('/block/report', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

// Canvas 세션 자동 재인증 래퍼
async function fetchCanvasWithAutoRetry(endpoint: string, options: RequestInit = {}) {
  try {
    return await fetchAPI(endpoint, options)
  } catch (error: any) {
    // 401 에러이고 저장된 자격증명이 있으면 재인증 시도
    if (error.message?.includes('세션') || error.message?.includes('401') || error.message?.includes('로그인')) {
      const creds = getCredentials()
      if (creds) {
        try {
          // Canvas 세션 재초기화
          await fetchAPI('/canvas/init', {
            method: 'POST',
            body: JSON.stringify({ username: creds.studentId, password: creds.password }),
          })
          // 원래 요청 재시도
          return await fetchAPI(endpoint, options)
        } catch (retryError) {
          // 재인증 실패 - 원래 에러 던지기
          throw error
        }
      }
    }
    throw error
  }
}

// Canvas LMS API
export const canvasAPI = {
  // 세션 초기화
  init: async (username: string, password: string) => {
    return fetchAPI('/canvas/init', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  // 세션 상태 확인
  getStatus: async () => {
    return fetchAPI('/canvas/status')
  },

  // 할 일 목록 조회 (자동 재인증)
  getTodos: async () => {
    return fetchCanvasWithAutoRetry('/canvas/todos')
  },

  // 수강 과목 목록 조회 (자동 재인증)
  getCourses: async () => {
    return fetchCanvasWithAutoRetry('/canvas/courses')
  },

  // 과목별 공지사항 목록 조회 (자동 재인증)
  getCourseAnnouncements: async (courseId: number) => {
    return fetchCanvasWithAutoRetry(`/canvas/courses/${courseId}/announcements`)
  },

  // 공지사항 상세 조회 (자동 재인증)
  getAnnouncement: async (courseId: number, topicId: number) => {
    return fetchCanvasWithAutoRetry(`/canvas/announcements/${courseId}/${topicId}`)
  },

  // 과목별 게시판 목록 조회 (자동 재인증)
  getCourseBoards: async (courseId: number) => {
    return fetchCanvasWithAutoRetry(`/canvas/courses/${courseId}/boards`)
  },

  // 게시판 게시글 목록 조회 (자동 재인증)
  getBoardPosts: async (courseId: number, boardId: number) => {
    return fetchCanvasWithAutoRetry(`/canvas/courses/${courseId}/boards/${boardId}/posts`)
  },

  // 과목 수강생 목록 조회 (자동 재인증)
  getCourseUsers: async (courseId: number) => {
    return fetchCanvasWithAutoRetry(`/canvas/courses/${courseId}/users`)
  },

  // 수업 계획서 조회 (자동 재인증)
  getCourseSyllabus: async (courseId: number) => {
    return fetchCanvasWithAutoRetry(`/canvas/courses/${courseId}/syllabus`)
  },
}

// EARS 세션 자동 재인증 래퍼
async function fetchEarsWithAutoRetry(endpoint: string, options: RequestInit = {}) {
  try {
    return await fetchAPI(endpoint, options)
  } catch (error: any) {
    if (error.message?.includes('세션') || error.message?.includes('401') || error.message?.includes('로그인')) {
      const creds = getCredentials()
      if (creds) {
        try {
          await fetchAPI('/sunmoon/login', {
            method: 'POST',
            body: JSON.stringify({ student_id: creds.studentId, password: creds.password }),
          })
          return await fetchAPI(endpoint, options)
        } catch (retryError) {
          throw error
        }
      }
    }
    throw error
  }
}

// EARS 출석 API
export const earsAPI = {
  // 세션 상태 확인
  getStatus: async () => {
    return fetchAPI('/ears/status')
  },

  // 수강과목 목록 조회
  getCourses: async () => {
    return fetchEarsWithAutoRetry('/ears/courses')
  },

  // 모든 과목 출석 현황 일괄 조회
  getAllAttendance: async () => {
    return fetchEarsWithAutoRetry('/ears/attendance/all')
  },
}

// 식단 API
export const cafeteriaAPI = {
  // 식당 목록 조회
  getList: async () => {
    return fetchAPI('/cafeteria/list')
  },

  // 식단 조회
  getMenu: async (cafeteriaType: string, day?: string) => {
    const query = day ? `?day=${day}` : ''
    return fetchAPI(`/cafeteria/menu/${cafeteriaType}${query}`)
  },
}

// 동아리 API
export const clubAPI = {
  // 목록 조회
  getClubs: async () => {
    return fetchAPI('/clubs')
  },

  // 상세 조회
  getClub: async (id: number) => {
    return fetchAPI(`/clubs/${id}`)
  },

  // 등록
  createClub: async (data: { name: string; description: string; qna_questions?: string[] }) => {
    return fetchAPI('/clubs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 수정
  updateClub: async (id: number, data: { name?: string; description?: string; qna_questions?: string[] }) => {
    return fetchAPI(`/clubs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // 삭제
  deleteClub: async (id: number) => {
    return fetchAPI(`/clubs/${id}`, {
      method: 'DELETE',
    })
  },

  // 신청
  applyClub: async (id: number, data: { name: string; student_id: string; qna_answers?: Record<string, string> }) => {
    return fetchAPI(`/clubs/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 신청 목록 조회
  getApplications: async (id: number) => {
    return fetchAPI(`/clubs/${id}/applications`)
  },

  // 신청 삭제
  deleteApplication: async (clubId: number, applicationId: number) => {
    return fetchAPI(`/clubs/${clubId}/applications/${applicationId}`, {
      method: 'DELETE',
    })
  },
}

// 장학금 세션 자동 재인증 래퍼
async function fetchScholarshipWithAutoRetry(endpoint: string) {
  try {
    return await fetchAPI(endpoint)
  } catch (error: any) {
    // 401 에러이고 저장된 자격증명이 있으면 재로그인 시도
    if (error.message?.includes('세션') || error.message?.includes('401') || error.message?.includes('로그인')) {
      const creds = getCredentials()
      if (creds) {
        try {
          // 메인 로그인으로 세션 갱신 (folio 자격증명 재저장)
          await fetchAPI('/sunmoon/login', {
            method: 'POST',
            body: JSON.stringify({ student_id: creds.studentId, password: creds.password }),
          })
          // 원래 요청 재시도
          return await fetchAPI(endpoint)
        } catch (retryError) {
          throw error
        }
      }
    }
    throw error
  }
}

// 장학금 API
export const scholarshipAPI = {
  // 마일리지 조회 (자동 재인증)
  getMileage: async (year: number) => {
    return fetchScholarshipWithAutoRetry(`/scholarship/mileage?year=${year}`)
  },
}

// 과팅 API
export const meetingAPI = {
  // 목록 조회
  getMeetings: async () => {
    return fetchAPI('/meetings')
  },

  // 내 과팅 목록
  getMyMeetings: async () => {
    return fetchAPI('/meetings/my')
  },

  // 상세 조회
  getMeeting: async (id: number) => {
    return fetchAPI(`/meetings/${id}`)
  },

  // 등록
  createMeeting: async (data: { department: string; member_count: number; description?: string }) => {
    return fetchAPI('/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 수정
  updateMeeting: async (id: number, data: { member_count?: number; description?: string }) => {
    return fetchAPI(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // 삭제
  deleteMeeting: async (id: number) => {
    return fetchAPI(`/meetings/${id}`, {
      method: 'DELETE',
    })
  },

  // 마감
  closeMeeting: async (id: number) => {
    return fetchAPI(`/meetings/${id}/close`, {
      method: 'PUT',
    })
  },

  // 신청
  applyMeeting: async (id: number, data: { department: string; member_count: number; message?: string }) => {
    return fetchAPI(`/meetings/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 신청 목록 조회
  getApplications: async (id: number) => {
    return fetchAPI(`/meetings/${id}/applications`)
  },

  // 매칭
  matchMeeting: async (meetingId: number, applicationId: number) => {
    return fetchAPI(`/meetings/${meetingId}/match/${applicationId}`, {
      method: 'POST',
    })
  },

  // 신청 삭제
  deleteApplication: async (meetingId: number, applicationId: number) => {
    return fetchAPI(`/meetings/${meetingId}/applications/${applicationId}`, {
      method: 'DELETE',
    })
  },

  // 매칭된 채팅방 나가기
  leaveMeeting: async (meetingId: number) => {
    return fetchAPI(`/meetings/${meetingId}/leave`, {
      method: 'POST',
    })
  },
}

// 알림 API
export const notificationAPI = {
  // 알림 배지 조회
  getBadges: async () => {
    return fetchAPI('/notifications/badges')
  },

  // 앱 조회 기록
  markViewed: async (appId: string) => {
    return fetchAPI(`/notifications/viewed/${appId}`, {
      method: 'POST',
    })
  },
}

// 셔틀버스 API
export const shuttleAPI = {
  // 시간표 조회
  getSchedule: async (dayType: string, route: string) => {
    return fetchAPI(`/shuttle/schedule?day_type=${dayType}&route=${encodeURIComponent(route)}`)
  },
}

// 도토리 API
export const dotoriAPI = {
  // 도토리 정보 조회
  getInfo: async () => {
    return fetchAPI('/dotori/info')
  },

  // 출석 체크
  checkAttendance: async () => {
    return fetchAPI('/dotori/attendance', { method: 'POST' })
  },

  // 아이템 구매
  purchaseItem: async (itemType: 'nickname_color' | 'title', value: string) => {
    return fetchAPI('/dotori/shop/purchase', {
      method: 'POST',
      body: JSON.stringify({ item_type: itemType, value }),
    })
  },

  // 학과별 랭킹 조회
  getRanking: async () => {
    return fetchAPI('/dotori/ranking')
  },

  // 친구에게 도토리 선물
  sendGift: async (receiverId: number, amount: number) => {
    return fetchAPI('/dotori/gift', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId, amount }),
    })
  },

  // 읽지 않은 선물 조회
  getUnreadGifts: async () => {
    return fetchAPI('/dotori/gifts/unread')
  },

  // 선물 읽음 처리
  markGiftAsRead: async (giftId: number) => {
    return fetchAPI(`/dotori/gifts/${giftId}/read`, { method: 'POST' })
  },
}

// 관리자 토큰 관리
const getAdminToken = () => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('admin_token')
  }
  return null
}

const setAdminToken = (token: string) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('admin_token', token)
  }
}

export const removeAdminToken = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('admin_token')
  }
}

// 관리자 API 요청 헬퍼 (토큰 포함)
async function fetchAdminAPI(endpoint: string, options: RequestInit = {}) {
  const adminToken = getAdminToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (adminToken) {
    (headers as Record<string, string>)['X-Admin-Token'] = adminToken
  }

  const response = await fetchWithRetry(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '요청 실패' }))
    // 인증 실패시 토큰 제거
    if (response.status === 401) {
      removeAdminToken()
    }
    throw new Error(error.detail || '요청 실패')
  }

  return response.json()
}

// 관리자 API
export const adminAPI = {
  // 로그인
  login: async (password: string) => {
    const result = await fetchAPI('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    if (result.token) {
      setAdminToken(result.token)
    }
    return result
  },

  // 로그아웃
  logout: () => {
    removeAdminToken()
  },

  // 인증 상태 확인
  isAuthenticated: () => {
    return !!getAdminToken()
  },

  // 통계 조회
  getStats: async () => {
    return fetchAdminAPI('/admin/stats')
  },

  // 전체 유저 목록
  getUsers: async () => {
    return fetchAdminAPI('/admin/users')
  },

  // 유저 상세 정보
  getUserDetail: async (userId: number) => {
    return fetchAdminAPI(`/admin/users/${userId}`)
  },

  // 특정 유저들에게 푸시 알림 전송
  sendPush: async (userIds: number[], title: string, content: string) => {
    return fetchAdminAPI('/admin/push', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds, title, content }),
    })
  },

  // 전체 유저에게 푸시 알림 전송
  sendPushAll: async (title: string, content: string) => {
    return fetchAdminAPI('/admin/push/all', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    })
  },

  // 회원 삭제 (관련 데이터 전체 삭제)
  deleteUser: async (userId: number) => {
    return fetchAdminAPI(`/admin/users/${userId}`, {
      method: 'DELETE',
    })
  },

  // 회원 일괄 삭제
  deleteUsers: async (userIds: number[]) => {
    return fetchAdminAPI('/admin/users/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    })
  },

  // 도토리 지급 (추가)
  grantDotori: async (userId: number, amount: number, reason?: string) => {
    return fetchAdminAPI('/admin/dotori/grant', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, amount, reason }),
    })
  },

  // 도토리 설정 (덮어쓰기)
  setDotori: async (userId: number, amount: number) => {
    return fetchAdminAPI('/admin/dotori/set', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, amount }),
    })
  },

  // 통계 상세 정보 조회
  getStatsDetail: async (category: string) => {
    return fetchAdminAPI(`/admin/stats/detail/${category}`)
  },

  // 메인 배너 조회
  getMainBanner: async () => {
    return fetchAdminAPI('/banner/main')
  },

  // 메인 배너 업데이트
  updateMainBanner: async (imageData: string | null, linkUrl: string | null, isActive: boolean) => {
    return fetchAdminAPI('/banner/main', {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData, link_url: linkUrl, is_active: isActive }),
    })
  },

  // 메인 배너 삭제
  deleteMainBanner: async () => {
    return fetchAdminAPI('/banner/main', { method: 'DELETE' })
  },

  // 팝업 조회
  getPopup: async () => {
    return fetchAdminAPI('/banner/popup')
  },

  // 팝업 업데이트
  updatePopup: async (imageData: string | null, linkUrl: string | null, isActive: boolean, title: string) => {
    return fetchAdminAPI('/banner/popup', {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData, link_url: linkUrl, is_active: isActive, title }),
    })
  },

  // 팝업 삭제
  deletePopup: async () => {
    return fetchAdminAPI('/banner/popup', { method: 'DELETE' })
  },
}

// 배너 API (공개)
export const bannerAPI = {
  // 메인 배너 조회
  getMainBanner: async () => {
    return fetchAPI('/banner/main')
  },

  // 팝업 조회
  getPopup: async () => {
    return fetchAPI('/banner/popup')
  },
}
