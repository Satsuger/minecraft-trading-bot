import type { Bot } from "mineflayer";
import type { BlockId } from "@minecraft-trading-bot/shared";

export interface ParsedChatCommand {
  args: string[];
  name: string;
  prefix: string;
  raw: string;
}

export interface ChatCommandResponseMessage {
  at: string;
  message: string;
  position: string;
  rawMessage: unknown;
}

export interface ChatCommandResponse {
  command: string;
  completedBy: "idle" | "predicate" | "timeout";
  messages: ChatCommandResponseMessage[];
  parsedCommand: ParsedChatCommand;
}

export interface SendCommandAndWaitOptions {
  idleMs?: number;
  ignoreEcho?: boolean;
  isComplete?: (response: ChatCommandResponse) => boolean;
  timeoutMs?: number;
}

type ChatCommandMessageListener = (
  message: string,
  position: string,
  jsonMessage: { json?: unknown },
) => void;

type CommandArgument = number | string;

export class ChatCommandService {
  constructor(
    private readonly bot: Bot,
    private readonly defaultPrefix = "/",
  ) {}

  public openOrders(blockId: BlockId) {
    const command = this.build("orders", [blockId]);
    
    this.bot.chat(command);
  }

  private build(name: string, args: readonly CommandArgument[] = []): string {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("Command name cannot be empty");
    }

    const prefix = normalizedName.startsWith("/") ? "" : this.defaultPrefix;

    const serializedArgs = args
      .map((argument) => quoteCommandArgument(String(argument)))
      .join(" ");

    return serializedArgs
      ? `${prefix}${normalizedName} ${serializedArgs}`
      : `${prefix}${normalizedName}`;
  }

  parse(command: string): ParsedChatCommand {
    const raw = command.trim();
    if (!raw) {
      throw new Error("Command string cannot be empty");
    }

    const prefix = raw[0] === "/" || raw[0] === "!" ? raw[0] : "";
    const body = prefix ? raw.slice(1) : raw;
    const [name, ...args] = tokenizeCommand(body);

    if (!name) {
      throw new Error(`Unable to parse command: ${command}`);
    }

    return {
      raw,
      prefix,
      name,
      args,
    };
  }

  send(command: string): ParsedChatCommand {
    const parsedCommand = this.parse(command);
    this.bot.chat(parsedCommand.raw);
    return parsedCommand;
  }

  async sendAndWait(
    command: string,
    options: SendCommandAndWaitOptions = {},
  ): Promise<ChatCommandResponse> {
    const parsedCommand = this.parse(command);
    const timeoutMs = options.timeoutMs ?? 5_000;
    const idleMs = options.idleMs ?? 750;
    const ignoreEcho = options.ignoreEcho ?? true;

    return new Promise<ChatCommandResponse>((resolve) => {
      const messages: ChatCommandResponseMessage[] = [];
      let settled = false;
      let idleTimer: NodeJS.Timeout | undefined;
      let timeoutTimer: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }

        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }

        if (this.bot.off) {
          this.bot.off("messagestr", onMessage);
          return;
        }

        this.bot.removeListener("messagestr", onMessage);
      };

      const finish = (completedBy: ChatCommandResponse["completedBy"]) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve({
          command: parsedCommand.raw,
          parsedCommand,
          messages,
          completedBy,
        });
      };

      const scheduleIdleTimeout = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }

        idleTimer = setTimeout(() => finish("idle"), idleMs);
      };

      const onMessage: ChatCommandMessageListener = (
        message,
        position,
        jsonMessage,
      ) => {
        const normalizedMessage = message.trim();
        if (!normalizedMessage) {
          return;
        }

        if (ignoreEcho && normalizedMessage === parsedCommand.raw) {
          return;
        }

        messages.push({
          at: new Date().toISOString(),
          message: normalizedMessage,
          position,
          rawMessage: jsonMessage.json,
        });

        const response: ChatCommandResponse = {
          command: parsedCommand.raw,
          parsedCommand,
          messages,
          completedBy: "predicate",
        };

        if (options.isComplete?.(response)) {
          finish("predicate");
          return;
        }

        scheduleIdleTimeout();
      };

      timeoutTimer = setTimeout(() => finish("timeout"), timeoutMs);
      this.bot.on("messagestr", onMessage);
      this.bot.chat(parsedCommand.raw);
    });
  }
}

// Keep parsing/building symmetric for arguments with spaces or quotes.
function quoteCommandArgument(value: string): string {
  if (!/[\s"]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function tokenizeCommand(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let escaping = false;

  for (const character of value.trim()) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && /\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
