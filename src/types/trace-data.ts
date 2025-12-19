export interface TraceDataCreatePayload {
  assignment_id: number;
  stage_id: number;
  action: string;
  content: string;
}

export interface TimelineData {
  stage_type: string;
  start_time: number | null;
  end_time: number | null;
}
