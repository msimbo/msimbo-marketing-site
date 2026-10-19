# RTS Program Coordinator Training Guide

**Your role:** Program Coordinator for the ULEM Revenue Technology Specialist (RTS) program.

**About "Cohort X":** This guide is written to work for every cohort. Wherever you see **Cohort X**, read it as the cohort that is recruiting right now. The only cohort-specific details are the dates in [Cohort key dates](#cohort-key-dates) at the end.

**What you'll find here:** Everything you need to run recruitment from the first application to the first day of class. Step-by-step, screen-by-screen.

**How to use this:** Read it once end-to-end so you see the full picture. Then keep it open next to Salesforce as a reference. Each section answers a question: "When this happens, what do I do?"

**If something looks different on screen:** The system may have been updated since this guide was written. When in doubt, ask Dele.

> **What changed on October 19, 2026**
>
> - **Cohorts have a new naming pattern:** `{Code} Cohort {n} · {Season} {Year} · FY{yy}-C{c}`, e.g. **RTS Cohort 2 · Fall 2026 · FY27-C1**. "Cohort 2" is the program's running count; "FY27-C1" is ULEM's reporting cycle (the first cohort starting in fiscal year 2027, which runs July-June). Salesforce builds the name for you, see [Setting up a new cohort's name](#setting-up-a-new-cohorts-name) and the [Program and Cohort Naming Guide](https://wiki.ulem.org/doc/program-and-cohort-naming-guide-D4tdVU103w).
> - **The program is now called MSIMBO Academy** (it was briefly MSIMBO Tech Academy).

> **What changed on October 16, 2026**
>
> - **You no longer convert Leads.** When you move a Lead to `Offer Confirmed`, Salesforce converts it to a student record (a Person Account), carries over their intake answers, and enrols them in their cohort and its three phases, all within a minute. The Lead moves to `Converted-RTS` on its own. See [Section 6.9](#69-checking-a-new-students-enrolment).
> - **Your task changes from "Convert Lead to Contact" to "Check enrolment".** It takes a few seconds: open the student, check the cohort is right, mark the task Complete.
> - **If the automatic step can't finish, you get an "Enrol by hand" task** with the reason. [Section 6.9](#69-checking-a-new-students-enrolment) has the steps.
> - **The program is now called MSIMBO Academy in Salesforce.** RTS is a track of MSIMBO.

> **What changed on October 7, 2026**
>
> - **Interview invitations are now automatic.** When a Lead is at `Assess Complete`, `Assessment Status = Passed` and all three scores (CLIK, CCAT, CBST2) are filled in, Salesforce moves it to `Interview Requested` and sends the interview invitation right away. You no longer change the Status to `Interview Requested` yourself. See [Section 6.5](#65-advancing-a-qualified-applicant-to-the-interview).
> - **Double-check before you save.** Whichever you save last (the Status, `Passed`, or the third score) sends the email. `Retake Required` and `Did Not Pass` stay at `Assess Complete` for you to decide.
> - **Returning applicants** who passed the assessment in the last 12 months skip it and go straight to `Interview Requested`. See [Someone re-applies](#someone-re-applies-returning-applicants).
> - **Two new tasks** may appear in your queue: "Returning RTS applicant" and "Possible duplicate RTS applicant". See [Section 8](#8-tasks-in-your-queue-what-they-mean).
> - **Don't delete duplicate Leads.** Send Dele the links and he'll merge them. See [Someone re-applies under a different email](#someone-re-applies-under-a-different-email).

---

## Table of Contents

1. [What the system does (and doesn't) do for you](#1-what-the-system-does-and-doesnt-do-for-you)
2. [Key terms and who does what](#2-key-terms-and-who-does-what)
3. [Logging in and getting around](#3-logging-in-and-getting-around)
4. [The daily rhythm: your morning checklist](#4-the-daily-rhythm-your-morning-checklist)
5. [The full applicant journey, step by step](#5-the-full-applicant-journey-step-by-step)
6. [How to do each decision: every Status change explained](#6-how-to-do-each-decision-every-status-change-explained)
7. [The dashboard: what each widget means](#7-the-dashboard-what-each-widget-means)
8. [Tasks in your queue: what they mean](#8-tasks-in-your-queue-what-they-mean)
9. [Handling special situations](#9-handling-special-situations)
10. [When something looks wrong: troubleshooting](#10-when-something-looks-wrong-troubleshooting)
11. [Appendix: cheat sheets](#11-appendix-cheat-sheets)

---

## 1. What the system does (and doesn't) do for you

### Salesforce does this automatically

- When an applicant submits the form on msimbo.org, **a Lead record is created in Salesforce** within seconds.
- The Lead is **assigned to you**. You'll see it in your Leads queue.
- An email with the **skills assessment link** goes to the applicant right away.
- The Lead status advances to **`Assess Pending`** so you know the applicant owes us an assessment score.
- When an applicant has `Assessment Status = Passed` and all three scores filled in at `Assess Complete`, the Lead **moves to `Interview Requested` and the interview invitation goes out**.
- When an applicant books their interview via Lunacal, the **interview time is written to the Lead automatically** and the status advances.
- When you move a Lead to certain statuses (Interview Requested, Offer Sent, Waitlisted, Declined), the **right email to the applicant goes out automatically**.
- When the email goes out, the system creates any **follow-up tasks** you need (e.g., "follow up on offer confirmation" the next day).
- When you move a Lead to `Offer Confirmed`, the applicant is **converted to a student record and enrolled in their cohort** automatically, and the Lead moves to `Converted-RTS`.

### You do this manually

- **Review** each application and assessment score.
- **Decide** each status transition (advance to interview? waitlist? decline?).
- **Move the Lead forward** once Dele has logged his interview outcome.
- **Check the new student's enrolment** once an applicant confirms (Salesforce gives you a "Check enrolment" task). You only enrol someone by hand if Salesforce tells you it couldn't.

### The golden rule

**The system only sends automated emails when you change the Lead's Status to the right value.** If a status change doesn't happen, no email goes out. You are the one driving the pipeline forward.

---

## 2. Key terms and who does what

### The objects in Salesforce you'll see

| Term | What it is |
|---|---|
| **Lead** | An applicant. Every person who applies becomes a Lead record. |
| **Person Account (student)** | A confirmed, enrolled student. Salesforce turns the Lead into a Person Account automatically when you move it to `Offer Confirmed`. It's the same kind of record as ULEM's other students, so a returning ULEM client keeps one record. |
| **Program Engagement** | The record linking a student to the program (**MSIMBO Academy**) and to their cohort. Salesforce creates it at the same time (see [Section 6.9](#69-checking-a-new-students-enrolment)). |
| **Cohort** | A single run of the program. Every Lead is tagged automatically to the cohort that is recruiting when they apply. Dates are in [Cohort key dates](#cohort-key-dates). |
| **Task** | A to-do item Salesforce creates for you (e.g., "follow up with applicant"). You'll see these in your Home page or on the Lead record. |

### The people

| Role | Who | What they do |
|---|---|---|
| **Program Coordinator** | Betzaida Guzman (you) | Owns every decision in the pipeline. Runs recruitment. Reviews assessments, moves applicants through the stages, makes accept/waitlist/decline calls. All automatic tasks are assigned to you. |
| **Lead Instructor** | Dele Omotosho | Interviews every applicant. Logs the interview outcome, notes and any wraparound support the applicant needs. Manages the technical curriculum. |
| **Applicant** | Anyone who submits the form on msimbo.org | Completes the assessment, takes one interview, accepts or declines the offer. |

### The status pipeline (the heart of the system)

Every Lead has a **Status** field that tells you where they are in recruitment. There are 11 possible statuses. You'll move Leads through them by clicking the Status field and picking the next one.

Think of the pipeline like a funnel:

```
Assess Pending
      ↓
Assess Complete
      ↓
Interview Requested  →  Interview Scheduled  →  Interview Complete
      ↓
Offer Sent
      ↓
Offer Confirmed  →  Converted-RTS

      (alternate endings)
      ├─ Waitlisted
      ├─ Declined-NotQual
      └─ Declined-Withdrew
```

There is **one interview**, with the Lead Instructor. It covers fit for the program and any wraparound support the applicant needs.

**What you need to know:**

- **You change the status manually** for every transition except four that the system handles:
  - New application → `Assess Pending` (fires when the Lead is created). A returning applicant who passed the assessment in the last 12 months skips it and goes on to `Interview Requested` (or `Assess Complete` if their scores are missing). See [Someone re-applies](#someone-re-applies-returning-applicants).
  - `Assess Complete` → `Interview Requested` (fires when `Assessment Status = Passed` and all three scores are filled in). See [Section 6.5](#65-advancing-a-qualified-applicant-to-the-interview).
  - `Interview Requested` → `Interview Scheduled` (fires when the Lunacal booking arrives)
  - `Offer Confirmed` → `Converted-RTS` (fires a few seconds after you set `Offer Confirmed`, once the student is enrolled). See [Section 6.9](#69-checking-a-new-students-enrolment).
- **Status changes trigger emails.** Moving to `Interview Requested` sends the interview booking email. Moving to `Offer Sent` sends the offer letter. And so on.
- **Always change Status last.** Fill in notes, scores, outcomes first. The moment you change the Status, the email goes out. You can't take it back.

---

## 3. Logging in and getting around

### Log in

1. Open your browser and go to **[ulem.my.salesforce.com](https://ulem.my.salesforce.com)**.
2. Enter your username: `bguzman@ulem.org`
3. Enter your password. If prompted, complete two-factor authentication.
4. You'll land on your Salesforce Home page.

### The app you use

In the very top-left corner you'll see the ULEM logo and the app name. Make sure you're in the app that includes **Leads, Contacts, and Dashboards** (usually called "Nonprofit Success Pack" or similar).

If you don't see "Leads" in the top menu, click the **grid icon (9 dots) in the top-left** to open the App Launcher and pick the right app.

### Key pages you'll live in

| Page | How to get there | Why |
|---|---|---|
| **Leads list** | Click **Leads** tab in top nav | See every applicant |
| **Individual Lead** | Click any applicant's name | Where you do everything — review, log notes, change status |
| **Dashboard** | App Launcher → **Dashboards** → **Recruitment Tracker - RTS Cohort X** | Quick overview of how recruitment is going |
| **Reports** | App Launcher → **Reports** → folder **RTS - Recruitment Reports** | Deeper slices of the data |
| **Applicants board** | **Leads** tab → list view **RTS Cohort X - Applicants** | Every applicant for the current cohort. Switch the display to **Kanban** to see them as cards by stage. |
| **Program Engagements** | App Launcher → **Program Management** → **Program Engagements** tab (or the **Related** tab on any student) | Where enrolled students live once they're enrolled |
| **Your Home / Tasks** | Click **Home** in top nav | See your open tasks for the day |

### Favorite the dashboard right now

1. Open the Recruitment Tracker - RTS Cohort X dashboard
2. Click the **star icon** next to the dashboard name at the top
3. Now it's available from the Favorites star icon in the top nav on every page

Do the same for the Leads tab.

---

## 4. The daily rhythm: your morning checklist

Open Salesforce once a day (twice a day once applications are flowing heavily). Here's the routine.

### 1. Open the dashboard

App Launcher → **Dashboards** → **Recruitment Tracker - RTS Cohort X**

The dashboard refreshes itself every hour. Click **Refresh** (circular arrow icon top-right) if you need numbers from the last few minutes.

**Look at:**
- **Applications Received** — how many total applicants so far
- **Funnel by Stage** — where in the pipeline people are stuck
- **Confirmed Enrolled** gauge — how close we are to our 15-seat goal
- **Interview Pipeline** — who you need to follow up with for interviews

### 2. Check your Tasks

Click **Home** in the top nav.

You'll see a list of tasks assigned to you. Each task is tied to a Lead. Typical tasks you'll see:
- "Follow up on offer confirmation — [Name]"
- "Check enrolment — [Name]"
- "Instructor interview rescheduled — [Name]"
- "Instructor interview cancelled — [Name]"

**For each task:** click it, read the description, click the linked Lead, do what it asks, then mark the task **Complete** (dropdown next to the task → Mark Complete).

### 3. Check the Leads list

Click the **Leads** tab.

Pick the list view **RTS Cohort X - Applicants** (dropdown at top-left next to "Recently Viewed") to see every applicant for the current cohort.

**Look for:**
- New Leads at `Assess Pending` — are they >3 days old without completing the assessment? Time to nudge them.
- Leads at `Assess Complete` waiting for your review
- Leads at `Interview Requested` where `Invite Sent = true` but the booking hasn't come in after 5 days
- Leads at `Offer Sent` where the offer has been out 3+ business days with no confirmation

### 4. Handle anything Criteria Core sent overnight

You'll get email notifications from Criteria Corp (ondemandassessment.com) with each applicant's scores. **You enter these scores into Salesforce by hand** — one of the few fully manual steps.

Skip ahead to [Section 6.3](#63-when-an-applicant-completes-the-criteria-core-assessment) for exact instructions.

### 5. Reply to any email from `program-rts@ulem.org`

The system sends emails from `program-rts@ulem.org` on your behalf. Applicants reply to those emails. Those replies land in the shared inbox you monitor. Answer them promptly — most are scheduling questions or confusion about the assessment link.

---

## 5. The full applicant journey, step by step

This is the end-to-end flow from one applicant's point of view, so you can see how your actions stitch together.

### Day 0 — Applicant submits the form on msimbo.org

- System creates the Lead in Salesforce automatically.
- Lead Status is set to **`Assess Pending`**.
- Lead Owner is **you**.
- System emails the applicant the **Criteria Core assessment link** from `program-rts@ulem.org`.
- You see a new row in the Leads list.

**You do:** nothing yet. Wait for them to complete the assessment.

**Returning applicants are different.** If the person passed the assessment in the last 12 months, they skip the assessment and go straight to **`Interview Requested`**: they get the interview invitation instead of the assessment email. See [Someone re-applies](#someone-re-applies-returning-applicants).

### Day 1-3 — Applicant takes the Criteria Core assessment

- Applicant clicks the assessment link in their email.
- They complete three tests: CLIK (Computer Literacy), CCAT (Cognitive Aptitude), CBST2 (Basic Skills).
- Criteria Corp emails you their scores.

**You do:** go to the Lead in Salesforce, enter the three scores into the fields `CLIK Score`, `CCAT Score`, `CBST2 Score`, and set `Assessment Status` to one of:
- `Passed` — scores meet thresholds
- `Retake Required` — one or more scores are below threshold but close enough to try again
- `Did Not Pass` — scores are too low to qualify

See [Section 6.3](#63-when-an-applicant-completes-the-criteria-core-assessment) for the score thresholds.

Then move Lead Status to **`Assess Complete`**.

### Day 2-5 — The applicant is invited to interview

If you set `Assessment Status = Passed` and all three scores are filled in, **the system moves the Lead straight to `Interview Requested`** as soon as it reaches `Assess Complete`. You don't change the Status yourself.

**System then:** sends the interview booking email with the Lunacal link. Sets the `Invite Sent` flag to prevent duplicate emails.

If they're at `Retake Required` or `Did Not Pass`, they stay at `Assess Complete` and you decide what happens next.

### Day 4-8 — Applicant books their interview

Applicant clicks the Lunacal link, picks a time with Dele, books it.

**System then:** automatically writes the interview time into the Lead's `Instructor Interview Date/Time` field AND changes Status to **`Interview Scheduled`**. You don't do anything.

### Day ~8 — Dele interviews the applicant

After the interview, Dele writes notes in Salesforce, records any wraparound support the applicant needs (transportation, meals, laptop), and picks an outcome:
- **Advance** — recommend an offer
- **Hold for Review** — needs discussion
- **Decline** — not a fit

**You do:** once Dele has logged the outcome, you change the Lead's Status to **`Interview Complete`**. Then you make the final call:

| Final call | Your action |
|---|---|
| Accept | Set `Decision = Accept`, Status → **`Offer Sent`** |
| Waitlist | Set `Decision = Waitlist`, Status → **`Waitlisted`** |
| Decline | Set `Decision = Decline`, Status → **`Declined-NotQual`** |

**System then sends the right email** based on which Status you chose.

### Day ~10 — Applicant responds to the offer

They reply to the offer email saying "I confirm" (or they don't).

**You do:**
- If confirmed within 3 business days: Status → **`Offer Confirmed`**
- You get a task reminder the day after the offer goes out. If they have not replied, follow up. If still no response, move to Waitlisted or Declined.

**System then:** (on Offer Confirmed) sends the Enrollment Confirmation email with program start details, converts the Lead into a student record, enrols them in Cohort X and its three phases, moves the Lead to `Converted-RTS`, and creates a task for you titled "Check enrolment".

### Day ~10 — You check the enrolment

Open the student from the task and check they're in the right cohort (see [Section 6.9](#69-checking-a-new-students-enrolment)). Mark the task Complete.

You're done with that applicant's recruitment cycle. They're now a student with a Program Engagement for Cohort X, and they appear on every class day's attendance list.

---

## 6. How to do each decision: every Status change explained

This is the "recipe book" — look up the situation, follow the steps.

### 6.1 Opening a Lead record

1. Click the **Leads** tab at the top.
2. Click the applicant's name.
3. You'll land on the Lead detail page.

At the top of the page you'll see a **colored bar showing the pipeline steps** — this is called the **Path**. Each step is one of the RTS Statuses. The current step is highlighted. Click a step to go there.

Below that, you'll see sections:
- **Applicant Info** — name, email, phone, age, zip, etc.
- **Motivation** — what they wrote about their goals
- **Assessment Results** — CLIK/CCAT/CBST2 scores and the Assessment Status field
- **Interview** — date/time, notes, outcome
- **Decision** — your final call
- **Barriers & Wraparound** — barriers the applicant reported, wraparound notes, and which supports they were approved for

To edit any field, **click the pencil icon next to it**, type your value, click **Save**.

### 6.2 Changing Status (the most common action)

There are two ways to change Status:

**Option A — use the Path bar at the top of the Lead**

1. Click the step you want to move to.
2. Click **Mark Status as Complete** (or the button that appears).
3. Confirm. Done.

**Option B — edit the Status field directly**

1. Click the pencil icon next to the **Lead Status** field in the Applicant Info section.
2. Pick the new Status from the dropdown.
3. Click **Save**.

Either way works. Path bar is faster. Direct field edit is more precise.

> **Remember:** the moment you change Status, any automated email tied to that status goes out. Double-check before clicking Save.

### 6.3 When an applicant completes the Criteria Core assessment

You'll get an email from Criteria Corp with their scores. Here's what to do:

**Score thresholds:**

| Assessment | Pass threshold | Retake-worthy range | Did Not Pass |
|---|---|---|---|
| CLIK | ≥ 70 | 50–69 | < 50 |
| CCAT | ≥ 20 | 15–19 | < 15 |
| CBST2 | ≥ 65 | 50–64 | < 50 |

*(Dele sets these thresholds. If a score is borderline, ask.)*

**Steps:**

1. Open the Lead.
2. Scroll to the **Assessment Results** section.
3. Enter the three scores in `CLIK Score`, `CCAT Score`, `CBST2 Score`.
4. Set `Assessment Date` to today's date.
5. Set `Assessment Status`:
   - **Passed** if all three scores meet their pass threshold
   - **Retake Required** if one or two scores are in the "retake-worthy" range (see next section for what happens)
   - **Did Not Pass** if any score is below the retake-worthy range, or multiple scores are borderline
6. Optionally add a note in **Assessment Notes** (e.g., "Strong CLIK, weak CCAT — may benefit from retake").
7. **Save**.
8. Change Lead Status to **`Assess Complete`** (or straight to `Declined-NotQual` if they did not pass and you've decided to cut them).

> **Heads up:** if `Assessment Status = Passed` and all three scores are filled in, reaching `Assess Complete` moves the Lead on to `Interview Requested` **and sends the interview invitation right away**. That happens whichever you save last: the Status, the Passed status or the third score. Double-check the scores and `Passed` before you save.

### 6.4 When you trigger an assessment retake

If you set `Assessment Status = Retake Required`, the system automatically:
- Sends the applicant a retake invitation email with the same assessment link
- Increments the `Assessment Attempts` field to 2
- **This only works once per applicant.** The hard cap is 2 total attempts (1 original + 1 retake).

**You do:** nothing else. Wait for the retake scores. When they come in, update the scores on the Lead (overwriting the old ones) and set `Assessment Status` to `Passed` or `Did Not Pass` for real this time.

**If you try to set `Retake Required` again on the same Lead:** the system does nothing. No email goes out. No duplicate attempt. That's by design.

### 6.5 Advancing a qualified applicant to the interview

**This is automatic.** When a Lead is at `Assess Complete`, `Assessment Status = Passed` and the CLIK, CCAT and CBST2 scores are all filled in, the system moves it to **`Interview Requested`** in the same save.

You only change Status to `Interview Requested` by hand when a score is missing (for example, a returning applicant with no scores on file) and you want them to move forward anyway.

**What the system does:**
- Sends the "Schedule your RTS Instructor interview" email with Dele's Lunacal booking link.
- Sets the `Instructor Invite Sent` checkbox to prevent duplicates.

**What you do next:** nothing. Wait for the applicant to book.

**When they book:**
- Status auto-advances to `Interview Scheduled`.
- `Instructor Interview Date/Time` gets filled in automatically.

**If they don't book within 5 days:** reach out via email or phone to nudge. You'll see them in the Interview Pipeline report.

### 6.6 After the interview

Dele interviews the applicant and logs his notes, the outcome, and any wraparound support the applicant needs. Once he's done:

1. Open the Lead.
2. Verify the **Interview** section has:
   - `Instructor Interview Notes` filled in
   - `Instructor Interview Outcome` set to one of: Advance / Hold for Review / Decline
3. Check the **Barriers & Wraparound** section: `Wraparound Notes` describes any supports they need, and the matching **Granted** boxes are ticked (Transportation, Meals, Laptop, Childcare, Emergency Fund).
4. Change Lead Status to **`Interview Complete`**.
5. Save.

**If outcome is "Advance":** go straight to [Section 6.7](#67-making-the-final-decision) and make the offer.

**If outcome is "Hold for Review":** leave at `Interview Complete`, discuss with Dele, and then either accept, waitlist or decline.

**If outcome is "Decline":** set `Decision = Decline`, pick a `Decision Reason`, change Status to **`Declined-NotQual`**. System sends the decline email.

### 6.7 Making the final decision

Based on the interview outcome and any other context:

**To ACCEPT:**
1. Set `Decision = Accept`.
2. Set `Decision Date = today`.
3. Change Status to **`Offer Sent`**.
4. Save.

**System then:**
- Sends the Offer of Admission email from `program-rts@ulem.org`.
- Stamps `Offer Sent Date = today` and `Offer Response = Pending`.
- Creates a high-priority task for you: **"Follow up on offer confirmation — [Name]"** due the next day.

**To WAITLIST:**
1. Set `Decision = Waitlist`.
2. Set `Decision Date = today`.
3. Set `Decision Reason` (see list below).
4. Change Status to **`Waitlisted`**.
5. Save.

**System then:** sends the Waitlist Notification email.

**To DECLINE:**
1. Set `Decision = Decline`.
2. Set `Decision Date = today`.
3. Set `Decision Reason`.
4. Change Status to **`Declined-NotQual`**.
5. Save.

**System then:** sends the Application Status Update (decline) email.

**Decision Reason options:**
- Did Not Pass Assessment
- Schedule Conflict (Cannot Attend Daytime)
- Cohort Full
- Applicant Withdrew
- Not a Strong Fit (Interview)
- Waitlisted — Pending Seat Availability
- Other

### 6.8 When an accepted applicant confirms their seat

Within 3 business days of the offer email, the applicant should reply "I confirm". When they do:

1. Open the Lead.
2. Change Status to **`Offer Confirmed`**.
3. Save.

**System then:**
- Sends the Enrollment Confirmation email (program start date, what to bring, etc.).
- Stamps `Offer Response = Confirmed` and `Offer Response Date = today`.
- Within a minute: converts the Lead into a student record (Person Account), enrols them in their cohort and its three phases, and moves the Lead to `Converted-RTS`.
- Creates a task for you: **"Check enrolment — [Name]"** due today.

**If there is no response:** the "Follow up on offer confirmation" task lands in your queue the day after the offer goes out. Call or email the applicant, and keep following up until the 3-business-day deadline. If still no response:
- Change Status to `Waitlisted` (put them on hold) OR
- Change Status to `Declined-Withdrew` (move on, offer their seat to waitlist)

### 6.9 Checking a new student's enrolment

When you move a Lead to `Offer Confirmed`, Salesforce does the rest within a minute:

- **Converts the Lead into a student record** (a Person Account), with no Opportunity. If the applicant is already a ULEM client with the same email, they're added to that record instead of getting a duplicate.
- **Carries over their intake answers:** date of birth, ZIP code, employment status, barriers, granted supports and wraparound notes.
- **Creates their Program Engagement:** Program **MSIMBO Academy**, their cohort, Stage **Enrolled**, Start Date = the cohort start.
- **Enrols them in the three phases** (RTS Foundations, RTS Specialization, RTS Career Launch) and puts them on the cohort's class schedules, so they appear on every class day's attendance list.
- **Moves the Lead to `Converted-RTS`.**

**What you do (the "Check enrolment" task):**

1. Open the task and click the student's name. (If you open the old Lead instead, it shows "This lead was converted" with a link to the student.)
2. On the student's record, open **Related → Program Engagements**.
3. Check there is one row for the right cohort (e.g. **RTS Cohort 2 · Fall 2026 · FY27-C1**) with Stage **Enrolled**.
4. Mark the task Complete.

**If the Lead is still at `Offer Confirmed` after a few minutes,** the automatic step didn't run. You'll also get an "Enrol by hand" task.

**If you get an "Enrol by hand" task:** the task description says why. The usual reason is that the Lead has no cohort, or its cohort isn't set up for classes yet. Fix the cohort on the Lead if it's wrong, then ask Dele to re-run it. If you need to enrol the person yourself:

1. Open the Lead. Clear the **Company** field (web applications arrive with "N/A"; if it's filled in, Salesforce creates the wrong kind of record). Save.
2. Click **Convert**. Under Account, choose **Create New** (or pick the person's existing record if they're already a ULEM client). Tick **Don't create an opportunity**. Converted Status: **Converted-RTS**. Click **Convert**.
3. On the new student, go to **Related → Program Engagements → New**:
   - Program: **MSIMBO Academy**
   - Program Cohort: the cohort they were accepted into
   - Stage: **Enrolled**
   - Role: **Client**
   - Start Date: the cohort's start date from [Cohort key dates](#cohort-key-dates)
   - Save

Salesforce then enrols them in the three phases and the class schedules, as above.

**Where to find Program Engagements later:** App Launcher (grid icon, top-left) → **Program Management** → **Program Engagements** tab shows every enrolled student. To see one cohort's students together, open the **Program Cohorts** tab in the same app and click the cohort.

### 6.10 If an applicant withdraws on their own

The applicant emails you saying they can't do the program anymore.

1. Open the Lead.
2. Set `Decision = Decline`.
3. Set `Decision Reason = Applicant Withdrew`.
4. Set `Decision Date = today`.
5. Change Status to **`Declined-Withdrew`**.
6. Save.

**System does NOT send an email for this status** — intentional. The applicant already knows; a rejection email would feel wrong.

---

## 7. The dashboard: what each widget means

Open: App Launcher → **Dashboards** → **Recruitment Tracker - RTS Cohort X**

It refreshes automatically every hour. Click **Refresh** at the top right for up-to-the-minute data.

### Widget by widget

**Applications Received** (big number, top-left)

Total number of applicants in Cohort X so far. Watch this climb as marketing runs.

**Funnel by Stage** (horizontal bar chart)

Shows how many applicants are currently sitting at each Lead Status. A big bar on `Assessment Pending` means lots of people have applied but haven't taken the assessment yet — time to send nudges. A big bar on `Interview Requested` means lots of invites are out but people haven't booked — nudge them.

**Applications by Source** (donut chart)

Breakdown of how applicants found us: Google, Facebook, Friend/Family, Flyer, Partner Org, Other. Tells Dele which marketing channels are actually working.

**Assessment Outcomes** (donut chart)

Of the applicants who completed the assessment, how many Passed vs. needed Retake vs. Did Not Pass. A pass rate below 30% means our marketing is drawing unqualified people; above 80% means we might be too easy.

**Confirmed Enrolled** (gauge)

How many applicants have reached `Offer Confirmed` status. The gauge goes red (0-10), yellow (10-13), green (13-15). Target is 15 seats. When the gauge is green, we're close to full.

**Interview Pipeline** (bar chart)

Applicants currently somewhere in the interview step (requested, scheduled or complete). Helps you see who's stuck where.

**Decisions Breakdown** (horizontal bar chart)

Accept vs. Waitlist vs. Decline counts. Useful for end-of-cohort review and grant reporting.

**Barrier Summary** (table)

Lists applicants with barrier flags (transportation, childcare, internet). Informs the wraparound budget and Dele's interview prep.

---

## 8. Tasks in your queue: what they mean

When certain things happen, Salesforce creates a task and assigns it to you (the Program Coordinator), whoever owns the Lead. These show up on your **Home** page under "My Tasks" and on each Lead record.

| Task subject | Why it was created | What you should do |
|---|---|---|
| **Follow up on offer confirmation — [Name]** | Flow 4 fires when you move a Lead to `Offer Sent`. Due the day after the offer is sent. High priority. | Call or email the applicant to remind them to reply "I confirm" to the offer email. If they've already confirmed, mark task Complete. |
| **Check enrolment — [Name]** | Flow 7 fires when Lead hits `Offer Confirmed`. Due same day. | Open the student and check the cohort, as in [Section 6.9](#69-checking-a-new-students-enrolment). Mark Complete. |
| **Enrol by hand — [Name]** | Salesforce couldn't enrol the applicant automatically. The task description says why. Due same day. High priority. | Follow "If you get an Enrol by hand task" in [Section 6.9](#69-checking-a-new-students-enrolment), or send Dele the link. |
| **Instructor interview rescheduled — [Name]** | n8n creates this when the applicant reschedules their Lunacal booking. Normal priority. | Note the new time. Follow up with Dele if he needs to reschedule his calendar. |
| **Instructor interview cancelled — [Name]** | n8n creates this when the applicant cancels. High priority. | Check in with the applicant. If they want to rebook, point them at the same Lunacal link (it still works). If they're out, decide whether to decline or waitlist them. |
| **Returning RTS applicant: assessment already passed** | The website creates this when someone who passed the assessment in the last 12 months applies again. If their scores are on file, they've already been moved to `Interview Requested` and sent the invitation. Due the next day. | Read their previous application at the top of the **Description** field. If the task says scores are missing, enter them (or move the Lead to `Interview Requested` yourself). If the task also lists possible earlier records, handle those as in the next row. |
| **Possible duplicate RTS applicant: review** | The website creates this when a new application looks like someone already in Salesforce: another RTS Lead with the same email, an RTS Lead with the same phone and last name, or an earlier RTS application that was converted. Due the next day. | Open each linked record. If it's the same person, follow [Someone re-applies under a different email](#someone-re-applies-under-a-different-email). If it's a family member who shares the phone, mark the task Complete and do nothing. |

### How to mark a task complete

1. Click the task's subject (opens the task).
2. At the top, find the **Status** dropdown (currently says "Not Started" or "In Progress").
3. Change to **Completed**.
4. Save.

Or from the tasks list on Home: click the **checkbox** next to the task.

---

## 9. Handling special situations

### The applicant says they never got the assessment email

1. Ask them to check spam/promotions folders.
2. Ask for the email address they used on the form — make sure it matches their Lead.
3. In Salesforce, open the Lead and **click their email address** to send them a manual message. In the body, paste the assessment link: `https://go.ulem.org/rts-assessment`
4. If they still don't get it, the email address on file might have a typo. Edit the Lead's email field to the correct one. Then re-trigger the flow: change `Assessment Status` back to `Not Started`, save, then move Lead Status back to `Assess Pending` and save again — this will re-fire the Application Received email (alternately, send manually).



### You accidentally move a Lead to the wrong Status

No undo button. But:

1. Change the Status back to what it should be. This won't re-send the correct email — it just updates the field.
2. If an unwanted email has already gone out to the applicant, follow up with a personal email apologizing for the confusion and giving the correct information.
3. Jot a note in the Lead's `Assessment Notes` or a Chatter comment about what happened, so anyone who reviews later understands.

### You need to re-send an interview invite

If the applicant lost their Lunacal link and needs it re-sent:

1. Open the Lead.
2. Find the `Instructor Invite Sent` checkbox. Uncheck it, save.
3. Change Status back from `Interview Scheduled` (or wherever they are) to `Interview Requested`. Save. This will re-fire the invite email because the "Sent" flag is now false.
4. Once they book, it will advance forward normally.

### An applicant's contact info changes

Edit the Lead directly. Name, email, phone, address are all standard editable fields.

**Caveat:** if you change their email, future emails from the system go to the new address but any Lunacal bookings they've already made are tied to the old email. If they book again, the webhook may not match the Lead. In that case, manually update the interview date/time on the Lead.

### Someone re-applies (returning applicants)

When someone applies with an email that's already in Salesforce, the website reuses their existing Lead instead of creating a new one. It moves the Lead onto the current cohort and puts it in the right place automatically:

| Who re-applies | Where they land | Email they get | Task for you |
|---|---|---|---|
| Already applied to the **current** cohort | Nothing changes. The form tells them they've already applied. | None | None |
| Came to an info session, now applying | `Assess Pending` | Assessment link | None |
| Applied before and **passed the assessment in the last 12 months** | `Interview Requested` (or `Assess Complete` if their scores are missing) | Interview invitation (none if scores are missing) | "Returning RTS applicant" |
| Applied before and passed **more than 12 months ago** | `Assess Pending` | Assessment link | None |
| Applied before and **did not pass**, or never took it | `Assess Pending`, with a fresh 2 attempts (1 + 1 retake) | Assessment link | None |
| Was waitlisted, declined or withdrew | Same rules as above, based on their assessment | Depends on assessment | Depends on assessment |

**What happens to their old application:** the website copies the old interview notes, decision, offer and assessment results to the **top of the Description field**, then clears those fields so the Lead looks like a new application. The `Invite Sent` checkboxes are cleared too, so the interview booking email goes out again when you move them to `Interview Requested`.

**You do:**
- Read the Description before you interview a returning applicant. Old notes (for example, a scheduling concern last time) may still apply.
- A returning applicant who passed is invited to interview automatically. If one is stuck at `Assess Complete`, their scores are missing: enter them, or move them to `Interview Requested` yourself.
- The 12-month rule is automatic. If you want someone to re-take the assessment anyway, set `Assessment Status = Retake Required` as in [Section 6.4](#64-when-you-trigger-an-assessment-retake).

**Matching only works on email.** If several Leads share the email, the website reuses the RTS Applicant record first, then an Info Session record. It never turns a Donor or Student Lead into an applicant when an RTS record exists.

### Someone re-applies under a different email

A returning applicant sometimes uses a new email address. The website can't safely tell whether that's the same person, because family members often share a phone number. So it creates a new Lead and gives you a **"Possible duplicate RTS applicant"** task listing the records that look like the same person.

1. Open each linked record from the task.
2. Confirm it's the same person (name, date of birth, address, phone).
3. **Decide which Lead to keep.** Keep the one with the current application: the newest Lead on the current cohort, or the one furthest along the pipeline.
4. **Don't delete the others.** Deleting loses their notes, emails and tasks. Send Dele the links of the Lead to keep and the ones to merge into it, and he'll merge them. Merging moves all tasks, emails and campaign history onto the Lead you keep.
5. Leave **Donor** and **Student** Leads alone. Those are a different relationship with ULEM, not a duplicate application.
6. Mark the task Complete.

### You want to bulk-email multiple applicants

Use a Salesforce **List Email** from the Leads list view:

1. Go to Leads tab.
2. Filter to the group you want (e.g., "All RTS Leads at Assessment Pending for 3+ days").
3. Check the boxes next to the Leads you want to email.
4. Top right → **Send List Email**.
5. Compose. Salesforce tracks sends in the activity history.

This is for one-off nudges, not automated flows.

---

## 10. When something looks wrong: troubleshooting

### "I moved the Status but no email went out"

Possible causes:
- The flow is inactive. Ask Dele to check Setup → Flows.
- The applicant's email is invalid. Check the Email field on the Lead — is there a typo or blank?
- The Org-Wide Email Address `program-rts@ulem.org` is somehow deactivated. Ask Dele to check Setup → Organization-Wide Addresses.

If it's urgent, send the email manually from your personal inbox.

### "The Lead I expected isn't showing up in Salesforce"

1. Go to Leads → search the applicant's email in the search box.
2. If not found, the form submission may have failed. Ask Dele to check Netlify function logs for errors.
3. As a fallback, create the Lead manually: Leads → **New** → fill in all fields → set RecordType to **RTS Applicant** → save. Then change Status to `Assess Pending` to kick off automation.

### "The dashboard numbers look wrong"

1. Click **Refresh** on the dashboard — it caches.
2. If still wrong, click into the underlying report (click "View Report" link under the widget) and verify the filter and data directly.

### "Flow 1 didn't set the RecordType on a new Lead"

This is a known quirk with Web-to-Lead. Flow 1c should correct it within a second of Lead creation. If you open a new Lead and the Path at the top shows only "Open - Not Contacted → Working - Contacted → …" (the wrong, generic Lead path), the RecordType is wrong.

Fix: click the pencil on the Lead record → scroll to **Record Type** → change to **RTS Applicant** → save. Path will switch to the full RTS pipeline.

**Check first that it's really an application.** Info session sign-ups also arrive as "Open - Not Contacted". They have an **Info Session Date** but no **Date of Birth**, and their correct Record Type is **RTS Info Session**. Leave those alone. They become applicants automatically if they fill in the application form.

### "I can't find the Leads tab"

You may be in the wrong Salesforce app. Click the grid icon (top-left) → App Launcher → pick the app that lists Leads, Contacts, Dashboards.

### "Applicant says the booking link is broken"

1. Confirm they're on the right URL: `https://go.ulem.org/rts-book-instructor`
2. Try the link yourself in a new browser tab. If it 404s, the URL redirect may be down — alert Dele.
3. As a fallback, send them the direct Lunacal URL: `https://meet.viz.li/deletosh/rts-instructor`

### "I think a duplicate Lead got created"

Don't delete either record. Follow [Someone re-applies under a different email](#someone-re-applies-under-a-different-email): pick the Lead with the current application and send Dele both links to merge.

### "When I try to save a Lead, I get a validation error"

Read the error message — it'll tell you which field is wrong (usually blank required field or invalid picklist value). Fix the field, try save again.

### "I forgot which Status triggers the email"

Here's the quick map:

| Status change | Email that goes out |
|---|---|
| → `Assess Pending` (on Lead create, by automation) | Application Received |
| → `Interview Requested` | Interview Invitation |
| → `Offer Sent` | Offer of Admission |
| → `Waitlisted` | Waitlist Notification |
| → `Declined-NotQual` | Application Status Update (decline) |
| → `Offer Confirmed` | Enrollment Confirmation |
| Assessment Status → `Retake Required` (on the Lead, not Status) | Assessment Retake Invitation |
| → `Assess Complete` | No email, unless `Assessment Status = Passed` and all three scores are filled in. Then the system moves the Lead to `Interview Requested` and the Interview Invitation goes out. |
| → `Interview Complete` | No email. |
| → `Declined-Withdrew` | No email (intentional). |
| → `Converted-RTS` | No email. Set by the system after `Offer Confirmed`. |

---

## 11. Appendix: cheat sheets

### The 3 transitions you'll make most often

1. **Invite to interview:** enter the three scores, set `Assessment Status = Passed`, Status = `Assess Complete`. The system moves them to `Interview Requested` and the email goes out. You're done.
2. **Accept:** after Dele logs a positive interview outcome → Status = `Interview Complete`, then set Decision = Accept and Status = `Offer Sent`. Offer email goes out. You're done.
3. **Confirm:** applicant replied "I confirm" → Status = `Offer Confirmed`. Salesforce enrols them. Open the "Check enrolment" task, check the cohort, mark it Complete.

### Short URL cheat sheet

| Short URL | Where it goes |
|---|---|
| `go.ulem.org/rts-assessment` | Criteria Core assessment for new applicants or retakes |
| `go.ulem.org/rts-book-instructor` | Dele's interview Lunacal page |

### Cohort key dates

**Current cohort: Cohort 2 (Fall 2026)**

| Date | Milestone |
|---|---|
| Oct 6, 8, 13, 14, 15 at 6:00 PM; Oct 9 at 12:00 PM | Info sessions (online) |
| November 2, 2026 (Monday) | Program starts |
| November 25-27, 2026 | No class (Thanksgiving) |
| December 24, 2026 - January 1, 2027 | No class (winter break) |
| January 18, 2027 (Monday) | No class (MLK Day) |
| January 19 - February 19, 2027 | Client capstone (Weeks 11-15) |
| February 15, 2027 (Monday) | No class (Presidents' Day) |
| February 19, 2027 (Friday) | Graduation and showcase; program ends. Applicant emails, the offer letter and the website say "through January 25" on purpose; the capstone then continues to February 19. |
| 15 weeks (68 class days) | Full duration: 10 weeks of teaching + 5-week capstone |
| Mon-Wed 10 AM-4 PM | In-person at ULEM Boston, 88 Warren Street, Roxbury |
| Thu-Fri 10 AM-4 PM | Remote |
| Foundations Nov 2-20, Specialization Nov 23-Dec 23, Career Launch Jan 4-Feb 19 | Phases in Salesforce |
| 15 seats | Target enrollment |

In Salesforce this cohort is called **RTS Cohort 2 · Fall 2026 · FY27-C1** (reporting code **RTS-FY27-C1**), and the dashboard is **Recruitment Tracker - RTS Cohort 2 · FY27-C1**.

**Past cohorts**

| Cohort | Program starts | Program ends | Target enrollment |
|---|---|---|---|
| Cohort 1 (RTS Cohort 1 · Spring 2026 · FY26-C2) | May 11, 2026 (Monday) | August 10, 2026 (Monday), including the Career Launch capstone | 15 seats |

When a new cohort opens, move the current table down into **Past cohorts** and fill in the new dates here. Nothing else in this guide needs to change.

#### Setting up a new cohort's name

You don't type the cohort name. On the **Program Cohort** record, fill in:

| Field | What to enter | Example |
|---|---|---|
| Start Date | The first class day | 11/2/2026 |
| Short Code | The program's code, the same every cohort | RTS |
| Cohort Number | The program's running count (it never resets) | 2 |
| Fiscal Cycle | Leave blank: Salesforce counts the program's cohorts that start earlier in the same fiscal year. Type a number only to correct it. | 1 |

The Name field is required when you create the record, so type anything (e.g. `new`); Salesforce replaces it on save with **RTS Cohort 2 · Fall 2026 · FY27-C1**. **Fiscal Year** and **Reporting Code** (RTS-FY27-C1) fill themselves in, and the linked RTS Cohort gets the same name. The season comes from the start month (Dec-Feb Winter, Mar-May Spring, Jun-Aug Summer, Sep-Nov Fall). After a new cohort is named, ask Dele to point the cohort's Lead list views at the new name. The full rules are in the [Program and Cohort Naming Guide](https://wiki.ulem.org/doc/program-and-cohort-naming-guide-D4tdVU103w).

### Key email addresses

| Address | Purpose |
|---|---|
| `program-rts@ulem.org` | System sends all automated emails from this address. Applicants reply here. You monitor this inbox. |
| `bguzman@ulem.org` | Your Salesforce login + personal work email |
| `domotosho@ulem.org` | Dele (Lead Instructor) |

### When to call Dele

- You're about to change a Status and you're not sure.
- Assessment score looks borderline and you can't decide Pass vs. Retake.
- An applicant's email isn't delivering and you've tried the basics.
- Flow doesn't seem to be firing (no email going out).
- Anything in the pipeline feels stuck or wrong.

Better to ask than to push a bad change through. Salesforce records everything, and recovering from a wrong status move means pinging the applicant to apologize.

---

**You've got this.** The system does the heavy lifting on emails and scheduling. Your job is the judgment calls — who gets an interview, who gets accepted, who needs a nudge. That's the work that matters, and it's why this program will be good.

Keep this guide open, and reach out anytime something doesn't match what you see on screen.

## Related guides

- [RTS Program Instructor's Guide](https://wiki.ulem.org/doc/rts-program-instructors-guide-pG7eMa5SxO): class list, attendance, hours and outcomes in Salesforce
- [RTS Automatic Enrolment: Edge Cases and Components](https://wiki.ulem.org/doc/rts-automatic-enrolment-edge-cases-and-components-huu7yiT2iq): how accepted applicants are enrolled, and setting up the next cohort
- [Program and Cohort Naming Guide](https://wiki.ulem.org/doc/program-and-cohort-naming-guide-D4tdVU103w): how programs, cohorts and schedules are named, and why
- [New Cohort Naming Checklist](https://wiki.ulem.org/doc/new-cohort-naming-checklist-I5dtUaGkgB): step-by-step naming when a new cohort opens
