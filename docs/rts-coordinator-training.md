# RTS Program Coordinator Training Guide

**Your role:** Program Coordinator for the ULEM Revenue Technology Specialist (RTS) program, Cohort 1.

**What you'll find here:** Everything you need to run recruitment from the first application to the first day of class. Step-by-step, screen-by-screen.

**How to use this:** Read it once end-to-end so you see the full picture. Then keep it open next to Salesforce as a reference. Each section answers a question: "When this happens, what do I do?"

**If something looks different on screen:** The system may have been updated since this guide was written. When in doubt, ask Dele.

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
- The Lead status advances to **`RTS - Assessment Pending`** so you know the applicant owes us an assessment score.
- When an applicant books an Instructor or Case Manager interview via Lunacal, the **interview time is written to the Lead automatically** and the status advances.
- When you move a Lead to certain statuses (Interview 1 Requested, Accepted, Waitlisted, Declined), the **right email to the applicant goes out automatically**.
- When the email goes out, the system creates any **follow-up tasks** you need (e.g., "follow up on offer confirmation in 5 days").

### You do this manually

- **Review** each application and assessment score.
- **Decide** each status transition (advance to interview? waitlist? decline?).
- **Log interview outcomes** after Dele or Wanda finishes an interview.
- **Convert the Lead to a Contact** once an applicant confirms enrollment (Salesforce asks you to do this with a task — you click through).

### The golden rule

**The system only sends automated emails when you change the Lead's Status to the right value.** If a status change doesn't happen, no email goes out. You are the one driving the pipeline forward.

---

## 2. Key terms and who does what

### The objects in Salesforce you'll see

| Term | What it is |
|---|---|
| **Lead** | An applicant. Every person who applies becomes a Lead record. |
| **Contact** | A confirmed enrolled student. A Lead becomes a Contact after they confirm the offer and you convert the record. |
| **Program Engagement** | A Nonprofit Cloud record linking a Contact to the RTS program. Created automatically during Lead conversion. |
| **Cohort** | A single run of the program. Cohort 1 starts May 11, 2026. Every Lead is tagged to a cohort. |
| **Task** | A to-do item Salesforce creates for you (e.g., "follow up with applicant"). You'll see these in your Home page or on the Lead record. |

### The people

| Role | Who | What they do |
|---|---|---|
| **Program Coordinator** | Betzaida Guzman (you) | Owns every decision in the pipeline. Runs recruitment. Reviews assessments, logs interviews, makes accept/waitlist/decline calls. |
| **Lead Instructor / Acting Director** | Dele Omotosho | Interviews applicants in Round 1. Manages the technical curriculum. |
| **Case Manager** | William (Wanda) Watkins | Interviews applicants in Round 2 to understand wraparound support needs. |
| **Applicant** | Anyone who submits the form on msimbo.org | Completes the assessment, takes the two interviews, accepts or declines the offer. |

### The status pipeline (the heart of the system)

Every Lead has a **Status** field that tells you where they are in recruitment. There are 15 possible statuses. You'll move Leads through them by clicking the Status field and picking the next one.

Think of the pipeline like a funnel:

```
RTS - Assessment Pending
      ↓
RTS - Assessment Complete
      ↓
RTS - Interview 1 Requested  →  RTS - Interview 1 Scheduled  →  RTS - Interview 1 Complete
      ↓
RTS - Interview 2 Requested  →  RTS - Interview 2 Scheduled  →  RTS - Interview 2 Complete
      ↓
RTS - Accepted - Offer Sent
      ↓
RTS - Accepted - Confirmed  →  RTS - Converted
      
      (alternate endings)
      ├─ RTS - Waitlisted
      ├─ RTS - Declined - Not Qualified
      └─ RTS - Declined - Withdrew
```

**What you need to know:**

- **You change the status manually** for every transition except three that the system handles:
  - `New` → `RTS - Assessment Pending` (fires on Lead creation)
  - `Interview 1 Requested` → `Interview 1 Scheduled` (fires when Lunacal booking arrives)
  - `Interview 2 Requested` → `Interview 2 Scheduled` (fires when Lunacal booking arrives)
