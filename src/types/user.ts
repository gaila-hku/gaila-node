import { User } from 'types/db/user';

export interface ClassUser extends User {
  student_class_id: number;
  student_class_name: string;
}

export type UserOption = Pick<
  User,
  'id' | 'first_name' | 'last_name' | 'username'
>;

export type UserListingItem = Omit<User, 'password' | 'deleted'>;
