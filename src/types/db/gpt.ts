export interface GptLog {
  id: number;
  user_id: number;
  assignment_tool_id: number;
  user_question: string;
  gpt_answer?: string | null;
  whole_prompt?: string | null;
  user_ask_time: number;
  gpt_response_time?: number;
  extra?: string | null;
  prompt_nature_category?: number;
  prompt_aspect_category?: number;
  is_structured: boolean;
  is_error?: boolean | null;
}

export interface StudentRevisionExplanation {
  id: number;
  user_id: number;
  gpt_log_id: number;
  aspect_id: string;
  saved_at: number;
  response_type?: 'agree' | 'disagree' | 'partial';
  explanation?: string;
}

export interface StudentRevisionPlan {
  id: number;
  user_id: number;
  gpt_log_id: number;
  aspect_id: string;
  saved_at: number;
  response_type?: 'agree' | 'disagree' | 'partial';
  plan?: string;
}
