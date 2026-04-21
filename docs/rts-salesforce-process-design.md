# RTS Program — Salesforce Application Process Design

**Program:** Revenue Technology Specialist (RTS) — ULEM Boston  
**Platform:** Salesforce Nonprofit Cloud  
**Integration approach:** Native-first (Web-to-Lead, Flow Builder, Email Templates) + n8n for Criteria Core and Lunacal.ai webhook ingestion (see Appendix D)  
**Scheduling tool:** Lunacal.ai (two event types: Instructor, Case Manager)  
**Last updated:** April 17, 2026

---

## Table of Contents

1. [Process Overview](#1-process-overview)
2. [Data Model](#2-data-model)
3. [Lead Status Pipeline](#3-lead-status-pipeline)
4. [Web-to-Lead Form Setup](#4-web-to-lead-form-setup)
5. [Criteria Core Assessment Integration](#5-criteria-core-assessment-integration)
6. [Automation Flows](#6-automation-flows)
7. [Email Templates](#7-email-templates)
8. [Lunacal.ai & Interview Scheduling](#8-lunacalai--interview-scheduling)
9. [Reports & Dashboard](#9-reports--dashboard)
10. [User Roles & Responsibilities](#10-user-roles--responsibilities)
11. [Implementation Sequence](#11-implementation-sequence)
12. [Appendix A — Lead Conversion Mapping](#appendix-a-lead-conversion-mapping)
13. [Appendix B — Criteria Core Assessment Thresholds](#appendix-b-criteria-core-assessment-thresholds)
14. [Appendix C — Key Dates, Cohort 1](#appendix-c-key-dates--cohort-1)
15. [Appendix D — n8n: Where It Helps, Where It Doesn't](#appendix-d-n8n--where-it-helps-where-it-doesnt)
16. [Appendix E — Sources](#appendix-e-sources)

---

## 1. Process Overview

The full applicant journey from msimbo.org to enrolled cohort member has eight stages:

```
[INTEREST]        Applicant fills out custom form on msimbo.org
     ↓
[APPLICATION]     Web-to-Lead creates record in Salesforce
                  Confirmation email sent automatically
                  Status auto-advances → Assessment Pending
     ↓
[ASSESSMENT]      Applicant completes Criteria Core (CLIK, CCAT, CBST2)
                  Scores land on Lead record via n8n webhook (see Appendix D)
                  or are logged manually by Coordinator
     ↓
[SCREENING]       Coordinator reviews application + assessment scores
                  Coordinator sets Status → Interview 1 Requested
                  (triggers Instructor interview invitation email)
     ↓
[INTERVIEW 1]     Instructor interview (Dele) — technical fit, motivation
                  Applicant books via Lunacal.ai (Instructor event)
                  → Lunacal webhook auto-moves Status → Interview 1 Scheduled
                  Coordinator logs outcome after the interview
     ↓
[INTERVIEW 2]     Case Manager interview (if Coordinator advances applicant)
                  Screens for barriers, wraparound needs, program readiness
                  Applicant books via Lunacal.ai (Case Manager event)
                  → Lunacal webhook auto-moves Status → Interview 2 Scheduled
                  Coordinator logs outcome after the interview
     ↓
[DECISION]        Coordinator sets Status → Accepted / Waitlisted / Declined
                  Automation sends the matching email for each outcome
     ↓
[ENROLLMENT]      Accepted applicant confirms seat
                  Lead converted → Contact + Program Engagement created
                  Enrollment confirmation email sent
```

> **Gating between interviews:** The Coordinator decides case-by-case whether an applicant advances from Interview 1 (Instructor) to Interview 2 (Case Manager). Most applicants who clear the Instructor interview should advance; borderline cases may be held, advanced for a fit check, or declined outright based on Instructor feedback.

**Target funnel numbers (Cohort 1):**

| Stage | Target Count |
|---|---|
| Leads / applications received | 40–60 |
| Pass screening (assessment + review) | 25–30 |
| Instructor interviews conducted | 25–30 |
| Advance to Case Manager interview | 20–25 |
| Case Manager interviews conducted | 20–25 |
| Offers extended | 18–20 |
| Confirmed enrolled | 15 |
| Waitlist | 3–5 |

---

## 2. Data Model

### 2.1 Core Objects

#### Lead (Application Record)
Used for every applicant until they confirm enrollment. Standard Salesforce object with custom fields added for RTS.

**Standard fields to use:**
- First Name, Last Name, Email, Phone
- Lead Source (set to `RTS Website` via Web-to-Lead)
- Lead Owner (auto-assigned to Program Coordinator)
- Status (see Section 3 for full picklist)
- Description (motivation statement from form)

**Custom fields to add to Lead:**

| Field Label             | API Name                        | Type                   | Notes                                                                 |
| ----------------------- | ------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| Zip Code                | `RTS_Zip_Code__c`               | Text(10)               | Boston-area proximity check                                           |
| Neighborhood            | `RTS_Neighborhood__c`           | Text(50)               |                                                                       |
| Employment Status       | `RTS_Employment_Status__c`      | Picklist               | Employed FT, PT, Unemployed, Student, Other                           |
| Highest Education       | `RTS_Education_Level__c`        | Picklist               | Less than HS, HS/GED, Some College, Associate's, Bachelor's, Graduate |
| Primary Language        | `RTS_Primary_Language__c`       | Text(50)               |                                                                       |
| How Did You Hear        | `RTS_Referral_Source__c`        | Picklist               | Google, Facebook/Instagram, Friend/Family, Flyer, Partner Org, Other  |
| Available Daytime (M–W) | `RTS_Daytime_Available__c`      | Checkbox               | Required for program                                                  |
| Childcare Barrier       | `RTS_Childcare_Barrier__c`      | Checkbox               | Flags for wraparound support                                          |
| Transportation Barrier  | `RTS_Transportation_Barrier__c` | Checkbox               |                                                                       |
| Internet/Device Barrier | `RTS_Internet_Barrier__c`       | Checkbox               |                                                                       |
| Assessment Status       | `RTS_Assessment_Status__c`      | Picklist               | Not Started, In Progress, Passed, Retake Required, Did Not Pass       |
| Assessment Date         | `RTS_Assessment_Date__c`        | Date                   |                                                                       |
| CLIK Score              | `RTS_CLIK_Score__c`             | Number(5,1)            | Criteria Core — Computer Literacy & Internet Knowledge                |
| CCAT Score              | `RTS_CCAT_Score__c`             | Number(5,1)            | Criteria Core — Criteria Cognitive Aptitude Test                      |
| CBST2 Score             | `RTS_CBST2_Score__c`            | Number(5,1)            | Criteria Core — Criteria Basic Skills Test, v2                        |
| Assessment Notes        | `RTS_Assessment_Notes__c`       | Text Area(500)         | Coordinator observations                                              |
| Instructor Interview Date/Time   | `RTS_Instructor_Interview_DateTime__c`  | Date/Time       | Auto-populated by n8n from Lunacal.ai webhook (Instructor event)      |
| Instructor Interview Notes       | `RTS_Instructor_Interview_Notes__c`     | Text Area(2000) | Dele's notes                                                          |
| Instructor Interview Outcome     | `RTS_Instructor_Interview_Outcome__c`   | Picklist        | Advance to Case Manager, Hold for Review, Decline                     |
| Case Manager Interview Date/Time | `RTS_CM_Interview_DateTime__c`          | Date/Time       | Auto-populated by n8n from Lunacal.ai webhook (Case Manager event)    |
| Case Manager Interview Notes     | `RTS_CM_Interview_Notes__c`             | Text Area(2000) | Case Manager's notes                                                  |
| Case Manager Interview Outcome   | `RTS_CM_Interview_Outcome__c`           | Picklist        | Recommend Accept, Recommend Waitlist, Recommend Decline               |
| Decision                | `RTS_Decision__c`               | Picklist               | Accept, Waitlist, Decline                                             |
| Decision Date           | `RTS_Decision_Date__c`          | Date                   |                                                                       |
| Decision Reason         | `RTS_Decision_Reason__c`        | Picklist               | See below                                                             |
| Offer Sent Date         | `RTS_Offer_Sent_Date__c`        | Date                   |                                                                       |
| Offer Response          | `RTS_Offer_Response__c`         | Picklist               | Pending, Confirmed, Declined, No Response                             |
| Offer Response Date     | `RTS_Offer_Response_Date__c`    | Date                   |                                                                       |
| Cohort                  | `RTS_Cohort__c`                 | Lookup → RTS_Cohort__c | Assigned on acceptance                                                |
| Instructor Invite Sent  | `RTS_Instructor_Invite_Sent__c` | Checkbox               | Automation sets this to prevent duplicate sends                       |
| Case Mgr Invite Sent    | `RTS_CM_Invite_Sent__c`         | Checkbox               | Automation sets this to prevent duplicate sends                       |

**Decision Reason picklist values:**
- Did Not Pass Assessment
- Schedule Conflict (Cannot Attend Daytime)
- Cohort Full
- Applicant Withdrew
- Not a Strong Fit (Interview)
- Waitlisted — Pending Seat Availability
- Other

---

#### RTS_Cohort__c (Custom Object)
Tracks each cohort run. One record per program cycle.

| Field                        | Type               | Notes                                   |
| ---------------------------- | ------------------ | --------------------------------------- |
| Cohort Name                  | Text(80)           | e.g., "Cohort 1 — May 2026"             |
| Start Date                   | Date               |                                         |
| End Date                     | Date               |                                         |
| Target Enrollment            | Number             | Default: 15                             |
| Max Offers                   | Number             | Default: 20                             |
| Status                       | Picklist           | Planning, Recruiting, Active, Completed |
| Lead Instructor              | Lookup → User      | Dele (also Acting Director for Cohort 1) |
| Case Manager                 | Lookup → User      | Named Case Manager for Cohort 1         |
| Confirmed Enrolled (formula) | Roll-up or formula | Count of linked Contacts                |
| Cohort Notes                 | Text Area          |                                         |

---

#### Contact (Post-Acceptance)
When an applicant confirms enrollment, their Lead is converted to a Contact. Key fields carried over:
- All RTS custom fields (via mapping on Lead conversion)
- Contact is linked to a Program Engagement (Nonprofit Cloud)

---

#### Program Engagement (Nonprofit Cloud)
NPC's native object for tracking a person's participation in a program.

| Field | Value |
|---|---|
| Program | Revenue Technology Specialist |
| Stage | Applied → Enrolled → Active → Graduated |
| Start Date | Cohort start date |
| End Date | Cohort end date |
| Role | Participant |

---

### 2.2 Object Relationships

```
RTS_Cohort__c
    └── Lead (lookup: RTS_Cohort__c)          — during application
    └── Contact (via Program Engagement)       — after enrollment confirmed
    └── Program Engagement (NPC)               — enrollment tracking

Lead → converted → Contact + Program Engagement
```

---

## 3. Lead Status Pipeline

Configure the Lead Status picklist with these values (in order):

| Status                     | Meaning                                        | Who Sets It                               |
| -------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `New`                      | Just submitted from website (transient — auto-advances) | Web-to-Lead *(initial creation only)*     |
| `Assessment Pending`       | Waiting for Criteria Core results              | **Automation** *(on Lead create)*         |
| `Assessment Complete`      | All three scores logged (CLIK, CCAT, CBST2)    | Coordinator (or n8n if webhook is live)   |
| `Interview 1 Requested`    | Passed screening, Instructor invite sent       | Coordinator *(triggers email automation)* |
| `Interview 1 Scheduled`    | Lunacal.ai booking confirmed for Instructor    | **Automation** *(lunacal webhook → n8n)*  |
| `Interview 1 Complete`     | Instructor interview done, outcome logged      | Coordinator                               |
| `Interview 2 Requested`    | Coordinator advanced applicant to Case Manager | Coordinator *(triggers email automation)* |
| `Interview 2 Scheduled`    | Lunacal.ai booking confirmed for Case Manager  | **Automation** *(lunacal webhook → n8n)*  |
| `Interview 2 Complete`     | Case Manager interview done, decision pending  | Coordinator                               |
| `Accepted — Offer Sent`    | Offer email sent                               | Coordinator *(triggers email automation)* |
| `Accepted — Confirmed`     | Applicant confirmed seat                       | Coordinator                               |
| `Waitlisted`               | On waitlist                                    | Coordinator *(triggers email automation)* |
| `Declined — Not Qualified` | Did not meet criteria                          | Coordinator *(triggers email automation)* |
| `Declined — Withdrew`      | Applicant withdrew                             | Coordinator                               |
| `Converted`                | Enrolled — Lead converted to Contact           | Coordinator (manual conversion action)    |

> **Ownership rule:** The **Program Coordinator owns every decision-point transition** in this pipeline — qualifying, advancing, declining, accepting. Automation handles only the **three mechanical transitions** where a human decision is not required:
>
> 1. `New` → `Assessment Pending` — fires when Web-to-Lead creates the record. No coordinator review is needed to acknowledge that an applicant now owes us an assessment.
> 2. `Interview 1 Requested` → `Interview 1 Scheduled` — fires when Lunacal sends a `booking.created` webhook for the Instructor event type. The applicant has booked; the status is just reflecting reality.
> 3. `Interview 2 Requested` → `Interview 2 Scheduled` — same pattern for the Case Manager event type.
>
> Every other transition is a coordinator-authored decision. This preserves a clean audit trail for the judgment calls that matter and removes busywork for state that is already determined by an external event.
>
> **Statuses that trigger email automation:** `Interview 1 Requested`, `Interview 2 Requested`, `Accepted — Offer Sent`, `Waitlisted`, `Declined — Not Qualified`, `Accepted — Confirmed`. All other status moves are audit-only.

---

## 4. Web-to-Lead Form Setup

### 4.1 How Web-to-Lead Works

Salesforce's built-in Web-to-Lead captures form submissions from any external website and creates a Lead record automatically. No third-party connector needed.

The msimbo.org application form is a **custom-designed form** (own HTML, own CSS, own UX — matching ULEM brand and msimbo.org design system). It **POSTs directly to the Salesforce Web-to-Lead endpoint** with hidden fields that identify the org and map form inputs to Lead fields. We're not using Salesforce's auto-generated HTML as-is; we're using its endpoint and field IDs with our own markup.

**Why this approach (custom form + native endpoint):**
- Full control over form UX (progressive disclosure, mobile layout, accessibility, validation messaging)
- No additional infrastructure to host or maintain — browser posts straight to Salesforce
- No extra failure point between form and CRM
- Still gives Salesforce all structured data it needs

### 4.2 Generate the Web-to-Lead Code

1. In Salesforce: **Setup → Marketing → Web-to-Lead**
2. Click "Create Web-to-Lead Form"
3. Select the fields you want to capture (match your HTML form fields)
4. Set the Return URL (the thank-you page on msimbo.org)
5. Copy the generated HTML

Salesforce generates something like this:

```html
<form action="https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8" method="POST">
  <input type="hidden" name="oid" value="YOUR_ORG_ID">
  <input type="hidden" name="retURL" value="https://msimbo.org/application-thank-you">
  <input type="hidden" name="lead_source" value="RTS Website">
  
  <!-- Standard fields -->
  <input type="text" name="first_name" placeholder="First Name">
  <input type="text" name="last_name" placeholder="Last Name">
  <input type="email" name="email" placeholder="Email">
  <input type="tel" name="phone" placeholder="Phone">
  
  <!-- Custom fields — use the Field ID from Salesforce Setup -->
  <input type="text" name="00NXXXXXXXXXXXXXXX" placeholder="Zip Code">
  <select name="00NXXXXXXXXXXXXXXX">
    <!-- Employment Status options -->
  </select>
  <!-- etc. -->
  
  <input type="submit" value="Submit Application">
</form>
```

### 4.3 Custom Field Mapping

For each custom Lead field, find its **Field ID** in Salesforce:

**Setup → Object Manager → Lead → Fields & Relationships → click field name → copy "Field ID"**

The Field ID looks like `00N5e00000XXXXXX`. Use this as the `name` attribute in the HTML form input.

### 4.4 Form Architecture Recommendation

Since Criteria Core is embedded during the application, use a **two-step flow**:

**Step 1 — Basic Info Form (msimbo.org)**
Collect: Name, Email, Phone, Zip, Employment Status, Education Level, How Did You Hear, Daytime Availability, Barrier flags (checkboxes), Brief Motivation Statement

→ On submit: POST to Salesforce Web-to-Lead, redirect to Criteria Core assessment URL

**Step 2 — Criteria Core Assessment**
Applicant completes CLIK, CCAT, and CBST2 assessments

→ Criteria Core fires Status + Scores webhooks (see Appendix D for n8n handler) **or** emails results to Program Coordinator
→ Scores land on the Lead record (via n8n webhook — automated) or Coordinator logs them manually

**Why two-step:**
- Applicant gets a Salesforce confirmation email immediately on form submit (before the assessment)
- Creates the Lead record early so no one falls through the cracks
- Coordinator can track who started but hasn't completed the assessment

### 4.5 Spam Protection

Web-to-Lead has no built-in CAPTCHA. Add one of these to the msimbo.org form:
- Google reCAPTCHA v3 (invisible, free) — validate client-side before the form submits
- Honeypot field — hidden field that bots fill in but humans don't; check and block in the form's submit handler before POSTing to Salesforce

---

## 5. Criteria Core Assessment Integration

### 5.1 The Challenge

Criteria Core does not have a native Salesforce connector. Two paths to get scores onto the Lead record:

1. **n8n webhook (recommended — see Appendix D):** Criteria Core fires `Status Webhook` and `Scores Webhook` to an n8n workflow, which writes to the Lead record via Salesforce REST API. Scores appear automatically within seconds of completion. Coordinator only acts on edge cases (retakes, flagged results).
2. **Manual fallback:** Coordinator reads the Criteria Core result email and types scores into the Lead record.

Both paths should be supported — the webhook handles 95% of cases; manual entry covers n8n outages and edge cases.

### 5.2 Coordinator Workflow

When Criteria Core results land on a Lead (either via webhook or email):

1. Open the Lead record in Salesforce (or the task the automation created)
2. Verify or populate:
   - `Assessment Status` → Passed / Retake Required / Did Not Pass
   - `CLIK Score`, `CCAT Score`, `CBST2 Score`
   - `Assessment Date` → date of completion
   - `Assessment Notes` → any flags from the report
3. If all three pass: update `Status` → `Interview 1 Requested` (this triggers the Instructor interview email automation)
4. If retake needed: send Criteria Core retake link manually; set `Assessment Status` → `Retake Required`
5. If did not pass: update `Status` → `Declined — Not Qualified` (triggers rejection email automation)

### 5.3 Assessment Scorecard View

Create a **Compact Layout** or **Custom Page Layout** in Salesforce that surfaces assessment fields prominently on the Lead record. Coordinator should see all scores at a glance without scrolling.

Suggested Lead page layout sections:
1. **Applicant Info** — Name, Email, Phone, Zip, Employment, Education
2. **Assessment Results** — Status, Date, CLIK, CCAT, CBST2, Notes
3. **Instructor Interview** — Date/Time, Outcome, Notes
4. **Case Manager Interview** — Date/Time, Outcome, Notes
5. **Decision** — Decision, Decision Date, Reason, Offer Response
6. **Barriers & Support** — Childcare, Transportation, Internet flags
7. **Application Details** — Source, Cohort, Motivation Statement

---

## 6. Automation Flows

All flows are built in **Salesforce Flow Builder** (Setup → Flows). All are **Record-Triggered Flows** that fire when a Lead record is updated.

> **Design rule for every flow below:** Automation **never writes to the `Status` field**. The Program Coordinator owns all status transitions. Flows only send emails, create tasks, and update bookkeeping fields (dates, sent-flags, offer response state). This is enforced in every flow definition.

---

### Flow 1: Application Received Confirmation

**Trigger:** Lead is created AND `LeadSource = "RTS Website"`

**Actions:**
1. Update Lead: `Status` = `Assessment Pending` *(the one automated status transition at this stage — no coordinator review needed)*
2. Send Email Alert → `Application_Received` email template → to applicant
3. Create Task:
   - Subject: `Review new RTS application — [First Name Last Name]`
   - Due Date: `Today + 2 days`
   - Assigned To: Program Coordinator (hardcode user ID)
   - Priority: Normal
   - Related To: this Lead
4. Assign Lead Owner → Program Coordinator

> This flow is the **first exception** to the ownership rule — it advances Status from `New` to `Assessment Pending` automatically because no decision is required to mark that the applicant is now expected to complete the assessment. The coordinator's review task is still created so they can screen barriers/eligibility in parallel.

---

### Flow 2: Instructor Interview Invitation

**Trigger:** Lead Status changes TO `Interview 1 Requested`

**Condition:** `RTS_Instructor_Invite_Sent__c = false` (prevent duplicate sends)

**Actions:**
1. Send Email Alert → `Instructor_Interview_Invitation` email template → to applicant (with Instructor Lunacal.ai link)
2. Update Lead:
   - `RTS_Instructor_Invite_Sent__c` = true
3. Create Task:
   - Subject: `Follow up if Instructor booking not made — [First Name Last Name]`
   - Due Date: `Today + 5 days`
   - Assigned To: Program Coordinator
   - Priority: Normal
   - Comments: `If RTS_Instructor_Interview_DateTime__c is still empty 5 days after invite, nudge the applicant.`

> Flow does not change Status. Status moves to `Interview 1 Scheduled` automatically via the Lunacal.ai webhook → n8n flow (see Appendix D, D.6) once the applicant books.

---

### Flow 3: Case Manager Interview Invitation

**Trigger:** Lead Status changes TO `Interview 2 Requested`

**Condition:** `RTS_CM_Invite_Sent__c = false` (prevent duplicate sends)

**Actions:**
1. Send Email Alert → `Case_Manager_Interview_Invitation` email template → to applicant (with Case Manager Lunacal.ai link)
2. Update Lead:
   - `RTS_CM_Invite_Sent__c` = true
3. Create Task:
   - Subject: `Follow up if Case Manager booking not made — [First Name Last Name]`
   - Due Date: `Today + 5 days`
   - Assigned To: Program Coordinator
   - Priority: Normal
   - Comments: `If RTS_CM_Interview_DateTime__c is still empty 5 days after invite, nudge the applicant.`

> Flow does not change Status. Status moves to `Interview 2 Scheduled` automatically via the Lunacal.ai webhook → n8n flow (see Appendix D, D.6) once the applicant books.

---

### Flow 4: Offer Letter Email

**Trigger:** Lead Status changes TO `Accepted — Offer Sent`

**Actions:**
1. Send Email Alert → `Offer_of_Admission` email template → to applicant
2. Update Lead (bookkeeping only — these are NOT status fields):
   - `RTS_Offer_Sent_Date__c` = Today
   - `RTS_Offer_Response__c` = `Pending`
3. Create Task:
   - Subject: `Follow up on offer confirmation — [First Name Last Name]`
   - Due Date: `Today + 5 days`
   - Assigned To: Program Coordinator
   - Priority: High
   - Comments: `Applicant has 5 days to confirm. If no response, escalate.`

> Coordinator sets `RTS_Decision__c = Accept` AND `Status = Accepted — Offer Sent` as a single manual step. Flow fires off the status change.

---

### Flow 5: Waitlist Notification

**Trigger:** Lead Status changes TO `Waitlisted`

**Actions:**
1. Send Email Alert → `Waitlist_Notification` email template → to applicant

> Coordinator sets `RTS_Decision__c = Waitlist` AND `Status = Waitlisted` as a single manual step.

---

### Flow 6: Decline Notification

**Trigger:** Lead Status changes TO `Declined — Not Qualified`

**Actions:**
1. Send Email Alert → `Application_Status_Update` email template → to applicant

> Coordinator sets `RTS_Decision__c = Decline` AND `Status = Declined — Not Qualified` as a single manual step.
>
> Do not auto-send for `Declined — Withdrew` — applicant already knows, and sending a rejection email feels wrong. No flow is wired to that status.

---

### Flow 7: Enrollment Confirmation

**Trigger:** Lead Status changes TO `Accepted — Confirmed`

**Actions:**
1. Send Email Alert → `Enrollment_Confirmation` email template → to applicant
2. Update Lead (bookkeeping only):
   - `RTS_Offer_Response__c` = `Confirmed`
   - `RTS_Offer_Response_Date__c` = Today
3. Create Task:
   - Subject: `Convert Lead to Contact — [First Name Last Name]`
   - Due Date: Today
   - Assigned To: Program Coordinator
   - Priority: High
   - Comments: `Convert lead and create Program Engagement in NPC. Then set Status = Converted.`

> Lead conversion (Lead → Contact + Program Engagement) and the final `Status = Converted` move are intentionally manual because NPC's Program Engagement fields need to be set carefully. Flow creates a task as the prompt; Coordinator finishes the transition.

---

### Flow Summary

Seven Salesforce Flows plus two n8n webhook flows. The three flows that write to `Status` are the documented mechanical exceptions to the coordinator-ownership rule.

| Flow | Where | Trigger | Key Action | Writes Status? |
|---|---|---|---|---|
| Application Received | Salesforce Flow | Lead created, source = RTS Website | Set Status → `Assessment Pending`, send confirmation email, create coordinator task | **Yes** — New → Assessment Pending |
| Instructor Interview Invitation | Salesforce Flow | → `Interview 1 Requested` | Email with Lunacal.ai link + follow-up task | No |
| Case Manager Interview Invitation | Salesforce Flow | → `Interview 2 Requested` | Email with Lunacal.ai link + follow-up task | No |
| Offer Letter | Salesforce Flow | → `Accepted — Offer Sent` | Offer email + 5-day follow-up task | No |
| Waitlist | Salesforce Flow | → `Waitlisted` | Waitlist email | No |
| Decline | Salesforce Flow | → `Declined — Not Qualified` | Rejection email | No |
| Enrollment Confirmation | Salesforce Flow | → `Accepted — Confirmed` | Confirmation email + convert task | No |
| Instructor Booking (see Appendix D) | n8n | Lunacal webhook: Instructor event booking.created | Write DateTime + set Status → `Interview 1 Scheduled` | **Yes** — Interview 1 Requested → Interview 1 Scheduled |
| Case Manager Booking (see Appendix D) | n8n | Lunacal webhook: CM event booking.created | Write DateTime + set Status → `Interview 2 Scheduled` | **Yes** — Interview 2 Requested → Interview 2 Scheduled |

---

## 7. Email Templates

All templates live in **Setup → Classic Email Templates** or **Lightning Email Templates**. Use Lightning templates with merge fields for professionalism.

---

### Template 1: Application Received

**Subject:** We got your application, {!Lead.FirstName} — here's what's next

**Body:**

> Hi {!Lead.FirstName},
>
> Thanks for applying to the Revenue Technology Specialist (RTS) program at ULEM! We're excited you're taking this step.
>
> **What happens next:**
> If you haven't already, please complete the skills assessment — you should have received the link right after submitting your form. This takes about 45–60 minutes and is a required step in the application process.
>
> Once we've reviewed your application and assessment, someone from our team will reach out within 5–7 business days.
>
> **Program reminder:**
> - 10 weeks, Mon to Wed in-person (10 AM to 4 PM), Thu and Fri remote
> - 100% free. Wraparound support is available based on individual need.
> - Cohort 1 starts May 18, 2026
>
> Questions? Reply to this email or reach us at programs@ulem.org.
>
> We'll be in touch,
> The MSIMBO Team at ULEM

---

### Template 2a: Instructor Interview Invitation

**Subject:** You're moving forward — schedule your RTS Instructor interview, {!Lead.FirstName}

**Body:**

> Hi {!Lead.FirstName},
>
> Great news — after reviewing your application and assessment, we'd like to invite you to an interview with our **lead instructor** (about 30 minutes). This conversation is about your interests, motivation, and fit for the technical work.
>
> **Book your Instructor interview here:**
> [Lunacal.ai link — Instructor event type]
>
> Interviews are conducted via Zoom or in person at ULEM Boston (88 Warren Street, Roxbury, MA 02119). Choose the format that works best for you.
>
> Please book your slot within the next **5 business days**.
>
> **What happens next:** If this interview goes well, we'll invite you to a second conversation with our Case Manager to talk about the supports you might need to succeed in the program (transportation, childcare, etc.).
>
> If none of the available times work, reply to this email and we'll find something that does.
>
> We look forward to speaking with you!
>
> The MSIMBO Team at ULEM

---

### Template 2b: Case Manager Interview Invitation

**Subject:** Next step — schedule your Case Manager interview, {!Lead.FirstName}

**Body:**

> Hi {!Lead.FirstName},
>
> Thank you for the great conversation with our instructor! We'd like to move you forward to one more interview — this one is with our **Case Manager**.
>
> This conversation (about 30 minutes) is focused on making sure we can set you up for success in the program. We'll talk through any barriers or supports you may need (transportation, childcare, scheduling, technology) and how ULEM can help.
>
> **Book your Case Manager interview here:**
> [Lunacal.ai link — Case Manager event type]
>
> Interviews are conducted via Zoom or in person at ULEM Boston. Please book your slot within the next **5 business days**.
>
> After this interview, our team will make a final decision and be in touch shortly.
>
> The MSIMBO Team at ULEM

---

### Template 3: Offer of Admission

**Subject:** Congratulations, you've been accepted to RTS Cohort 1, {!Lead.FirstName}!

**Body:**

> Hi {!Lead.FirstName},
>
> We're thrilled to offer you a seat in the **Revenue Technology Specialist (RTS) Cohort 1** at ULEM.
>
> **Your offer details:**
> - Program start: May 18, 2026
> - Schedule: Monday to Wednesday in-person (10 AM to 4 PM). Thursday and Friday remote.
> - Duration: 10 weeks (through late July 2026)
> - Cost to you: $0
>
> **To confirm your seat, please reply to this email with "I confirm" by [Date: Today + 5 days].**
>
> Seats are limited and held on a first-confirmed basis. If we don't hear from you by that date, we may offer your seat to someone on the waitlist.
>
> **What you'll get:**
> - Free professional training in HubSpot CRM, Revenue Operations, and AI tools
> - Industry certifications (HubSpot, Google, Salesforce)
> - Wraparound support based on your individual needs, as discussed in your Case Manager interview. This may include transportation, meals, a loaner laptop, or emergency funds.
> - Career coaching, employer connections, and a Demo Day presentation
>
> We can't wait to have you in the cohort. Congratulations again.
>
> The MSIMBO Team at ULEM

---

### Template 4: Waitlist Notification

**Subject:** Your RTS application — an update from our team

**Body:**

> Hi {!Lead.FirstName},
>
> Thank you so much for applying to the RTS program and for the time you put into your interview. It was genuinely great to learn more about you.
>
> Our Cohort 1 is now fully confirmed, and we've placed you on our **waitlist**. This means if a confirmed spot opens up before May 18, we'll contact you right away.
>
> We'll reach out no later than **May 5** to let you know your final status.
>
> We're also actively planning Cohort 2 (target: Fall 2026), and we'd love for you to be part of it. If that timeline works for you, you'll stay in our system and we'll be in touch with more details as they're confirmed.
>
> Thank you for your patience — and for your interest in building a career in tech. We hope to work with you soon.
>
> The MSIMBO Team at ULEM

---

### Template 5: Application Status Update (Decline)

**Subject:** An update on your RTS application, {!Lead.FirstName}

**Body:**

> Hi {!Lead.FirstName},
>
> Thank you for applying to the Revenue Technology Specialist program and for the time you invested in the process. We received a strong pool of applicants for Cohort 1, and this was a genuinely difficult decision.
>
> Unfortunately, we're not able to offer you a seat in this cohort.
>
> This does not mean we don't see potential in you — it means the specific needs of this cohort and the timing weren't the right fit at this moment.
>
> **What's next:**
> We're planning Cohort 2 for Fall 2026 and would encourage you to reapply when applications open. We'll keep your information on file and can reach out when the next application cycle begins, if you'd like.
>
> You can also reach out to programs@ulem.org if you have any questions or would like feedback.
>
> Thank you again for your interest. We wish you the very best.
>
> The MSIMBO Team at ULEM

---

### Template 6: Enrollment Confirmation

**Subject:** You're officially enrolled — here's everything you need to know, {!Lead.FirstName}

**Body:**

> Hi {!Lead.FirstName},
>
> Welcome to the RTS family. Your seat in Cohort 1 is confirmed.
>
> **Program start: Monday, May 18, 2026 at 10:00 AM**
> Location: ULEM Boston, 88 Warren Street, Roxbury, MA 02119
>
> **Before your first day, we'll send you:**
> - Your Google Classroom invite (check your email)
> - A welcome packet with what to bring and what to expect
> - Details on any wraparound support you requested
>
> **Your schedule:**
> - Mon to Wed: In-person, 10 AM to 4 PM at ULEM
> - Thu and Fri: Remote, self-paced plus project work
>
> **Questions before day one?** Reply to this email or contact Betzaida Guzman at programs@ulem.org.
>
> We are so excited to have you. See you May 18.
>
> The MSIMBO Team at ULEM

---

## 8. Lunacal.ai & Interview Scheduling

ULEM uses **Lunacal.ai** for interview scheduling (not Calendly). Lunacal supports webhooks on booking events — `booking.created`, `booking.rescheduled`, `booking.canceled` — which means bookings push into Salesforce automatically via n8n. See Appendix D, sections D.6–D.8 for the webhook flow design.

### 8.1 Setup

Create **two event types** in Lunacal.ai — one per interview stage:

**Event Type 1: RTS Instructor Interview**
- Duration: 30 minutes
- Host: Dele (Lead Instructor)
- Buffer: 15 minutes between interviews
- Location: configure **two separate location options** in Lunacal so the applicant picks one at booking time:
  1. Zoom (auto-generated link)
  2. In-person at ULEM Boston, 88 Warren Street, Roxbury, MA 02119
- Confirmation email: customize with RTS branding
- Reminders: 24 hours + 1 hour before
- **Custom booking question (required):** "Applicant email" — must match the email on the Salesforce Lead record. This is how n8n will find the Lead.
- Webhook: point `booking.created`, `booking.rescheduled`, `booking.canceled` to the n8n endpoint for the Instructor flow (see D.6)
- URL → paste into the **Instructor Interview Invitation** email template

**Event Type 2: RTS Case Manager Interview**
- Duration: 30 minutes
- Host: William Watkins (Case Manager)
- Buffer: 15 minutes between interviews
- Location: configure **two separate location options** in Lunacal so the applicant picks one at booking time:
  1. Zoom (auto-generated link)
  2. In-person at ULEM Boston, 88 Warren Street, Roxbury, MA 02119
- Confirmation email: customize with RTS branding
- Reminders: 24 hours + 1 hour before
- **Custom booking question (required):** "Applicant email" — must match the Lead email
- Webhook: point `booking.created`, `booking.rescheduled`, `booking.canceled` to the n8n endpoint for the Case Manager flow (see D.7)
- URL → paste into the **Case Manager Interview Invitation** email template

### 8.2 After Interview 1 (Instructor) Is Booked

**Automatic (no coordinator action):**

1. Applicant books via Lunacal → Lunacal fires `booking.created` webhook
2. n8n receives payload, finds Lead by applicant email, writes:
   - `RTS_Instructor_Interview_DateTime__c` = booking time
   - `Status` = `Interview 1 Scheduled`
3. Calendar invite / confirmation email goes to applicant and Dele (Lunacal default behavior)

**After the Instructor interview (Coordinator-owned):**

1. Dele logs notes in `RTS_Instructor_Interview_Notes__c`
2. Dele sets `RTS_Instructor_Interview_Outcome__c` → Advance to Case Manager / Hold for Review / Decline
3. Coordinator sets `Status` → `Interview 1 Complete`
4. Based on outcome, Coordinator routes:
   - **Advance to Case Manager:** Coordinator sets `Status` → `Interview 2 Requested` (triggers Case Manager invitation email)
   - **Decline:** Coordinator sets `RTS_Decision__c` = `Decline` AND `Status` → `Declined — Not Qualified`
   - **Hold for Review:** Coordinator discusses with Dele, then routes to one of the above

### 8.3 After Interview 2 (Case Manager) Is Booked

Same pattern as Interview 1:

**Automatic (no coordinator action):**

1. Applicant books via Lunacal → Lunacal fires `booking.created` webhook
2. n8n receives payload, finds Lead by applicant email, writes:
   - `RTS_CM_Interview_DateTime__c` = booking time
   - `Status` = `Interview 2 Scheduled`
3. Calendar invite / confirmation email goes to applicant and Case Manager

**After the Case Manager interview (Coordinator-owned):**

1. Case Manager logs notes in `RTS_CM_Interview_Notes__c`
2. Case Manager sets `RTS_CM_Interview_Outcome__c` → Recommend Accept / Recommend Waitlist / Recommend Decline
3. Coordinator sets `Status` → `Interview 2 Complete`
4. Coordinator sets `RTS_Decision__c` and moves `Status` → `Accepted — Offer Sent` / `Waitlisted` / `Declined — Not Qualified`

### 8.4 Reschedule and Cancel Handling

The Lunacal webhook also fires on `booking.rescheduled` and `booking.canceled`. n8n handles these:

- **Rescheduled:** update `RTS_Instructor_Interview_DateTime__c` (or CM equivalent) to new time. Status stays `Interview 1 Scheduled` (or `Interview 2 Scheduled`) — still a valid booking, just different time.
- **Canceled:** clear the DateTime field. Move Status back to `Interview 1 Requested` (or `Interview 2 Requested`) so the applicant can rebook using the same Lunacal link (the `Invite Sent` flag stays `true` to prevent a duplicate invitation email).
- In both cases, n8n creates a Salesforce Task for the Coordinator as a courtesy alert.

### 8.5 Fallback If Lunacal Webhook Fails

If the webhook fails or n8n is down, the Coordinator should:

1. Check the Lunacal dashboard for new bookings daily
2. Manually write the booking time to the appropriate DateTime field on the Lead
3. Manually move Status to `Interview 1 Scheduled` or `Interview 2 Scheduled`

This is a rare path but documented so it's not a surprise.

---

## 9. Reports & Dashboard

### 9.1 Reports to Create

**Report 1: RTS Application Funnel**
- Type: Summary Report on Leads
- Filter: `LeadSource = RTS Website`
- Group by: `Status`
- Shows: Count of applicants at each stage

**Report 2: Applications by Source**
- Type: Summary Report on Leads
- Group by: `RTS_Referral_Source__c`
- Shows: Where applicants are coming from (Google ads vs. referral vs. partner, etc.)

**Report 3: Assessment Pass Rate**
- Type: Summary Report on Leads
- Group by: `RTS_Assessment_Status__c`
- Filter: Has Assessment Date
- Shows: % passing on first try vs. retake vs. did not pass

**Report 4: Interview Pipeline**
- Type: Leads Report
- Filter: `Status IN (Interview 1 Requested, Interview 1 Scheduled, Interview 1 Complete, Interview 2 Requested, Interview 2 Scheduled, Interview 2 Complete)`
- Group by: `Status` (so you can see how many are at each interview stage)
- Shows: All active interview candidates with both interview dates and outcomes

**Report 4b: Instructor → Case Manager Conversion**
- Type: Matrix Report on Leads
- Rows: `RTS_Instructor_Interview_Outcome__c`
- Columns: `RTS_CM_Interview_Outcome__c`
- Shows: How Instructor recommendations correlate with Case Manager recommendations — helps calibrate rubrics across the two interviewers

**Report 5: Decision Outcomes**
- Type: Summary Report
- Group by: `RTS_Decision__c`
- Shows: Accept / Waitlist / Decline breakdown with decision reasons

**Report 6: Enrolled vs. Target**
- Type: Leads Report
- Filter: `Status = Accepted — Confirmed`
- Shows: Count confirmed vs. target of 15 (add a chart with a goal line)

**Report 7: Barrier Flags**
- Type: Matrix Report
- Rows: Transportation, Childcare, Internet barriers
- Shows: How many enrolled participants need each type of support (informs budget)

### 9.2 RTS Program Dashboard

Create a dashboard called **"RTS Cohort 1 — Recruitment Tracker"** with these components:

| Widget | Type | Data |
|---|---|---|
| Applications Received | Metric | Count of all RTS Leads |
| Funnel by Stage | Funnel Chart | Report 1 |
| Applications by Source | Donut Chart | Report 2 |
| Assessment Pass Rate | Gauge | Report 3 |
| Confirmed Enrolled | Gauge (0–15) | Report 6 |
| Decisions Breakdown | Bar Chart | Report 5 |
| Barrier Summary | Table | Report 7 |

---

## 10. User Roles & Responsibilities

> **Ownership rule (restated):** The Program Coordinator is the owner of every **decision-point** Status transition in the Lead pipeline. Automation handles three mechanical transitions only: `New → Assessment Pending` (on Lead create), `Interview 1 Requested → Interview 1 Scheduled` (on Lunacal webhook), and `Interview 2 Requested → Interview 2 Scheduled` (on Lunacal webhook). No other role writes to `Status`.

### Program Coordinator

**Daily tasks in Salesforce:**
- Check Lead queue for applications in `Assessment Pending` that need screening (automation already advanced them from New)
- Verify Criteria Core scores on Lead record (from n8n webhook) or log them manually; set Status → `Assessment Complete` once all three scores are in
- Update Status → `Interview 1 Requested` for qualified applicants (triggers Instructor email)
- **Skip** the Interview 1 Scheduled step — Lunacal webhook handles it when the applicant books
- After Instructor interview: set Status → `Interview 1 Complete`; based on Instructor Outcome, decide whether to advance
- Update Status → `Interview 2 Requested` for applicants advancing to Case Manager (triggers Case Manager email)
- **Skip** the Interview 2 Scheduled step — Lunacal webhook handles it when the applicant books
- After CM interview: set Status → `Interview 2 Complete`
- Set `RTS_Decision__c` and the matching terminal Status: `Accepted — Offer Sent` / `Waitlisted` / `Declined — Not Qualified`
- Follow up on pending offer responses (check 5-day task queue)
- Convert accepted Leads to Contacts, create Program Engagements, and set Status → `Converted`
- Monitor the Lunacal webhook health (check Appendix D, D.9 for fallback procedure if it fails)

**Recommended daily view:** Create a custom List View on Leads called **"RTS Active Pipeline"** with:
- Filter: `LeadSource = RTS Website` AND `Status NOT IN (Declined — Not Qualified, Declined — Withdrew, Converted)`
- Columns: Name, Status, Assessment Status, Instructor Interview Date, CM Interview Date, Decision, Offer Response, Last Modified

### Dele — Lead Instructor + Acting Director (Cohort 1)

Dele wears two hats for Cohort 1. Both are documented here so the split is clear for a future Director hire.

**As Lead Instructor:**
- Review applicant's application and assessment scores before each Instructor interview
- Conduct Instructor interview (30 min)
- Log interview notes in `RTS_Instructor_Interview_Notes__c`
- Set `RTS_Instructor_Interview_Outcome__c` → Advance / Hold / Decline
- Does **not** change Lead `Status` — communicates outcome to Coordinator via the outcome field

**As Acting Director:**
- Review RTS Dashboard weekly for go/no-go metrics
- Monitor Enrolled vs. Target widget to track toward go/no-go decision (≥8 confirmed by May 5)
- Review high-level funnel report
- Approve offers beyond Max Offers cap for the cohort
- Approve Case Manager's wraparound support recommendations where they have budget impact
- This role is temporary — flagged for hand-off to a permanent Director when one is hired

### Case Manager

Needs a **Salesforce license** and access to the Lead object with the RTS Application Layout.

**Tasks in Salesforce:**
- Review applicant's application, assessment scores, and Instructor notes before each CM interview
- Conduct Case Manager interview (30 min) — focus on barriers, wraparound, program readiness
- Log interview notes in `RTS_CM_Interview_Notes__c`
- Set `RTS_CM_Interview_Outcome__c` → Recommend Accept / Recommend Waitlist / Recommend Decline
- Flag any wraparound support needs (childcare, transportation, emergency support) in notes
- Does **not** change Lead `Status` — Coordinator owns all Status moves based on CM's outcome recommendation

---

## 11. Implementation Sequence

Complete these steps in order before launch.

### Phase 1: Data Model (Week 1)

- [ ] Add all custom fields to Lead object (see Section 2.1 table, including both interview field sets)
- [ ] Update Lead Status picklist with all 15 values (see Section 3)
- [ ] Create `RTS_Cohort__c` custom object with all fields (incl. Case Manager lookup)
- [ ] Create "Cohort 1 — May 2026" cohort record
- [ ] Create custom Lead page layout: **RTS Application Layout** (see Section 5.3 — 7 sections)
- [ ] Provision Case Manager as a Salesforce user (license, profile, permissions)
- [ ] Assign RTS Application Layout to Coordinator, Dele, and Case Manager profiles

### Phase 2: Web-to-Lead (Week 1–2)

- [ ] Go to Setup → Marketing → Web-to-Lead → Create form
- [ ] Select all fields to map (including custom RTS fields)
- [ ] Set Return URL to msimbo.org thank-you page
- [ ] Note all Field IDs for custom fields
- [ ] Update msimbo.org HTML form: change `action` to Salesforce endpoint, add hidden fields, map field names
- [ ] Add CAPTCHA or honeypot to form
- [ ] Test end-to-end: submit test form → verify Lead created in Salesforce with all fields populated
- [ ] Verify auto-response email arrives (Salesforce sends one by default from Web-to-Lead settings)

### Phase 3: Email Templates (Week 2)

- [ ] Create all 7 email templates (Application Received, Instructor Invite, Case Manager Invite, Offer, Waitlist, Decline, Enrollment — see Section 7)
- [ ] Add ULEM logo to email templates
- [ ] Create Email Alerts for each template (Setup → Email Alerts)
- [ ] Test each template with a real email address

### Phase 4: Automation Flows (Week 2–3)

- [ ] Build Flow 1: Application Received
- [ ] Build Flow 2: Instructor Interview Invitation
- [ ] Build Flow 3: Case Manager Interview Invitation
- [ ] Build Flow 4: Offer Letter Email
- [ ] Build Flow 5: Waitlist Notification
- [ ] Build Flow 6: Decline Notification
- [ ] Build Flow 7: Enrollment Confirmation
- [ ] Verify **no flow** writes to the `Status` field (enforce ownership rule)
- [ ] Test each flow end-to-end using a test Lead record
- [ ] Activate all flows

### Phase 5: Reports & Dashboard (Week 3)

- [ ] Create all 7 reports (see Section 9.1)
- [ ] Build RTS Dashboard with all widgets
- [ ] Share dashboard with Dele (Instructor + Acting Director), Coordinator, and Case Manager
- [ ] Set dashboard to refresh daily

### Phase 6: Lunacal.ai (Week 3)

- [ ] Create "RTS Instructor Interview" event type in Lunacal (host: Dele)
- [ ] Create "RTS Case Manager Interview" event type in Lunacal (host: Case Manager)
- [ ] Add a required custom question "Applicant email" to both event types
- [ ] Add Instructor URL to Instructor Interview Invitation email template
- [ ] Add Case Manager URL to Case Manager Interview Invitation email template
- [ ] Test both booking flows end-to-end

### Phase 7: n8n Workflows (Week 3–4)

- [ ] Provision n8n instance (self-hosted or cloud)
- [ ] Create a dedicated Salesforce integration user and OAuth2 credentials in n8n
- [ ] Build Workflow 1: Criteria Core → Salesforce (see Appendix D, D.5)
- [ ] Build Workflow 2: Lunacal Instructor booking → Salesforce (see Appendix D, D.6)
- [ ] Build Workflow 3: Lunacal Case Manager booking → Salesforce (see Appendix D, D.7)
- [ ] Configure Criteria Corp webhooks (Status + Scores) pointing at n8n
- [ ] Configure Lunacal webhooks (booking.created, rescheduled, canceled) pointing at n8n for both event types
- [ ] Test each workflow end-to-end with a dummy applicant in the Salesforce sandbox
- [ ] Set up Slack alert channel for n8n workflow errors
- [ ] Promote workflows to production

### Phase 8: Training & Launch (Week 4)

- [ ] Train Coordinator on full workflow (Lead queue → application review → assessment verification → two-interview scheduling → decisions → conversion)
- [ ] Train Dele on Instructor interview notes and outcome field (and separately on Acting Director dashboard view)
- [ ] Train Case Manager on interview notes and outcome field
- [ ] Create coordinator quick-reference guide (1-page cheat sheet covering the full two-interview pipeline)
- [ ] Run a full end-to-end test with a fake applicant (including n8n webhook path)
- [ ] Go live — enable ads / publish msimbo.org application form

---

## Appendix A: Lead Conversion Mapping

When a Lead is converted (after offer confirmed), map these fields to Contact and Account:

| Lead Field | Contact Field |
|---|---|
| First Name | First Name |
| Last Name | Last Name |
| Email | Email |
| Phone | Phone |
| RTS_Zip_Code__c | Create matching Contact custom field |
| RTS_Employment_Status__c | Create matching Contact custom field |
| RTS_Cohort__c | Create matching Contact lookup |
| RTS_Childcare_Barrier__c | Create matching Contact custom field |
| RTS_Transportation_Barrier__c | Create matching Contact custom field |
| RTS_Internet_Barrier__c | Create matching Contact custom field |

> All custom Contact fields need to be created before conversion mapping is configured.

---

## Appendix B: Criteria Core Assessment Thresholds

We use **Criteria Core's recommended benchmark scores** for entry-level sales / revenue operations / customer success roles as the default passing thresholds. These are pulled from Criteria Core's Benchmark Library during account setup, reviewed with ULEM, and locked in before Cohort 1 launches.

| Assessment | Minimum Passing Score | Notes |
|---|---|---|
| CLIK (Computer Literacy & Internet Knowledge) | Criteria Core default for entry-level CRM/ops roles | Basic digital skills — prerequisites for HubSpot / Salesforce training |
| CCAT (Criteria Cognitive Aptitude Test) | Criteria Core default for sales/ops roles | Problem solving, pattern recognition, verbal reasoning |
| CBST2 (Criteria Basic Skills Test, v2) | Criteria Core default for entry-level roles | Reading comprehension, math fundamentals, language mechanics |

**Decision logic:**
- All three must pass for the applicant to advance to the Instructor interview
- A retake can be offered once for any single failed assessment
- Coordinator may override the threshold with Acting Director approval for applicants with strong motivation, lived experience, or referral signals

**Action before launch:**
- [ ] Pull Criteria Core recommended benchmarks during implementation setup (Phase 1)
- [ ] Document the exact numeric thresholds used in this Appendix
- [ ] Lock in the thresholds so every applicant is scored against the same bar

---

## Appendix C: Key Dates — Cohort 1

| Milestone | Date |
|---|---|
| Application form goes live | ASAP (TBD) |
| Go/no-go decision | May 5, 2026 (≥8 confirmed enrollees) |
| Offers sent deadline | ~May 10, 2026 |
| Cohort 1 start | May 18, 2026 |
| Cohort 1 end | ~July 27, 2026 |
| 30-day placement check-in | ~August 27, 2026 |
| 90-day placement check-in | ~October 27, 2026 |

---

## Appendix D: n8n — Where It Helps, Where It Doesn't

We have access to n8n. This appendix lays out every workflow we're running through it for Cohort 1 — plus the use cases we evaluated and decided to skip.

### D.1 Use Case Evaluation

| Use Case | n8n Value | Verdict |
|---|---|---|
| Criteria Core scores → Salesforce | **High** — Criteria Corp exposes Status + Scores webhooks. Eliminates manual data entry for every applicant. | **Build it (D.5)** |
| Lunacal booking → Salesforce (Instructor) | **High** — eliminates coordinator data entry for every interview booking, and auto-advances Status to `Interview 1 Scheduled`. Lunacal fires standard webhook on `booking.created`. | **Build it (D.6)** |
| Lunacal booking → Salesforce (Case Manager) | **High** — same as above, for the Case Manager event type. | **Build it (D.7)** |
| Reminder / nurture sequences | **Medium** — useful if you want multi-channel (email + SMS) reminders. Salesforce Flow can do email-only. | **Build only if SMS or cross-channel is needed; otherwise Flow is enough** |
| Form submission → Salesforce Lead | **Negligible** — Web-to-Lead already handles this natively. Adding n8n in the path just adds a failure point. | **Skip** |
| Error alerting / pipeline health | **Medium** — n8n can poll Salesforce and ping Slack when funnel stalls (e.g., Lead stuck in `Assessment Pending` > 7 days). | **Optional Cohort 2 enhancement** |

### D.2 Three n8n Workflows to Build for Cohort 1

All three write to Salesforce via OAuth2 credentials scoped to a dedicated **integration user** (not a human user). This gives a clean audit trail — every automated change is attributed to that integration user, easy to distinguish from coordinator edits.

1. **Criteria Core scores → Salesforce** (D.5) — writes assessment scores and Assessment Status. Does not change Lead Status.
2. **Lunacal Instructor booking → Salesforce** (D.6) — writes DateTime and advances Lead Status to `Interview 1 Scheduled`.
3. **Lunacal Case Manager booking → Salesforce** (D.7) — writes DateTime and advances Lead Status to `Interview 2 Scheduled`.

Workflows 2 and 3 are the documented exceptions to the "n8n doesn't write Status" guideline (see D.4). They write only to a specific `Interview N Requested → Interview N Scheduled` transition — never anywhere else in the pipeline.

### D.3 n8n Instance Setup

1. Provision an n8n instance (self-hosted or n8n Cloud). Document the owner.
2. Create Salesforce OAuth2 credentials in n8n, connected to a dedicated integration user (e.g., `n8n-integration@ulem.org`).
3. Create a Slack credential for error alerting (optional but recommended).
4. Create three workflows following the templates in D.5, D.6, D.7 — each with its own webhook URL.

### D.4 What NOT to Automate in n8n

To keep the design clean and reversible:

- **The only Status transitions n8n writes** are the three mechanical ones: `New → Assessment Pending` (handled in Salesforce Flow, not n8n), `Interview 1 Requested → Interview 1 Scheduled` (D.6), and `Interview 2 Requested → Interview 2 Scheduled` (D.7). Every other Status move belongs to the Coordinator.
- **Don't mirror Flow Builder logic into n8n** — if Salesforce Flow can already send the email (e.g., offer letter, waitlist notification), keep it in Flow. n8n owns only cross-system moves (Criteria Core, Lunacal) or cross-channel output (Slack, SMS) that Flow can't do natively.
- **Don't treat n8n as a hard dependency.** If n8n is down, the Coordinator falls back to manual logging. See each workflow's fallback notes.

### D.5 Workflow 1: Criteria Core → Salesforce

**Why this matters:** Without automation, the Coordinator opens every Criteria Core result email, finds the matching Lead, types three scores, sets Assessment Status, sets Assessment Date. That's ~2–3 minutes per applicant × 40–60 applicants = 2–3 hours of pure data entry with a real risk of typos. n8n eliminates it.

**Flow design:**

```
Criteria Core webhook (Scores + Status)
     ↓
[n8n] Parse payload
     ↓
[n8n] Salesforce: Find Lead by applicant email
     ↓
[n8n] Salesforce: Update Lead
   - RTS_CLIK_Score__c
   - RTS_CCAT_Score__c
   - RTS_CBST2_Score__c
   - RTS_Assessment_Date__c (now)
   - RTS_Assessment_Status__c (Passed / Retake Required / Did Not Pass — based on score vs threshold)
     ↓
[n8n] Salesforce: Create Task
   - Subject: "Review Criteria Core scores — [Name]"
   - Assignee: Program Coordinator
   - Priority: Normal
   - Due: Today + 1 day
   - Comments: Score summary
     ↓
[n8n] (if all three pass) Slack alert to #rts-coordinator channel
     ↓
Done. Coordinator opens the task and — if scores confirm — sets Status → Interview 1 Requested.
```

**Design rule:** This workflow writes scores and dates but **does NOT write to Lead `Status`**. It creates a Salesforce Task asking the Coordinator to make the status call. Assessment pass/fail is a judgment that the Coordinator owns (threshold + context), not a mechanical sync.

**Setup steps:**

1. In n8n, create a new workflow with a Webhook Trigger node. Copy the webhook URL (e.g., `https://n8n.ulem.org/webhook/criteria-core-scores`).
2. Contact your Criteria Corp rep and ask them to configure two webhooks on the ULEM account:
   - **Status Webhook** → n8n URL
   - **Scores Webhook** → n8n URL (can be same endpoint; use payload fields to route)
3. Add a Salesforce node using the integration-user OAuth2 credentials.
4. Build the "Find Lead by email" → "Update Lead" → "Create Task" chain as shown above.
5. Send a test payload from Criteria Corp, confirm it lands on a test Lead.

**Fallback:** If the webhook fails, Coordinator reads the Criteria Core result email and logs scores manually (Section 5.2).

### D.6 Workflow 2: Lunacal Instructor Booking → Salesforce

**Why this matters:** When an applicant books via Lunacal, the calendar has the truth but Salesforce doesn't — unless somebody manually types it in. This workflow keeps Salesforce in sync and eliminates the coordinator step of watching Lunacal confirmations.

**Flow design:**

```
Lunacal "Instructor Interview" webhook (booking.created / rescheduled / canceled)
     ↓
[n8n] Parse payload — extract:
       - applicant email (from the required custom booking question)
       - booking start time
       - event type = "booking.created" | "booking.rescheduled" | "booking.canceled"
     ↓
[n8n] Salesforce: Find Lead by applicant email
     ↓
[n8n] Branch on event type:
     ├─ booking.created:
     │    • Update Lead:
     │        RTS_Instructor_Interview_DateTime__c = start time
     │        Status = "Interview 1 Scheduled"    ← mechanical exception
     │
     ├─ booking.rescheduled:
     │    • Update Lead:
     │        RTS_Instructor_Interview_DateTime__c = new start time
     │    • (Status stays Interview 1 Scheduled)
     │    • Create Task: "Instructor interview rescheduled — [Name]"
     │
     └─ booking.canceled:
          • Update Lead:
              RTS_Instructor_Interview_DateTime__c = null
              Status = "Interview 1 Requested"    ← roll back
          • Create Task: "Instructor interview canceled — [Name]"
     ↓
Done.
```

**Setup steps:**

1. In n8n, create a new workflow with a Webhook Trigger node. Copy the webhook URL (e.g., `https://n8n.ulem.org/webhook/lunacal-instructor`).
2. In Lunacal, open the **RTS Instructor Interview** event type settings → Webhooks → add the n8n URL for `booking.created`, `booking.rescheduled`, `booking.canceled`.
3. Make sure the Lunacal event type has a required question labeled "Applicant email" (must match the Lead email).
4. Build the branching flow in n8n using the Salesforce node with integration-user credentials.
5. Test: book a dummy slot using a test Lead's email → verify Lead DateTime and Status update.

**Fallback:** If the webhook fails, Coordinator checks Lunacal dashboard daily, enters DateTime manually, moves Status to `Interview 1 Scheduled` manually (Section 8.5).

### D.7 Workflow 3: Lunacal Case Manager Booking → Salesforce

Same design as D.6 but for the Case Manager event type. Fields are `RTS_CM_Interview_DateTime__c` and the rolled-back status is `Interview 2 Requested`.

```
Lunacal "Case Manager Interview" webhook (booking.created / rescheduled / canceled)
     ↓
[n8n] Parse payload (applicant email, booking start time, event type)
     ↓
[n8n] Salesforce: Find Lead by applicant email
     ↓
[n8n] Branch on event type:
     ├─ booking.created:
     │    • Update Lead:
     │        RTS_CM_Interview_DateTime__c = start time
     │        Status = "Interview 2 Scheduled"    ← mechanical exception
     │
     ├─ booking.rescheduled:
     │    • Update Lead:
     │        RTS_CM_Interview_DateTime__c = new start time
     │    • (Status stays Interview 2 Scheduled)
     │    • Create Task: "Case Manager interview rescheduled — [Name]"
     │
     └─ booking.canceled:
          • Update Lead:
              RTS_CM_Interview_DateTime__c = null
              Status = "Interview 2 Requested"    ← roll back
          • Create Task: "Case Manager interview canceled — [Name]"
```

Setup steps mirror D.6 — webhook URL `https://n8n.ulem.org/webhook/lunacal-case-manager`, pointed from the Case Manager event type in Lunacal.

### D.8 Operational Considerations

- **Who owns the n8n instance?** Needs to be clear. If it's self-hosted, assign an owner for uptime.
- **Secrets management:** Salesforce integration user credentials live in n8n's credential store — not in workflow JSON.
- **Logging:** Turn on execution logging for all three workflows. Any failure (e.g., email doesn't match a Lead, Salesforce API timeout) routes to a Slack alert, not silently dropped.
- **Testing:** Use a Salesforce sandbox for first builds. Promote to production only after end-to-end verification with a dummy Criteria Core run + dummy Lunacal bookings on both event types.
- **Idempotency:** Lunacal may retry a webhook if n8n times out. Guard against double-writes — e.g., in the `booking.created` branch, only set `Status = Interview 1 Scheduled` if current Status is `Interview 1 Requested` (don't overwrite a later status like `Interview 1 Complete`).

### D.9 Monitoring

Create a Salesforce report: Leads where `RTS_Instructor_Invite_Sent__c = true` AND Status = `Interview 1 Requested` AND days-since-last-modified > 5. This catches applicants whose Instructor invite went out but whose booking never made it into Salesforce — either the applicant hasn't booked, or the Lunacal webhook failed. Same report pattern for Case Manager.

---

## Appendix E: Sources

- [Criteria Corp — Technology Integrations & Partnerships](https://www.criteriacorp.com/integrations-and-partners)
- [Criteria Corp integration — KeldairHR docs (confirms Status + Scores webhook URLs)](https://support.keldairhr.com/hc/en-us/articles/19670820303511-Criteria-Assessment-Integration)
- [Criteria API listing — API Tracker](https://apitracker.io/a/criteriacorp)
- [Lunacal.ai — home / webhook-supported scheduling](https://lunacal.ai)
- [Lunacal.ai — help & docs](https://help.lunacal.ai)
- [n8n — Webhook and Salesforce integration](https://n8n.io/integrations/webhook/and/salesforce/)
