export interface Class {
  id: number;
  name: string;
  class_key: string;
  description?: string;
  start_at?: number;
  end_at?: number;
}

export interface ClassTeacher {
  id: number;
  class_id: number;
  teacher_id: number;
}

export interface ClassStudent {
  id: number;
  class_id: number;
  student_id: number;
}
