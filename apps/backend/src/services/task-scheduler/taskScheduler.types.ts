export type TaskPriority = "normal" | "high";
export type TaskSchedulerStatus = "idle" | "running" | "stopping" | "stopped";
export type TaskExecutionPhase = "step-delay" | "step" | "task-delay";

export interface StepDelayOptions {
  baseDelayMs?: number;
  randomDelayMs?: number;
}

export interface TaskStepExecutionContext {
  priority: TaskPriority;
  stepIndex: number;
  stepCount: number;
  taskId: string;
  taskName: string;
}

export interface TaskStep<TResult = unknown> extends StepDelayOptions {
  name?: string;
  run(context: TaskStepExecutionContext): Promise<TResult> | TResult;
}

export interface TaskDefinition<TResult = unknown> {
  baseDelayMs?: number;
  randomDelayMs?: number;
  metadata?: Record<string, unknown>;
  name?: string;
  steps: readonly [TaskStep<TResult>, ...TaskStep<TResult>[]];
}

export interface QueuedTaskSnapshot {
  enqueuedAt: string;
  id: string;
  name: string;
  priority: TaskPriority;
  stepCount: number;
}

export interface CurrentExecutionSnapshot {
  effectiveDelayMs: number | null;
  phase: TaskExecutionPhase;
  priority: TaskPriority;
  startedAt: string;
  stepCount: number;
  stepIndex: number;
  stepName: string | null;
  taskId: string;
  taskName: string;
}

export interface LastCompletedTaskSnapshot {
  finishedAt: string;
  id: string;
  name: string;
  priority: TaskPriority;
}

export interface TaskFailureSnapshot {
  error: unknown;
  failedAt: string;
  priority: TaskPriority;
  stepIndex: number;
  stepName: string;
  taskId: string;
  taskName: string;
}

export interface TaskSchedulerStateSnapshot {
  currentExecution: CurrentExecutionSnapshot | null;
  highPriorityQueue: QueuedTaskSnapshot[];
  isIdle: boolean;
  isRunning: boolean;
  lastCompletedTask: LastCompletedTaskSnapshot | null;
  lastFailure: TaskFailureSnapshot | null;
  normalPriorityQueue: QueuedTaskSnapshot[];
  status: TaskSchedulerStatus;
  stopRequested: boolean;
}

export interface TaskExecutionResult<TResult = unknown> {
  enqueuedAt: string;
  finishedAt: string;
  id: string;
  name: string;
  priority: TaskPriority;
  startedAt: string;
  stepResults: TResult[];
}

export interface ScheduledTaskHandle<TResult = unknown> {
  completion: Promise<TaskExecutionResult<TResult>>;
  id: string;
  priority: TaskPriority;
}

export interface NormalizedTaskDefinition<TResult = unknown>
  extends Omit<TaskDefinition<TResult>, "name" | "steps"> {
  name: string;
  steps: readonly [NormalizedTaskStep<TResult>, ...NormalizedTaskStep<TResult>[]];
}

export interface NormalizedTaskStep<TResult = unknown>
  extends Omit<TaskStep<TResult>, "name"> {
  name: string;
}

export interface QueuedTask<TResult = unknown> {
  completion: {
    reject: (reason?: unknown) => void;
    resolve: (value: TaskExecutionResult<TResult>) => void;
  };
  definition: NormalizedTaskDefinition<TResult>;
  enqueuedAt: number;
  id: string;
  priority: TaskPriority;
}
