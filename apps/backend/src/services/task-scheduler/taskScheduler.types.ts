export type TaskPriority = "normal" | "high";
export type TaskSchedulerStatus = "idle" | "running" | "stopping" | "stopped";
export type TaskExecutionPhase = "step-delay" | "step" | "task-delay";
export type TaskContext = Record<string, unknown>;

export interface StepDelayOptions {
  baseDelayMs?: number;
  randomDelayMs?: number;
}

export interface TaskStepExecutionContext<TContext extends TaskContext = TaskContext> {
  context: TContext;
  priority: TaskPriority;
  stepIndex: number;
  stepCount: number;
  taskId: string;
  taskName: string;
}

export interface TaskStep<
  TResult = unknown,
  TContext extends TaskContext = TaskContext,
> extends StepDelayOptions {
  name?: string;
  run(context: TaskStepExecutionContext<TContext>): Promise<TResult> | TResult;
}

export interface TaskDefinition<TContext extends TaskContext = TaskContext> {
  baseDelayMs?: number;
  context?: TContext;
  randomDelayMs?: number;
  metadata?: Record<string, unknown>;
  name?: string;
  steps: readonly [TaskStep<any, TContext>, ...TaskStep<any, TContext>[]];
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

export interface TaskExecutionResult<TContext extends TaskContext = TaskContext> {
  context: TContext;
  enqueuedAt: string;
  finishedAt: string;
  id: string;
  name: string;
  priority: TaskPriority;
  startedAt: string;
  stepResults: unknown[];
}

export interface ScheduledTaskHandle<TContext extends TaskContext = TaskContext> {
  completion: Promise<TaskExecutionResult<TContext>>;
  id: string;
  priority: TaskPriority;
}

export interface NormalizedTaskDefinition<TContext extends TaskContext = TaskContext>
  extends Omit<TaskDefinition<TContext>, "name" | "steps"> {
  name: string;
  steps: readonly [
    NormalizedTaskStep<TContext>,
    ...NormalizedTaskStep<TContext>[],
  ];
}

export interface NormalizedTaskStep<TContext extends TaskContext = TaskContext>
  extends Omit<TaskStep<any, TContext>, "name"> {
  name: string;
}

export interface QueuedTask<TContext extends TaskContext = TaskContext> {
  completion: {
    reject: (reason?: unknown) => void;
    resolve: (value: TaskExecutionResult<TContext>) => void;
  };
  context: TContext;
  definition: NormalizedTaskDefinition<TContext>;
  enqueuedAt: number;
  id: string;
  priority: TaskPriority;
}
