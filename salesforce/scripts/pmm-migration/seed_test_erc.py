"""Seed (or delete) a TEST drop-in program modelled on ERC, for the check-in app prototype.

Usage: SFAUTH=auth.json python3 seed_test_erc.py [--delete]

Creates: Program "TEST - Employment Resource Center", cohort "TEST - ERC FY27", Services
"ERC Open Hours" (the schedule the kiosk reads) + 5 visit reasons (Check_In_Reason__c), a Drop-In
schedule with Mon-Fri 8:30-4:30 sessions for three weeks, 25 fake contacts (LastName "... ZZTEST",
phones 617-555-01NN so the PIN is 01NN), their engagements, and sample visits before today.
Everything hangs off the TEST program, so --delete finds it all from there.
"""
import sys, os, random, datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfapi import q, call, insert_many, update_many

PROGRAM = "TEST - Employment Resource Center"
TZ = ZoneInfo("America/New_York")
REASONS = ["Job Search", "Resume Help", "Computer Lab", "Workshop", "Meet with Staff"]
PEOPLE = ["Maria Rivera", "James Carter", "Aisha Mohamed", "Luis Santos", "Keisha Brown", "Daniel Nguyen",
          "Fatima Diallo", "Marcus Johnson", "Rosa Delgado", "Tyrone Williams", "Mei Chen", "Andre Baptiste",
          "Grace Okafor", "Kevin O'Neil", "Yolanda Pierre", "Samuel Mensah", "Brianna Lee", "Hector Ramos",
          "Nadia Haddad", "Curtis Green", "Esther Joseph", "Omar Farah", "Tanya Moore", "Victor Alves", "Linda Tran"]


def ids(soql):
    return [r["Id"] for r in q(soql)]


def delete(sobject_ids):
    for i in range(0, len(sobject_ids), 200):
        res = call("DELETE", "/composite/sobjects?allOrNone=true&ids=" + ",".join(sobject_ids[i:i + 200]))
        assert all(r["success"] for r in res), res


def teardown():
    prog = ids(f"SELECT Id FROM pmdm__Program__c WHERE Name = '{PROGRAM}'")
    if not prog:
        print("nothing to delete"); return
    p = prog[0]
    deliveries = ids(f"SELECT Id FROM pmdm__ServiceDelivery__c WHERE pmdm__Service__r.pmdm__Program__c = '{p}'")
    sessions = ids(f"SELECT Id FROM pmdm__ServiceSession__c WHERE pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__c = '{p}'")
    participants = ids(f"SELECT Id FROM pmdm__ServiceParticipant__c WHERE pmdm__Service__r.pmdm__Program__c = '{p}'")
    schedules = ids(f"SELECT Id FROM pmdm__ServiceSchedule__c WHERE pmdm__Service__r.pmdm__Program__c = '{p}'")
    engagements = ids(f"SELECT Id FROM pmdm__ProgramEngagement__c WHERE pmdm__Program__c = '{p}'")
    contacts = ids("SELECT Id FROM Contact WHERE LastName LIKE '% ZZTEST' AND MobilePhone LIKE '(617) 555-01%'")
    services = ids(f"SELECT Id FROM pmdm__Service__c WHERE pmdm__Program__c = '{p}'")
    cohorts = ids(f"SELECT Id FROM pmdm__ProgramCohort__c WHERE pmdm__Program__c = '{p}'")
    for label, group in [("deliveries", deliveries), ("sessions", sessions), ("participants", participants),
                         ("schedules", schedules), ("engagements", engagements), ("contacts", contacts),
                         ("services", services), ("cohorts", cohorts), ("program", prog)]:
        if group: delete(group)
        print(f"deleted {len(group)} {label}")


