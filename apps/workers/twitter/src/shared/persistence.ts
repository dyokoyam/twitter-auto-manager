import type { ActionsConfig } from "@tam/shared";
import { logger } from "./logger";

export function updatePostIndexWithMemory(configData: ActionsConfig, botIndex: number, memory: Map<string, number>, accountName: string): boolean {
  const botConfig: any = (configData as any).bots[botIndex];
  if (botConfig?.scheduled_content_list) {
    try {
      const contentList = typeof botConfig.scheduled_content_list === 'string' ? JSON.parse(botConfig.scheduled_content_list) : botConfig.scheduled_content_list;
      const currentIndex = memory.has(accountName) ? (memory.get(accountName) as number) : (botConfig.current_index || 0);
      const nextIndex = (currentIndex + 1) % contentList.length;
      memory.set(accountName, nextIndex);
      (configData as any).bots[botIndex].current_index = nextIndex;
      logger.info(`Updated post index for ${accountName}: ${currentIndex} -> ${nextIndex}`);
      return true;
    } catch (e: any) {
      logger.error(`Failed to update post index for ${accountName}: ${e?.message}`);
      return false;
    }
  }
  return false;
}
