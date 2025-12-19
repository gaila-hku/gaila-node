export interface RefreshToken {
  user_id: number;
  token_hash: string;
  expires_at: number;
  updated_at: number;
}
