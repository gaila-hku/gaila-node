import {
  GptAnalyticsCountDatabaseItem,
  GptAnalyticsCountItem,
} from './../types/gpt';

const natureCodeMap: Record<number, string> = {
  0: 'Irrelevant',
  1: 'perform',
  2: 'learning',
};

export const convertPromptNatureArray = (
  selfResults: GptAnalyticsCountDatabaseItem[],
  classResults: GptAnalyticsCountDatabaseItem[],
): GptAnalyticsCountItem[] => {
  return selfResults.map(item => ({
    key: natureCodeMap[item.item_key],
    stage_type: item.stage_type,
    count: item.count,
    class_average:
      classResults.find(i => i.item_key === item.item_key)?.count ?? 0,
  }));
};

const aspectCodeMap: Record<number, string> = {
  0: 'Irrelevant',
  1: 'content_idea',
  2: 'structure',
  3: 'revision',
  4: 'language',
  5: 'rhetoric',
  6: 'error_correction',
};

export const convertPromptAspectArray = (
  selfResults: GptAnalyticsCountDatabaseItem[],
  classResults: GptAnalyticsCountDatabaseItem[],
): GptAnalyticsCountItem[] => {
  return selfResults.map(item => ({
    key: aspectCodeMap[item.item_key],
    stage_type: item.stage_type,
    count: item.count,
    class_average:
      classResults.find(i => i.item_key === item.item_key)?.count ?? 0,
  }));
};
