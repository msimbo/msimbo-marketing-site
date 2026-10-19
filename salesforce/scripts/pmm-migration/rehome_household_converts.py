"""Move RTS applicants who were converted into NPSP household Contacts onto Person Accounts, then enrol them.
Usage: SFAUTH=auth.json python3 rehome_household_converts.py <LeadId> [<LeadId>...] [--apply]

For each converted Lead: build a Person Account from the Lead's data (same fields RTS_EnrollmentService
copies), move Tasks/Events and Files from the household Contact, delete the household Contact (and its
household Account if empty), and create the Program Engagement in the Lead's PMM cohort.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfapi import q, call, insert_many, update_many

APPLY = "--apply" in sys.argv
LEADS = [a for a in sys.argv[1:] if not a.startswith("--")]
COPY = ["RTS_Childcare_Barrier", "RTS_Childcare_Granted", "RTS_Cohort", "RTS_Emergency_Fund_Granted", "RTS_Employment_Status",
        "RTS_Internet_Barrier", "RTS_Laptop_Granted", "RTS_Meals_Granted", "RTS_Transportation_Barrier",
        "RTS_Transportation_Granted", "RTS_Wraparound_Notes", "RTS_Zip_Code"]
PERSON_RT = q("SELECT Id FROM RecordType WHERE SobjectType='Account' AND DeveloperName='PersonAccount'")[0]["Id"]


def delete(ids):
    if ids:
        res = call("DELETE", "/composite/sobjects?allOrNone=true&ids=" + ",".join(ids))
        assert all(r["success"] for r in res), res


for lead_id in LEADS:
    l = q(f"""SELECT Id, Name, FirstName, LastName, Salutation, Email, Phone, MobilePhone, LeadSource, CreatedDate,
              ConvertedContactId, ConvertedAccountId, RTS_Date_of_Birth__c,
              RTS_Cohort__r.PMM_Cohort__c, RTS_Cohort__r.PMM_Cohort__r.pmdm__Program__c, RTS_Cohort__r.Start_Date__c,
              {', '.join(f + '__c' for f in COPY)} FROM Lead WHERE Id = '{lead_id}'""")[0]
    old_contact, old_account = l["ConvertedContactId"], l["ConvertedAccountId"]
    c = q(f"SELECT OwnerId, Account.IsPersonAccount FROM Contact WHERE Id = '{old_contact}'")[0]
    if c["Account"]["IsPersonAccount"]:
        print(l["Name"], "is already a Person Account; skipping"); continue
    tasks = q(f"SELECT Id, WhatId FROM Task WHERE WhoId = '{old_contact}'")
    events = q(f"SELECT Id, WhatId FROM Event WHERE WhoId = '{old_contact}'")
    files = q(f"SELECT Id, ContentDocumentId, ShareType, Visibility FROM ContentDocumentLink WHERE LinkedEntityId = '{old_contact}'")
    print(f"{l['Name']}: {len(tasks)} tasks, {len(events)} events, {len(files)} files to move")
    if not APPLY:
        continue

    acct = {"RecordTypeId": PERSON_RT, "FirstName": l["FirstName"], "LastName": l["LastName"], "Salutation": l["Salutation"],
            "PersonEmail": l["Email"], "Phone": l["Phone"], "PersonMobilePhone": l["MobilePhone"], "PersonLeadSource": l["LeadSource"],
            "PersonBirthdate": l["RTS_Date_of_Birth__c"], "OwnerId": c["OwnerId"]}
    for f in COPY:
        v = l[f + "__c"]
        if v not in (None, False):
            acct[f + "__pc"] = v
    new_account = call("POST", "/sobjects/Account", {k: v for k, v in acct.items() if v is not None})["id"]
    new_contact = q(f"SELECT PersonContactId FROM Account WHERE Id = '{new_account}'")[0]["PersonContactId"]

    for sobj, rows in (("Task", tasks), ("Event", events)):
        update_many(sobj, [dict({"Id": r["Id"], "WhoId": new_contact}, **({"WhatId": new_account} if r["WhatId"] == old_account else {}))
                           for r in rows])
    if files:
        insert_many("ContentDocumentLink", [{"ContentDocumentId": f["ContentDocumentId"], "LinkedEntityId": new_contact,
                                             "ShareType": f["ShareType"], "Visibility": f["Visibility"]} for f in files])
        delete([f["Id"] for f in files])
    delete([old_contact])
    if old_account and not q(f"SELECT Id FROM Contact WHERE AccountId = '{old_account}' LIMIT 1") \
            and q(f"SELECT Id FROM Account WHERE Id = '{old_account}'"):
        delete([old_account])

    cohort = l["RTS_Cohort__r"]
    eng = call("POST", "/sobjects/pmdm__ProgramEngagement__c", {
        "pmdm__Program__c": cohort["PMM_Cohort__r"]["pmdm__Program__c"], "pmdm__ProgramCohort__c": cohort["PMM_Cohort__c"],
        "pmdm__Contact__c": new_contact, "pmdm__Role__c": "Client", "pmdm__Stage__c": "Enrolled",
        "pmdm__ApplicationDate__c": l["CreatedDate"][:10], "pmdm__StartDate__c": cohort["Start_Date__c"]})["id"]
    print(f"  -> Person Account {new_account}, engagement {eng}")
