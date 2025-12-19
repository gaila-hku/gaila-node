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
