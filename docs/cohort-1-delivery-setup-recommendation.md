# RTS Cohort 1 — Delivery Setup Recommendation

**Author:** Dele Tosh
**Date:** 2026-05-06 (updated 2026-05-08 with locked decisions)
**Status:** Approved — ready for phased SF deploy
**Cohort record:** `RTS - Cohort 1 - May 2026` (`a1JUV000005GKMT2A4`), May 11 – July 20, 2026

This document covers the Salesforce setup for **delivering** Cohort 1 once class starts. Recruiting (Lead pipeline → conversion to Contact) is already built. This is the next layer down: tracking who attended what, what they completed, and how they did.

The recommendation uses ULEM's existing **Program Management Module (PMM)** package. Every object below already exists in the org under the `pmdm__` namespace — no AppExchange installs required.

---

## TL;DR

| Layer | Object | Purpose | Cohort 1 count |
|---|---|---|---|
| Program shell | `pmdm__Program__c` | The RTS program itself (one record, reused across cohorts) | 1 |
| Cohort link | `pmdm__ProgramCohort__c` | This cohort's instance of the program | 1 |
| Per-trainee enrollment | `pmdm__ProgramEngagement__c` | One per accepted student (already created on Lead conversion in Flow 4) | up to 15 |
| Curriculum module | `pmdm__Service__c` | Each phase or module ("Foundations", "Sales Ops"…) | 3–10 |
| Class meeting | `pmdm__ServiceSession__c` | Each in-person or remote class session | ~30 (deferred — see below) |
| Attendance / outcome | `pmdm__ServiceDelivery__c` | One per trainee per session — tracks attendance and notes | ~450 |
| Trainee↔Service link | `pmdm__ServiceParticipant__c` | Which trainees are enrolled in which Service | up to 15 × N services |

**Recommended phased build:**

1. **Now (before May 11):** Program + ProgramCohort + Services + ServiceParticipants + outcome fields on ProgramEngagement.
2. **Week 1 of class (after schedule is firm):** ServiceSessions for the full 10 weeks.
3. **Ongoing (each class day):** ServiceDelivery records via a quick-action button on the Session, marking each ServiceParticipant present/absent/late.

This proposal scopes only step 1 for SF deploy. Steps 2 and 3 happen once the class schedule is locked.

---

## 1. Program shell (`pmdm__Program__c`)

One record named `Revenue Technology Specialist`. This is the **program**, not the cohort — it persists across all future cohorts (Cohort 2 Fall 2026, Cohort 3, etc.).

**Fields:**
- `Name`: `Revenue Technology Specialist`
- `pmdm__Status__c`: `Active`
- `pmdm__Description__c`: One-paragraph mission statement (lifted from the landing page hero)

**Why one record, not one-per-cohort:** PMM's data model is hierarchical. Program → Cohort → Engagement. Reporting like "all RTS graduates ever, across all cohorts" needs the parent Program to be stable.

---

## 2. Program cohort link (`pmdm__ProgramCohort__c`)

PMM's own cohort object. Distinct from the existing `RTS_Cohort__c` we use for Lead recruiting. The two should coexist:

- **`RTS_Cohort__c`** — the Lead-side anchor. Tracks recruiting metrics, max offers, lead instructor. Used by Flows 1 through 5 in recruiting.
- **`pmdm__ProgramCohort__c`** — the delivery-side anchor. Connects to PMM Services and ProgramEngagements.

Add a lookup field `RTS_Cohort__c.PMM_Cohort__c` pointing to `pmdm__ProgramCohort__c` so the two stay linked. Populate it when this Cohort 1 record is created.

**Cohort 1 PMM record:**
- `Name`: `RTS - Cohort 1 - May 2026`
- `pmdm__Program__c`: lookup to the Program shell above
- `pmdm__StartDate__c`: 2026-05-11
- `pmdm__EndDate__c`: 2026-07-20

---

## 3. Trainee enrollment (`pmdm__ProgramEngagement__c`)

**Already partially handled.** Flow 4 in the recruiting build creates a ProgramEngagement when a Lead converts (Status → `RTS - Converted`, Decision = Accepted-Confirmed). Verify on day 1 that all 15 confirmed trainees have one.

**Add these custom fields for outcome tracking** (deploy with this round):

| Field API name | Type | Purpose |
|---|---|---|
| `RTS_Completion_Status__c` | Picklist | `Enrolled`, `In Progress`, `Mid-Cohort Check`, `Completed`, `Withdrew`, `Did Not Complete` (drives Path on the engagement record) |
| `RTS_Completion_Date__c` | Date | Filled when status moves to terminal |
| `RTS_Final_Capstone_Score__c` | Number(3,0) | Demo Day capstone grade, 0–100 |
| `RTS_HubSpot_Cert_Earned__c` | Checkbox | HubSpot Revenue Operations Certification passed |
| `RTS_Google_AI_Cert_Earned__c` | Checkbox | Google AI Essentials Certification passed |
| `RTS_Job_Placement_Status__c` | Picklist | `Not Placed`, `Placed - Full Time`, `Placed - Part Time`, `Placed - Internship`, `Continuing Education` |
| `RTS_Job_Placement_Date__c` | Date | First role start date |
| `RTS_Job_Placement_Employer__c` | Text(120) | Employer name |
| `RTS_Job_Placement_Salary__c` | Currency | Reportable for outcomes — do not surface to learner-facing layouts |
| `RTS_Withdrawal_Reason__c` | Long Text(500) | Free-form, populated only if status = Withdrew |

