import { sleep } from 'k6';
import { Rate } from 'k6/metrics';

import { fetchAccessToken } from './lib/auth.js';
import { createCustomer, createOrder, trackOrder } from './lib/orders.js';
import { optionsFor } from './profiles.js';

const profileName = __ENV.K6_PROFILE || 'smoke';
const orderTemplate = JSON.parse(open('./data/orders.json'));
const sagaCompletionWithinSixtySeconds = new Rate('saga_completion_within_60s');
const sagaTimeoutSeconds = 60;
const pollingIntervalSeconds = 1;
const runId = (__ENV.K6_RUN_ID || Date.now().toString(16))
  .replace(/[^0-9a-f]/gi, '')
  .slice(-8)
  .padStart(8, '0');

export const options = optionsFor(profileName);

let accessToken;
let customer;

function virtualUserCustomer() {
  const suffix = `${runId}${__VU.toString(16).padStart(4, '0')}`;
  return {
    customerId: `00000000-0000-4000-8000-${suffix}`,
    username: `k6-${runId}-vu-${__VU}`,
    firstName: 'Performance',
    lastName: `VirtualUser${__VU}`,
  };
}

function orderFor(customerId) {
  return {
    customerId,
    restaurantId: orderTemplate.restaurantId,
    price: orderTemplate.item.subTotal,
    items: [orderTemplate.item],
    address: orderTemplate.address,
  };
}

function ensureVirtualUserIsReady() {
  if (!accessToken) {
    accessToken = fetchAccessToken();
  }
  if (!customer) {
    customer = virtualUserCustomer();
    if (!createCustomer(accessToken, customer)) {
      throw new Error('Could not create isolated customer data for the virtual user.');
    }
  }
}

function awaitTerminalSaga(trackingId) {
  const deadline = Date.now() + sagaTimeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const status = trackOrder(accessToken, trackingId);
    if (status === 'APPROVED' || status === 'CANCELLED') {
      sagaCompletionWithinSixtySeconds.add(true);
      return true;
    }
    sleep(pollingIntervalSeconds);
  }
  sagaCompletionWithinSixtySeconds.add(false);
  return false;
}

export function setup() {
  // This endpoint is public and fails before load begins when the stack is not ready.
  return { profileName };
}

export default function orderFlow() {
  ensureVirtualUserIsReady();
  const trackingId = createOrder(accessToken, orderFor(customer.customerId));
  if (!trackingId) {
    sagaCompletionWithinSixtySeconds.add(false);
    return;
  }
  awaitTerminalSaga(trackingId);
}
