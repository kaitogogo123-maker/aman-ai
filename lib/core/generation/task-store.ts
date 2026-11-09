import type { GenerationTask } from './types';

export interface TaskStore {
  create(task: GenerationTask): Promise<GenerationTask>;
  get(taskId: string): Promise<GenerationTask | null>;
  update(task: GenerationTask): Promise<GenerationTask>;
  listByDevice(deviceId: string): Promise<GenerationTask[]>;
  listByUser(userId: string): Promise<GenerationTask[]>;
  remove(taskId: string): Promise<void>;
}

export function createMemoryTaskStore(): TaskStore {
  const tasks = new Map<string, GenerationTask>();

  return {
    async create(task) {
      tasks.set(task.id, task);
      return task;
    },
    async get(taskId) {
      return tasks.get(taskId) ?? null;
    },
    async update(task) {
      const updated = { ...task, updatedAt: new Date().toISOString() };
      tasks.set(updated.id, updated);
      return updated;
    },
    async listByDevice(deviceId) {
      return Array.from(tasks.values())
        .filter((task) => task.deviceId === deviceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listByUser(userId) {
      return Array.from(tasks.values())
        .filter((task) => task.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async remove(taskId) {
      tasks.delete(taskId);
    }
  };
}
