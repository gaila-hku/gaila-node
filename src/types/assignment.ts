import {
  Assignment,
  AssignmentGoalContent,
  AssignmentReadingContent,
  AssignmentReflectionContent,
  AssignmentStage,
  AssignmentWritingContent,
  AssignmnentStageType,
} from 'types/db/assignment';
import { Class } from 'types/db/class';
import { User } from 'types/db/user';

export interface AssignmentTeacherListingItem extends Assignment {
  student_count: number;
  submitted_count: number;
  graded_count: number;
  status: 'active' | 'upcoming' | 'past-due';
}

export interface AssignmentView extends Assignment {
  enrolled_classes: Class[];
  enrolled_students: User[];
}

export interface RubricItem {
  criteria: string;
  description: string;
  max_points: number;
}

export interface AssignmentCreatePayload {
  title: string;
  description?: string;
  due_date?: number | null;
  type?: string;
  instructions?: string;
  requirements?: {
    min_word_count?: number | null;
    max_word_count?: number | null;
  };
  rubrics?: RubricItem[];
  checklist?: string[];
  enrolled_class_ids?: number[];
  enrolled_student_ids?: number[];
  stages: (Omit<AssignmentStage, 'id' | 'order_index' | 'tools'> & {
    tools: { key: string; enabled: boolean }[];
  })[];
}

export interface AssignmentStageCreatePayload {
  stage_type: AssignmnentStageType;
  enabled: boolean;
  tools: { key: string; enabled: boolean }[];
  config?: string;
}

export interface AssignmentStageWithTools {
  id: number;
  assignment_id: number;
  stage_type: AssignmnentStageType;
  order_index: number;
  enabled: boolean;
  tools: { id: number; key: string; enabled: boolean }[];
  config?: string;
}

export type AssignmentEnrollment =
  | AssignmentEnrolledClass
  | AssignmentEnrolledStudent;

export type AssignmentEnrolledClass = {
  id: number;
  assignment_id: number;
  class_id: number;
  class_name: string;
  num_students: number;
};

export type AssignmentEnrolledStudent = {
  id: number;
  assignment_id: number;
  student_id: number;
  username: string;
  first_name: string;
  last_name: string;
};

export interface AssignmentSubmissionListingItem {
  id: number;
  assignment_id: number;
  submitted_at: number | null;
  is_final: boolean | null;
  stage_id: number;
  stage_type: AssignmnentStageType;
  student_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  score: number | null;
}

export interface AssignmentSubmissionListingItemResponse {
  assignment_id: number | null;
  submissions: {
    id: number;
    stage_id: number;
    stage_type: AssignmnentStageType;
    submitted_at: number | null;
    is_final: boolean | null;
    score: number | null;
  }[];
  student: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface AssignmentRecentSubmissionListingItem
  extends AssignmentSubmissionListingItem {
  title: string;
}

export interface AssignmentRecentSubmissionListingItemResponse
  extends AssignmentSubmissionListingItemResponse {
  title: string;
}

export interface AssignmentSubmissionDetail {
  id: number;

  assignment_id: number;
  title: string;
  description?: string;
  start_date?: number;
  due_date?: number;
  type?: string;
  rubrics?: string;
  config?: string;

  stage_id: number;
  stage_type: AssignmnentStageType;
  order_index: number;

  student_id: number;
  username: string;
  first_name: string;
  last_name: string;

  content?:
    | AssignmentReadingContent
    | AssignmentGoalContent
    | AssignmentWritingContent
    | AssignmentReflectionContent;
  submitted_at?: number;
  is_final?: boolean;

  overall_score: number;
  overall_feedback?: string;
  rubrics_breakdown?: string;
  graded_at?: number;
  graded_by: number;
}

export interface AssignmentOption {
  id: number;
  title: string;
}
