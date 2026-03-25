import type {
  CurrentExecutionSnapshot,
  NormalizedTaskDefinition,
  NormalizedTaskStep,
  QueuedTask,
  QueuedTaskSnapshot,
  ScheduledTaskHandle,
  StepDelayOptions,
  TaskDefinition,
  TaskExecutionPhase,
  TaskExecutionResult,
  TaskFailureSnapshot,
  TaskPriority,
  TaskSchedulerStateSnapshot,
  TaskSchedulerStatus,
  TaskStepExecutionContext,
} from "./taskScheduler.types.js";

const DEFAULT_TASK_NAME = "unnamed";
const DEFAULT_STEP_NAME = "unnamed";
const DEFAULT_TASK_BASE_DELAY_MS = 500;
const DEFAULT_TASK_RANDOM_DELAY_MS = 200;
const DEFAULT_STEP_BASE_DELAY_MS = 300;
const DEFAULT_STEP_RANDOM_DELAY_MS = 100;

export class TaskSchedulerService {
  private readonly highPriorityQueue: QueuedTask<any>[] = [];
  private readonly normalPriorityQueue: QueuedTask<any>[] = [];
  private readonly stateListeners = new Set<
    (state: TaskSchedulerStateSnapshot) => void
  >();

  private currentExecution: CurrentExecutionSnapshot | null = null;
  private lastCompletedTask: TaskSchedulerStateSnapshot["lastCompletedTask"] =
    null;
  private lastFailure: TaskFailureSnapshot | null = null;
  private processingPromise: Promise<void> | null = null;
  private stopRequested = false;

  enqueueHigh<TResult>(
    definition: TaskDefinition<TResult>,
  ): ScheduledTaskHandle<TResult> {
    return this.enqueue(definition, "high");
  }

  enqueueNormal<TResult>(
    definition: TaskDefinition<TResult>,
  ): ScheduledTaskHandle<TResult> {
    return this.enqueue(definition, "normal");
  }

  resume(): void {
    if (!this.stopRequested) return;

    this.stopRequested = false;
    this.emitStateChange();
    this.ensureProcessing();
  }

  async stop(options: { clearQueuedTasks?: boolean } = {}): Promise<void> {
    this.stopRequested = true;

    if (options.clearQueuedTasks) {
      this.clearQueuedTasks();
    }

    this.emitStateChange();

    await this.processingPromise;
  }

  getState(): TaskSchedulerStateSnapshot {
    const status = this.getStatus();

    return {
      status,
      stopRequested: this.stopRequested,
      isIdle: this.currentExecution === null,
      isRunning: this.currentExecution !== null,
      currentExecution: this.currentExecution
        ? { ...this.currentExecution }
        : null,
      highPriorityQueue: this.highPriorityQueue.map((task) =>
        this.createQueuedTaskSnapshot(task),
      ),
      normalPriorityQueue: this.normalPriorityQueue.map((task) =>
        this.createQueuedTaskSnapshot(task),
      ),
      lastCompletedTask: this.lastCompletedTask
        ? { ...this.lastCompletedTask }
        : null,
      lastFailure: this.lastFailure ? { ...this.lastFailure } : null,
    };
  }

