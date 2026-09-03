# Capacity Testing and Experience Report Runbook

Use this runbook when evaluating Zuno at high connection counts or reporting a
capacity problem. A report is useful even below 200,000 connections: the first
repeatable limit often reveals more than the headline target.

Zuno does not guarantee a fixed connection count. Results belong to the exact
application workload and deployment topology that produced them.

## 1. Start with the local regression profile

Build the current branch and run the same bounded test used by CI:

```bash
pnpm install --frozen-lockfile
pnpm build-core
pnpm capacity:smoke
```

The command must admit 1,000 connections, complete reconnect churn, deliver all
expected fan-out messages, and pass the latency and memory checks. If it fails,
save the full JSON output and run `pnpm verify` before testing a deployment.

## 2. Run the optional distributed gateway simulation

From GitHub, open **Actions → Capacity validation → Run workflow** on the commit
being evaluated. The workflow distributes the `gateway-200k-v1` profile across
20 runners and produces:

- `capacity-shard-0` through `capacity-shard-19` raw report artifacts
- one `capacity-summary` aggregate artifact
- an explicit pass/fail result for every configured SLO

This tests 200,000 in-process gateway connections. It does not open 200,000 real
SSE or WebSocket connections and must not be presented as a production-network
capacity result.

The same profile can be distributed across developer-owned generators. Give
each generator a unique zero-based index and keep the shard count identical:

```bash
pnpm build-core
pnpm capacity:run -- \
  --profile benchmarks/profiles/200k-gateway.json \
  --shard-index 0 \
  --shard-count 20 \
  --output shard-0.json
```

Collect every shard and aggregate them:

```bash
pnpm capacity:aggregate -- \
  --profile benchmarks/profiles/200k-gateway.json \
  --reports reports/shard-*.json \
  --output capacity-summary.json
```

Aggregation fails if a shard is missing, duplicated, or produced from a
different profile. Do not edit a generated report to make an SLO pass.

## 3. Test a real deployment gradually

Use a staging environment that matches production. Do not begin with 200,000
connections or run an unapproved load test against a shared production system.
Increase the load in controlled stages such as 1,000, 5,000, 10,000, 25,000,
50,000, and then higher only while error and latency budgets remain healthy.

For every stage, exercise both a stable period and failure scenarios:

- connect and hold SSE or WebSocket sessions
- publish representative mutation and payload rates
- use the real partition/topic distribution, including hot partitions
- reconnect a controlled percentage of clients simultaneously
- drain and replace at least one gateway
- slow selected consumers until backpressure recovery is exercised
- verify authoritative replay or snapshot convergence after interruption

Stop the test when it threatens unrelated workloads, produces sustained server
errors, exhausts database connections, or exceeds the agreed cost budget.

## 4. Record the environment

Capacity results without environment details cannot be compared. Record:

- Zuno package versions and exact git commit
- date, duration, and test profile file
- cloud/provider, regions, instance types, CPU, memory, and gateway count
- load balancer, proxy, TLS, idle-timeout, and keep-alive configuration
- SSE versus WebSocket connection counts
- persistence adapter, database size/tier, and connection-pool settings
- event-bus implementation, partitions, replication, and consumer settings
- total clients, ramp rate, reconnect rate, mutation rate, and payload sizes
- subscription count and partition/topic distribution per client
- p50, p95, and p99 connect, mutation, and fan-out latency
- connection failures, disconnects, HTTP errors, conflicts, retries, and resyncs
- gateway CPU, memory, event-loop delay, open handles, and network throughput
- database and event-bus latency, throughput, saturation, and error metrics
- estimated or actual test cost

Attach the unchanged workload profile, raw shard reports, aggregate summary, and
relevant metrics dashboard export. Remove tokens, cookies, user data, internal
hostnames, and other secrets before sharing artifacts publicly.

## 5. Diagnose the first failing signal

| Signal | Likely area to inspect |
| --- | --- |
| Connection admission errors | Gateway limits, per-principal limits, file descriptors, load-balancer capacity |
| High connect latency | Ramp rate, TLS handshakes, proxy queues, reconnect storms |
| Missing fan-out delivery | Subscription scope, event-bus offsets, gateway routing, slow-consumer eviction |
| High fan-out latency | Hot topics, gateway CPU/event loop, serialization, event-bus lag |
| Frequent `RESYNC_REQUIRED` | Client read speed, pending-message limits, network stalls |
| Mutation latency or conflicts | Database contention, partition leadership, incorrect base versions |
| Excess memory per connection | Pending buffers, subscription cardinality, listeners, payload retention |
| Uneven gateway load | Load-balancer affinity, regional routing, connection draining |

Change one capacity variable at a time when possible. A smaller repeatable test
is preferable to a larger result that cannot be reproduced.

## 6. Report an issue or production experience

Open a GitHub issue with a title such as:

```text
Capacity: fan-out p95 exceeds SLO at 25k WebSocket connections
```

Use this body template:

```markdown
## Summary
What limit or behavior did you observe?

## Versions
- Zuno packages:
- Git commit:
- Node/Bun/runtime:

## Deployment topology
- Provider/regions:
- Gateway count and instance type:
- Load balancer/proxy:
- Persistence:
- Event bus:

## Workload
- Profile and profile hash:
- Duration and ramp rate:
- Peak concurrent connections:
- SSE/WebSocket split:
- Mutations per second and payload size:
- Partitions/topics/subscriptions:
- Reconnect or drain scenario:

## Results
- Connect p95/p99:
- Fan-out p95/p99:
- Error/disconnect/conflict/resync rates:
- CPU/memory/network:
- Database/event-bus metrics:
- First failing connection level:

## Reproduction
Commands or minimal repository needed to reproduce the result.

## Artifacts
Sanitized profile, raw reports, aggregate summary, logs, and graphs.
```

State whether the report came from simulation, staging, or production. If the
problem includes a security vulnerability or sensitive tenant data, follow
`SECURITY.md` instead of opening a public issue.
