export interface TraceData {
  id: number;
  user_id: number;
  assignment_id: number | null;
  stage_id: number | null;
  saved_at: number;
  action: string;
  content: string | null;
}
