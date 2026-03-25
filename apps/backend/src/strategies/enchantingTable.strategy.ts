import { Strategy } from "./strategy.js";

export class EnchantingTableStrategy extends Strategy {
  constructor() {
    super({
      name: "enchanting-table",
      description:
        "Buy enchanting tables from orders and resell them on auction for double the price.",
    });
  }

  async run(): Promise<void> {
    // check if enchanting tables are present in the inventory. if not create order to buy enchanting tables

    // wait for the message in chat that confirms order filled

    // claim enchanting table from orders window

    // list enchanting table on auction house for double the price. Max 10 at a time.

    // if chat message confirms auction sold, list another enchanting table on auction house for double the price

    // if enchanting tables sold out, create new order to buy enchanting tables and repeat the process
    return;
  }
}
