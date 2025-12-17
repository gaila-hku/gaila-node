export interface Class {
  id: number;
  name: string;
  description?: string;
  start_at?: number;
  end_at?: number;
}

export interface ClassOption {
  id: number;
  name: string;
  num_students: number;
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

export interface ClassDetail {
  id: number;
  name: string;
  description?: string;
  start_at?: number;
  end_at?: number;
  students: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  }[];
  teachers: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  }[];
  assignments: {
    id: number;
    title: string;
    description?: string;
    start_date?: number;
    due_date?: number;
    type?: string;
  }[];
}

export type ClassManagementDetail = Omit<ClassDetail, 'assignments'>;
