// App-wide state types and mock data

export interface User {
  id: string
  name: string
  studentId: string
  department: string
  profileImage?: string
}

export interface ScheduleItem {
  id: string
  day: string
  startTime: string
  endTime: string
  subject: string
  professor: string
  room: string
  color: string
}

export interface ChatRoom {
  id: string
  name: string
  participants: number
  lastMessage: string
  lastTime: string
}

export interface ChatMessage {
  id: string
  sender: string
  message: string
  time: string
  isMine: boolean
}

export interface CommuteMate {
  id: string
  name: string
  department: string
  from: string
  to: string
  time: string
  profileImage?: string
}

export interface Announcement {
  id: string
  title: string
  date: string
  category: string
  isNew: boolean
}

export interface PhoneEntry {
  id: string
  department: string
  name: string
  phone: string
  extension?: string
}

export interface Friend {
  id: string
  name: string
  studentId: string
  department: string
  status: 'accepted' | 'pending' | 'requested'
}

export interface FreeTime {
  day: string
  startTime: string
  endTime: string
}

// Mock data
export const mockUser: User = {
  id: '1',
  name: '김선문',
  studentId: '20230001',
  department: '컴퓨터공학과',
}

export const mockSchedule: ScheduleItem[] = [
  { id: '1', day: '월', startTime: '09:00', endTime: '10:30', subject: '자료구조', professor: '이교수', room: 'IT관 301', color: '#3B82F6' },
  { id: '2', day: '월', startTime: '13:00', endTime: '14:30', subject: '알고리즘', professor: '김교수', room: 'IT관 405', color: '#0EA5E9' },
  { id: '3', day: '화', startTime: '10:30', endTime: '12:00', subject: '데이터베이스', professor: '박교수', room: 'IT관 201', color: '#06B6D4' },
  { id: '4', day: '화', startTime: '14:00', endTime: '15:30', subject: '운영체제', professor: '최교수', room: 'IT관 302', color: '#8B5CF6' },
  { id: '5', day: '수', startTime: '09:00', endTime: '10:30', subject: '컴퓨터네트워크', professor: '정교수', room: 'IT관 101', color: '#F59E0B' },
  { id: '6', day: '수', startTime: '13:00', endTime: '14:30', subject: '소프트웨어공학', professor: '한교수', room: 'IT관 202', color: '#10B981' },
  { id: '7', day: '목', startTime: '10:30', endTime: '12:00', subject: '자료구조', professor: '이교수', room: 'IT관 301', color: '#3B82F6' },
  { id: '8', day: '목', startTime: '15:00', endTime: '16:30', subject: '인공지능', professor: '윤교수', room: 'IT관 501', color: '#EF4444' },
  { id: '9', day: '금', startTime: '09:00', endTime: '10:30', subject: '웹프로그래밍', professor: '서교수', room: 'IT관 401', color: '#EC4899' },
  { id: '10', day: '금', startTime: '13:00', endTime: '14:30', subject: '알고리즘', professor: '김교수', room: 'IT관 405', color: '#0EA5E9' },
]

export const mockChatRooms: ChatRoom[] = [
  { id: '1', name: '자료구조 스터디', participants: 12, lastMessage: '다음 주 시험 범위 아시는 분?', lastTime: '2분 전' },
  { id: '2', name: '글로벌 자유게시판', participants: 248, lastMessage: '오늘 학식 뭐예요?', lastTime: '5분 전' },
  { id: '3', name: '알고리즘 질문방', participants: 34, lastMessage: 'DP 문제 풀이 공유합니다', lastTime: '15분 전' },
  { id: '4', name: '컴공 24학번 모임', participants: 89, lastMessage: '엠티 날짜 정해요!', lastTime: '1시간 전' },
]

