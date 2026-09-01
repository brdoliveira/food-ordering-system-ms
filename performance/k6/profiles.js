const httpThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<750'],
};

const sagaThreshold = {
  saga_completion_within_60s: ['rate>0.95'],
};

export const performanceProfiles = {
  smoke: {
    name: 'smoke',
    options: {
      scenarios: {
        order_flow: {
          executor: 'constant-vus',
          vus: 5,
          duration: '30s',
        },
      },
      thresholds: {
        ...httpThresholds,
        ...sagaThreshold,
      },
    },
  },
  load: {
    name: 'load',
    options: {
      scenarios: {
        order_flow: {
          executor: 'ramping-vus',
          startVUs: 10,
          stages: [
            { duration: '5m', target: 50 },
            { duration: '2m', target: 50 },
          ],
        },
      },
      thresholds: {
        ...httpThresholds,
        ...sagaThreshold,
      },
    },
  },
  stress: {
    name: 'stress',
    options: {
      scenarios: {
        order_flow: {
          executor: 'ramping-vus',
          startVUs: 50,
          stages: [
            { duration: '6m', target: 150 },
            { duration: '1m', target: 150 },
          ],
        },
      },
      thresholds: {
        ...httpThresholds,
        ...sagaThreshold,
      },
    },
  },
};

export function optionsFor(profileName) {
  const profile = performanceProfiles[profileName];
  if (!profile) {
    throw new Error(`Unknown K6_PROFILE "${profileName}". Use smoke, load, or stress.`);
  }
  return profile.options;
}