- **Status changes trigger emails.** Moving to `Interview 1 Requested` sends the Instructor booking email. Moving to `Accepted - Offer Sent` sends the offer letter. And so on.
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
| **Dashboard** | App Launcher → **Dashboards** → **RTS Cohort 1 — Recruitment Tracker** | Quick overview of how recruitment is going |
| **Reports** | App Launcher → **Reports** → folder **RTS - Recruitment Reports** | Deeper slices of the data |
| **Your Home / Tasks** | Click **Home** in top nav | See your open tasks for the day |

### Favorite the dashboard right now

1. Open the RTS Cohort 1 — Recruitment Tracker dashboard
2. Click the **star icon** next to the dashboard name at the top
3. Now it's available from the Favorites star icon in the top nav on every page

Do the same for the Leads tab.

---

## 4. The daily rhythm: your morning checklist

Open Salesforce once a day (twice a day once applications are flowing heavily). Here's the routine.

### 1. Open the dashboard

App Launcher → **Dashboards** → **RTS Cohort 1 — Recruitment Tracker**

Click **Refresh** (circular arrow icon top-right) to load fresh numbers.

**Look at:**
- **Applications Received** — how many total applicants so far
- **Funnel by Stage** — where in the pipeline people are stuck
- **Confirmed Enrolled** gauge — how close we are to our 15-seat goal
- **Interview Pipeline** — who you need to follow up with for interviews

### 2. Check your Tasks

Click **Home** in the top nav.

You'll see a list of tasks assigned to you. Each task is tied to a Lead. Typical tasks you'll see:
- "Follow up on offer confirmation — [Name]"
- "Convert Lead to Contact — [Name]"
- "Instructor interview rescheduled — [Name]"
- "Instructor interview cancelled — [Name]"

**For each task:** click it, read the description, click the linked Lead, do what it asks, then mark the task **Complete** (dropdown next to the task → Mark Complete).

### 3. Check the Leads list

Click the **Leads** tab.

Filter to **All Open Leads** (dropdown at top-left next to "Recently Viewed") to see everyone who hasn't been closed out yet.

**Look for:**
- New Leads at `RTS - Assessment Pending` — are they >3 days old without completing the assessment? Time to nudge them.
- Leads at `RTS - Assessment Complete` waiting for your review
- Leads at `RTS - Interview 1 Requested` where `Invite Sent = true` but the booking hasn't come in after 5 days
- Leads at `RTS - Accepted - Offer Sent` where the offer has been out 5+ days with no confirmation

### 4. Handle anything Criteria Core sent overnight

You'll get email notifications from Criteria Corp (ondemandassessment.com) with each applicant's scores. For Cohort 1, **you enter these scores into Salesforce by hand** — one of the few fully manual steps.

