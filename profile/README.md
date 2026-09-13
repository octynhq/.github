# OCTYN

**We build and operate custom AI systems and internal tools for businesses that run on repeated human contact.**

Two people, Ashwini Tiwari and Shraajan Gupta. Everything on this page is something we wrote, shipped, and still keep running.

[octyn.co](https://octyn.co) · [the work](https://octyn.co/projects) · `admin@octyn.co`

![currently](./badges/status.svg) ![last shipped](./badges/last-deploy.svg)

## Who we build for

A non-technical business that delivers its value through repeated human touchpoints across fragmented channels, where a person has to rebuild context by hand before every next action. WhatsApp, email, phone, SMS, in-app messages, a CRM and a spreadsheet, reassembled per client or patient or participant by a coordinator whose entire job that is.

Clinics and patient follow-up, health and behaviour coaching, home care, recruiting, wealth advisory, education, property management, legal case management, membership organisations. It is not an industry. It is an operational shape, and the industry is a consequence.

The public signal for it is a job posting: when a company solves this by hiring a care coordinator, a client success coordinator, a case manager or a patient navigator, the responsibilities list names the fragmented channels out loud.

## What we build

**Company Brain.** One record per person the business serves, assembled from every channel they arrive through, so the next touchpoint opens with context already in place instead of a search.

**Growth Engine.** Sourcing, qualification, contact resolution, drafting and sending, with the gates written as code and tested, rather than left to a model's judgement.

**Content Engine.** Campaign and channel content produced in volume against a fixed voice, with a lint that every draft passes before anything can be queued.

**Agency Ops.** The dashboards, ledgers and multi-tenant surfaces a service business actually runs on.

## Systems we run

| System | What it is | Where it stands |
| --- | --- | --- |
| [Mooney](https://usemooney.app) | Voice-first Android expense tracker. A spoken sentence becomes a saved transaction through a chain with four layers of fallback. | Live on Google Play. ~50 installs in week one, 2026-07-06, Play Store. |
| [WhoFits](https://whofits.co) | Creator discovery that ranks people by their position in a network instead of by follower count, and shows its working for every recommendation. | 12,000 interactions in the crawler database, 2026-07-05. |
| [WhoFits Agency](https://agency.whofits.co) | Lead engine that turns state licence registries into contactable, scored contractors, behind a multi-tenant dashboard. | 3,207 rows in the exported qualified-lead file, 2026-06-24. |
| aarttsii outreach | A two-plane cold outreach system for an outside studio, where a reasoning session drafts and a deterministic sender is the only thing allowed to put mail in front of a company. | 284 contacted leads, 2026-08-11. Built and operated by us. |
| [octyn.co](https://octyn.co) | Our own front door, built so every claim on it carries a date and a source. | Shipping since 2026-07-06. |

Every figure above is dated and traceable to the system that produced it. Where we do not have a number yet, the case study says so in the same shape, with the same date, rather than omitting it.

## How we build

A few rules that came out of things going wrong on a specific day, and got written down next to what they prevent.

- **Anything that can do damage has no intelligence in it.** A model send-worker once errored, mis-sent, then reported a send that had not happened. The replacement is a small deterministic service that polls, marks each job as it goes, and confirms per send.
- **Gates are code, not judgement.** Geography, voice and cadence are plain typed functions with tests beside them, so the same input decides the same way every time.
- **Never trust what a model returns unless the text is literally present in the page it was given.** That rule is what keeps an invented email address out of a send queue.
- **Deletion should be loud.** Two cascading foreign keys quietly removed interaction edges that were expensive to collect. Both became restrict, which turns silent data loss into a blocked delete that says what it is blocking.
- **Every failure path is written down before it is needed.** Provider fallbacks, rollback procedure and the thing we would fix first all live in the repo, audited rather than assumed.

## Repositories

Most of what we run is private, because it is product and client infrastructure. This organisation holds the org-wide workflows and the badge generator behind the status line above. The readable version of the work is the case studies on [octyn.co](https://octyn.co).

---

Work with us: `admin@octyn.co`
