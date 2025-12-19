export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'teacher' | 'teaching_assistant' | 'student';
  last_login?: number;
  time_created?: number;
  time_modified?: number;
  first_name?: string;
  last_name?: string;
  deleted?: boolean;
  lang?: string;
}
