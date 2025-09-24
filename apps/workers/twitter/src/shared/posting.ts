import type { Bot } from '@tam/shared';
import { logger as log } from './logger.js';

export type NextContent = {
  content: string;
  nextIndex?: number;
  source: 'list' | 'single';
  listLength?: number;
  currentIndex?: number;
};

export type ContentResolution =
  | { status: 'ok'; next: NextContent }
  | { status: 'skip'; reason: string };

type ListPayload = string | string[];

type PostTweetInput = {
  client: any;
  content: string;
  botName: string;
  dryRun: boolean;
};

export type PostTweetResult =
  | { success: true; data: { id: string; text: string } }
  | { success: false; error: string };

const parseListPayload = (payload: ListPayload): string[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const parsed = JSON.parse(payload) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('scheduled_content_list is not an array');
  }
  return parsed as string[];
};

export const resolveNextContent = (bot: Bot): ContentResolution => {
  if (bot.scheduled_content_list) {
    try {
      const list = parseListPayload(bot.scheduled_content_list).map((item) => String(item ?? ''));
      if (list.length === 0) {
        return { status: 'skip', reason: 'scheduled_content_list is empty' };
      }

      const currentIndex =
        typeof bot.current_index === 'number' && bot.current_index >= 0 ? bot.current_index : 0;
      const safeIndex = currentIndex % list.length;
      const content = list[safeIndex]?.trim();

      if (!content) {
        return {
          status: 'skip',
          reason: `scheduled_content_list[${safeIndex}] is empty after trimming`,
        };
      }

      return {
        status: 'ok',
        next: {
          content,
          nextIndex: (safeIndex + 1) % list.length,
          source: 'list',
          listLength: list.length,
          currentIndex: safeIndex,
        },
      };
    } catch (error) {
      return {
        status: 'skip',
        reason: `failed to parse scheduled_content_list: ${(error as Error).message}`,
      };
    }
  }

  const single = bot.scheduled_content?.trim();
  if (single) {
    return {
      status: 'ok',
      next: {
        content: single,
        source: 'single',
      },
    };
  }

  return {
    status: 'skip',
    reason: 'no scheduled content configured',
  };
};

export const postTweet = async ({
  client,
  content,
  botName,
  dryRun,
}: PostTweetInput): Promise<PostTweetResult> => {
  if (dryRun) {
    log.info(`[dry-run] tweet for ${botName}: "${content}"`);
    return {
      success: true,
      data: { id: `dry_run_${Date.now()}`, text: content },
    };
  }

  try {
    const response = await client.v2.tweet(content);
    if (!response?.data) {
      throw new Error('Empty response from Twitter API');
    }

    log.info(`[posted] tweet for ${botName}: ${response.data.id}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    const message = error?.message ?? 'unknown error';
    log.error(`Failed to post tweet for ${botName}: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
};
