import { Class } from 'types/class';
import { User } from 'types/user';

export interface Assignment {
  id: number;
  title: string;
  description?: string;
  start_date?: number;
  due_date?: number;
  type?: string;
  instructions?: string;
  requirements?: number;
  rubrics?: string;
  tips?: string;
  created_by: number;
}

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

export interface AssignmentStage {
  id: number;
  assignment_id: number;
  stage_type: string;
  order_index: number;
  enabled: boolean;
}

export interface AssignmentStageCreatePayload {
  stage_type: string;
  enabled: boolean;
  tools: { key: string; enabled: boolean }[];
}

export interface ChatbotTemplates {
  id: number;
  name: string;
  description: string;
  default_role_prompt: string;
  default_config: string;
  default_model: string;
  created_at: string;
}

export interface AssignmentTool {
  id: number;
  assignment_id?: number;
  assignment_stage_id?: number;
  tool_key: string;
  chatbot_template_id?: number;
  custom_role_prompt?: string;
  custom_config?: string;
  enabled: boolean;
}

export interface AssignmentStageWithTools {
  id: number;
  assignment_id: number;
  stage_type: string;
  order_index: number;
  enabled: boolean;
  tools: { id: number; key: string; enabled: boolean }[];
}

export interface AssignmentTeacher {
  id: number;
  assignment_id: number;
  teacher_id: number;
}

export interface AssignmentTarget {
  id: number;
  assignment_id: number;
  class_id?: number;
  student_id?: number;
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

export interface AssignmentSubmission {
  id: number;
  assignment_id: number;
  stage_id: number;
  student_id: number;
  content?:
    | AssignmentGoalContent
    | AssignmentEssayContent
    | AssignmentReflectionContent;
  submitted_at?: number;
  is_final?: boolean;
}

export interface AssignmentSubmissionListingItem {
  id: number;
  assignment_id: number;
  submitted_at: number | null;
  is_final: boolean | null;
  stage_id: number;
  stage_type: string;
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
    stage_type: string;
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

export interface AssignmentGrade {
  id: number;
  submission_id: number;
  overall_score: number;
  overall_feedback?: string;
  rubrics_breakdown?: string;
  graded_at?: number;
  graded_by: number;
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

  stage_id: number;
  stage_type: string;
  order_index: number;

  student_id: number;
  username: string;
  first_name: string;
  last_name: string;

  content?:
    | AssignmentGoalContent
    | AssignmentEssayContent
    | AssignmentReflectionContent;
  submitted_at?: number;
  is_final?: boolean;

  overall_score: number;
  overall_feedback?: string;
  rubrics_breakdown?: string;
  graded_at?: number;
  graded_by: number;
}

export interface AssignmentGoalContent {
  writing_goals: AssignmentGoal[];
  ai_goals: AssignmentGoal[];
  isGoalConfirmed: boolean;
}

export interface AssignmentGoal {
  goalText: string;
  strategies: {
    text: string;
    completed?: boolean;
  }[];
}

export interface AssignmentEssayContent {
  title: string;
  outline: string;
  essay: string;
  goals: AssignmentGoalContent | null;
}

export interface AssignmentReflectionContent {
  reflections: { [key: string]: string };
}

export interface AssignmentOption {
  id: number;
  title: string;
}
