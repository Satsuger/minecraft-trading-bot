import type { TaskStep, TaskStepExecutionContext } from "./taskScheduler.types.js";

export interface CreateStepOptions {
  baseDelay?: number;
  name?: string;
  randomDelay?: number;
}

export function createStep<TResult = unknown>(
  run: (
    context: TaskStepExecutionContext,
  ) => Promise<TResult> | TResult,
  options: CreateStepOptions = {},
): TaskStep<TResult> {
  return {
    run,
    name: options.name,
    baseDelayMs: options.baseDelay,
    randomDelayMs: options.randomDelay,
  };
}