  onStateChange(
    listener: (state: TaskSchedulerStateSnapshot) => void,
  ): () => void {
    this.stateListeners.add(listener);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private enqueue<TResult>(
    definition: TaskDefinition<TResult>,
    priority: TaskPriority,
  ): ScheduledTaskHandle<TResult> {
    const normalizedDefinition = this.normalizeTaskDefinition(definition);
    const queuedTask = this.createQueuedTask(normalizedDefinition, priority);
    const targetQueue =
      priority === "high" ? this.highPriorityQueue : this.normalPriorityQueue;

    targetQueue.push(queuedTask);
    this.emitStateChange();
    this.ensureProcessing();

    return {
      id: queuedTask.id,
      priority,
      completion: queuedTask.completionPromise,
    };
  }

  private createQueuedTask<TResult>(
    definition: NormalizedTaskDefinition<TResult>,
    priority: TaskPriority,
  ): QueuedTask<TResult> & {
    completionPromise: Promise<TaskExecutionResult<TResult>>;
  } {
    let resolveTask!: (value: TaskExecutionResult<TResult>) => void;
    let rejectTask!: (reason?: unknown) => void;

    const completionPromise = new Promise<TaskExecutionResult<TResult>>(
      (resolve, reject) => {
        resolveTask = resolve;
        rejectTask = reject;
      },
    );

    return {
      id: crypto.randomUUID(),
      priority,
      definition,
      enqueuedAt: Date.now(),
      completion: {
        resolve: resolveTask,
        reject: rejectTask,
      },
      completionPromise,
    };
  }

  private normalizeTaskDefinition<TResult>(
    definition: TaskDefinition<TResult>,
  ): NormalizedTaskDefinition<TResult> {
    const normalizedName = definition.name?.trim() || DEFAULT_TASK_NAME;
    const normalizedDefinition: NormalizedTaskDefinition<TResult> = {
      ...definition,
      name: normalizedName,
      steps: definition.steps.map((step) => this.normalizeTaskStep(step)) as [
        NormalizedTaskStep<TResult>,
        ...NormalizedTaskStep<TResult>[],
      ],
    };

    this.validateTaskDefinition(normalizedDefinition);

    return normalizedDefinition;
  }

  private normalizeTaskStep<TResult>(
    step: TaskDefinition<TResult>["steps"][number],
  ): NormalizedTaskStep<TResult> {
    return {
      ...step,
      name: step.name?.trim() || DEFAULT_STEP_NAME,
    };
  }

  private validateTaskDefinition(definition: NormalizedTaskDefinition): void {
    if (!definition.steps.length) {
      throw new Error(
        `Task "${definition.name}" must contain at least one step`,
      );
    }

    definition.steps.forEach((step, index) => {
      if (typeof step.run !== "function") {
        throw new Error(
          `Task "${definition.name}" contains an invalid step at index ${index}`,
        );
      }
    });
  }

  private ensureProcessing(): void {
    if (this.processingPromise || this.stopRequested) {
      return;
    }

    this.processingPromise = this.processQueue().finally(() => {
      this.processingPromise = null;
      this.emitStateChange();

      if (this.stopRequested || !this.hasQueuedTasks()) {
        return;
      }

      this.ensureProcessing();
    });

    this.emitStateChange();
  }

  private async processQueue(): Promise<void> {
    while (!this.stopRequested) {
      const task = this.dequeueNextTask();
      if (!task) {
        this.currentExecution = null;
        this.emitStateChange();
        return;
      }

      await this.executeTask(task);
    }

    this.currentExecution = null;
  }

  private dequeueNextTask(): QueuedTask<any> | undefined {
    return this.highPriorityQueue.shift() ?? this.normalPriorityQueue.shift();
  }

  private async executeTask<TResult>(task: QueuedTask<TResult>): Promise<void> {
    const startedAt = Date.now();
    const stepResults: TResult[] = [];

    try {
      for (const [stepIndex, step] of task.definition.steps.entries()) {
        const stepContext: TaskStepExecutionContext = {
          taskId: task.id,
          taskName: task.definition.name,
          priority: task.priority,
          stepIndex,
          stepCount: task.definition.steps.length,
        };

        const stepDelayMs = this.resolveDelay({
          baseDelayMs: step.baseDelayMs ?? DEFAULT_STEP_BASE_DELAY_MS,
          randomDelayMs: step.randomDelayMs ?? DEFAULT_STEP_RANDOM_DELAY_MS,
        });

        this.setCurrentExecution({
          task,
          phase: "step-delay",
          stepIndex,
          stepName: step.name,
          effectiveDelayMs: stepDelayMs,
        });

        await this.wait(stepDelayMs);

        this.setCurrentExecution({
          task,
          phase: "step",
          stepIndex,
          stepName: step.name,
          effectiveDelayMs: null,
        });

        const result = await step.run(stepContext);
        stepResults.push(result);
      }

      const completionDelayMs = this.resolveDelay({
        baseDelayMs: task.definition.baseDelayMs ?? DEFAULT_TASK_BASE_DELAY_MS,
        randomDelayMs:
          task.definition.randomDelayMs ?? DEFAULT_TASK_RANDOM_DELAY_MS,
      });

      this.setCurrentExecution({
        task,
        phase: "task-delay",
        stepIndex: task.definition.steps.length - 1,
        stepName: null,
        effectiveDelayMs: completionDelayMs,
      });

      await this.wait(completionDelayMs);

      const finishedAt = Date.now();
      const executionResult: TaskExecutionResult<TResult> = {
        id: task.id,
        name: task.definition.name,
        priority: task.priority,
        enqueuedAt: new Date(task.enqueuedAt).toISOString(),
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        stepResults,
      };

      task.completion.resolve(executionResult);
      this.lastCompletedTask = {
        id: task.id,
        name: task.definition.name,
        priority: task.priority,
        finishedAt: executionResult.finishedAt,
      };
      this.currentExecution = null;
      this.emitStateChange();
    } catch (error) {
      const failure = this.createFailureSnapshot(task, error);
      const executionError = new TaskExecutionError({
        cause: error,
        priority: task.priority,
        stepIndex: failure.stepIndex,
        stepName: failure.stepName,
        taskId: task.id,
        taskName: task.definition.name,
      });

      this.lastFailure = {
        ...failure,
        error: executionError,
      };
      this.currentExecution = null;
      task.completion.reject(executionError);
      this.emitStateChange();
    }
  }

  private createFailureSnapshot(
    task: QueuedTask<any>,
    error: unknown,
  ): TaskFailureSnapshot {
    return {
      error,
      failedAt: new Date().toISOString(),
      priority: task.priority,
      stepIndex: this.currentExecution?.stepIndex ?? 0,
      stepName: this.currentExecution?.stepName ?? "unknown",
      taskId: task.id,
      taskName: task.definition.name,
    };
  }

  private setCurrentExecution(options: {
    effectiveDelayMs: number | null;
    phase: TaskExecutionPhase;
    stepIndex: number;
    stepName: string | null;
    task: QueuedTask<any>;
  }): void {
    this.currentExecution = {
      taskId: options.task.id,
      taskName: options.task.definition.name,
      priority: options.task.priority,
      startedAt: new Date().toISOString(),
      stepCount: options.task.definition.steps.length,
      stepIndex: options.stepIndex,
      stepName: options.stepName,
      phase: options.phase,
      effectiveDelayMs: options.effectiveDelayMs,
    };

    this.emitStateChange();
  }

  private resolveDelay({
    baseDelayMs = 0,
    randomDelayMs = 0,
  }: StepDelayOptions): number {
    const normalizedBaseDelayMs = Math.max(0, baseDelayMs);
    const normalizedRandomDelayMs = Math.max(0, Math.abs(randomDelayMs));

    if (!normalizedRandomDelayMs) {
      return normalizedBaseDelayMs;
    }

    const randomOffset =
      Math.floor(Math.random() * (normalizedRandomDelayMs * 2 + 1)) -
      normalizedRandomDelayMs;

    return Math.max(0, normalizedBaseDelayMs + randomOffset);
  }

  private async wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  private clearQueuedTasks(): void {
    const queuedTasks = [
      ...this.highPriorityQueue.splice(0, this.highPriorityQueue.length),
      ...this.normalPriorityQueue.splice(0, this.normalPriorityQueue.length),
    ];

    const error = new TaskSchedulerStoppedError();

    queuedTasks.forEach((task) => {
      task.completion.reject(error);
    });
  }

  private hasQueuedTasks(): boolean {
    return (
      this.highPriorityQueue.length > 0 || this.normalPriorityQueue.length > 0
    );
  }

  private getStatus(): TaskSchedulerStatus {
    if (this.currentExecution) {
      return this.stopRequested ? "stopping" : "running";
    }

    if (this.stopRequested) {
      return "stopped";
    }

    return "idle";
  }

  private createQueuedTaskSnapshot(task: QueuedTask<any>): QueuedTaskSnapshot {
    return {
      id: task.id,
      name: task.definition.name,
      priority: task.priority,
      stepCount: task.definition.steps.length,
      enqueuedAt: new Date(task.enqueuedAt).toISOString(),
    };
  }

  private emitStateChange(): void {
    const snapshot = this.getState();

    this.stateListeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}

export class TaskSchedulerError extends Error {
  readonly taskId: string;
  readonly taskName: string;

  constructor(message: string, taskId: string, taskName: string) {
    super(message);
    this.name = "TaskSchedulerError";
    this.taskId = taskId;
    this.taskName = taskName;
  }
}

export class TaskExecutionError extends TaskSchedulerError {
  readonly cause: unknown;
  readonly priority: TaskPriority;
  readonly stepIndex: number;
  readonly stepName: string;

  constructor(options: {
    cause: unknown;
    priority: TaskPriority;
    stepIndex: number;
    stepName: string;
    taskId: string;
    taskName: string;
  }) {
    super(
      `Task "${options.taskName}" failed on step ${options.stepIndex + 1} "${options.stepName}"`,
      options.taskId,
      options.taskName,
    );

    this.name = "TaskExecutionError";
    this.cause = options.cause;
    this.priority = options.priority;
    this.stepIndex = options.stepIndex;
    this.stepName = options.stepName;
  }
}

export class TaskSchedulerStoppedError extends Error {
  constructor(message = "Task scheduler stopped before the task could run") {
    super(message);
    this.name = "TaskSchedulerStoppedError";
  }
}
