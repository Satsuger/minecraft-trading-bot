export interface StrategyOptions {
  name: string;
  description?: string;
}

export abstract class Strategy<TContext, TResult = void> {
  readonly name: string;
  readonly description?: string;

  protected constructor({ name, description }: StrategyOptions) {
    this.name = name;
    this.description = description;
  }

  abstract run(context: TContext): Promise<TResult>;
}
