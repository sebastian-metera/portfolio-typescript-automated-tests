import { test, expect, APIRequestContext, APIResponse } from "@playwright/test";
import { testConfig } from "../../src/core/test-config";
import { request } from "node:http";
import { ok } from "node:assert";
import { create } from "node:domain";

const bookingUrl: string = testConfig.apiBaseUrl + "/booking";

type BookingQueryParams = {
  checkin?: string;
  checkout?: string;
  lastname?: string;
};

interface Payload {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: {
    checkin: string;
    checkout: string;
  };
  additionalneeds?: string;
}

async function getBookingIds(
  request: APIRequestContext,
  params?: BookingQueryParams,
): Promise<APIResponse> {
  return request.get(bookingUrl, { params });
}

async function getBookingById(
  request: APIRequestContext,
  bookingId: number,
): Promise<APIResponse> {
  return request.get(`${bookingUrl}/${bookingId}`);
}

async function createBooking(
  request: APIRequestContext,
  payload: Payload | string,
  headers?: { "content-type": string; accept: string },
): Promise<APIResponse> {
  return request.post(bookingUrl, { data: payload, headers: headers });
}

async function getAuthToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${testConfig.apiBaseUrl}/auth`, {
    data: { username: "admin", password: "password123" },
  });
  const { token } = await response.json();
  return token;
}
//TODO: ask for token once by assigning it to global variable; to be done when getAuthToken moved to client class

function expectJsonContentType(response: APIResponse) {
  expect(response.headers()["content-type"]).toContain("application/json");
}

const fullyUpdatedBookingPayload = {
  firstname: "James",
  lastname: "Brown",
  totalprice: 111,
  depositpaid: true,
  bookingdates: {
    checkin: "2028-01-01",
    checkout: "2029-01-01",
  },
  additionalneeds: "Breakfast",
};

const partUpdateBookingModel = {
  firstname: "Joe",
  lastname: "Doe",
  totalprice: 128,
  depositpaid: false,
  bookingdates: {
    checkin: "2027-11-01",
    checkout: "2027-11-11",
  },
};

const partUpdatedBookingDetails = {
  firstname: "John",
  lastname: "Doughie",
  totalprice: 256,
  depositpaid: true,
  bookingdates: {
    checkin: "2027-11-01",
    checkout: "2027-11-22",
  },
  additionalneeds: "Bathroom with a shower",
};

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

test.describe("@api create booking", () => {
  test("should create booking using JSON explicitly", async ({ request }) => {
    const payload = {
      firstname: "Betty",
      lastname: "Stayer",
      totalprice: 128,
      depositpaid: true,
      bookingdates: {
        checkin: "2027-01-01",
        checkout: "2027-01-17",
      },
      additionalneeds: "Late check-in, between 20 and 22",
    };
    const requestHeadersJson = {
      "content-type": "application/json",
      accept: "application/json",
    };
    const response = await createBooking(request, payload, requestHeadersJson);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");

    const responseBody = await response.json();

    expect(responseBody).toHaveProperty("bookingid");
    expect(responseBody.booking).toStrictEqual(payload);
  });

  test("should create booking using XML", async ({ request }) => {
    const requestHeadersXml = {
      "content-type": "text/xml",
      accept: "application/xml",
    };
    const payloadXml = `<?xml version="1.0" encoding="utf-8"?>
        <booking>
          <firstname>Joe</firstname>
          <lastname>Doghn</lastname>
          <totalprice>456</totalprice>
          <depositpaid>true</depositpaid>
          <bookingdates>
            <checkin>2027-01-01</checkin>
            <checkout>2027-01-11</checkout>
          </bookingdates>
          <additionalneeds>Breakfast</additionalneeds>
        </booking>`;
    const response = await createBooking(
      request,
      payloadXml,
      requestHeadersXml,
    );

    expect(response.status()).toBe(200);
    // expect(response.headers()["content-type"]).toBe("application/xml");
    // they don't send response in "application/xml" type but in... "text/html"
    expect(response.headers()["content-type"]).toContain("text/html");

    const responseBody = await response.text();

    expect(responseBody).toContain("<created-booking>");
    expect(responseBody).toContain("<bookingid>");
    expect(responseBody).toContain("<firstname>Joe</firstname>");
    expect(responseBody).toContain("<lastname>Doghn</lastname>");
    expect(responseBody).toContain(
      "<additionalneeds>Breakfast</additionalneeds>",
    );
    expect(responseBody).toContain("<checkin>2027-01-01</checkin>");
    expect(responseBody).toContain("<checkout>2027-01-11</checkout>");
  });

  test("should create booking without 'additional needs' field", async ({
    request,
  }) => {
    const payload = {
      firstname: "Mark",
      lastname: "Noadd-needer",
      totalprice: 128,
      depositpaid: true,
      bookingdates: {
        checkin: "2027-01-01",
        checkout: "2027-01-17",
      },
    };
    const response = await createBooking(request, payload);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");

    const responseBody = await response.json();

    expect(responseBody).toHaveProperty("bookingid");
    expect(responseBody.bookingid).toBeGreaterThan(1000);
    expect(responseBody.booking).not.toHaveProperty("additionalneeds");
    expect(responseBody.booking).toEqual(payload);
  });

  // TODO:
  // should return error: incomplete booking details - missing names
  // should return error: incomplete booking details - missing price
  // should return error: incomplete booking details - missing booking dates
  // should return error: dates in past
  // should return error: checkin later than checkout
  // should return error: price not a number
});

test.describe("@api update booking via PUT", () => {
  test("should update booking using JSON - new dates", async ({ request }) => {
    const token = await getAuthToken(request);
    const response = await request.put(`${bookingUrl}/1`, {
      data: fullyUpdatedBookingPayload,
      headers: { cookie: `token=${token}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual(fullyUpdatedBookingPayload);
  });

  test("should update booking using XML", async ({ request }) => {
    const updatedBookingPayloadXml = `<?xml version="1.0" encoding="utf-8"?>
    <booking>
    <firstname>James</firstname>
    <lastname>Brown</lastname>
    <totalprice>111</totalprice>
    <depositpaid>true</depositpaid>
    <bookingdates>
      <checkin>2028-01-01</checkin>
      <checkout>2029-01-01</checkout>
    </bookingdates>
    <additionalneeds>Breakfast</additionalneeds>
    </booking>`;
    const authToken = await getAuthToken(request);
    const response = await request.put(`${bookingUrl}/1`, {
      data: updatedBookingPayloadXml,
      headers: {
        cookie: `token=${authToken}`,
        "content-type": "text/xml",
        accept: "application/xml",
      },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.text();

    expect(responseBody).toContain("<booking>");
    expect(responseBody).toContain("<checkin>2028-01-01</checkin>");
    expect(responseBody).toContain("<checkout>2029-01-01</checkout>");
    expect(responseBody).toContain(
      "<additionalneeds>Breakfast</additionalneeds>",
    );
  });

  test("should update booking using auth via 'Authorization' header", async ({
    request,
  }) => {
    const response = await request.put(`${bookingUrl}/1`, {
      data: fullyUpdatedBookingPayload,
      headers: { authorization: "Basic YWRtaW46cGFzc3dvcmQxMjM=" }, //TODO: move token value to .env despite it's public
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");

    const responseBody = await response.json();

    expect(responseBody).toEqual(fullyUpdatedBookingPayload);
  });

  test("should return error: missing token", async ({ request }) => {
    const response = await request.put(`${bookingUrl}/1`, {
      data: fullyUpdatedBookingPayload,
    });

    expect(response.status()).toBe(403); //would expect 401, but since they return 403... let it be!
    expect(await response.text()).toBe("Forbidden");
  });

  test("should return error: wrong token", async ({ request }) => {
    const response = await request.put(`${bookingUrl}/1`, {
      data: fullyUpdatedBookingPayload,
      headers: { cookie: "invalid-token" },
    });

    expect(response.status()).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  test("should return error: missing booking id", async ({ request }) => {
    const authToken = await getAuthToken(request);
    const response = await request.put(`${bookingUrl}`, {
      data: fullyUpdatedBookingPayload,
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  test("should return error: update using ony 1 field in payload", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const response = await request.put(`${bookingUrl}/1`, {
      data: fullyUpdatedBookingPayload.bookingdates,
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(400);
  });

  // other cases to be checked with getting by bookingId if the API would not rotate data
  // "should accept new names"
  // "should accept lower price"
  // "should add additional needs" // for booking that has no additional needs
  // "should update with all new booking details"
});

test.describe("@api @patch update booking partially", () => {
  test("should update part of booking using JSON - first name", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const { firstname: newFirstName } = partUpdatedBookingDetails;
    const response = await request.patch(`${bookingUrl}/10`, {
      // data: { firstname: "John" },
      data: { firstname: newFirstName },
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      ...partUpdateBookingModel,
      firstname: newFirstName,
    });
  });

  test("should update part of booking using XML - last name", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const response = await request.patch(`${bookingUrl}/3`, {
      data: `<booking>
        <lastname>Doughie</lastname>
      </booking>`,
      headers: {
        cookie: `token=${authToken}`,
        "content-type": "text/xml",
        accept: "application/xml",
      },
    });

    expect(response.status()).toBe(200);
    // expect(response.headers()["content-type"]).toBe("application/xml");
    // yeah, request has "application/xml" in "accept" header but server responds with the "text/html" anyway...
    expect(response.headers()["content-type"]).toContain("text/html");

    const responseBody = await response.text();
    expect(responseBody).toContain("<lastname>Doughie</lastname>");
    expect(responseBody).toContain("<checkin>2016-10-01</checkin>");
    expect(responseBody).toContain("<checkout>2016-12-27</checkout>");
  });

  test("should update part of booking: lower price", async ({ request }) => {
    const authToken = await getAuthToken(request);
    const response = await request.patch(`${bookingUrl}/11`, {
      data: {
        totalprice: 99,
      },
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({ ...partUpdateBookingModel, totalprice: 99 });
  });

  test("should update part of booking: mark deposit as paid", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const response = await request.patch(`${bookingUrl}/12`, {
      data: { depositpaid: true },
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      ...partUpdateBookingModel,
      depositpaid: true,
    });
  });

  test("should update part of booking: add additional needs", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const { additionalneeds: newAdditionalNeeds } = partUpdatedBookingDetails;
    const response = await request.patch(`${bookingUrl}/13`, {
      data: { additionalneeds: newAdditionalNeeds},
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      ...partUpdateBookingModel,
      additionalneeds: newAdditionalNeeds,
    });
  });

  test("should update part of booking: erase additional needs", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const response = await request.patch(`${bookingUrl}/14`, {
      data: { additionalneeds: "" },
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      ...partUpdateBookingModel,
      additionalneeds: "",
    });
  });

  test("should update booking using multiple fields at once: both names", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const {firstname: newFirstName, lastname: newLastName} = partUpdatedBookingDetails;
    const response = await request.patch(`${bookingUrl}/15`, {
      data: { firstname: newFirstName, lastname: newLastName },
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      ...partUpdateBookingModel,
      firstname: newFirstName,
      lastname: newLastName,
    });
  });

  test("should update booking using multiple fields at once: higher price, deposit to true and dates", async ({
    request,
  }) => {
    const authToken = await getAuthToken(request);
    const response = await request.patch(`${bookingUrl}/16`, {
      data: {
        totalprice: 256,
        depositpaid: true,
        bookingdates: {
          checkin: "2027-11-01",
          checkout: "2027-11-22",
        },
      },
      headers: { cookie: `token=${authToken}` },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      ...partUpdateBookingModel,
      totalprice: 256,
      depositpaid: true,
      bookingdates: {
        checkin: "2027-11-01",
        checkout: "2027-11-22",
      },
    });
  });
});
