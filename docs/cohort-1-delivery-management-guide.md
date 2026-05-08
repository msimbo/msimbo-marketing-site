# RTS Cohort 1 — Salesforce Delivery Management Guide

**Audience:** Program Coordinator, Case Manager, Lead Instructor
**Cohort:** RTS Cohort 1 (May 11 – July 20, 2026)
**Last updated:** 2026-05-08

This guide walks you through the Salesforce side of delivering Cohort 1: from converting accepted Leads into trainees, through tracking attendance and certifications, to closing out the cohort with outcome reporting.

The recruiting side (Lead pipeline, applications, interviews, offers) is documented in `rts-coordinator-training.md`. This guide picks up where that one ends.

---

## What got built (and what hasn't)

**Live in production:**

- Program record: `Revenue Technology Specialist`
- ProgramCohort record: `RTS - Cohort 1 - May 2026` (linked to RTS_Cohort__c via `PMM_Cohort__c`)
- 3 Service records: `RTS Foundations - Cohort 1`, `RTS Specialization - Cohort 1`, `RTS Career Launch - Cohort 1`
- 11 custom fields (10 outcome fields on ProgramEngagement, 1 cohort bridge on RTS_Cohort__c)
- 1 permission set: `RTS Delivery Admin` (assigned to Dele, Betzaida, William)
- 1 Lightning Path: `RTS Engagement Path` on ProgramEngagement
- 1 record-triggered flow: `RTS Flow 9 — Auto-create ServiceParticipants`

**Not built yet (planned for week 1 of class):**

- ServiceSession records (one per class meeting)
- ServiceDelivery records (attendance per trainee per session)
- A "Take Attendance" quick action on ServiceSession

These are deferred until the syllabus and instructor schedule are locked.

---

## Day-of-class checklist (before May 11)

Run these in order. Each step has a verification check so you know it worked.

### 1. Verify Flow 4 fires correctly on the first conversion

Flow 4 ("RTS Flow 4 — Offer Letter") is the one that matters here. When a Lead's status flips to `RTS - Converted` (with Decision = Accepted-Confirmed), it converts the Lead into a Contact and creates a `pmdm__ProgramEngagement__c`.

**To verify:**

1. Pick **one** Lead currently at `RTS - Accepted - Confirmed`
2. Convert it via the standard Lead Convert flow (or set Status = `RTS - Converted` if Flow 4 owns conversion)
3. Within ~10 seconds, check the Contact has a related `Program Engagements` list with one row
4. Open that ProgramEngagement and confirm:
   - `pmdm__Program__c` = `Revenue Technology Specialist`
   - `pmdm__ProgramCohort__c` = `RTS - Cohort 1 - May 2026`
   - `pmdm__Contact__c` is the trainee
   - **3 ServiceParticipants** are visible in the related list (one per Service)
   - `RTS Completion Status` = `Enrolled` (the Path shows the first stage)

**If any of those is wrong:** stop and fix Flow 4 before you bulk-convert the rest. Common fixes:
- ProgramCohort missing → Flow 4 isn't reading `RTS_Cohort__r.PMM_Cohort__c` from the source Lead. Check the lookup chain.
- ServiceParticipants missing → Flow 9 didn't fire. Check Setup → Flows → "RTS Flow 9 — Auto-create ServiceParticipants" → confirm Active. Check Setup → Debug Logs for any failures.

### 2. Bulk-convert the remaining 9 confirmed Leads

Once step 1 passes end-to-end, convert the other 9 `RTS - Accepted - Confirmed` Leads. You can do this manually one-by-one (safe but slow) or use Mass Action / Data Loader.

**After bulk conversion:**

- Run this query to confirm all 10 engagements exist:

  ```
  SELECT Count(Id), pmdm__ProgramCohort__r.Name
  FROM pmdm__ProgramEngagement__c
  WHERE pmdm__ProgramCohort__c = 'a1BUV000002OSV32AO'
  GROUP BY pmdm__ProgramCohort__r.Name
  ```

  Expected: `10` rows (or however many trainees you actually have on day 1).

- Run this query to confirm ServiceParticipants were created:

  ```
  SELECT Count(Id)
  FROM pmdm__ServiceParticipant__c
  WHERE pmdm__ProgramEngagement__r.pmdm__ProgramCohort__c = 'a1BUV000002OSV32AO'
  ```

  Expected: `30` rows (10 trainees × 3 Services).

If either count is off, audit the records before May 11.

---

## Daily / weekly Coordinator workflow

### Advancing the Path

The `RTS Engagement Path` lives on every trainee's ProgramEngagement record. Stages, in order:

