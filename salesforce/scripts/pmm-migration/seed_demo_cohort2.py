"""Seed (or delete) a check-in demo on RTS Cohort 2, before its first real session (Nov 2).

Usage: SFAUTH=auth.json python3 seed_demo_cohort2.py [--delete]

Creates: one Service Session "DEMO - Check-in (delete me)" today 10:00-16:00 on the
"RTS Cohort 2 · Foundations" schedule, and 6 fake students (LastName "... ZZTEST", phones
617-555-02NN so the PIN is 02NN) enrolled in the Cohort 2 PMM cohort. RTS Flow 9 creates their
Service Participants and RTS_ServiceParticipantTrigger links them to the Cohort 2 schedules.
The 02NN phones keep them clear of seed_test_erc.py, whose teardown takes 617-555-01NN.
The real Cohort 2 students also show on the list; don't check them in.
"""
import sys, os, datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfapi import q, call, insert_many

SCHEDULE = "RTS Cohort 2 · Foundations"
SESSION = "DEMO - Check-in (delete me)"
TZ = ZoneInfo("America/New_York")
PEOPLE = ["Jordan Ellis", "Priya Shah", "Marcus Bell", "Ana Torres", "Kofi Asante", "Hannah Kim"]
CONTACTS = "SELECT Id FROM Contact WHERE LastName LIKE '% ZZTEST' AND MobilePhone LIKE '(617) 555-02%'"


def ids(soql):
    return [r["Id"] for r in q(soql)]


def delete(sobject_ids):
    for i in range(0, len(sobject_ids), 200):
        res = call("DELETE", "/composite/sobjects?allOrNone=true&ids=" + ",".join(sobject_ids[i:i + 200]))
        assert all(r["success"] for r in res), res


def at(day, hh, mm):
    return datetime.datetime.combine(day, datetime.time(hh, mm), TZ).astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def teardown():
    contacts = ids(CONTACTS)
    sessions = ids(f"SELECT Id FROM pmdm__ServiceSession__c WHERE Name = '{SESSION}'")
    clist = ",".join(f"'{c}'" for c in contacts) or "''"
    slist = ",".join(f"'{s}'" for s in sessions) or "''"
    deliveries = ids(f"SELECT Id FROM pmdm__ServiceDelivery__c WHERE pmdm__ServiceSession__c IN ({slist}) OR pmdm__Contact__c IN ({clist})")
    participants = ids(f"SELECT Id FROM pmdm__ServiceParticipant__c WHERE pmdm__Contact__c IN ({clist})")
    engagements = ids(f"SELECT Id FROM pmdm__ProgramEngagement__c WHERE pmdm__Contact__c IN ({clist})")
    for label, group in [("deliveries", deliveries), ("sessions", sessions), ("participants", participants),
                         ("engagements", engagements), ("contacts", contacts)]:
        if group: delete(group)
        print(f"deleted {len(group)} {label}")


def seed():
    if ids(CONTACTS) or ids(f"SELECT Id FROM pmdm__ServiceSession__c WHERE Name = '{SESSION}'"):
        sys.exit("demo already exists; run with --delete first")
    [sched] = q(f"SELECT Id, pmdm__Service__r.pmdm__Program__c, Program_Cohort__c FROM pmdm__ServiceSchedule__c WHERE Name = '{SCHEDULE}'")
    today = datetime.datetime.now(TZ).date()
    session = insert_many("pmdm__ServiceSession__c", [{"Name": SESSION, "pmdm__ServiceSchedule__c": sched["Id"],
        "pmdm__SessionStart__c": at(today, 10, 0), "pmdm__SessionEnd__c": at(today, 16, 0), "pmdm__Status__c": "Pending"}])[0]
    contacts = insert_many("Contact", [{"FirstName": n.split(" ", 1)[0], "LastName": n.split(" ", 1)[1] + " ZZTEST",
        "MobilePhone": f"(617) 555-02{i + 1:02d}", "Description": "Check-in demo test person"} for i, n in enumerate(PEOPLE)])
    insert_many("pmdm__ProgramEngagement__c", [{"pmdm__Program__c": sched["pmdm__Service__r"]["pmdm__Program__c"],
        "pmdm__ProgramCohort__c": sched["Program_Cohort__c"], "pmdm__Contact__c": c, "pmdm__Role__c": "Client",
        "pmdm__Stage__c": "Enrolled", "pmdm__StartDate__c": "2026-11-02"} for c in contacts], size=5)
    linked = q(f"SELECT COUNT(Id) n FROM pmdm__ServiceParticipant__c WHERE pmdm__ServiceSchedule__c = '{sched['Id']}' "
               f"AND pmdm__Contact__c IN ({','.join(repr(c) for c in contacts)})")[0]["n"]
    print(f"session {session}, {len(contacts)} people ({linked} on the Foundations schedule)")


if __name__ == "__main__":
    teardown() if "--delete" in sys.argv else seed()
