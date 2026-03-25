import { Bot } from "mineflayer";
import {
  createStep,
  TaskSchedulerService,
} from "../services/task-scheduler/index.js";
import { Strategy } from "./strategy.js";
import { InventoryService } from "../services/inventory.service.js";
import { ItemId } from "@minecraft-trading-bot/constants";

export class EnchantingTableStrategy extends Strategy {
  private readonly taskScheduler: TaskSchedulerService;
  private readonly bot: Bot;
  private readonly inventoryService: InventoryService;

  constructor(bot: Bot, taskScheduler: TaskSchedulerService) {
    super({
      name: "enchanting-table",
      description:
        "Buy enchanting tables from orders and resell them on auction for double the price.",
    });

    this.bot = bot;
    this.taskScheduler = taskScheduler;
    this.inventoryService = new InventoryService(bot);
  }

  async run(): Promise<void> {
    this.taskScheduler.enqueueNormal({
      steps: [
        createStep(({ priority, stepIndex, taskName }) => {
          this.inventoryService.findItemByItemId(ItemId.EnchantingTable);
        }),
      ],
    });

    // check if enchanting tables are present in the inventory. if not create order to buy enchanting tables

    // wait for the message in chat that confirms order filled

    // claim enchanting table from orders window

    // list enchanting table on auction house for double the price. Max 10 at a time.

    // if chat message confirms auction sold, list another enchanting table on auction house for double the price

    // if enchanting tables sold out, create new order to buy enchanting tables and repeat the process
    return;
  }
}