| Stage | When you advance | What to log first |
|---|---|---|
| **Enrolled** | Default on engagement create | Verify ServiceParticipants exist |
| **In Progress** | Trainee has attended their first session | Nothing required, but a note on the engagement helps |
| **Mid-Cohort Check** | Beginning of week 5 | Run a 1:1; capture attendance trend, capstone progress, wraparound needs |
| **Completed** | After Demo Day, capstone graded | `RTS Final Capstone Score`, `RTS Completion Date`, `RTS HubSpot RevOps Cert Earned`, `RTS Google AI Cert Earned` |

**Off-path terminal values** (these close the Path without finishing it):

- `Withdrew` — trainee voluntarily exits. Always log `RTS Withdrawal Reason`.
- `Did Not Complete` — trainee ran out of time or didn't meet minimum bar. No reason field required, but a record-page note helps the next funder report.

To advance: open the ProgramEngagement → click the next stage on the Path → "Mark Status as Complete." The picklist updates automatically.

### Logging certifications

When a trainee passes a certification:

1. Open their ProgramEngagement
2. Check `RTS HubSpot RevOps Cert Earned` or `RTS Google AI Cert Earned`
3. Save

Both fields are reportable. The cohort outcome dashboard (see "Reports" below) keys on these.

### Logging job placements

When a trainee accepts a role (during program or in the 90-day post-grad placement window):

1. Open their ProgramEngagement
2. Set `RTS Job Placement Status` (Placed - Full Time / Part Time / Internship / Continuing Education)
3. Set `RTS Job Placement Date` (start date)
4. Set `RTS Job Placement Employer`
5. Set `RTS Job Placement Salary` if disclosed (funder-reportable; do not surface on learner-facing layouts)

### Recording withdrawals

When a trainee withdraws:

1. Open their ProgramEngagement
2. Set `RTS Completion Status` = `Withdrew`
3. Set `RTS Completion Date` to today
4. Fill in `RTS Withdrawal Reason` (free text, 500 chars max — be specific enough to inform recruiting for Cohort 2)
5. Notify the Case Manager so wraparound supports can be ramped down

**Important:** withdrawing a trainee does NOT delete their ServiceParticipants. They stay on file for funder reporting (hours attended up to the point of withdrawal). Don't delete records.

---

## What Flow 9 does, and what to do if it breaks

Flow 9 (`RTS Flow 9 — Auto-create ServiceParticipants`) is the only delivery-side automation. It runs after-save on `pmdm__ProgramEngagement__c` create. Logic:

1. Triggers when a new engagement is created with both `pmdm__Program__c` and `pmdm__Contact__c` set
2. Looks up all `pmdm__Service__c` records with `pmdm__Program__c` = the engagement's program AND `pmdm__Status__c` = `Active`
3. For each Service found, builds a ServiceParticipant with:
   - `pmdm__Contact__c` = engagement's Contact
   - `pmdm__ProgramEngagement__c` = the engagement
   - `pmdm__Service__c` = the Service
   - `pmdm__Status__c` = `Active`
4. Bulk-inserts the collection in one DML

**If a trainee's ServiceParticipants are missing:**

1. Confirm the engagement has `pmdm__Program__c` populated. If null, the flow's start filter excluded it. Backfill the field and re-trigger.
2. Confirm the 3 RTS Services are still `pmdm__Status__c = Active`. If a Service was deactivated, the flow won't pick it up.
3. Check Setup → Debug Logs. Filter by user = the engagement's CreatedBy. Look for "RTS Flow 9" entries.
4. Manual fallback: create the missing ServiceParticipants via Data Loader.

**If you add a new Service to the cohort mid-program** (e.g., adding a 4th phase):

- Set `pmdm__Status__c = Active` on the new Service
- Run a one-time backfill: for each trainee in the cohort, create a ServiceParticipant linking them to the new Service. Flow 9 only fires on engagement create, not Service create.

---

## Reports and dashboards

