# Support Policy

Zuno is a pre-1.0 open-source project. Questions, reproducible bug reports, and
feature proposals are accepted through GitHub Issues. Security reports must use
the private process in `SECURITY.md`.

The latest published package versions and the Node.js/framework ranges in
`docs/compatibility.md` are supported. Best-effort help is available for older
versions, custom transports, and third-party persistence adapters, but fixes may
require upgrading to the latest release.

A useful bug report includes package versions, runtime, a minimal reproduction,
expected and actual behavior, and relevant structured Zuno status/log output.
No response-time or uptime SLA is provided.

Zuno does not guarantee a fixed concurrent-connection capacity. Limits depend
on workload shape, gateway count, host resources, regions, load balancers,
SSE/WebSocket settings, persistence, and event-bus infrastructure. Use the
versioned profiles and SLO tooling in `docs/capacity-validation.md` against a
production-like topology before setting an operational limit. Capacity reports
from one topology must not be treated as guarantees for another.
Use `docs/capacity-testing-runbook.md` to collect a reproducible, sanitized
capacity issue or production-experience report.
