---
title: "Terms of Service and Privacy Policy Revision"
lang: en
sourceSha256: bfe7b9ad6e254594a15e8e44f227fd0f955ba1527ed55ddacb42d7d0ec7e88f5
---

Hello from SYU CAMPUS.

We have revised the **Terms of Service** and **Privacy Policy** to explain service features and actual operation more accurately.

This revision does not request new mandatory permissions or reduce users' rights. It clarifies the information processed by existing features, including timetable sharing, schedule polls, push notifications, and reviews of inquiries and suggestions.

---

## Dates

- Revision date: June 21, 2026
- Effective date: June 21, 2026

---

## Additions

### Terms of Service

- Added an explanation that selected course identifiers, academic year, semester, and browser information may be stored to create and load timetable share links.
- Added an explanation that campus tip suggestions and inquiries may be classified, held, kept private, deleted, checked for safety, or edited for clarity during operator review.
- Added an explanation that the operator may use an AI classification assistant to prioritize inquiries and suggestions and decide how to handle them.
- Added an explanation that the Privacy Policy governs specific personal-information items, retention periods, processing arrangements, overseas processing, and deletion methods.

### Privacy Policy

- Added the creation and loading of timetable share links to the purposes of processing personal information.
- Added the following timetable-sharing data items:
  - Course identifiers included in a share link
  - Academic year and semester
  - Browser information at the time a share link is created
- Added edit-token hashes used to modify schedule poll responses.
- Specified operational and security information, including request-limit counters, locks preventing duplicate notifications, and notification delivery records.
- Added an explanation that AI classification results and their creation times may be stored for operator review.
- Clarified the provision of personal information to third parties:
  - In principle, personal information is not provided to third parties. Processing is limited to the relevant scope when there is a statutory exception or user consent.
- Added a separate explanation of external services and possible overseas processing involving Google, Vercel, GitHub, Kakao, and the configured AI classification API.
- Added methods for deleting server data after its retention period:
  - Expired data is deleted through Firestore TTL or scheduled cleanup jobs.
  - Users can remove local-storage information by clearing browser data or changing service settings.

---

## Revisions

### Terms of Service

- Updated the academic information section to include timetable building and sharing.
- Aligned personal-information explanations with the features currently operating.
- Clarified that inquiries and suggestions do not guarantee an individual reply and may be used for service improvements and data corrections.

### Privacy Policy

- Specified a maximum retention period of 90 days for schedule poll information, reflecting actual operation.
- Specified a maximum retention period of 90 days from the creation of a timetable share link.
- Specified a maximum retention period of 14 days for duplicate-notification prevention records.
- Aligned explanations of Google Analytics, Search Console, Firebase, Firestore, and AI classification assistance with their actual purposes.
- Clarified effective-date and last-revision-date labels.

---

## Removals

This revision does not remove service features or user rights, or newly restrict permissions.

Duplicate or unclear wording in the previous documents has been aligned with actual operation. The scope of personal-information processing is explained more specifically so users can check it more easily.

---

## Read the revised documents

The revised documents are available here:

- [Terms of Service](/terms)
- [Privacy Policy](/privacy)
- [Notifications and Privacy](/more/privacy)

We will continue explaining service features and data processing transparently.

Thank you.
