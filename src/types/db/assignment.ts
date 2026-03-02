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
  checklist?: string;
  config?: string;
  created_by: number;
}

export type AssignmnentStageType =
  | 'reading'
  | 'goal_setting'
  | 'language_preparation'
  | 'outlining'
  | 'drafting'
  | 'revising'
  | 'reflection';

export type AssignmentStage =
  | AssignmentStageReading
  | AssignmentStageGoalSetting
  | AssignmentStageLanguagePreparation
  | AssignmentStageOutlining
  | AssignmentStageDrafting
  | AssignmentStageRevising
  | AssignmentStageReflection;

export interface AssignmentStageBase {
  id: number;
  stage_type:
    | 'reading'
    | 'goal_setting'
    | 'language_preparation'
    | 'outlining'
    | 'drafting'
    | 'revising'
    | 'reflection';
  enabled: boolean;
  order_index: number;
  tools: { id: number; key: string; enabled: boolean }[];
  config: Record<string, unknown>;
}

export interface AssignmentStageReading extends AssignmentStageBase {
  stage_type: 'reading';
  config: {
    readings?: string[];
    annotation_enabled?: boolean;
    annotation_labels?: string[];
  };
}

export interface AssignmentStageGoalSetting extends AssignmentStageBase {
  stage_type: 'goal_setting';
}

export interface AssignmentStageLanguagePreparation
  extends AssignmentStageBase {
  stage_type: 'language_preparation';
  config: {
    readings?: string[];
    vocabulary_enabled: boolean;
    vocab_categories?: string[];
  };
}

export interface AssignmentStageOutlining extends AssignmentStageBase {
  stage_type: 'outlining';
  config: {
    dashboard_enabled?: boolean;
  };
}

export interface AssignmentStageDrafting extends AssignmentStageBase {
  stage_type: 'drafting';
  config: {
    dashboard_enabled?: boolean;
  };
}

export interface AssignmentStageRevising extends AssignmentStageBase {
  stage_type: 'revising';
  config: {
    revision_tool_ask_explanation?: boolean;
    dashboard_enabled?: boolean;
  };
}

export type AssignmentStageWriting =
  | AssignmentStageOutlining
  | AssignmentStageDrafting
  | AssignmentStageRevising;

export interface AssignmentStageReflection extends AssignmentStageBase {
  stage_type: 'reflection';
  config: {
    reflection_questions?: string[];
  };
}
export interface ChatbotConfig {
  max_tokens: number;
  choices: number;
  temperature: number;
}

export interface ChatbotTemplate {
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
    | AssignmentReadingContent
    | AssignmentGoalContent
    | AssignmentLanguagePreparationContent
    | AssignmentOutliningContent
    | AssignmentDraftingContent
    | AssignmentRevisingContent
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
  goal_confirmed: boolean;
}

export interface AssignmentGoal {
  goalText: string;
  strategies: {
    text: string;
    completed?: boolean;
  }[];
}

export interface AssignmentReadingContent {
  annotations: {
    id: number;
    text: string;
    note: string;
    color: string;
    start_index: number;
    end_index: number;
    text_index: number;
  }[];
  model_text_generated?: boolean;
}

export interface VocabSubmissionItem {
  id: string;
  text: string;
  type: 'word' | 'phrase';
  will_be_used: boolean;
}

export interface AssignmentLanguagePreparationContent {
  generated_vocabs: VocabSubmissionItem[];
}

export interface AssignmentOutliningContent {
  outline: string;
}

export interface AssignmentDraftingContent {
  title: string;
  essay: string;
}

export interface AssignmentRevisingContent {
  title: string;
  essay: string;
}

export type AssignmentWritingContent =
  | AssignmentOutliningContent
  | AssignmentDraftingContent
  | AssignmentRevisingContent;

export interface AssignmentReflectionContent {
  reflections: { [key: string]: string };
}
