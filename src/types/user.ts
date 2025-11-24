export interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  role: 'admin' | 'teacher' | 'teaching_assistant' | 'student';
  last_access?: number;
  last_login?: number;
  time_created?: number;
  time_modified?: number;
  first_name?: string;
  last_name?: string;
  deleted?: boolean;
  lang?: string;
}

export interface ClassUser extends User {
  student_class_id: number;
  student_class_name: string;
}

export type UserOption = Pick<
  User,
  'id' | 'first_name' | 'last_name' | 'username'
>;