These fields drive **funder reporting**. A single SOQL query against ProgramEngagement gives the Cohort 1 outcomes report: enrolled / completed / certified / placed / median salary.

---

## 4. Curriculum modules (`pmdm__Service__c`)

A `Service` in PMM is "a thing the program offers that participants engage with" — perfect for curriculum modules.

**Recommendation: 3 Services, one per phase.** This matches the landing page's narrative (Foundations → Specialization → Career Launch) and keeps the operational overhead low. Going to 10 Services (one per week) adds tracking precision but quintuples the number of ServiceDelivery records to maintain per session.

| # | Service Name | Weeks | Maps to landing page phase |
|---|---|---|---|
| 1 | RTS Foundations | 1–3 | "CRM fundamentals, SQL basics, Excel proficiency, Google AI Essentials" |
| 2 | RTS Specialization | 4–7 | "Marketing automation, sales ops, data visualization, AI workflow automation, HubSpot RevOps cert" |
| 3 | RTS Career Launch | 8–10 | "Capstone portfolio, mock interviews, salary negotiation, Demo Day" |

Each Service:
- `Name`: e.g., `RTS Foundations - Cohort 1`
- `pmdm__Program__c`: lookup to the Program shell
- `pmdm__ProgramCohort__c`: lookup to the Cohort 1 PMM cohort
- `pmdm__Status__c`: `Active`
- `pmdm__Description__c`: one-paragraph summary of what's covered

**If we later want week-level granularity** (e.g., for HubSpot to see which week the trainee was on when they completed the cert), we can add 10 sub-Services. Easier to add later than to collapse.

---

## 5. Trainee ↔ Service link (`pmdm__ServiceParticipant__c`)

One record per (trainee × Service). For 15 trainees × 3 Services = 45 records. Trivial to create in a single Flow when the cohort starts.

Each ServiceParticipant:
- `pmdm__Contact__c`: lookup to the trainee's Contact
- `pmdm__ProgramEngagement__c`: lookup to their RTS engagement
- `pmdm__Service__c`: lookup to the Service
- `pmdm__Status__c`: `Active`

**Automation:** add a flow `RTS Flow 6 — Auto-create ServiceParticipants` that fires on Lead conversion (or on ProgramEngagement create). For each new engagement, create a ServiceParticipant for each Active Service in this cohort.

---

## 6. Class meetings (`pmdm__ServiceSession__c`) — **deferred**

A ServiceSession is a single class meeting (Mon May 11, 10am–4pm in-person; Tue May 12, etc.). Per-session counts:

- 10 weeks × 3 in-person days/week = 30 in-person sessions
- 10 weeks × 2 remote days/week = 20 remote sessions

**Not creating these in this round.** Reasons:

1. The instructor schedule isn't fully locked — better to stage them after the syllabus is final.
2. ServiceSession records are operationally trivial (Name, Service lookup, DateTime, Duration). They can be added in batches via Data Loader once the schedule exists.
3. Premature sessions create Calendar/event noise the team has to clean up if dates shift.

**When we do create them**, recommend a Salesforce Schedule on `pmdm__ServiceSession__c` plus a Lightning Quick Action on the Session for "Take Attendance" that bulk-creates one ServiceDelivery per ServiceParticipant.

---

## 7. Attendance & per-day outcomes (`pmdm__ServiceDelivery__c`) — **deferred**

One record per (trainee × session). For 15 × 50 = ~750 records over 10 weeks if we run sessions at full granularity. The PMM standard quick-action handles bulk creation.

Per-record fields used:
- `pmdm__Contact__c`, `pmdm__ServiceSession__c`, `pmdm__Service__c`
- `pmdm__AttendanceStatus__c`: standard PMM picklist (Present, Absent, Late, Excused)
- `pmdm__Quantity__c`: hours attended (useful for funder hour-tracking)
- `pmdm__Notes__c`: instructor observations

**Builds in week 1 of class**, not before.

---

## What I'm proposing to deploy now

```
salesforce/force-app/main/default/objects/
  pmdm__ProgramEngagement__c/fields/
    RTS_Completion_Status__c.field-meta.xml
    RTS_Completion_Date__c.field-meta.xml
    RTS_Final_Capstone_Score__c.field-meta.xml
    RTS_HubSpot_Cert_Earned__c.field-meta.xml
    RTS_Google_AI_Cert_Earned__c.field-meta.xml
    RTS_Job_Placement_Status__c.field-meta.xml
    RTS_Job_Placement_Date__c.field-meta.xml
    RTS_Job_Placement_Employer__c.field-meta.xml
    RTS_Job_Placement_Salary__c.field-meta.xml
    RTS_Withdrawal_Reason__c.field-meta.xml
  RTS_Cohort__c/fields/
    PMM_Cohort__c.field-meta.xml  (lookup to pmdm__ProgramCohort__c)

salesforce/force-app/main/default/pathAssistant/
  pmdm__ProgramEngagement__c.RTS_Engagement_Path.pathAssistant-meta.xml
    (4 active stages: Enrolled → In Progress → Mid-Cohort Check → Completed,
     plus Withdrew / Did Not Complete as off-path terminal values)

salesforce/force-app/main/default/flexipages/
  RTS_ProgramEngagement_Record_Page.flexipage-meta.xml
    (adds Path component to the engagement record page)
```

