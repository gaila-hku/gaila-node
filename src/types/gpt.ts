export interface GptLog {
  id: number;
  user_id: number;
  assignment_tool_id: number;
  user_question: string;
  gpt_answer: string;
  whole_prompt: string;
  user_ask_time: number;
  gpt_response_time?: number;
  prompt_nature_category?: string;
  prompt_aspect_category?: string;
  is_structured: boolean;
}

interface GptResponseMessage {
  role: string;
  content: string | null;
  parsed?: object;
  tool_calls?: {
    id: string;
    type: 'function';
    /** The details of the function call requested by the AI model. */
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

interface GptReponseObject {
  id: string;
  created: number; // Unix timestamp (seconds)
  model: string;
  choices: {
    index: number;
    finish_reason: string | null;
    message: GptResponseMessage;
  }[];
  usage: {
    completion_tokens: number /** The number of tokens generated across all completions emissions. */;
    prompt_tokens: number /** The number of tokens in the provided prompts for the completions request. */;
    total_tokens: number /** The total number of tokens processed for the completions request and response. */;
  };
}

export interface GptResponse {
  response: GptReponseObject;
  wholeprompt: {
    content: string;
    role: string;
  }[];
}

interface GptClassificationResponseMessage extends GptResponseMessage {
  parsed?: {
    categories: {
      prompt: string;
      prompt_nature: string;
      prompt_nature_code: number;
      writing_aspect: string;
      writing_aspect_code: number;
    }[];
  };
}

interface GptClassificationResponseObject extends GptReponseObject {
  choices: {
    index: number;
    finish_reason: string | null;
    message: GptClassificationResponseMessage;
  }[];
}

export interface GptClassificationResponse extends GptResponse {
  response: GptClassificationResponseObject;
}

export interface GptAnalytics {
  total_prompt_count: number;
  nature_counts: GptAnalyticsCountItem[];
  aspect_counts: GptAnalyticsCountItem[];
  tool_counts: GptAnalyticsCountItem[];
}

export interface GptAnalyticsCountDatabaseItem {
  item_key: number;
  stage_type: string;
  count: number;
}

export interface GptAnalyticsCountDatabaseToolItem {
  item_key: string;
  stage_type: string;
  count: number;
}

export interface GptAnalyticsCountItem {
  key: string;
  stage_type: string;
  count: number | undefined;
  class_average: number;
}
