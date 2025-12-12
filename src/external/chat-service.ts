import { isNumber } from 'lodash-es';

import { ChatbotConfig } from 'types/assignment';
import { GptClassificationResponse, GptLog, GptResponse } from 'types/gpt';

const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:5000';

const defaultChatRequest = {
  myusername: process.env.CHAT_SERVICE_USERNAME || '',
  mypassword: process.env.CHAT_SERVICE_PASSWORD || '',
  chatgptParameters: '1000;;;1;;;2',
};

const defaultChatFetchOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
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
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    taskDescription,
    essay,
    rubrics,
    past_messages: JSON.stringify(pastMessages),
    ...(config
      ? {
          chatgptParameters: `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
        }
      : {}),
  });

  const res = await fetch(chatServiceUrl + '/chatgpt', {
    ...defaultChatFetchOptions,
    body: data,
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
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    taskDescription,
    rubrics,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
    ...(isNumber(stage) ? { stage: stage.toString() } : {}),
    ...(config
      ? {
          chatgptParameters: `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
        }
      : {}),
  });

  const res = await fetch(chatServiceUrl + '/ideation-agent', {
    ...defaultChatFetchOptions,
    body: data,
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
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
    ...(config
      ? {
          chatgptParameters: `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
        }
      : {}),
  });

  const res = await fetch(chatServiceUrl + '/dictionary-agent', {
    ...defaultChatFetchOptions,
    body: data,
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
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    essay,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
    ...(config
      ? {
          chatgptParameters: `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
        }
      : {}),
  });

  const res = await fetch(chatServiceUrl + '/grammar-agent', {
    ...defaultChatFetchOptions,
    body: data,
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
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    taskDescription,
    essay,
    rubrics,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
    ...(config
      ? {
          chatgptParameters: `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
        }
      : {}),
  });

  const res = await fetch(chatServiceUrl + '/autograde-agent', {
    ...defaultChatFetchOptions,
    body: data,
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
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    essay,
    rubrics,
    past_messages: JSON.stringify(pastMessages),
    taskDescription,
    is_structured: is_structured ? '1' : '0',
    ...(config
      ? {
          chatgptParameters: `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
        }
      : {}),
  });

  const res = await fetch(chatServiceUrl + '/revision-agent', {
    ...defaultChatFetchOptions,
    body: data,
  });

  return res.json();
};

export const fetchPromptClassificationResponse = async (
  taskDescription: string | null,
  prompts: string[],
): Promise<GptClassificationResponse> => {
  const data = new URLSearchParams({
    ...defaultChatRequest,
    ...(taskDescription ? { taskDescription } : {}),
    prompts: JSON.stringify(prompts),
  });

  const res = await fetch(chatServiceUrl + '/classify-prompt', {
    ...defaultChatFetchOptions,
    body: data,
  });

  return res.json();
};