**Plus data inserts** (via `sf data create record`, not metadata):

1. Program record `Revenue Technology Specialist`
2. ProgramCohort record `RTS - Cohort 1 - May 2026` linked to it
3. Three Service records (Foundations, Specialization, Career Launch)
4. Link `RTS_Cohort__c.PMM_Cohort__c` on `a1JUV000005GKMT2A4` to the new ProgramCohort

**Plus one new Flow:**

`RTS Flow 6 — Auto-create ServiceParticipants` — record-triggered on `pmdm__ProgramEngagement__c` create. Sets `RTS_Completion_Status__c = 'Enrolled'` and loops the active Services for the cohort, creating a ServiceParticipant per Service.

**Verification gate before bulk-conversion:** convert one Lead first, confirm the ProgramEngagement / ServiceParticipants / Path render correctly, then convert the remaining 9 confirmed Leads.

---

## Decisions (locked 2026-05-08)

The four review questions from the original draft are resolved as follows:

### 1. Service granularity: **3 Services (one per phase)**

Foundations / Specialization / Career Launch as listed in section 4. Locked because:

- ServiceParticipant count stays at 45 (15 trainees × 3 Services). Operationally cheap.
- Phase boundaries already match the landing page narrative and the syllabus structure.
- HubSpot RevOps and Google AI Essentials cert tracking lives on ProgramEngagement (`RTS_HubSpot_Cert_Earned__c`, `RTS_Google_AI_Cert_Earned__c`), not on a per-Service record. We don't need a Service-level record to know who passed which cert.
- Adding week-level Services later is additive (just create them and run a backfill flow). Going from 10 → 3 later is destructive.

### 2. Outcome fields: **ship the doc list as-is**

The 10 fields in section 3 cover the full funder reporting need for Cohort 1:

- Completion: status, date, capstone score, withdrawal reason
- Certifications: HubSpot RevOps, Google AI Essentials
- Placement: status, date, employer, salary

Demographics stay on Lead/Contact (no mirror to ProgramEngagement). Outcome reports join through Contact when needed. Mirroring is reconsidered only if a funder explicitly requires a flat ProgramEngagement export.

Hours-attended rollups are deferred. They become relevant only when ServiceDelivery records are being created (week 1 of class, per section 7), and rolling up `pmdm__Quantity__c` is a one-line summary field added then.

### 3. Existing ProgramEngagements: **verification gate before May 11**

Flow 4 has not fired yet in production (no Leads have hit `RTS - Converted` with Decision = Accepted-Confirmed). Pre-class verification:

- **Before May 11:** convert one of the 10 currently `RTS - Accepted - Confirmed` Leads end-to-end. Confirm a ProgramEngagement record is created, linked to the right Contact and to Cohort 1.
- If the engagement is missing the new ProgramCohort lookup or the outcome fields default wrong, fix Flow 4 before bulk-converting the rest of the cohort.
- After verification, bulk-convert the remaining 9 confirmed Leads in a single operation so all 10 engagements exist on day 1.

### 4. Lightning Path on ProgramEngagement: **yes, add it**

Path stages on `pmdm__ProgramEngagement__c` (driven by `RTS_Completion_Status__c`):

| # | Stage label | API value | When it fires |
|---|---|---|---|
| 1 | Enrolled | `Enrolled` | Default on engagement create (Flow 4 sets this) |
| 2 | In Progress | `In Progress` | Coordinator advances on first ServiceDelivery (week 1) |
| 3 | Mid-Cohort Check | `Mid-Cohort Check` | Coordinator advances at week 5 (formal check-in) |
| 4 | Completed | `Completed` | Set on Demo Day after capstone graded |
| — | Withdrew | `Withdrew` | Off-path terminal status (closes Path) |
| — | Did Not Complete | `Did Not Complete` | Off-path terminal status (closes Path) |

Add Path guidance text at each stage (e.g., on "In Progress": "Confirm trainee has started ServiceDeliveries and HubSpot cert path is active"). This gives the Coordinator a single record-page driver for the trainee lifecycle, mirroring the Lead Path used during recruiting.

The `RTS_Completion_Status__c` picklist values listed in section 3 expand to include `Mid-Cohort Check` to support the Path.

---

## Why this matches PMM conventions

PMM (Salesforce.org Program Management Module) is opinionated about this exact shape: **Program → ProgramCohort → ProgramEngagement → ServiceParticipant → ServiceDelivery**. Going off-pattern (e.g., putting attendance directly on ProgramEngagement) breaks the PMM dashboards and the Salesforce.org Outcome Management add-on if we ever adopt it.
