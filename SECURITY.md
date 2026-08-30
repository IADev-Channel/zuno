# Security Policy

## Supported versions

Security fixes are provided for the latest published version of each Zuno
package. Older pre-1.0 releases may be asked to upgrade before a fix is applied.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private
security-advisory reporting flow for `IADev-Channel/zuno` and include affected
versions, reproduction steps, impact, and any suggested mitigation.

Expect an acknowledgement within seven days. Disclosure timing is coordinated
after the issue is reproduced and a supported release is available.

## Scope

Zuno validates protocol payloads and provides authorization hooks, but the host
application owns authentication, TLS, CORS, tenant selection, secret handling,
rate limiting, and access to persistence files or services.
