# Multi-client Benchmarks

Run the reproducible benchmark with `pnpm benchmark`.

The workload models 100 clients producing 100 authoritative mutations each
(10,000 total) across independent stores using the in-memory persistence
adapter. A second workload has 100 clients write from the same base version to
verify that exactly one mutation is accepted and the other 99 are reported as
version conflicts.

Results are machine-dependent and are not an SLA. Record the Node.js version,
hardware, persistence adapter, and command output when comparing changes. The
in-memory result measures protocol and compare-and-set overhead; production
persistence, network latency, serialization size, subscribers, and event-bus
fan-out must be benchmarked in the deployment environment.

## Reference run

Recorded on 2026-08-30 with Node.js 24.13.0 on the development machine:

| Metric | Result |
| --- | ---: |
| Clients | 100 |
| Mutations | 10,000 |
| Elapsed | 170.84 ms |
| Throughput | 58,534 operations/second |
| Contended writes accepted | 1 |
| Version conflicts detected | 99 |
