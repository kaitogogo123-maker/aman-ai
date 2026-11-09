import { normalizeGenerationSettings } from './settings';
import type {
  CreateGenerationTaskInput,
  GenerationItem,
  GenerationProvider,
  GenerationTask
} from './types';
import type { TaskStore } from './task-store';
import type { Translator } from '@/lib/core/translation/types';
import { preparePromptProductInfo } from '@/lib/core/translation/prompt-product-info';

export interface GenerationServiceDependencies {
  taskStore: TaskStore;
  provider: GenerationProvider;
  translator?: Translator;
}

// 最大并发出图数(同时在 fal 队列里跑的图片数)。从 4 提到 8:≤8 张一次全开,16 张两批,墙钟约减半。
// fal 是队列式 API,并发提交安全;再高需顾及限流/成本,8 为平衡值。
const MAX_ACTIVE_ITEMS = 8;

type ItemProgress =
  | { status: 'running'; requestId: string }
  | { status: 'succeeded'; resultUrl: string }
  | { status: 'failed'; error: string };

export function createGenerationService({ taskStore, provider, translator }: GenerationServiceDependencies) {
  return {
    async createTask(input: CreateGenerationTaskInput): Promise<GenerationTask> {
      const normalizedSettings = normalizeGenerationSettings(input.settings);
      const promptProductInfo = await preparePromptProductInfo({
        productInfo: normalizedSettings.productInfo,
        analysis: normalizedSettings.analysis,
        mode: normalizedSettings.mode,
        translator
      });
      const now = new Date().toISOString();
      const task: GenerationTask = {
        id: `task_${crypto.randomUUID()}`,
        deviceId: input.deviceId,
        userId: input.userId,
        sourceImageUrl: input.sourceImageUrl,
        sourceImageUrls: input.sourceImageUrls,
        settings: {
          ...normalizedSettings,
          promptProductInfo
        },
        status: 'queued',
        items: createItems(normalizedSettings.imageTypes),
        createdAt: now,
        updatedAt: now
      };

      return taskStore.create(task);
    },

    async runTask(taskId: string): Promise<GenerationTask> {
      let task = await taskStore.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      let guard = 0;
      while (!isTerminalStatus(task.status) && guard < 32) {
        task = await this.advanceTask(taskId);
        guard += 1;
      }

      return task;
    },

    async advanceTask(taskId: string): Promise<GenerationTask> {
      let task = await taskStore.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (isTerminalStatus(task.status)) {
        return task;
      }

      if (task.status === 'queued') {
        task = await taskStore.update({
          ...task,
          status: 'running'
        });
      }

      const currentTask = task;
      const runningItems = currentTask.items.filter((item) => item.status === 'running').slice(0, MAX_ACTIVE_ITEMS);
      if (runningItems.length > 0) {
        const progresses = await Promise.all(runningItems.map((item) => provider.syncItem({ task: currentTask, item })));
        task = await persistProgresses(currentTask, runningItems, progresses);
        if (isTerminalStatus(task.status)) {
          return task;
        }
      }

      const startTask = task;
      const activeCount = startTask.items.filter((item) => item.status === 'running').length;
      const slots = Math.max(0, MAX_ACTIVE_ITEMS - activeCount);
      const queuedItems = startTask.items.filter((item) => item.status === 'queued').slice(0, slots);

      if (queuedItems.length > 0) {
        const progresses = await Promise.all(queuedItems.map((item) => provider.startItem({ task: startTask, item })));
        task = await persistProgresses(startTask, queuedItems, progresses);
        if (isTerminalStatus(task.status)) {
          return task;
        }
      }

      if (task.items.every((item) => item.status === 'succeeded')) {
        return taskStore.update({
          ...task,
          status: 'succeeded'
        });
      }

      return task;
    },

    async getTask(taskId: string, options?: { advance?: boolean }) {
      if (options?.advance) {
        // 先确认存在再推进:不存在直接返 null(路由据此返 404),
        // 避免 advanceTask 对不存在任务 throw 导致 500
        const existing = await taskStore.get(taskId);
        if (!existing) {
          return null;
        }
        return this.advanceTask(taskId);
      }

      return taskStore.get(taskId);
    },

    // 历史列表:按登录用户归属(生成已强制登录,避免同设备跨账号串数据)
    async listTasksForUser(userId: string) {
      return taskStore.listByUser(userId);
    },

    // 删除任务，仅当任务属于该用户时才执行；返回是否删除成功（不存在或非本人返回 false）
    async deleteTask(taskId: string, userId: string): Promise<boolean> {
      const task = await taskStore.get(taskId);
      if (!task || task.userId !== userId) {
        return false;
      }
      await taskStore.remove(taskId);
      return true;
    }
  };

  async function persistProgresses(
    task: GenerationTask,
    items: GenerationItem[],
    progresses: ItemProgress[]
  ) {
    const progressByItemId = new Map(items.map((item, index) => [item.id, progresses[index]]));
    const nextItems = task.items.map((currentItem) => {
      const progress = progressByItemId.get(currentItem.id);
      if (!progress) {
        return currentItem;
      }

      if (progress.status === 'running') {
        return {
          ...currentItem,
          status: 'running' as const,
          providerRequestId: progress.requestId
        };
      }

      if (progress.status === 'failed') {
        return {
          ...currentItem,
          status: 'failed' as const,
          providerRequestId: undefined,
          error: progress.error
        };
      }

      return {
        ...currentItem,
        status: 'succeeded' as const,
        providerRequestId: undefined,
        resultUrl: progress.resultUrl
      };
    });

    const nextStatus =
      nextItems.some((currentItem) => currentItem.status === 'failed')
        ? 'failed'
        : nextItems.every((currentItem) => currentItem.status === 'succeeded')
          ? 'succeeded'
          : 'running';

    return taskStore.update({
      ...task,
      status: nextStatus,
      items: nextItems
    });
  }
}

function createItems(imageTypes: GenerationTask['settings']['imageTypes']): GenerationItem[] {
  const items: GenerationItem[] = [];

  for (const type of imageTypes) {
    for (let i = 0; i < type.count; i += 1) {
      items.push({
        id: `item_${crypto.randomUUID()}`,
        kind: type.kind,
        index: items.length,
        status: 'queued'
      });
    }
  }

  return items;
}

function isTerminalStatus(status: GenerationTask['status']) {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}
