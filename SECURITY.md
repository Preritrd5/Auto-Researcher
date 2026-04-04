# Security Policy

## Supported Versions

This project is currently maintained as a fast-moving early release.

| Version | Supported |
| --- | --- |
| `0.1.x` | Yes |
| `< 0.1.0` | No |

## Reporting a Vulnerability

Please avoid opening a public issue with exploitable details.

Preferred path:

1. Use GitHub private vulnerability reporting for this repository if the "Report a vulnerability" option is available in the Security tab.
2. If that option is unavailable, open a minimal public issue titled `[Security] Request private disclosure channel` without including reproduction steps, payloads, or secrets.
3. The maintainer will reply with a private coordination path before asking for sensitive details.

Please include:

- affected component or file path
- impact summary
- reproduction conditions
- whether credentials, data, or remote code execution are involved
- any suggested mitigation, if known

## Response Expectations

- Initial triage target: within 5 business days
- Status update target: within 10 business days
- Coordinated disclosure is preferred after a fix or mitigation is available

## Scope

Security reports are especially helpful for:

- secret handling and credential leakage
- unsafe command execution or sandbox escapes
- SSRF, path traversal, or arbitrary file access
- insecure provider integrations
- unsafe SSH or Docker execution defaults
- authentication, authorization, or API exposure regressions

## Safe Harbor

Good-faith security research that avoids data destruction, service abuse, or privacy violations is welcome. Please keep testing narrowly scoped and do not access data or systems you do not own.

