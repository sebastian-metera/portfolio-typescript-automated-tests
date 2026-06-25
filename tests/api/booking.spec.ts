import { test, expect, APIRequestContext, APIResponse } from "@playwright/test";
import { testConfig } from "../../src/core/test-config";
import { request } from "node:http";
import { ok } from "node:assert";

const apiUrl: string = testConfig.apiBaseUrl;

type BookingQueryParams = {
  checkin?: string;
  checkout?: string;
  lastname?: string;
};

async function getBookingIds(
  request: APIRequestContext,
  params?: BookingQueryParams,
): Promise<APIResponse> {
  return request.get(`${apiUrl}/booking`, { params });
}

async function getBookingById(
  request: APIRequestContext,
  bookingId: number,
): Promise<APIResponse> {
  return request.get(`${apiUrl}/booking/${bookingId}`);
}

function expectJsonContentType(response: APIResponse) {
  expect(response.headers()["content-type"]).toContain("application/json");
}

test.describe("@api get booking ids", () => {
  test("get all booking ids", async ({ request }) => {
    type BookingIdResponse = {
      bookingid: number;
    };

    const response = await getBookingIds(request);

    expect(response.status()).toBe(200);
    expectJsonContentType(response);

    const body = (await response.json()) as BookingIdResponse[];

    expect(body).not.toHaveLength(0);

    const bookingIds = body.map((item) => item.bookingid);

    expect(bookingIds).toContain(3);
    expect(body).not.toContainEqual({ bookingid: 9999 });
  });

  test("should not have any bookings - filter by last name", async ({
    request,
  }) => {
    const response = await getBookingIds(request, { lastname: "brown" });

    expect(response.status()).toBe(200);
    expectJsonContentType(response);

    const body = await response.json();

    expect(body).toEqual([]);
  });

  test("should filter by checkin date", async ({ request }) => {
    type BookingIdResponse = {
      bookingid: number;
    };

    const response = await getBookingIds(request, { checkin: "2025-01-01" });

    expect(response.status()).toBe(200);
    expectJsonContentType(response);

    const body = (await response.json()) as BookingIdResponse[];

    expect(body).not.toBe([]);

    const bookingIds = body.map((item) => item.bookingid);
    expect(
      //TODO: make it less fragile - check full objects, not primitives only
      bookingIds.includes(4) || bookingIds.includes(10),
    ).toBeTruthy();
  });

  test("should filter by checkout date", async ({ request }) => {
    type BookingIdResponse = {
      bookingid: number;
    };

    const today = new Date().toISOString().split("T")[0];
    const response = await getBookingIds(request, { checkout: today });

    expect(response.status()).toBe(200);
    expectJsonContentType(response);

    const body = (await response.json()) as BookingIdResponse[];
    const bookingIds = body.map((item) => item.bookingid);

    expect(bookingIds).not.toHaveLength(0);
  });

  test("should have 1278 bookings until 2020-12-31", async ({ request }) => {
    type BookingIdResponse = {
      bookingid: number;
    };

    const response = await getBookingIds(request, { checkout: "2020-12-31" });

    expect(response.status()).toBe(200);

    const body = (await response.json()) as BookingIdResponse[];
    const bookingIds = body.map((item) => item.bookingid);

    expect(bookingIds).toHaveLength(1278);
  });

  test("should return booking ids that are in a range between checkin and checkout dates", async ({
    request,
  }) => {
    type BookingIdResponse = {
      bookingid: number;
    };
    const response = await getBookingIds(request, {
      checkin: "2026-01-01",
      checkout: "2026-06-22",
    });

    expect(response.status()).toBe(200);

    const body = (await response.json()) as BookingIdResponse[];
    expect(body).not.toHaveLength(0);

    const bookingIds = body.map((item) => item.bookingid);
    expect(bookingIds).toContain([2205, 2332]);
  });

  test("should return error when checkin later than checkout", async ({
    request,
  }) => {
    const response = await getBookingIds(request, {
      checkin: "2027-10-01",
      checkout: "2026-11-01",
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);

    const body = await response.json();
    expect(body).not.toHaveProperty("bookingid");
    expect(body.message).toContain("Invalid date range"); //assumption, since they send 200 OK with empty array
  });
});

test.describe("@api get bookings by id", () => {
  test("should return all fields of details of specific booking", async ({
    request,
  }) => {
    const response = await getBookingById(request, 11);

    expect(response.status()).toBe(200);
    expectJsonContentType(response);
    expect(parseInt(response.headers()["content-length"])).toBeGreaterThan(0);

    const body = await response.json();

    expect(body).toEqual({
      firstname: "John",
      lastname: "Smith",
      totalprice: 111,
      depositpaid: true,
      bookingdates: {
        checkin: "2018-01-01",
        checkout: "2019-01-01",
      },
      additionalneeds: "Breakfast",
    });
  });

  test("should return details of booking without additional needs field", async ({
    request,
  }) => {
    const response = await getBookingById(request, 1);

    expect(response.status()).toBe(200);
    expectJsonContentType(response);

    const body = await response.json();

    expect(body).not.toHaveProperty("additionalneeds");
    expect(body.firstname).toBe("Mary");
    expect(body.lastname).toBe("Wilson");
    expect(typeof body.totalprice).toBe("number");
    expect(body.totalprice).toBe(637);
    expect(body.depositpaid).toBeTruthy();
    expect(body.bookingdates.checkin).toBe("2015-04-01");
    expect(body.bookingdates.checkout).toBe("2023-04-20");
  });

  test("should return 404 error for non-existing booking id", async ({
    request,
  }) => {
    const response = await getBookingById(request, 9999);

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(await response.text()).toBe("Not Found");
  });
});

test.describe("@api create bookings", () => {
  test("Should create booking using JSON", async ({ request }) => {
    const response = await request.post(`${apiUrl}/booking`, {
      data: {
        firstname: "Betty",
        lastname: "Stayer",
        totalprice: 128,
        depositpaid: true,
        bookingdates: {
          checkin: "2027-01-01",
          checkout: "2027-01-17",
        },
        additionalneeds: "Late check-in, between 20 and 22",
      },
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toHaveProperty("bookingid");
    expect(responseBody.booking).toStrictEqual({
      firstname: "Betty",
      lastname: "Stayer",
      totalprice: 128,
      depositpaid: true,
      bookingdates: {
        checkin: "2027-01-01",
        checkout: "2027-01-17",
      },
      additionalneeds: "Late check-in, between 20 and 22",
    });
  });

  // should create booking using XML

  // should create booking without additionalneeds field

  // should return error: incomplete booking details
  // should return error: dates in past
  // should return error: checkin later than checkout
  // should return error: price not a number
});
