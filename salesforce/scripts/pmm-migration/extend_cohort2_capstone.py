"""Extend RTS Cohort 2's Career Launch (capstone) to Fri Feb 19, 2027 (decided 2026-10-17).
Usage: SFAUTH=auth.json python3 extend_cohort2_capstone.py [--apply]

The curriculum shifted to start Nov 2: teaching Nov 2 - Jan 15, capstone Jan 19 - Feb 19.
Adds Mon-Fri 10:00-16:00 sessions Jan 26 - Feb 19 (off Mon Feb 15, Presidents' Day) to the
Career Launch schedule, and moves the cohort end dates to Feb 19.
"""
import sys, os, datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfapi import q, call, insert_many

TZ = ZoneInfo("America/New_York")
RTS_COHORT_2, PMM_COHORT_2 = "a1JUV000005JhMX2A0", "a1BUV000002iHbt2AE"
INSTRUCTOR = "0032J00003eFngzQAC"   # Dele Omotosho


def at(day, hh):
    return datetime.datetime.combine(day, datetime.time(hh), TZ).astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


APPLY = "--apply" in sys.argv
CAREER_LAUNCH = "a1GUV000006L2hh2AC"
START, END = datetime.date(2027, 1, 26), datetime.date(2027, 2, 19)
OFF = {datetime.date(2027, 2, 15)}
days = [START + datetime.timedelta(days=i) for i in range((END - START).days + 1)]
days = [d for d in days if d.weekday() < 5 and d not in OFF]
have = {s["pmdm__SessionStart__c"][:10] for s in q(f"SELECT pmdm__SessionStart__c FROM pmdm__ServiceSession__c WHERE pmdm__ServiceSchedule__c = '{CAREER_LAUNCH}'")}
days = [d for d in days if str(d) not in have]
print(len(days), "sessions to add:", days[0] if days else None, "...", days[-1] if days else None)
if not APPLY:
    sys.exit("dry run; pass --apply")
insert_many("pmdm__ServiceSession__c", [{"Name": f"RTS Career Launch {d}", "pmdm__ServiceSchedule__c": CAREER_LAUNCH,
    "pmdm__SessionStart__c": at(d, 10), "pmdm__SessionEnd__c": at(d, 16), "pmdm__Status__c": "Pending",
    "pmdm__PrimaryServiceProvider__c": INSTRUCTOR} for d in days])
call("PATCH", f"/sobjects/pmdm__ServiceSchedule__c/{CAREER_LAUNCH}", {"pmdm__ServiceScheduleEndDate__c": str(END)})
call("PATCH", f"/sobjects/pmdm__ProgramCohort__c/{PMM_COHORT_2}", {"pmdm__EndDate__c": str(END)})
call("PATCH", f"/sobjects/RTS_Cohort__c/{RTS_COHORT_2}", {"End_Date__c": str(END)})
print("done")
