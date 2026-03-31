import type {
  TaskContext,
  TaskStep,
  TaskStepExecutionContext,
} from "./taskScheduler.types.js";

export interface CreateStepOptions {
  baseDelay?: number;
  name?: string;
  randomDelay?: number;
}

export function createStep<
  TResult = unknown,
  TContext extends TaskContext = TaskContext,
>(
  run: (
    context?: TaskStepExecutionContext<TContext>,
  ) => Promise<TResult> | TResult,
  options: CreateStepOptions = {},
): TaskStep<TResult, TContext> {
  return {
    run,
    name: options.name,
    baseDelayMs: options.baseDelay,
    randomDelayMs: options.randomDelay,
  };
}
