import { Bot } from "mineflayer";
import {
  createStep,
  TaskSchedulerService,
} from "../services/task-scheduler/index.js";
import { Strategy } from "./strategy.js";

export class EnchantingTableStrategy extends Strategy {
  private readonly taskScheduler: TaskSchedulerService;
  private readonly bot: Bot;

  constructor(bot: Bot, taskScheduler: TaskSchedulerService) {
    super({
      name: "enchanting-table",
      description:
        "Buy enchanting tables from orders and resell them on auction for double the price.",
    });

    this.bot = bot;
    this.taskScheduler = taskScheduler;
  }

  async run(): Promise<void> {
    this.taskScheduler.enqueueNormal({
      steps: [
        createStep(({ priority, stepIndex, taskName }) => {
          console.log(
            `[strategy:${this.name}] [${priority}] ${taskName} step ${stepIndex + 1}: inspecting inventory for ${this.bot.username}`,
          );
        }),
        createStep(({ priority, stepIndex, taskName }) => {
          console.log(
            `[strategy:${this.name}] [${priority}] ${taskName} step ${stepIndex + 1}: inspecting hotbar for ${this.bot.username}`,
          );
        }),
      ],
    });

    this.taskScheduler.enqueueNormal({
      name: "enchanting-table-normal-2",
      baseDelayMs: 300,
      randomDelayMs: 100,
      steps: [
        createStep(
          ({ priority, stepIndex, taskName }) => {
            console.log(
              `[strategy:${this.name}] [${priority}] ${taskName} step ${stepIndex + 1}: preparing order lookup`,
            );
          },
          {
            name: "prepare-order-check",
            baseDelay: 200,
            randomDelay: 50,
          },
        ),
        createStep(
          ({ priority, stepIndex, taskName }) => {
            console.log(
              `[strategy:${this.name}] [${priority}] ${taskName} step ${stepIndex + 1}: preparing auction lookup`,
            );
          },
          {
            name: "prepare-auction-check",
            baseDelay: 200,
            randomDelay: 50,
          },
        ),
      ],
    });

    this.taskScheduler.enqueueHigh({
      name: "enchanting-table-high-priority",
      baseDelayMs: 150,
      randomDelayMs: 50,
      steps: [
        createStep(
          ({ priority, stepIndex, taskName }) => {
            console.log(
              `[strategy:${this.name}] [${priority}] ${taskName} step ${stepIndex + 1}: handling urgent restock check`,
            );
          },
          {
            name: "handle-urgent-restock",
            baseDelay: 100,
            randomDelay: 25,
          },
        ),
        createStep(
          ({ priority, stepIndex, taskName }) => {
            console.log(
              `[strategy:${this.name}] [${priority}] ${taskName} step ${stepIndex + 1}: confirming urgent follow-up`,
            );
          },
          {
            name: "confirm-urgent-follow-up",
            baseDelay: 100,
            randomDelay: 25,
          },
        ),
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
