import { Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

registry.setDefaultLabels({ app: 'fjord' });
collectDefaultMetrics({ register: registry });
