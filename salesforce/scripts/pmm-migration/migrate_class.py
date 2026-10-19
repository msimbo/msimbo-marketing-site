"""Migrate one legacy Program_Class__c (with its Class Registrations and Attendance) into a PMM Program Cohort.
Usage: SFAUTH=auth.json python3 migrate_class.py <ProgramClassId> <ProgramCohortId> [--apply]
auth.json = {"accessToken","instanceUrl"} from `sf org display -o ulem --json`. Without --apply it is a dry run.
PROGRAM_ID/SERVICES are set for MSIMBO Tech Academy / RTS Cohort 1 (MSIMBO-FY26-CY2, migrated 2026-10-16).
After --apply, PMM attendance rollups only recalculate when Attendance Status changes; blank and restore it."""
import sys, json, collections, datetime
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfapi import q, call, insert_many, update_many
PC_ID, COHORT_ID = sys.argv[1], sys.argv[2]
APPLY = "--apply" in sys.argv
PROGRAM_ID = "a1DUV000006Jlnl2AC"
SERVICES = [("2026-05-31", "a1IUV000004DSSP2A4", "RTS Foundations"),      # weeks 1-3
            ("2026-06-28", "a1IUV000004DSU12AO", "RTS Specialization"),   # weeks 4-7
            ("9999-12-31", "a1IUV000004DSVd2AO", "RTS Career Launch")]    # weeks 8-10 + after
STAGE = {"Active": "Active", "Enrolled": "Enrolled", "Completed": "Completed",
         "Dropped Out": "Withdrawn", "Terminated": "Withdrawn", "Assessment": "Applied"}
STATUS = {"Present": "Present", "Tardy": "Late", "No Show": "Unexcused Absence", "Excused": "Excused Absence"}

def service_for(d):
    for until, sid, name in SERVICES:
        if d <= until: return sid, name

pc = q(f"SELECT Id, Name, Start_Date__c, End_Date__c, Stipend__c, Instructor__c, Class_Days__c FROM Program_Class__c WHERE Id='{PC_ID}'")[0]
regs = q(f"SELECT Id, Student__c, Student__r.Name, Student__r.PersonContactId, Status__c, Date__c, Completion_Date__c, Attempt_1_Date__c, Attempt_1_Outcome__c, Attempt_1_Total_Score__c, Attempt_2_Date__c, Attempt_2_Outcome__c, Attempt_2_Total_Score__c, Requirements__c FROM Class_Registration__c WHERE Program_Class__c='{PC_ID}'")
att = q(f"SELECT Id, Student__c, Class_Registration__c, Date__c, Time_In__c, Time_Out__c, Time__c, Status__c, Excused_Reason__c FROM Attendance__c WHERE Program_Class__c='{PC_ID}' ORDER BY Date__c")
pes = q(f"SELECT Id, Name, pmdm__Contact__c, pmdm__Contact__r.Name, pmdm__Contact__r.AccountId, pmdm__Stage__c, Legacy_Class_Registration_Id__c FROM pmdm__ProgramEngagement__c WHERE pmdm__ProgramCohort__c='{COHORT_ID}'")

def norm(n): return " ".join(w for w in n.lower().replace(".", "").split() if len(w) > 1)
by_acct = {p["pmdm__Contact__r"]["AccountId"]: p for p in pes}
by_contact = {p["pmdm__Contact__c"]: p for p in pes}
report = collections.defaultdict(list)

# --- 1. program, cohort, services
if APPLY:
    call("PATCH", f"/sobjects/pmdm__Program__c/{PROGRAM_ID}", {"Name": "MSIMBO Tech Academy"})
    call("PATCH", f"/sobjects/pmdm__ProgramCohort__c/{COHORT_ID}", {
        "Legacy_Program_Class_Id__c": pc["Id"], "Instructor__c": pc["Instructor__c"],
        "Class_Days__c": pc["Class_Days__c"], "Stipend__c": pc["Stipend__c"]})
    update_many("pmdm__Service__c", [{"Id": s[1], "pmdm__AttendanceFieldSet__c": "RTS_Attendance"} for s in SERVICES])

# --- 2. engagements
reg_to_pe, new_pes, upd_pes = {}, [], []
for r in regs:
    contact = r["Student__r"]["PersonContactId"]
    legacy = {"Legacy_Class_Registration_Id__c": r["Id"],
              "Assessment_Attempt_1_Date__c": r["Attempt_1_Date__c"], "Assessment_Attempt_1_Outcome__c": r["Attempt_1_Outcome__c"],
              "Assessment_Attempt_1_Score__c": r["Attempt_1_Total_Score__c"], "Assessment_Attempt_2_Date__c": r["Attempt_2_Date__c"],
              "Assessment_Attempt_2_Outcome__c": r["Attempt_2_Outcome__c"], "Assessment_Attempt_2_Score__c": r["Attempt_2_Total_Score__c"],
              "Requirements__c": r["Requirements__c"]}
    pe = by_acct.get(r["Student__c"]) or by_contact.get(contact)
    if not pe:
        cand = [p for p in pes if norm(p["pmdm__Contact__r"]["Name"]) == norm(r["Student__r"]["Name"])
                or set(norm(p["pmdm__Contact__r"]["Name"]).split()) <= set(norm(r["Student__r"]["Name"]).split())]
        if len(cand) == 1:
            pe = cand[0]
            report["matched by name only (different Account - possible duplicate person)"].append(
                f'{r["Student__r"]["Name"]}: legacy Account {r["Student__c"]} vs PMM Contact {pe["pmdm__Contact__c"]} (Account {pe["pmdm__Contact__r"]["AccountId"]})')
    if pe:
        reg_to_pe[r["Id"]] = (pe["Id"], pe["pmdm__Contact__c"])
        upd_pes.append(dict(Id=pe["Id"], **legacy))
        if STAGE.get(r["Status__c"]) != pe["pmdm__Stage__c"]:
            report["stage conflict (kept PMM value; needs your final outcome)"].append(
                f'{r["Student__r"]["Name"]}: legacy {r["Status__c"]} vs PMM {pe["pmdm__Stage__c"]}')
    else:
        if not contact:
            report["skipped: legacy student is not a person account"].append(r["Student__r"]["Name"]); continue
        stage = STAGE.get(r["Status__c"], "Enrolled")
        new_pes.append((r["Id"], dict(Name=f'{r["Student__r"]["Name"]} {pc["Start_Date__c"]}: MSIMBO Tech Academy'[:80],
            pmdm__Program__c=PROGRAM_ID, pmdm__ProgramCohort__c=COHORT_ID, pmdm__Contact__c=contact, pmdm__Role__c="Client",
            pmdm__Stage__c=stage, pmdm__StartDate__c=r["Date__c"] or pc["Start_Date__c"], pmdm__EndDate__c=r["Completion_Date__c"], **legacy)))
        report["new engagement (stage from legacy, provisional)"].append(f'{r["Student__r"]["Name"]}: {r["Status__c"]} -> {stage}')

