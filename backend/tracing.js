const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://jaeger-collector.observability.svc.cluster.local:4318/v1/traces',
});

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('Tracing initialized');

process.on('SIGTERM', () => {
  sdk.shutdown().catch((err) => {
    console.error('OpenTelemetry shutdown error:', err);
  });
});
