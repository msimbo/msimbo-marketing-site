"""One-off setup of RTS Cohort 2 in PMM (decided 2026-10-16). Usage: SFAUTH=auth.json python3 setup_cohort2.py [--apply]

Mon Nov 2 2026 - Mon Jan 25 2027, Mon-Fri 10:00-16:00 ET, Mon-Wed in person / Thu-Fri remote.
Off: Nov 25-27, Dec 24 - Jan 1, Jan 18. Phases: Foundations Nov 2-20, Specialization Nov 23 - Dec 23,
Career Launch Jan 4-25 (15 / 20 / 15 class days).
"""
import sys, os, datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfapi import q, call, insert_many, update_many

APPLY = "--apply" in sys.argv
TZ = ZoneInfo("America/New_York")
RTS_COHORT_2 = "a1JUV000005JhMX2A0"
PMM_COHORT_1, PMM_COHORT_2 = "a1BUV000002OSV32AO", "a1BUV000002iHbt2AE"
STRAY_RTS_COHORTS = ["a1JUV00000689yj2AA", "a1JUV0000068JQD2A2"]
LEGACY_CLASS, LEGACY_REG = "a0nUV00000klksvYAA", "a0mUV0000034qazYAA"
INSTRUCTOR = "0032J00003eFngzQAC"   # Dele Omotosho
START, END = datetime.date(2026, 11, 2), datetime.date(2027, 1, 25)
OFF = {datetime.date(2026, 11, d) for d in (25, 26, 27)} | {datetime.date(2027, 1, 18)} \
    | {datetime.date(2026, 12, 24) + datetime.timedelta(days=i) for i in range(9)}
PHASES = [("RTS Foundations", "a1IUV000004DSSP2A4", datetime.date(2026, 11, 20)),
          ("RTS Specialization", "a1IUV000004DSU12AO", datetime.date(2026, 12, 23)),
          ("RTS Career Launch", "a1IUV000004DSVd2AO", END)]


def at(day, hh):
    return datetime.datetime.combine(day, datetime.time(hh), TZ).astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


days = [START + datetime.timedelta(days=i) for i in range((END - START).days + 1)]
days = [d for d in days if d.weekday() < 5 and d not in OFF]
assert len(days) == 50, len(days)
by_phase, prev = [], START - datetime.timedelta(days=1)
for name, sid, until in PHASES:
    ds = [d for d in days if prev < d <= until]
    by_phase.append((name, sid, ds)); prev = until
print("class days per phase:", [(n, len(ds), str(ds[0]), str(ds[-1])) for n, _, ds in by_phase])

strays = q("SELECT Id, Name FROM Lead WHERE RTS_Cohort__c IN ('" + "','".join(STRAY_RTS_COHORTS) + "')")
print("leads to re-point:", [l["Name"] for l in strays])
if not APPLY:
    sys.exit("dry run; pass --apply")

call("PATCH", f"/sobjects/RTS_Cohort__c/{RTS_COHORT_2}", {"Start_Date__c": str(START), "End_Date__c": str(END)})
call("PATCH", f"/sobjects/pmdm__ProgramCohort__c/{PMM_COHORT_2}", {"pmdm__StartDate__c": str(START), "pmdm__EndDate__c": str(END),
     "Instructor__c": INSTRUCTOR, "Class_Days__c": "Monday;Tuesday;Wednesday;Thursday;Friday"})
update_many("pmdm__ServiceSchedule__c", [{"Id": s["Id"], "Program_Cohort__c": PMM_COHORT_1}
            for s in q("SELECT Id FROM pmdm__ServiceSchedule__c WHERE Name LIKE '%Cohort 1 (migrated)'")])

for name, sid, ds in by_phase:
    sched = insert_many("pmdm__ServiceSchedule__c", [{
        "Name": f"{name} - Cohort 2", "pmdm__Service__c": sid, "Program_Cohort__c": PMM_COHORT_2,
        "pmdm__Frequency__c": "Weekly", "pmdm__DaysOfWeek__c": "2;3;4;5;6", "pmdm__CreateServiceSessionRecords__c": False,
        "pmdm__FirstSessionStart__c": at(ds[0], 10), "pmdm__FirstSessionEnd__c": at(ds[0], 16),
        "pmdm__ServiceScheduleEnds__c": "On", "pmdm__ServiceScheduleEndDate__c": str(ds[-1]),
        "pmdm__PrimaryServiceProvider__c": INSTRUCTOR, "Delivery_Mode__c": "In Person", "Remote_Days__c": "Thursday;Friday"}])[0]
    insert_many("pmdm__ServiceSession__c", [{"Name": f"{name} {d}", "pmdm__ServiceSchedule__c": sched,
        "pmdm__SessionStart__c": at(d, 10), "pmdm__SessionEnd__c": at(d, 16), "pmdm__Status__c": "Pending",
        "pmdm__PrimaryServiceProvider__c": INSTRUCTOR} for d in ds])
    print("created", name, len(ds), "sessions")

update_many("Lead", [{"Id": l["Id"], "RTS_Cohort__c": RTS_COHORT_2} for l in strays])
for ids in ([LEGACY_REG], [LEGACY_CLASS], STRAY_RTS_COHORTS):
    res = call("DELETE", "/composite/sobjects?allOrNone=true&ids=" + ",".join(ids))
    print("deleted", ids, [r["success"] for r in res])
