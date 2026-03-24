import { OrderBlockCoupleStrategy, Strategy } from "./lib/strategies/index.js";

export class Advisor<TContext, TResult = void, TAggregated = TResult[]> {
  constructor(
    private readonly strategies: readonly Strategy<TContext, TResult>[],
  ) {}

  async run(context: TContext): Promise<TAggregated> {
    const results = await Promise.all(
      this.strategies.map((strategy) => strategy.run(context)),
    );

    return results as TAggregated;
  }
}

void new Advisor([new OrderBlockCoupleStrategy()]).run(undefined as never);
