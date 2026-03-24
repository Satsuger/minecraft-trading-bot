import { OrdersClient } from "../clients/orders-client.js";
import { Strategy } from "./strategy.js";

const BLOCK_COUPLES = [
  ["emerald_block", "emerald"],
  ["coal_block", "coal"],
] as const;

interface OrderItem {
  itemId?: string;
}

interface RawOrder {
  item?: OrderItem;
  userName?: string;
  itemPrice?: number;
  amountOrdered?: number;
  amountDelivered?: number;
  creationDate?: string;
  expirationDate?: string;
  lastUpdated?: string;
}

export interface BlockCoupleOrder {
  itemId: string;
  userName?: string;
  itemPrice: number;
  amountOrdered?: number;
  amountDelivered?: number;
  creationDate?: string;
  expirationDate?: string;
  lastUpdated?: string;
}

export class OrderBlockCoupleStrategy extends Strategy<
  void,
  Record<string, BlockCoupleOrder[]>
> {
  constructor(
    private readonly ordersClient: OrdersClient = new OrdersClient(),
  ) {
    super({
      name: "order-block-couple",
      description: "Finds the best order deal for each block and unit couple.",
    });
  }

  async run() {
    const itemIds = BLOCK_COUPLES.flatMap((couple) => couple);
    const ordersByItemId = await this.fetchLastOrdersByItemIds(itemIds);

    console.table(
      Object.entries(ordersByItemId).map(([itemId, orders]) => ({
        itemId,
        last9AvgPrice: this.getAveragePrice(orders),
        last3AvgPrice: this.getAveragePrice(orders.slice(0, 3)),
        topPrice: this.getTopPrice(orders),
      })),
    );

    Object.entries(ordersByItemId).forEach(([itemId, orders]) => {
      console.log(itemId);
      console.table(
        orders.map(
          ({
            creationDate,
            expirationDate,
            lastUpdated,
            amountOrdered,
            amountDelivered,
            ...order
          }) => ({
            ...order,
            amountOrdered,
            amountDelivered,
            leftToDeliver: this.getLeftToDeliver(amountOrdered, amountDelivered),
            earningOpportunity: this.formatCompactNumber(
              this.getEarningOpportunity(
                amountOrdered,
                amountDelivered,
                order.itemPrice,
              ),
            ),
            lastUpdated: this.formatDateTime(lastUpdated),
          }),
        ),
      );
    });

    return ordersByItemId;
  }

  private async fetchLastOrdersByItemIds(
    itemIds: readonly string[],
  ): Promise<Record<string, BlockCoupleOrder[]>> {
    const ordersByItem = await Promise.all(
      itemIds.map(async (itemId) => {
        const response = await this.ordersClient.fetchOrders({ query: itemId });

        const orders = this.extractOrders(response)
          .filter(
            (order): order is RawOrder & { item: { itemId: string }; itemPrice: number } =>
              order.item?.itemId === itemId && typeof order.itemPrice === "number",
          )
          .sort(
            (left, right) =>
              this.getOrderTimestamp(right) - this.getOrderTimestamp(left),
          )
          .slice(0, 9)
          .map((order) => ({
            itemId,
            userName: order.userName,
            itemPrice: order.itemPrice,
            amountOrdered: order.amountOrdered,
            amountDelivered: order.amountDelivered,
            creationDate: order.creationDate,
            expirationDate: order.expirationDate,
            lastUpdated: order.lastUpdated,
          }));

        return [itemId, orders] as const;
      }),
    );

    return Object.fromEntries(ordersByItem);
  }

  private getOrderTimestamp(order: RawOrder): number {
    const timestamp = order.lastUpdated ?? order.creationDate;
    return timestamp ? Date.parse(timestamp) || 0 : 0;
  }

  private formatDateTime(value?: string): string {
    if (!value) {
      return "-";
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return value;
    }

    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  private getLeftToDeliver(
    amountOrdered?: number,
    amountDelivered?: number,
  ): number | null {
    if (
      typeof amountOrdered !== "number" ||
      typeof amountDelivered !== "number"
    ) {
      return null;
    }

    return amountOrdered - amountDelivered;
  }

  private getEarningOpportunity(
    amountOrdered?: number,
    amountDelivered?: number,
    itemPrice?: number,
  ): number | null {
    const leftToDeliver = this.getLeftToDeliver(amountOrdered, amountDelivered);
    if (leftToDeliver === null || typeof itemPrice !== "number") {
      return null;
    }

    return leftToDeliver * itemPrice;
  }

  private formatCompactNumber(value: number | null): string {
    if (value === null || !Number.isFinite(value)) {
      return "-";
    }

    const suffixes = ["", "k", "m", "b", "t"] as const;
    const sign = value < 0 ? "-" : "";
    let scaled = Math.abs(value);
    let suffixIndex = 0;

    while (scaled >= 1000 && suffixIndex < suffixes.length - 1) {
      scaled /= 1000;
      suffixIndex += 1;
    }

    let decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    let rounded = Number(scaled.toFixed(decimals));

    if (rounded >= 1000 && suffixIndex < suffixes.length - 1) {
      rounded /= 1000;
      suffixIndex += 1;
      decimals = rounded >= 100 ? 0 : rounded >= 10 ? 1 : 2;
      rounded = Number(rounded.toFixed(decimals));
    }

    const formatted = rounded
      .toFixed(decimals)
      .replace(/\.?0+$/, "")
      .replace(".", ",");

    return `${sign}${formatted}${suffixes[suffixIndex]}`;
  }

  private getAveragePrice(orders: readonly BlockCoupleOrder[]): number | null {
    if (orders.length === 0) {
      return null;
    }

    const total = orders.reduce((sum, order) => sum + order.itemPrice, 0);
    return total / orders.length;
  }

  private getTopPrice(orders: readonly BlockCoupleOrder[]): number | null {
    if (orders.length === 0) {
      return null;
    }

    return Math.max(...orders.map((order) => order.itemPrice));
  }

  private extractOrders(payload: unknown): RawOrder[] {
    if (Array.isArray(payload)) {
      return payload.filter(this.isRawOrder);
    }

    if (!payload || typeof payload !== "object") {
      return [];
    }

    const response = payload as {
      orders?: unknown;
      results?: unknown;
      items?: unknown;
      data?: unknown;
    };

    const collections = [
      response.orders,
      response.results,
      response.items,
      response.data,
    ];

    for (const collection of collections) {
      if (Array.isArray(collection)) {
        return collection.filter(this.isRawOrder);
      }
    }

    if (response.data && typeof response.data === "object") {
      const nested = response.data as {
        orders?: unknown;
        results?: unknown;
        items?: unknown;
      };

      const nestedCollections = [nested.orders, nested.results, nested.items];

      for (const collection of nestedCollections) {
        if (Array.isArray(collection)) {
          return collection.filter(this.isRawOrder);
        }
      }
    }

    return [];
  }

  private isRawOrder(value: unknown): value is RawOrder {
    return !!value && typeof value === "object";
  }
}
