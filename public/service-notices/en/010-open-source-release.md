---
title: "SYU CAMPUS Open Source Release and Contribution Guide"
lang: en
sourceSha256: 9507f2a47ec7b11c9381d14690fc22b10ba8a50071d5cc2356f68e25a128151e
---

Hello from SYU CAMPUS.

We have published the SYU CAMPUS source code on GitHub. Explore how the service is built and operated, and use it for learning, research, bug reports, and suggestions for improvements.

---

## Public repository

- [SYU CAMPUS GitHub repository](https://github.com/syu-kr/campus.syu.kr)

The code uses Next.js, React, TypeScript, and Tailwind CSS. It includes the implementation of notices, cafeteria menus, shuttle information, academic schedules, and other features, together with operational automation.

The code is available under the MIT License. Please read the repository's `LICENSE` file for the exact terms governing copying, modification, and distribution. Separate rights may apply to logos, trademarks, and data provided by the university or external organizations.

---

## Ways to use and contribute

We welcome the following uses of the public repository:

- Learning how a web service is structured and implemented
- Reference material for personal projects and research
- Reporting bugs and steps to reproduce them
- Suggesting usability improvements and new features
- Improving documentation, accessibility, and performance
- Submitting Pull Requests with your own changes

We welcome contributions ranging from typo fixes to feature improvements.

---

## Before contributing code

Before modifying code to contribute, read [`CONTRIBUTING.md`](https://github.com/syu-kr/campus.syu.kr/blob/main/CONTRIBUTING.md) and [`DEVELOPMENT.md`](https://github.com/syu-kr/campus.syu.kr/blob/main/DEVELOPMENT.md), and follow their instructions carefully.

The main contribution steps are:

1. Keep changes focused on the relevant feature and submit them in small units.
2. Do not add dummy or mock data to production data.
3. When adding an environment variable, update the example file and related documentation.
4. Before submitting, run `npm run check` to check lint, types, unused code, crawler syntax, and the production build.
5. Update related documentation when user behavior or deployment procedures change.
6. Submit changes as a Pull Request and check that all required checks pass.

Changes that do not follow the contribution guide or could affect production stability may not be accepted.

---

## Reporting bugs and security vulnerabilities

Report ordinary bugs and suggestions through GitHub Issues or Contact the site. Include steps to reproduce the issue, the environment, expected behavior, and actual behavior so we can investigate more quickly.

Do not publish vulnerability details, secrets, or personal information in public Issues. Use the repository's **Security > Report a vulnerability** feature to report security issues privately. If that option is unavailable, first contact `singhic@outlook.kr` without making the details public.

For more information, read [`SECURITY.md`](https://github.com/syu-kr/campus.syu.kr/blob/main/SECURITY.md).

---

## Attacks using the public code are prohibited

Publishing the source code does not authorize attacks, penetration testing, or unauthorized access against the running SYU CAMPUS service or connected university and external systems.

The following actions are strictly prohibited:

- Disrupting normal service operation or deliberately placing load on the server
- Using analysis of the public code to attempt authentication bypass, unauthorized access, hacking, or system compromise
- Exploiting vulnerabilities or collecting other people's personal or nonpublic information
- Malicious crawling, scraping, or use of automation tools or bots
- Harming university systems or connected external services

Such conduct may result in restrictions under the SYU CAMPUS [Terms of Service](/terms). Depending on the conduct and harm, it may also lead to criminal penalties or civil liability for damages under applicable law. Perform testing and research only in a local environment you control or an environment where you have lawful authorization.

---

## Help us build a better service

We are publishing the code so that more people can learn how the service works, identify problems, and suggest improvements together.

We hope the public repository becomes a useful learning resource and helps make SYU CAMPUS more stable and convenient.

Thank you.
