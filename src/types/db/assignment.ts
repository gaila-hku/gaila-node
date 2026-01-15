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
  config?: string;
  created_by: number;
}

export interface AssignmentStage {
  id: number;
  assignment_id: number;
  stage_type: string;
  order_index: number;
  enabled: boolean;
  config?: string;
}

export interface ChatbotConfig {
  max_tokens: number;
  choices: number;
  temperature: number;
}

export interface ChatbotTemplates {
  id: number;
  name: string;
  description: string;
  default_role_prompt: string;
  default_config: ChatbotConfig;
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
  custom_config?: ChatbotConfig;
  enabled: boolean;
}

export interface AssignmentTarget {
  id: number;
  assignment_id: number;
  class_id?: number;
  student_id?: number;
}

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

export interface AssignmentGrade {
  id: number;
  submission_id: number;
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
