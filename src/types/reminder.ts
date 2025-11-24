export interface StudentReminder {
  id: number;
  assignment_id: number;
  student_id: number;
  teacher_id: number;
  reminder_type: 'writing' | 'ai' | 'dashboard' | 'copying';
  reminded_at: number;
}

export const REMINDER_TYPES = [
  'writing',
  'ai',
  'dashboard',
  'copying',
] as const;
