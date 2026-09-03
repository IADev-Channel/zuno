# Capacity Validation

For a step-by-step developer testing, diagnosis, and experience-reporting
process, see the [Capacity Testing Runbook](./capacity-testing-runbook.md).

Milestone 13 delivers versioned workload profiles, independently runnable
load-generator shards, strict report aggregation, and machine-readable SLO
checks. It intentionally separates repeatable gateway simulation from an
operator's end-to-end network capacity claim.

## CI smoke test

`pnpm verify` runs `pnpm capacity:smoke` after the build and unit tests. The
smoke profile creates 1,000 scoped connections across two gateways, exercises
fan-out and one-percent reconnect churn, aggregates its report, and fails when
an admission, delivery, latency, reconnect, or memory check misses its SLO.

## Distributed 200k gateway profile

The manual **Capacity validation** GitHub workflow runs the versioned
`benchmarks/profiles/200k-gateway.json` profile on 20 independent runners. Each
runner owns 10,000 connections distributed across two gateways. The aggregation
job rejects missing, duplicate, or mismatched-profile shards before evaluating
the combined SLOs. Raw shard reports are retained for 30 days and the aggregate
summary for 90 days.

A shard can also run on any load-generator host:

```bash
pnpm build-core
pnpm capacity:run -- \
  --profile benchmarks/profiles/200k-gateway.json \
  --shard-index 0 \
  --shard-count 20 \
  --output shard-0.json
```

After collecting all 20 reports:

```bash
pnpm capacity:aggregate -- \
  --profile benchmarks/profiles/200k-gateway.json \
  --reports reports/shard-*.json \
  --output capacity-summary.json
```

The profile hash binds every report to the exact JSON workload. Aggregation
requires every shard exactly once, preventing a partial run from being reported
as a successful 200,000-connection result.

## Scope and claim boundary

The current profile exercises Zuno's connection gateway, indexed subscription
fan-out, reconnect admission, metrics, and memory in-process. It does not include
TLS, kernel socket limits, reverse proxies, load balancers, WebSocket/SSE framing,
or a production database/event bus. Passing it is required evidence for the
gateway layer, but is not sufficient to claim 200,000 production connections.

Zuno does not guarantee a fixed concurrent-connection count. Before setting an
operational limit, add and pass a versioned end-to-end profile against the
deployment topology that will carry the traffic. Record instance types, regions,
gateway count, persistence/event-bus configuration, payload and mutation rates,
subscription distribution, reconnect pattern, duration, and
connection/fan-out latency SLOs. Production feedback and retained reports can
then drive targeted improvements when an application approaches its limits.
