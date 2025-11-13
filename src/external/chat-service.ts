import { GptLog, GptResponse } from 'types/gpt';

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

export const fetchChatReponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  rubrics: string,
  pastMessages: GptLog[],
): Promise<GptResponse> => {
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    essay,
    rubrics,
    past_messages: JSON.stringify(pastMessages),
  });

  const res = await fetch(chatServiceUrl + '/chatgpt', {
    ...defaultChatFetchOptions,
    body: data,
  });

  return res.json();
};

export const fetchDictionaryAgentReponse = async (
  question: string,
  rolePrompt: string,
  pastMessages: GptLog[],
  is_structured: boolean,
): Promise<GptResponse> => {
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
  });

  const res = await fetch(chatServiceUrl + '/dictionary-agent', {
    ...defaultChatFetchOptions,
    body: data,
  });

  return res.json();
};

export const fetchGrammarAgentReponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  pastMessages: GptLog[],
  is_structured: boolean,
): Promise<GptResponse> => {
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    essay,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
  });

  const res = await fetch(chatServiceUrl + '/grammar-agent', {
    ...defaultChatFetchOptions,
    body: data,
  });

  return res.json();
};

export const fetchAutogradeAgentReponse = async (
  question: string,
  rolePrompt: string,
  essay: string,
  rubrics: string,
  pastMessages: GptLog[],
  is_structured: boolean,
): Promise<GptResponse> => {
  const data = new URLSearchParams({
    ...defaultChatRequest,
    userQuestions: question,
    chatgptRoleDescription: rolePrompt,
    essay,
    rubrics,
    past_messages: JSON.stringify(pastMessages),
    is_structured: is_structured ? '1' : '0',
  });

  const res = await fetch(chatServiceUrl + '/autograde-agent', {
    ...defaultChatFetchOptions,
    body: data,
  });

  return res.json();
};
