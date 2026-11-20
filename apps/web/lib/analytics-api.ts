import {
  analyticsOverviewResponseSchema,
  kitchenAnalyticsResponseSchema,
  orderAnalyticsResponseSchema,
  paymentAnalyticsResponseSchema,
  popularItemsAnalyticsResponseSchema,
  salesAnalyticsResponseSchema,
  tableAnalyticsResponseSchema,
  type AnalyticsRangeQuery,
} from "@restroflow/contracts";

import { apiError, apiUrl } from "./auth-api";

function params(query: AnalyticsRangeQuery): string {
  return new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
    granularity: query.granularity,
  }).toString();
}

async function analyticsRequest(
  restaurantId: string,
  path: string,
): Promise<unknown> {
  const response = await fetch(`${apiUrl}/api/v1/analytics/${path}`, {
    credentials: "include",
    headers: { "x-restaurant-id": restaurantId },
  });
  if (!response.ok) throw await apiError(response);
  return response.json();
}

export async function fetchAnalyticsOverview(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return analyticsOverviewResponseSchema.parse(
    await analyticsRequest(restaurantId, `overview?${params(query)}`),
  ).overview;
}

export async function fetchSalesAnalytics(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return salesAnalyticsResponseSchema.parse(
    await analyticsRequest(restaurantId, `sales?${params(query)}`),
  ).sales;
}

export async function fetchPaymentAnalytics(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return paymentAnalyticsResponseSchema.parse(
    await analyticsRequest(restaurantId, `payments?${params(query)}`),
  ).payments;
}

export async function fetchPopularItemsAnalytics(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return popularItemsAnalyticsResponseSchema.parse(
    await analyticsRequest(
      restaurantId,
      `popular-items?${params(query)}&limit=5`,
    ),
  ).popularItems;
}

export async function fetchOrderAnalytics(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return orderAnalyticsResponseSchema.parse(
    await analyticsRequest(restaurantId, `orders?${params(query)}`),
  ).orders;
}

export async function fetchTableAnalytics(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return tableAnalyticsResponseSchema.parse(
    await analyticsRequest(restaurantId, `tables?${params(query)}`),
  ).tables;
}

export async function fetchKitchenAnalytics(
  restaurantId: string,
  query: AnalyticsRangeQuery,
) {
  return kitchenAnalyticsResponseSchema.parse(
    await analyticsRequest(restaurantId, `kitchen?${params(query)}`),
  ).kitchen;
}
