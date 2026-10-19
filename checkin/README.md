# ULEM Check-In (prototype)

Self-serve sign-in/sign-out for program participants, at the front desk or from their own device on
remote days. It reads today's class sessions from Program Management (PMM) in Salesforce and writes
attendance straight back to PMM. There is no separate database.

## Flow

1. **Pick the program.** Every program with a PMM Service Session today is listed, so other programs
   appear automatically once they're in PMM.
2. **Tap your name.** The list is the Service Participants on that session's Service Schedule,
   shown as first name + last initial.
3. **Enter a PIN.** The last 4 digits of the phone number on the participant's Contact.
4. **Check in.** Creates a `pmdm__ServiceDelivery__c` with Time In. Status is **Present**, or **Late** if
   more than 10 minutes after the session start.
5. **Check out.** Sets Time Out. Status becomes **Left Early** if more than 45 minutes before the
   session end (before 3:15 PM for a 4:00 PM class).

**Drop-in programs** (schedule has **Drop-In** ticked, e.g. ERC open hours) never mark Late or
Left Early. Any program whose list has more than 20 people shows a name search instead of the full
list; the API only returns who's checked in now, plus matches for 2+ typed letters. If a program
has Services with **Offer as Check-In Reason** ticked, check-in asks "What brings you in today?" and
records the visit against that Service.

The **TEST - Employment Resource Center** program (25 fake people, PIN = 01NN from 617-555-01NN) is
created and removed by `salesforce/scripts/pmm-migration/seed_test_erc.py [--delete]`.

In Salesforce, `RTS_AttendanceService` calculates the hours from the times, copies In Person/Remote
from the session, and adds the hours to the participant's Program Engagement. People who never check
out show on the **Missing Check-Outs** report (RTS - Recruitment Reports) for staff to complete.
Absences are still marked by staff on the session's Track Attendance screen.

## Run locally

```sh
cd checkin
eval $(sf org display -o ulem --json | jq -r '"export SF_ACCESS_TOKEN=\(.result.accessToken) SF_INSTANCE_URL=\(.result.instanceUrl)"')
PORT=8899 node dev-server.js     # http://localhost:8899
```

The session token expires after about 2 hours; rerun both lines to refresh it. The page only lists
programs that have a PMM Service Session **today** (America/New_York).

## Options considered

| Option | Remote self check-in | Effort | Cost | Notes |
|---|---|---|---|---|
| **Custom web app on Netlify** (this prototype) | Yes, same URL | Low–medium | Free tier | Same hosting and pattern as msimbo.org. Needs a Salesforce integration user and some security hardening (below). |
| Salesforce Experience Cloud site (public guest page + LWC) | Yes | Medium–high | Free guest access | Native to Salesforce, but guest users can't read or write PMM records directly, so every read and write needs Apex running "without sharing". Guest-user security rules are strict and change often. |
| Lightning page on a logged-in front-desk tablet | No: students have no Salesforce logins | Low | Uses a Salesforce licence | Fine for the desk, but doesn't cover Thu/Fri remote days. |
| Third-party kiosk (e.g. BookingNinjas) | Varies | Low to set up | Paid subscription | Built for hospitality and events; not shown to work with PMM objects, so it would need mapping or custom work anyway. |
| Volunteer/check-in SaaS with CSV sync | Yes | Low | Paid | A second system to sync; contradicts "one system". |

**Recommendation:** the custom web app. It is the only option that covers both the front desk and
remote days with no extra licences, it keeps all data in PMM, and it scales to any program by
adding that program's sessions in PMM.

## Before production

- **Integration user and OAuth.** Production logs in with the OAuth client-credentials flow, so
  nothing expires and no staff login is used. The metadata is in `salesforce/force-app`:
  permission set `ULEM_Checkin_Integration` (read PMM sessions, schedules, participants and Contact
  phones, with View All on Contact because Contact sharing is Private; create/edit, no delete, on
  Service Deliveries) and External Client App `ULEM_Checkin` ("ULEM Check-In"). Steps:
  1. Use the shared **ULEM Integration** user (`integration@ulem.org`; licence Salesforce
     Integration, profile Minimum Access - API Only Integrations, permission set licence
     Salesforce API Integration). It serves every integration; each one adds its own permission
     set, so assign **ULEM Check-In Integration** to it.
  2. Put that username in `extlClntAppOauthPolicies/ULEM_Checkin_oauthPlcy.ecaOauthPlcy-meta.xml`
     (replace `RUN_AS_USERNAME`), then from `salesforce/`:
     `sf project deploy start -o ulem -l RunSpecifiedTests -t RTS_DashboardRefreshSchedulerTest -m PermissionSet:ULEM_Checkin_Integration -m ExternalClientApplication:ULEM_Checkin -m ExtlClntAppGlobalOauthSettings:ULEM_Checkin_glbloauth -m ExtlClntAppOauthSettings:ULEM_Checkin_oauth -m ExtlClntAppOauthConfigurablePolicies:ULEM_Checkin_oauthPlcy`
     (deploy the permission set first if you need to assign it in step 1).
  3. Setup > External Client App Manager > ULEM Check-In > Settings > OAuth Settings > Consumer
     Key and Secret. Copy them into Netlify as `SF_CLIENT_ID` and `SF_CLIENT_SECRET`, and set
     `SF_LOGIN_URL=https://ulem.my.salesforce.com`. It must be the My Domain URL: Salesforce
     rejects client-credentials logins at login.salesforce.com, and the function refuses to start
     without it.
  4. Check: `curl -s -X POST https://ulem.my.salesforce.com/services/oauth2/token -d grant_type=client_credentials -d client_id=... -d client_secret=...`
     returns an `access_token`; then do one real check-in and check-out.

  The function caches the token for 50 minutes and, if Salesforce rejects it sooner, logs in again
  and retries the request once.
- **PIN guessing:** a 4-digit PIN has 10,000 combinations. Add a lockout (e.g. 5 wrong tries locks
  that person for 15 minutes), stored in Netlify Blobs or a Contact field. Consider a dedicated PIN
  field instead of the phone's last 4, which classmates may know.
- **Public class list:** anyone with the URL sees today's first names + last initials. Optionally
  gate the front-desk URL with a device key, and give remote students a personal link.
- **Kiosk device:** iPad in Guided Access mode, with the page saved to the Home Screen.
- **Hosting:** deploy as its own Netlify site (e.g. checkin.ulem.org), separate from msimbo.org.
- **Cohort 2:** needs its schedule (Mon–Wed in person, Thu–Fri remote) with participants linked;
  this app only lists people linked to the session's schedule.
