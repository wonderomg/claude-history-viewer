# Security Policy

## Supported Versions

Security fixes are provided for the latest release on the default branch.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report security issues via [GitHub Security Advisories](https://github.com/wonderomg/claude-history-viewer/security/advisories/new) or by opening a private report through the repository maintainer.

Include:

- A description of the issue and potential impact
- Steps to reproduce
- Your environment (OS, Node.js version)

We aim to acknowledge reports within a reasonable timeframe.

## Scope Notes

This application reads local conversation files under `~/.claude` and `~/.cursor`. It is intended for **local use only**. Do not expose the API port to untrusted networks without authentication and a reverse proxy.
