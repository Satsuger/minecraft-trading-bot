import { OrderBlockCoupleStrategy, Strategy } from "./strategies/index.js";

export class Advisor<TResult = void, TAggregated = TResult[]> {
  constructor(private readonly strategies: readonly Strategy<TResult>[]) {}

  async run(): Promise<TAggregated> {
    const results = await Promise.all(this.strategies.map((strategy) => strategy.run()));

    return results as TAggregated;
  }
}

const advisor = new Advisor([new OrderBlockCoupleStrategy()]).run();
