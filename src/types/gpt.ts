export interface GptLog {
  id: number;
  user_id: number;
  assignment_tool_id: number;
  user_question: string;
  gpt_answer: string;
  whole_prompt: string;
  user_ask_time: number;
  gpt_response_time?: number;
  prompt_category?: string;
  is_structured: boolean;
}

export interface GptResponse {
  response: {
    id: string;
    created: number; // Unix timestamp (seconds)
    model: string;
    choices: {
      index: number;
      finish_reason: string | null;
      message: {
        role: string;
        content: string | null;
        parsed?: JSON;
        tool_calls?: {
          id: string;
          type: 'function';
          /** The details of the function call requested by the AI model. */
          function: {
            name: string;
            arguments: string;
          };
        }[];
      };
    }[];
    usage: {
      completion_tokens: number /** The number of tokens generated across all completions emissions. */;
      prompt_tokens: number /** The number of tokens in the provided prompts for the completions request. */;
      total_tokens: number /** The total number of tokens processed for the completions request and response. */;
    };
  };
  wholeprompt: {
    content: string;
    role: string;
  }[];
}