if APPLY:
    update_many("pmdm__ProgramEngagement__c", upd_pes)
    ids = insert_many("pmdm__ProgramEngagement__c", [x[1] for x in new_pes])
    for (rid, rec), pid in zip(new_pes, ids):
        reg_to_pe[rid] = (pid, rec["pmdm__Contact__c"])
    withdrawn = [pid for (rid, rec), pid in zip(new_pes, ids) if rec["pmdm__Stage__c"] == "Withdrawn"]
    if withdrawn:
        sps = q("SELECT Id FROM pmdm__ServiceParticipant__c WHERE pmdm__ProgramEngagement__c IN ('" + "','".join(withdrawn) + "')")
        update_many("pmdm__ServiceParticipant__c", [{"Id": s["Id"], "pmdm__Status__c": "Withdrawn"} for s in sps])

# --- 3. schedules + sessions (one session per class date, per phase service)
by_date = collections.defaultdict(list)
for a in att: by_date[a["Date__c"]].append(a)
sched_ids = {}
if APPLY:
    for until, sid, name in SERVICES:
        dates = [d for d in sorted(by_date) if service_for(d)[0] == sid]
        if not dates: continue
        sched_ids[sid] = insert_many("pmdm__ServiceSchedule__c", [{
            "Name": f"{name} - Cohort 1 (migrated)", "pmdm__Service__c": sid, "pmdm__Frequency__c": "Weekly",
            "pmdm__DaysOfWeek__c": "2;3;4", "pmdm__CreateServiceSessionRecords__c": False,
            "pmdm__FirstSessionStart__c": dates[0] + "T14:00:00.000Z", "pmdm__FirstSessionEnd__c": dates[0] + "T20:00:00.000Z",
            "pmdm__ServiceScheduleEnds__c": "On", "pmdm__ServiceScheduleEndDate__c": dates[-1]}])[0]
sessions = []
for d in sorted(by_date):
    rows = by_date[d]; sid, name = service_for(d)
    ins = [a["Time_In__c"] for a in rows if a["Time_In__c"]]; outs = [a["Time_Out__c"] for a in rows if a["Time_Out__c"]]
    sessions.append((d, sid, {"Name": f"{name} {d}", "pmdm__ServiceSchedule__c": sched_ids.get(sid),
        "pmdm__SessionStart__c": min(ins) if ins else d + "T14:00:00.000Z",
        "pmdm__SessionEnd__c": max(outs) if outs else d + "T20:00:00.000Z", "pmdm__Status__c": "Complete"}))
session_ids = {}
if APPLY:
    for (d, sid, rec), sess in zip(sessions, insert_many("pmdm__ServiceSession__c", [s[2] for s in sessions])):
        session_ids[d] = sess

# --- 4. attendance -> service deliveries
deliveries = []
for a in att:
    pe = reg_to_pe.get(a["Class_Registration__c"])
    if not pe and APPLY:
        report["attendance skipped: no engagement"].append(a["Id"]); continue
    sid, name = service_for(a["Date__c"])
    if a["Status__c"] is None: report["attendance with blank status (migrated blank)"].append(f'{a["Date__c"]} {a["Id"]}')
    if a["Time_In__c"] and not a["Time_Out__c"]: report["attendance with no Time Out (hours blank)"].append(f'{a["Date__c"]} {a["Id"]}')
    deliveries.append({"Name": f"{name} {a['Date__c']}", "pmdm__Service__c": sid, "pmdm__ServiceSession__c": session_ids.get(a["Date__c"]),
        "pmdm__ProgramEngagement__c": pe[0] if pe else None, "pmdm__Contact__c": pe[1] if pe else None,
        "pmdm__DeliveryDate__c": a["Date__c"], "pmdm__AttendanceStatus__c": STATUS.get(a["Status__c"]),
        "Time_In__c": a["Time_In__c"], "Time_Out__c": a["Time_Out__c"], "pmdm__Quantity__c": a["Time__c"],
        "Legacy_Attendance_Id__c": a["Id"]})
if APPLY:
    insert_many("pmdm__ServiceDelivery__c", deliveries)

print(f"class {pc['Name']}: {len(regs)} registrations ({len(upd_pes)} matched, {len(new_pes)} new), {len(sessions)} sessions, {len(deliveries)} deliveries, apply={APPLY}")
for k, v in report.items():
    print(f"\n## {k} ({len(v)})"); [print("  -", x) for x in v]
