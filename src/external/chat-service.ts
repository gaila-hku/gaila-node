import { isNumber } from 'lodash-es';

import { ChatbotConfig } from 'types/db/assignment';
import { GptLog } from 'types/db/gpt';
import { GptClassificationResponse, GptResponse } from 'types/external/gpt';

const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:5000';

const initFormData = () => {
  const formData = new FormData();
  formData.append('myusername', process.env.CHAT_SERVICE_USERNAME || '');
  formData.append('mypassword', process.env.CHAT_SERVICE_PASSWORD || '');
  formData.append('chatgptParameters', '1000;;;1;;;2');
  return formData;
};

export const fetchChatResponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  rubrics: string,
  pastMessages: GptLog[],
  taskDescription: string,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData();
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('essay', essay);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  }

  const res = await fetch(chatServiceUrl + '/chatgpt', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchIdeationAgentResponse = async (
  question: string,
  rolePrompt: string,
  pastMessages: GptLog[],
  rubrics: string,
  taskDescription: string,
  is_structured: boolean,
  stage: number | undefined,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData();
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');
  if (isNumber(stage)) {
    formData.append('stage', stage.toString());
  }
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  }

  const res = await fetch(chatServiceUrl + '/ideation-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchDictionaryAgentResponse = async (
  question: string,
  rolePrompt: string,
  pastMessages: GptLog[],
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData();
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  }
  const res = await fetch(chatServiceUrl + '/dictionary-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchGrammarAgentResponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  pastMessages: GptLog[],
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData();
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('essay', essay);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  }

  const res = await fetch(chatServiceUrl + '/grammar-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchAutogradeAgentResponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  rubrics: string,
  pastMessages: GptLog[],
  taskDescription: string,
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData();
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('essay', essay);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  }

  const res = await fetch(chatServiceUrl + '/autograde-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchRevisionAgentResponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  rubrics: string,
  pastMessages: GptLog[],
  taskDescription: string,
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData();
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('essay', essay);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  }

  const res = await fetch(chatServiceUrl + '/revision-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchPromptClassificationResponse = async (
  taskDescription: string | null,
  prompts: string[],
): Promise<GptClassificationResponse> => {
  const formData = initFormData();
  if (taskDescription) {
    formData.append('taskDescription', taskDescription);
  }
  formData.append('prompts', JSON.stringify(prompts));

  const res = await fetch(chatServiceUrl + '/classify-prompt', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};
