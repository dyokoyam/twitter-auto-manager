export type PlanType = 'starter' | 'basic' | 'pro';

export interface Account {
  id?: number | string;
  account_name: string;
  api_key?: string;
  api_key_secret?: string;
  access_token?: string;
  access_token_secret?: string;
  api_type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BotConfigItem {
  account: Account;
  scheduled_content_list?: string | string[];
  scheduled_content?: string | null;
  current_index?: number;
  scheduled_times?: string | null;
}

export interface ReplySettingsItem {
  id?: number | string;
  target_bot_ids: string; // JSON string array of ids
  reply_bot_id: number | string;
  reply_content: string;
  is_active?: boolean;
  last_checked_tweet_ids?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ActionsConfig {
  version?: string;
  bots: BotConfigItem[];
  reply_settings?: ReplySettingsItem[];
  updated_at?: string;
}

