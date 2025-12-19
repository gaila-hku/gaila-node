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

export type AgentUsageData = {
  agent_type: string;
  agent_uses: number;
  prompts: number;
}[];