export const mockChatMessages: ChatMessage[] = [
  { id: '1', sender: '익명1', message: '다음 주 시험 범위 아시는 분?', time: '14:23', isMine: false },
  { id: '2', sender: '익명2', message: '챕터 1~5까지라고 하셨어요', time: '14:24', isMine: false },
  { id: '3', sender: '나', message: '감사합니다! 혹시 PPT 공유 가능하신가요?', time: '14:25', isMine: true },
  { id: '4', sender: '익명3', message: '저도 필요해요 ㅠㅠ', time: '14:26', isMine: false },
  { id: '5', sender: '익명1', message: '학교 e러닝에 올라와있어요!', time: '14:27', isMine: false },
  { id: '6', sender: '나', message: '아 맞다 감사합니다!', time: '14:28', isMine: true },
]

export const mockCommuteMates: CommuteMate[] = [
  { id: '1', name: '박OO', department: '컴퓨터공학과', from: '천안역', to: '선문대', time: '08:30' },
  { id: '2', name: '이OO', department: '경영학과', from: '천안역', to: '선문대', time: '08:30' },
  { id: '3', name: '최OO', department: '간호학과', from: '아산역', to: '선문대', time: '09:00' },
  { id: '4', name: '정OO', department: '전자공학과', from: '천안역', to: '선문대', time: '08:30' },
]

export const mockAnnouncements: Announcement[] = [
  { id: '1', title: '2026학년도 1학기 수강신청 안내', date: '2026.02.20', category: '학사', isNew: true },
  { id: '2', title: '중앙도서관 운영시간 변경 안내', date: '2026.02.18', category: '일반', isNew: true },
  { id: '3', title: '장학금 신청 안내 (3월)', date: '2026.02.15', category: '장학', isNew: false },
  { id: '4', title: '2026학년도 졸업요건 안내', date: '2026.02.12', category: '학사', isNew: false },
  { id: '5', title: '캠퍼스 셔틀버스 노선 변경', date: '2026.02.10', category: '일반', isNew: false },
  { id: '6', title: '동아리 박람회 개최 안내', date: '2026.02.08', category: '행사', isNew: false },
]

export const mockPhoneDirectory: PhoneEntry[] = [
  { id: '1', department: '학사지원팀', name: '학사문의', phone: '041-530-2114', extension: '2114' },
  { id: '2', department: '학사지원팀', name: '성적문의', phone: '041-530-2115', extension: '2115' },
  { id: '3', department: '학생지원팀', name: '장학문의', phone: '041-530-2210', extension: '2210' },
  { id: '4', department: '학생지원팀', name: '생활관문의', phone: '041-530-2220', extension: '2220' },
  { id: '5', department: '취업지원팀', name: '취업상담', phone: '041-530-2310', extension: '2310' },
  { id: '6', department: '국제교류팀', name: '교환학생', phone: '041-530-2410', extension: '2410' },
  { id: '7', department: '도서관', name: '대출/반납', phone: '041-530-2510', extension: '2510' },
  { id: '8', department: '도서관', name: '열람실', phone: '041-530-2520', extension: '2520' },
  { id: '9', department: 'IT지원팀', name: '전산문의', phone: '041-530-2610', extension: '2610' },
  { id: '10', department: '보건실', name: '건강상담', phone: '041-530-2710', extension: '2710' },
]

export const mockFriends: Friend[] = [
  { id: '1', name: '이민수', studentId: '20230015', department: '컴퓨터공학과', status: 'accepted' },
  { id: '2', name: '박지현', studentId: '20230023', department: '컴퓨터공학과', status: 'accepted' },
  { id: '3', name: '최영호', studentId: '20230042', department: '전자공학과', status: 'accepted' },
  { id: '4', name: '김하나', studentId: '20230008', department: '경영학과', status: 'pending' },
  { id: '5', name: '정서연', studentId: '20230031', department: '컴퓨터공학과', status: 'accepted' },
]

export const mockFreeTimeResults: FreeTime[] = [
  { day: '월요일', startTime: '10:30', endTime: '13:00' },
  { day: '화요일', startTime: '09:00', endTime: '10:30' },
  { day: '수요일', startTime: '15:00', endTime: '18:00' },
  { day: '목요일', startTime: '13:00', endTime: '15:00' },
  { day: '금요일', startTime: '10:30', endTime: '13:00' },
]