def at(day, hh, mm):
    return datetime.datetime.combine(day, datetime.time(hh, mm), TZ).astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def seed():
    if ids(f"SELECT Id FROM pmdm__Program__c WHERE Name = '{PROGRAM}'"):
        sys.exit("TEST program already exists; run with --delete first")
    rnd = random.Random(42)
    today = datetime.datetime.now(TZ).date()
    monday = today - datetime.timedelta(days=today.weekday())

    prog = call("POST", "/sobjects/pmdm__Program__c", {"Name": PROGRAM, "pmdm__Status__c": "Active",
        "pmdm__ProgramIssueArea__c": "Employment", "pmdm__StartDate__c": "2026-07-01",
        "pmdm__ShortSummary__c": "Job search, resume help and computer access. Walk in Mon–Fri.",
        "pmdm__Description__c": "TEST copy of ERC for the check-in prototype. Delete with seed_test_erc.py --delete."})["id"]
    cohort = call("POST", "/sobjects/pmdm__ProgramCohort__c", {"Name": "TEST - ERC FY27", "pmdm__Program__c": prog,
        "pmdm__Status__c": "Active", "pmdm__StartDate__c": "2026-07-01", "pmdm__EndDate__c": "2027-06-30",
        "Class_Days__c": "Monday;Tuesday;Wednesday;Thursday;Friday"})["id"]
    svc = lambda name, reason: {"Name": name, "pmdm__Program__c": prog, "pmdm__Status__c": "Active",
        "pmdm__UnitOfMeasurement__c": "Hours", "pmdm__AttendanceFieldSet__c": "RTS_Attendance", "Check_In_Reason__c": reason}
    open_hours = insert_many("pmdm__Service__c", [svc("ERC Open Hours", False)])[0]
    reason_ids = dict(zip(REASONS, insert_many("pmdm__Service__c", [svc(r, True) for r in REASONS])))

    schedule = insert_many("pmdm__ServiceSchedule__c", [{"Name": "TEST - ERC Open Hours (Mon-Fri 8:30-4:30)",
        "pmdm__Service__c": open_hours, "pmdm__Frequency__c": "Weekly", "pmdm__DaysOfWeek__c": "2;3;4;5;6",
        "pmdm__FirstSessionStart__c": at(monday, 8, 30), "pmdm__FirstSessionEnd__c": at(monday, 16, 30),
        "pmdm__ServiceScheduleEnds__c": "On", "pmdm__ServiceScheduleEndDate__c": "2027-06-30",
        "pmdm__CreateServiceSessionRecords__c": False, "Delivery_Mode__c": "In Person", "Drop_In__c": True}])[0]
    days = [monday + datetime.timedelta(days=d) for d in range(21) if (monday + datetime.timedelta(days=d)).weekday() < 5]
    session_ids = dict(zip(days, insert_many("pmdm__ServiceSession__c", [{
        "Name": f"ERC Open Hours {d}", "pmdm__ServiceSchedule__c": schedule,
        "pmdm__SessionStart__c": at(d, 8, 30), "pmdm__SessionEnd__c": at(d, 16, 30),
        "pmdm__Status__c": "Complete" if d < today else "Pending"} for d in days])))

    contacts = insert_many("Contact", [{"FirstName": n.split(" ", 1)[0], "LastName": n.split(" ", 1)[1] + " ZZTEST",
        "MobilePhone": f"(617) 555-01{10 + i:02d}", "Description": "Check-in prototype test person"} for i, n in enumerate(PEOPLE)])
    engagements = insert_many("pmdm__ProgramEngagement__c", [{"pmdm__Program__c": prog, "pmdm__ProgramCohort__c": cohort,
        "pmdm__Contact__c": c, "pmdm__Role__c": "Client", "pmdm__Stage__c": "Active",
        "pmdm__StartDate__c": str(datetime.date(2026, 7, 1) + datetime.timedelta(days=rnd.randrange(100)))} for c in contacts], size=5)
    # RTS Flow 9 creates a participant per active Service; put the Open Hours ones on the schedule.
    parts = q(f"SELECT Id, pmdm__Contact__c FROM pmdm__ServiceParticipant__c WHERE pmdm__Service__c = '{open_hours}'")
    have = {p["pmdm__Contact__c"] for p in parts}
    update_many("pmdm__ServiceParticipant__c", [{"Id": p["Id"], "pmdm__ServiceSchedule__c": schedule} for p in parts])
    missing = [{"pmdm__Contact__c": c, "pmdm__ProgramEngagement__c": e, "pmdm__Service__c": open_hours,
                "pmdm__ServiceSchedule__c": schedule, "pmdm__Status__c": "Enrolled"}
               for c, e in zip(contacts, engagements) if c not in have]
    if missing: insert_many("pmdm__ServiceParticipant__c", missing)

    # Sample visits before today (plus two people here right now), so reports have something to show.
    visits = []
    for d in [d for d in days if d <= today]:
        who = rnd.sample(range(len(contacts)), rnd.randint(4, 8) if d < today else 2)
        for k, i in enumerate(who):
            tin = datetime.datetime.combine(d, datetime.time(8, 30), TZ) + datetime.timedelta(minutes=rnd.randrange(0, 300))
            reason = rnd.choices(REASONS, weights=[5, 3, 4, 1, 2])[0]
            v = {"Name": f"{reason} {d}", "pmdm__Service__c": reason_ids[reason], "pmdm__ServiceSession__c": session_ids[d],
                 "pmdm__ProgramEngagement__c": engagements[i], "pmdm__Contact__c": contacts[i], "pmdm__DeliveryDate__c": str(d),
                 "pmdm__AttendanceStatus__c": "Present", "Time_In__c": tin.astimezone(datetime.timezone.utc).isoformat()}
            leave_out = d == today or (d == days[0] and k == 0)   # today's are still here; one forgot to check out
            if not leave_out:
                v["Time_Out__c"] = min(tin + datetime.timedelta(minutes=rnd.randrange(45, 360)),
                                       datetime.datetime.combine(d, datetime.time(16, 30), TZ)).astimezone(datetime.timezone.utc).isoformat()
            visits.append(v)
    insert_many("pmdm__ServiceDelivery__c", visits)
    print(f"program {prog}, cohort {cohort}, {len(REASONS)} reasons, {len(days)} sessions, "
          f"{len(contacts)} people, {len(visits)} sample visits")


if __name__ == "__main__":
    teardown() if "--delete" in sys.argv else seed()
