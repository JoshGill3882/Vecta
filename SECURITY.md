# Security policy

Vecta is a single-user, self-hosted application whose main job is standing between the internet and your data. Reports about that job are taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** A public issue hands the exploit to everyone who is running the app before there is a fix for them to run.

Use GitHub's private reporting instead: go to the [Security tab](https://github.com/JoshGill3882/Vecta/security) and choose **Report a vulnerability**. That opens a private advisory visible only to you and the maintainer, with somewhere to discuss a fix and coordinate disclosure.

Useful things to include, to the extent you have them:

- What an attacker can do that they should not be able to
- The steps to reproduce it, and the version or image digest you saw it on
- Which database engine you are running, if it seems relevant

## What happens next

This project has one maintainer working on it in spare time, so the honest answer is **best effort**. You should expect an acknowledgement within a week or so, and a considered reply after that. If the report is valid, a fix goes out as a patch release and you get credit in the advisory unless you would rather not.

There is no bug bounty, and no promise of a fix within a fixed window. If that is not good enough for your purposes, please say so in the report rather than after.

## Supported versions

| Version          | Supported |
| ---------------- | --------- |
| Latest release   | ✅        |
| Anything earlier | ❌        |

Fixes land in the next release. Nothing is back-ported to older versions — upgrading is the supported path, and the [upgrade guide](./README.md#upgrading) covers it.

## Scope

Things worth reporting, as examples rather than an exhaustive list:

- Authentication bypass, or reaching any route while signed out
- Forging or tampering with a session cookie
- SQL injection, or any escape from the query layer
- Stored or reflected XSS, particularly through Markdown in a task description
- Remote code execution, or anything reachable from a request that should not be

**Things that are the deployer's responsibility, and are documented as such in the [README's security section](./README.md#security):**

- The container serving plain HTTP. TLS termination belongs to a reverse proxy in front of it; exposing the port directly is a deployment decision, not an application flaw.
- A weak or absent `ADMIN_PASSWORD`. The app refuses to start without one but cannot judge its strength.
- Reusing the placeholder `SESSION_SECRET` from `.env.example`. It is published in this repository precisely so it is obviously not a real one.
- Exposing an instance to the internet without a reverse proxy, authentication in front of it, or a network boundary.

Reports in that second group are not rejections of your effort — they are decisions already made and written down. If you think one of them is the wrong decision, an issue is the right place for that conversation.

## Denial of service

A single-user application on hardware you control has a different threat model from a hosted service. Resource exhaustion by the one person who can log in is not treated as a vulnerability. Something an _unauthenticated_ request can do to take an instance down is.
