export interface DashboardStats {
  total_accounts: number;
  active_accounts: number;
  today_tweets: number;
  total_tweets: number;
  error_count: number;
}

export interface UserSettingsDTO {
  id?: number;
  user_id: string;
  plan_type: 'starter' | 'basic' | 'pro';
  max_accounts: number;
  created_at: string;
  updated_at: string;
}

