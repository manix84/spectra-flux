# Security Policy 🔐

## Supported Versions ✅

Security fixes target the current `main` branch and the latest published app version.

## Reporting a Vulnerability 🚨

Please do not open a public issue for security-sensitive reports.

Use a private advisory if the repository enables GitHub Security Advisories, or contact the maintainer through a private channel. Include:

- 📝 A clear description of the issue
- 🔁 Steps to reproduce
- ⚠️ Potential impact
- 🩹 Suggested mitigation, if known

Please allow time for triage before public disclosure. The maintainer may ask for more detail, confirm the scope, and coordinate a fix before publishing notes.

## Scope 🧭

This is a browser-only visualizer. The most relevant areas are dependency safety, permission handling for microphone/display capture, and PWA service worker behaviour.

## Out of Scope 🌐

- Browser or operating system capture behaviour outside this app's control
- Reports that require physical access to a user's device
- Generic dependency reports without a reachable impact in this project
