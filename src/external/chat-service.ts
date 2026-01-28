import { ChatbotConfig } from 'types/db/assignment';
import { GptLog } from 'types/db/gpt';
import { GptClassificationResponse, GptResponse } from 'types/external/gpt';

const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:5000';

const initFormData = (config?: ChatbotConfig | null) => {
  const formData = new FormData();
  formData.append('myusername', process.env.CHAT_SERVICE_USERNAME || '');
  formData.append('mypassword', process.env.CHAT_SERVICE_PASSWORD || '');
  if (config) {
    formData.append(
      'chatgptParameters',
      `${config.max_tokens};;;${config.choices};;;${config.temperature}`,
    );
  } else {
    formData.append('chatgptParameters', '1000;;;1;;;2');
  }
  return formData;
};

type PastMessage = Pick<GptLog, 'user_question' | 'gpt_answer'>;

export const fetchChatResponse = async (
  question: string,
  rolePrompt: string,
  outline: string,
  essay: string,
  rubrics: string,
  pastMessages: PastMessage[],
  taskDescription: string,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('outline', outline);
  formData.append('essay', essay);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));

  const res = await fetch(chatServiceUrl + '/chatgpt', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchIdeationGuidingAgentResponse = async (
  question: string,
  outline: string,
  rolePrompt: string,
  pastMessages: PastMessage[],
  rubrics: string,
  taskDescription: string,
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('outline', outline);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');

  const res = await fetch(chatServiceUrl + '/ideation-guiding-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchOutlineReviewAgentResponse = async (
  question: string,
  outline: string,
  rolePrompt: string,
  pastMessages: PastMessage[],
  rubrics: string,
  taskDescription: string,
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('outline', outline);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');

  const res = await fetch(chatServiceUrl + '/outline-review-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchDictionaryAgentResponse = async (
  question: string,
  outline: string,
  essay: string,
  rolePrompt: string,
  pastMessages: PastMessage[],
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('outline', outline);
  formData.append('essay', essay);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');
  const res = await fetch(chatServiceUrl + '/dictionary-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchGrammarAgentResponse = async (
  question: string,
  rolePrompt: string,
  outline: string,
  essay: string,
  pastMessages: PastMessage[],
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('outline', outline);
  formData.append('essay', essay);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');

  const res = await fetch(chatServiceUrl + '/grammar-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchAutogradeAgentResponse = async (
  question: string,
  rolePrompt: string,
  outline: string,
  essay: string,
  rubrics: string,
  pastMessages: PastMessage[],
  taskDescription: string,
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('outline', outline);
  formData.append('essay', essay);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');

  const res = await fetch(chatServiceUrl + '/autograde-agent', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchRevisionAgentResponse = async (
  question: string,
  rolePrompt: string,
  outline: string,
  essay: string,
  rubrics: string,
  pastMessages: PastMessage[],
  taskDescription: string,
  is_structured: boolean,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('userQuestions', question);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('outline', outline);
  formData.append('essay', essay);
  formData.append('rubrics', rubrics);
  formData.append('past_messages', JSON.stringify(pastMessages));
  formData.append('is_structured', is_structured ? '1' : '0');

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

export const fetchVocabGenerationResponse = async (
  rolePrompt: string,
  rubrics: string,
  taskDescription: string,
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('rubrics', rubrics);

  const res = await fetch(chatServiceUrl + '/generate-vocab', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const fetchDashboardbGenerationResponse = async (
  rolePrompt: string,
  taskDescription: string,
  rubrics: string,
  annotations: { text: string; color: string; note: string }[],
  generatedVocabs: string[],
  outline: string,
  essayDraft: string,
  essayDraftTitle: string,
  revisedEssay: string,
  revisedEssayTitle: string,
  checklist: string[],
  gptLogs: GptLog[],
  config: ChatbotConfig | null,
): Promise<GptResponse> => {
  const formData = initFormData(config);
  formData.append('chatgptRoleDescription', rolePrompt);
  formData.append('taskDescription', taskDescription);
  formData.append('rubrics', rubrics);
  formData.append('annotations', JSON.stringify(annotations));
  formData.append('generatedVocabs', JSON.stringify(generatedVocabs));
  formData.append('outline', outline);
  formData.append('essayDraft', essayDraft);
  formData.append('essayDraftTitle', essayDraftTitle);
  formData.append('revisedEssay', revisedEssay);
  formData.append('revisedEssayTitle', revisedEssayTitle);
  formData.append('checklist', JSON.stringify(checklist));
  formData.append('gptLogs', JSON.stringify(gptLogs));

  const res = await fetch(chatServiceUrl + '/generate-dashboard', {
    method: 'POST',
    body: formData,
  });

  return res.json();
};
