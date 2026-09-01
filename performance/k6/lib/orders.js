import http from 'k6/http';
import { check } from 'k6';
import { sleep } from 'k6';

const customerBaseUrl = __ENV.CUSTOMER_BASE_URL || 'http://customer-service:8184';
const orderBaseUrl = __ENV.ORDER_BASE_URL || 'http://order-service:8181';

function authorizedJson(token) {
  return {
    headers: {
      Accept: 'application/vnd.api.v1+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

export function createCustomer(token, customer) {
  const response = http.post(
    `${customerBaseUrl}/customers`,
    JSON.stringify(customer),
    { ...authorizedJson(token), tags: { endpoint: 'create_customer' } },
  );
  return check(response, {
    'customer creation returns 200': (result) => result.status === 200,
  });
}

export function createOrder(token, order) {
  const deadline = Date.now() + 30_000;
  let response;
  do {
    response = http.post(
      `${orderBaseUrl}/orders`,
      JSON.stringify(order),
      {
        ...authorizedJson(token),
        responseCallback: http.expectedStatuses(200, 400),
        tags: { endpoint: 'create_order' },
      },
    );
    if (response.status === 200) {
      break;
    }
    if (response.status !== 400) {
      break;
    }
    sleep(1);
  } while (Date.now() < deadline);

  const accepted = check(response, {
    'order creation returns 200': (result) => result.status === 200,
  });
  return accepted ? response.json('orderTrackingId') : null;
}

export function trackOrder(token, trackingId) {
  const response = http.get(
    `${orderBaseUrl}/orders/${trackingId}`,
    { ...authorizedJson(token), tags: { endpoint: 'track_order' } },
  );
  const found = check(response, {
    'order tracking returns 200': (result) => result.status === 200,
  });
  return found ? response.json('orderStatus') : null;
}