Skip ahead to [Section 6.3](#63-when-an-applicant-completes-the-criteria-core-assessment) for exact instructions.

### 5. Reply to any email from `program-rts@ulem.org`

The system sends emails from `program-rts@ulem.org` on your behalf. Applicants reply to those emails. Those replies land in the shared inbox you monitor. Answer them promptly — most are scheduling questions or confusion about the assessment link.

---

## 5. The full applicant journey, step by step

This is the end-to-end flow from one applicant's point of view, so you can see how your actions stitch together.

### Day 0 — Applicant submits the form on msimbo.org

- System creates the Lead in Salesforce automatically.
- Lead Status is set to **`RTS - Assessment Pending`**.
- Lead Owner is **you**.
- System emails the applicant the **Criteria Core assessment link** from `program-rts@ulem.org`.
- You see a new row in the Leads list.

**You do:** nothing yet. Wait for them to complete the assessment.

### Day 1-3 — Applicant takes the Criteria Core assessment

- Applicant clicks the assessment link in their email.
- They complete three tests: CLIK (Computer Literacy), CCAT (Cognitive Aptitude), CBST2 (Basic Skills).
- Criteria Corp emails you their scores.

**You do:** go to the Lead in Salesforce, enter the three scores into the fields `CLIK Score`, `CCAT Score`, `CBST2 Score`, and set `Assessment Status` to one of:
- `Passed` — scores meet thresholds
- `Retake Required` — one or more scores are below threshold but close enough to try again
- `Did Not Pass` — scores are too low to qualify

See [Section 6.3](#63-when-an-applicant-completes-the-criteria-core-assessment) for the score thresholds.

Then move Lead Status to **`RTS - Assessment Complete`**.

### Day 2-5 — You review and decide to interview

You read the application, scores, and motivation statement. If you want to move them forward, change Status to **`RTS - Interview 1 Requested`**.

**System then:** sends the Instructor interview booking email with the Lunacal link. Sets the `Invite Sent` flag to prevent duplicate emails.

### Day 4-8 — Applicant books their Instructor interview

Applicant clicks the Lunacal link, picks a time with Dele, books it.

**System then:** automatically writes the interview time into the Lead's `Instructor Interview Date/Time` field AND changes Status to **`RTS - Interview 1 Scheduled`**. You don't do anything.

### Day ~8 — Dele interviews the applicant

After the interview, Dele writes notes and picks an outcome in Salesforce:
- **Advance to Case Manager** — applicant moves forward
- **Hold for Review** — needs discussion
- **Decline** — not a fit

**You do:** once Dele has logged the outcome, you change the Lead's Status to **`RTS - Interview 1 Complete`**. If the outcome is "Advance to Case Manager", you then change Status to **`RTS - Interview 2 Requested`**.

**System then:** sends the Case Manager interview booking email with Wanda's Lunacal link.

### Day ~10 — Applicant books their Case Manager interview

Same as the Instructor booking — automatic. Status moves to **`RTS - Interview 2 Scheduled`** when they book.

### Day ~13 — Wanda interviews the applicant

Wanda logs notes, any wraparound supports requested (transportation, childcare, laptop, meals, emergency fund), and an outcome:
- **Recommend Accept**
- **Recommend Waitlist**
- **Recommend Decline**

**You do:** once Wanda has logged it, you change Status to **`RTS - Interview 2 Complete`**. Then you make the final call:

| Final call | Your action |
|---|---|
| Accept | Set `Decision = Accept`, Status → **`RTS - Accepted - Offer Sent`** |
| Waitlist | Set `Decision = Waitlist`, Status → **`RTS - Waitlisted`** |
| Decline | Set `Decision = Decline`, Status → **`RTS - Declined - Not Qualified`** |

**System then sends the right email** based on which Status you chose.

### Day ~14 — Applicant responds to the offer

They reply to the offer email saying "I confirm" (or they don't).

**You do:**
- If confirmed within 5 days: Status → **`RTS - Accepted - Confirmed`**
- If no response after 5 days: you'll get a task reminder. Follow up. If still no response, move to Waitlisted or Declined.

**System then:** (on Accepted - Confirmed) sends the Enrollment Confirmation email with program start details, AND creates a task for you titled "Convert Lead to Contact".

### Day ~15 — You convert the Lead to a Contact

Click the **Convert** button at the top of the Lead page. Walk through the guided conversion (see [Section 6.10](#610-converting-an-accepted-applicant-to-a-contact-and-program-engagement)). Change Status to **`RTS - Converted`**.

You're done with that applicant's recruitment cycle. They're now a Contact and a Program Engagement record has been created for their participation in RTS.

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
- **Instructor Interview** — date/time, notes, outcome
- **Case Manager Interview** — date/time, notes, outcome, wraparound notes
- **Decision & Offer** — your final call
- **Wraparound Support Granted** — which supports the applicant was approved for

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

**Score thresholds (for Cohort 1):**

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
8. Change Lead Status to **`RTS - Assessment Complete`** (or straight to `RTS - Declined - Not Qualified` if they did not pass and you've decided to cut them).

### 6.4 When you trigger an assessment retake

If you set `Assessment Status = Retake Required`, the system automatically:
- Sends the applicant a retake invitation email with the same assessment link
- Increments the `Assessment Attempts` field to 2
- **This only works once per applicant.** The hard cap is 2 total attempts (1 original + 1 retake).

**You do:** nothing else. Wait for the retake scores. When they come in, update the scores on the Lead (overwriting the old ones) and set `Assessment Status` to `Passed` or `Did Not Pass` for real this time.

**If you try to set `Retake Required` again on the same Lead:** the system does nothing. No email goes out. No duplicate attempt. That's by design.

### 6.5 Advancing a qualified applicant to the Instructor interview

Applicant has `Assessment Status = Passed` and you want them to move forward.

1. Open the Lead.
2. Change Status to **`RTS - Interview 1 Requested`**.
3. Save.

**What the system does:**
- Sends the "Schedule your RTS Instructor interview" email with Dele's Lunacal booking link.
- Sets the `Instructor Invite Sent` checkbox to prevent duplicates.

**What you do next:** nothing. Wait for the applicant to book.

**When they book:**
- Status auto-advances to `RTS - Interview 1 Scheduled`.
- `Instructor Interview Date/Time` gets filled in automatically.

**If they don't book within 5 days:** reach out via email or phone to nudge. You'll see them in Report 4 (Interview Pipeline).

### 6.6 After the Instructor interview

Dele interviews the applicant and logs his notes + outcome. Once he's done:

1. Open the Lead.
2. Verify the **Instructor Interview** section has:
   - `Instructor Interview Notes` filled in
   - `Instructor Interview Outcome` set to one of: Advance to Case Manager / Hold for Review / Decline
3. Change Lead Status to **`RTS - Interview 1 Complete`**.
4. Save.

**If outcome is "Advance to Case Manager":** change Status to **`RTS - Interview 2 Requested`**. This triggers the Case Manager invitation email. Done.

**If outcome is "Hold for Review":** leave at `Interview 1 Complete`, discuss with Dele, and then either advance or decline.

**If outcome is "Decline":** set `Decision = Decline`, pick a `Decision Reason`, change Status to **`RTS - Declined - Not Qualified`**. System sends the decline email.

### 6.7 After the Case Manager interview

Wanda interviews the applicant and logs notes. Once she's done:

1. Open the Lead.
2. Verify the **Case Manager Interview** section has:
   - `Case Manager Interview Notes` filled in
   - `Case Manager Interview Outcome` set
   - `Wraparound Notes` — any supports they need (transportation, meals, laptop, childcare, emergency funds)
3. Check any **Wraparound Granted** boxes that apply (Transportation Granted, Childcare Granted, Laptop Granted, Meals Granted, Emergency Fund Granted).
4. Change Lead Status to **`RTS - Interview 2 Complete`**.
5. Save.

### 6.8 Making the final decision

Based on both interview outcomes and any other context:

**To ACCEPT:**
1. Set `Decision = Accept`.
2. Set `Decision Date = today`.
3. Change Status to **`RTS - Accepted - Offer Sent`**.
4. Save.

**System then:**
- Sends the Offer of Admission email from `program-rts@ulem.org`.
- Stamps `Offer Sent Date = today` and `Offer Response = Pending`.
- Creates a high-priority task for you: **"Follow up on offer confirmation — [Name]"** due in 5 days.

**To WAITLIST:**
1. Set `Decision = Waitlist`.
2. Set `Decision Date = today`.
3. Set `Decision Reason` (see list below).
4. Change Status to **`RTS - Waitlisted`**.
5. Save.

**System then:** sends the Waitlist Notification email.

**To DECLINE:**
1. Set `Decision = Decline`.
2. Set `Decision Date = today`.
3. Set `Decision Reason`.
4. Change Status to **`RTS - Declined - Not Qualified`**.
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

### 6.9 When an accepted applicant confirms their seat

Within 5 days of the offer email, the applicant should reply "I confirm". When they do:

1. Open the Lead.
2. Change Status to **`RTS - Accepted - Confirmed`**.
3. Save.

**System then:**
- Sends the Enrollment Confirmation email (program start date, what to bring, etc.).
- Stamps `Offer Response = Confirmed` and `Offer Response Date = today`.
- Creates a high-priority task for you: **"Convert Lead to Contact — [Name]"** due today.

**If the 5-day deadline passes with no response:** you'll see the "Follow up on offer confirmation" task fire in your queue. Call or email the applicant. If still no response:
- Change Status to `RTS - Waitlisted` (put them on hold) OR
- Change Status to `RTS - Declined - Withdrew` (move on, offer their seat to waitlist)

### 6.10 Converting an accepted applicant to a Contact and Program Engagement

Once Status is `RTS - Accepted - Confirmed`:

1. Open the Lead.
2. Click the **Convert** button at the top right.
3. Salesforce shows a conversion wizard. Fill in:
   - **Account:** if the applicant has an existing Account (rare for individuals), pick it. Otherwise, create a new Account using their full name OR link to the default "Individual" account your org uses for students.
   - **Contact:** keep all the defaults. Salesforce carries over name, email, phone, address from the Lead.
   - **Opportunity:** if the form asks to create one, you can check "Don't create an opportunity".
4. Click **Convert**.
5. After conversion, open the new Contact record.
6. On the Contact, add a **Program Engagement** record:
   - Click the **Related** tab
   - Find the **Program Engagements** section
   - Click **New**
   - Program: **Revenue Technology Specialist**
   - Stage: **Enrolled**
   - Start Date: cohort start date (May 11, 2026)
   - End Date: cohort end date (July 20, 2026)
   - Role: **Participant**
   - Save
7. Go back to the old Lead (it's now marked as Converted). Change its Status to **`RTS - Converted`** to close the loop.

Done. That applicant is now officially a student.

### 6.11 If an applicant withdraws on their own

The applicant emails you saying they can't do the program anymore.

1. Open the Lead.
2. Set `Decision = Decline`.
3. Set `Decision Reason = Applicant Withdrew`.
4. Set `Decision Date = today`.
5. Change Status to **`RTS - Declined - Withdrew`**.
6. Save.

**System does NOT send an email for this status** — intentional. The applicant already knows; a rejection email would feel wrong.

---

## 7. The dashboard: what each widget means

Open: App Launcher → **Dashboards** → **RTS Cohort 1 — Recruitment Tracker**

Click **Refresh** at the top right to load fresh data.

### Widget by widget

**Applications Received** (big number, top-left)

Total number of applicants in Cohort 1 so far. Watch this climb as marketing runs.

**Funnel by Stage** (horizontal bar chart)

Shows how many applicants are currently sitting at each Lead Status. A big bar on `Assessment Pending` means lots of people have applied but haven't taken the assessment yet — time to send nudges. A big bar on `Interview 1 Requested` means lots of invites are out but people haven't booked — nudge them.

**Applications by Source** (donut chart)

Breakdown of how applicants found us: Google, Facebook, Friend/Family, Flyer, Partner Org, Other. Tells Dele which marketing channels are actually working.

**Assessment Outcomes** (donut chart)

Of the applicants who completed the assessment, how many Passed vs. needed Retake vs. Did Not Pass. A pass rate below 30% means our marketing is drawing unqualified people; above 80% means we might be too easy.

**Confirmed Enrolled** (gauge)

How many applicants have reached `RTS - Accepted - Confirmed` status. The gauge goes red (0-10), yellow (10-13), green (13-15). Target is 15 seats. When the gauge is green, we're close to full.

**Interview Pipeline** (bar chart)

Applicants currently somewhere in the two-interview process. Helps you see who's stuck where.

**Decisions Breakdown** (horizontal bar chart)

Accept vs. Waitlist vs. Decline counts. Useful for end-of-cohort review and grant reporting.

**Barrier Summary** (table)

Lists applicants with barrier flags (transportation, childcare, internet). Informs the wraparound budget and the Case Manager's prep.

---

## 8. Tasks in your queue: what they mean

When certain things happen, Salesforce creates a task and assigns it to you. These show up on your **Home** page under "My Tasks" and on each Lead record.

| Task subject | Why it was created | What you should do |
|---|---|---|
| **Follow up on offer confirmation — [Name]** | Flow 4 fires when you move a Lead to `Accepted - Offer Sent`. Due 5 days out. High priority. | Call or email the applicant to remind them to reply "I confirm" to the offer email. If they've already confirmed, mark task Complete. |
| **Convert Lead to Contact — [Name]** | Flow 7 fires when Lead hits `Accepted - Confirmed`. Due same day. High priority. | Click through to the Lead, click Convert, follow [Section 6.10](#610-converting-an-accepted-applicant-to-a-contact-and-program-engagement). |
| **Instructor interview rescheduled — [Name]** | n8n creates this when the applicant reschedules their Lunacal booking. Normal priority. | Note the new time. Follow up with Dele if he needs to reschedule his calendar. |
| **Instructor interview cancelled — [Name]** | n8n creates this when the applicant cancels. High priority. | Check in with the applicant. If they want to rebook, point them at the same Lunacal link (it still works). If they're out, decide whether to decline or waitlist them. |
| **Case Manager interview rescheduled — [Name]** | Same pattern as the Instructor reschedule, for the Case Manager event type. | Same action. |
| **Case Manager interview cancelled — [Name]** | Same pattern as the Instructor cancel. | Same action. |

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
4. If they still don't get it, the email address on file might have a typo. Edit the Lead's email field to the correct one. Then re-trigger the flow: change `Assessment Status` back to `Not Started`, save, then move Lead Status back to `RTS - Assessment Pending` and save again — this will re-fire the Application Received email (alternately, send manually).

### The applicant booked the wrong interview event type

Applicant books the Case Manager event when they should have booked the Instructor, or vice versa.

1. Ask them to cancel the booking via the cancellation link in their Lunacal email.
2. Send them the correct link (Instructor: `https://go.ulem.org/rts-book-instructor`, Case Manager: `https://go.ulem.org/rts-book-casemanager`).
3. When they rebook correctly, Salesforce auto-updates.
4. The wrong booking created a cancellation task in your queue — mark it complete.

### You accidentally move a Lead to the wrong Status

No undo button. But:

1. Change the Status back to what it should be. This won't re-send the correct email — it just updates the field.
2. If an unwanted email has already gone out to the applicant, follow up with a personal email apologizing for the confusion and giving the correct information.
3. Jot a note in the Lead's `Assessment Notes` or a Chatter comment about what happened, so anyone who reviews later understands.

### You need to re-send an interview invite

If the applicant lost their Lunacal link and needs it re-sent:

1. Open the Lead.
2. Check the `Instructor Invite Sent` checkbox (or `Case Mgr Invite Sent` for Interview 2). Uncheck it, save.
3. Change Status back from `Interview 1 Scheduled` (or wherever they are) to `Interview 1 Requested`. Save. This will re-fire the invite email because the "Sent" flag is now false.
4. Once they book, it will advance forward normally.

### An applicant's contact info changes

Edit the Lead directly. Name, email, phone, address are all standard editable fields.

**Caveat:** if you change their email, future emails from the system go to the new address but any Lunacal bookings they've already made are tied to the old email. If they book again, the webhook may not match the Lead. In that case, manually update the interview date/time on the Lead.

### Someone applies twice with the same email

The form now blocks duplicate applications for the same email in the active cohort. If somehow a duplicate gets through:

1. Open the newer Lead.
2. Copy any new info from it (if any) into the older Lead.
3. Delete the newer Lead (or set Status to `RTS - Declined - Withdrew` with Decision Reason "Other" and a note).

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
3. As a fallback, create the Lead manually: Leads → **New** → fill in all fields → set RecordType to **RTS Applicant** → save. Then change Status to `RTS - Assessment Pending` to kick off automation.

### "The dashboard numbers look wrong"

1. Click **Refresh** on the dashboard — it caches.
2. If still wrong, click into the underlying report (click "View Report" link under the widget) and verify the filter and data directly.

### "Flow 1 didn't set the RecordType on a new Lead"

This is a known quirk with Web-to-Lead. Flow 1c should correct it within a second of Lead creation. If you open a new Lead and the Path at the top shows only "Open - Not Contacted → Working - Contacted → …" (the wrong, generic Lead path), the RecordType is wrong.

Fix: click the pencil on the Lead record → scroll to **Record Type** → change to **RTS Applicant** → save. Path will switch to the full RTS pipeline.

### "I can't find the Leads tab"

You may be in the wrong Salesforce app. Click the grid icon (top-left) → App Launcher → pick the app that lists Leads, Contacts, Dashboards.

### "Applicant says the booking link is broken"

1. Confirm they're on the right URL. Expected links:
   - Instructor: `https://go.ulem.org/rts-book-instructor`
   - Case Manager: `https://go.ulem.org/rts-book-casemanager`
2. Try the link yourself in a new browser tab. If it 404s, the URL redirect in Cloudflare may be down — alert Dele.
3. As a fallback, send them the direct Lunacal URL: `https://app.lunacal.ai/deletosh/rts-instructor` (or `rts-casemanager`).

### "I think a duplicate Lead got created"

Open both records side by side. Pick the one with the most complete info. Update it with any info from the duplicate. Delete the duplicate (or set its Status to `RTS - Declined - Withdrew` with note "duplicate").

### "When I try to save a Lead, I get a validation error"

Read the error message — it'll tell you which field is wrong (usually blank required field or invalid picklist value). Fix the field, try save again.

### "I forgot which Status triggers the email"

Here's the quick map:

| Status change | Email that goes out |
|---|---|
| → `RTS - Assessment Pending` (on Lead create, by automation) | Application Received |
| → `RTS - Interview 1 Requested` | Instructor Interview Invitation |
| → `RTS - Interview 2 Requested` | Case Manager Interview Invitation |
| → `RTS - Accepted - Offer Sent` | Offer of Admission |
| → `RTS - Waitlisted` | Waitlist Notification |
| → `RTS - Declined - Not Qualified` | Application Status Update (decline) |
| → `RTS - Accepted - Confirmed` | Enrollment Confirmation |
| Assessment Status → `Retake Required` (on the Lead, not Status) | Assessment Retake Invitation |
| → `RTS - Assessment Complete` | No email. |
| → `RTS - Interview 1 Complete` | No email. |
| → `RTS - Interview 2 Complete` | No email. |
| → `RTS - Declined - Withdrew` | No email (intentional). |
| → `RTS - Converted` | No email. |

---

## 11. Appendix: cheat sheets

### The 4 transitions you'll make most often

1. **Qualify for Interview 1:** new applicant passed the assessment and looks like a fit → Status = `RTS - Interview 1 Requested`. Email goes out. You're done.
2. **Advance to Case Manager:** after Dele logs a positive Instructor interview outcome → Status = `RTS - Interview 1 Complete`, then `RTS - Interview 2 Requested`. Email goes out. You're done.
3. **Accept:** after Wanda's interview and final decision → set Decision = Accept, Status = `RTS - Accepted - Offer Sent`. Offer email goes out. You're done.
4. **Confirm and convert:** applicant replied "I confirm" → Status = `RTS - Accepted - Confirmed`. Task fires to convert to Contact. Click Convert, follow the wizard.

### Short URL cheat sheet

| Short URL | Where it goes |
|---|---|
| `go.ulem.org/rts-assessment` | Criteria Core assessment for new applicants or retakes |
| `go.ulem.org/rts-book-instructor` | Dele's Instructor interview Lunacal page |
| `go.ulem.org/rts-book-casemanager` | Wanda's Case Manager interview Lunacal page |

### Cohort 1 key dates

| Date | Milestone |
|---|---|
| May 11, 2026 (Monday) | Program starts |
| July 20, 2026 (Monday) | Program ends |
| 10 weeks | Full duration |
| Mon-Wed 10 AM-4 PM | In-person at ULEM Boston, 88 Warren Street, Roxbury |
| Thu-Fri | Remote, self-paced + project work |
| 15 seats | Target enrollment |

### Key email addresses

| Address | Purpose |
|---|---|
| `program-rts@ulem.org` | System sends all automated emails from this address. Applicants reply here. You monitor this inbox. |
| `bguzman@ulem.org` | Your Salesforce login + personal work email |
| `domotosho@ulem.org` | Dele (Lead Instructor + Acting Director) |
| `wwatkins@ulem.org` | Wanda (Case Manager) |

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