Three reports cover the cohort-outcome story end-to-end. All filter on `pmdm__ProgramCohort__c = 'a1BUV000002OSV32AO'` (Cohort 1's PMM ID).

### Cohort 1 Roster

Source object: `pmdm__ProgramEngagement__c`

Columns:
- Contact: Full Name
- Contact: Email
- `pmdm__StartDate__c`
- `RTS_Completion_Status__c`
- `RTS_HubSpot_Cert_Earned__c`
- `RTS_Google_AI_Cert_Earned__c`
- `RTS_Job_Placement_Status__c`

Filter: `pmdm__ProgramCohort__c equals "RTS - Cohort 1 - May 2026"`

Use this for daily standups, weekly check-ins, and the Demo Day attendee list.

### Cohort 1 Outcomes Summary

Source object: `pmdm__ProgramEngagement__c`

Grouped by: `RTS_Completion_Status__c`

Columns:
- Count of Engagements
- `RTS_HubSpot_Cert_Earned__c` (sum of true)
- `RTS_Google_AI_Cert_Earned__c` (sum of true)
- `RTS_Job_Placement_Status__c` (count by value)
- `RTS_Job_Placement_Salary__c` (median)

Filter: `pmdm__ProgramCohort__c equals "RTS - Cohort 1 - May 2026"`

Use this for the funder report. Median salary stays in this report only — never share individual salary data outside funder context.

### Cohort 1 Withdrawals

Source object: `pmdm__ProgramEngagement__c`

Columns:
- Contact: Full Name
- `RTS_Completion_Date__c`
- `RTS_Withdrawal_Reason__c`

Filter: `pmdm__ProgramCohort__c equals "RTS - Cohort 1 - May 2026"` AND `RTS_Completion_Status__c equals "Withdrew"`

Use this for cohort retrospectives and Cohort 2 recruiting strategy. Patterns in withdrawal reasons inform application screening.

---

## Permission set: who has access

`RTS Delivery Admin` is assigned to:

- Dele Tosh (`domotosho@ulem.org`) — Lead Instructor / build owner
- Betzaida Guzman (`bguzman@ulem.org`) — Program Coordinator
- William Watkins (`wwatkins@ulem.org`) — Case Manager / System Admin

If you onboard another delivery team member (e.g., a TA), assign this permset alongside `RTS Program Access`. Without it, they won't see any of the RTS_* outcome fields or the PMM_Cohort__c lookup.

To assign in Setup: `Setup → Permission Sets → RTS Delivery Admin → Manage Assignments → Add Assignments`.

---

## What to build during week 1 of class

Once the syllabus and class schedule are locked (likely by end of week 1, May 15), the next layer of metadata goes in:

1. **ServiceSession records** — one per class meeting. ~50 sessions over 10 weeks (30 in-person + 20 remote). Create via Data Loader from a CSV export of the syllabus.
2. **ServiceDelivery records** — attendance per trainee per session. Use the standard PMM "Take Attendance" quick action on the ServiceSession record. It bulk-creates one ServiceDelivery per active ServiceParticipant.
3. **Hours-attended summary** — once ServiceDelivery records exist, add a roll-up summary field on ProgramEngagement that sums `pmdm__Quantity__c` across all related deliveries. Funder reports use this for hour-tracking.

These are documented at a high level in `cohort-1-delivery-setup-recommendation.md` (sections 6 and 7). When the time comes, pick that doc back up.

---

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Trainee's engagement has no ServiceParticipants | Flow 9 fired but found 0 active Services | Verify the 3 Services are `pmdm__Status__c = Active` and linked to the right Program |
| Path not visible on engagement record | RTS Delivery Admin permset not assigned to user | Assign permset |
| `RTS_Completion_Status__c` field hidden | Same as above — FLS missing | Assign permset |
| Engagement created but Cohort field is blank | Flow 4 didn't read `RTS_Cohort__r.PMM_Cohort__c` from the Lead | Check Flow 4's logic; manually backfill the engagement |
| Lead converted but no engagement appeared | Flow 4 failed silently | Check Setup → Debug Logs filtered by user. Check Flow 4 fault paths. |
| New trainee added mid-cohort, doesn't show in reports | Engagement missing or wrong ProgramCohort | Verify engagement exists and `pmdm__ProgramCohort__c` is set to Cohort 1's PMM ID |

---

## ID reference

Pin these somewhere — they show up everywhere.

| Record | ID |
|---|---|
| Program: Revenue Technology Specialist | `a1DUV000006Jlnl2AC` |
| ProgramCohort: RTS - Cohort 1 - May 2026 | `a1BUV000002OSV32AO` |
| RTS_Cohort__c (recruiting): RTS - Cohort 1 - May 2026 | `a1JUV000005GKMT2A4` |
| RTS_Cohort__c (recruiting): RTS - Cohort 2 - Fall 2026 | `a1JUV000005JhMX2A0` |
| Service: RTS Foundations - Cohort 1 | `a1IUV000004DSSP2A4` |
| Service: RTS Specialization - Cohort 1 | `a1IUV000004DSU12AO` |
| Service: RTS Career Launch - Cohort 1 | `a1IUV000004DSVd2AO` |
| Permission Set: RTS Delivery Admin | `0PSUV000000GGOz4AO` |
| Lead Record Type: RTS_Applicant | `012UV000003WmSnYAK` |
