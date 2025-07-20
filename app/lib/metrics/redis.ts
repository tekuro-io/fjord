import { Histogram } from 'prom-client';
import { registry } from './registry';

export const redisScannerReadDuration = new Histogram({
  name: 'redis_scanner_read_duration',
  help: 'Time it took to read the scanner from redis',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

registry.registerMetric(redisScannerReadDuration);
