import axiosImport, { type AxiosInstance, type AxiosStatic } from "axios";

const DONUT_AUCTION_BASE_URL = "https://api.donut.auction";
const axios = axiosImport as unknown as AxiosStatic;

export class OrdersClient {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: DONUT_AUCTION_BASE_URL,
      timeout: 10_000,
    });
  }

  async fetchOrders({
    query = "",
    cursor = "",
    sort = "MaxPrice",
  }: {
    query?: string;
    cursor?: string;
    sort?: string;
  } = {}): Promise<unknown> {
    const response = await this.client.get("/v2/orders/search/", {
      params: {
        query,
        cursor,
        sort,
      },
    });

    return response.data;
  }
}
