/**
 * Moves an accepted RTS applicant from Lead into the program:
 *   1. converts the Lead to a Person Account (reusing an existing Person Account with the same
 *      email, so re-applicants keep one record), with no Opportunity;
 *   2. copies the RTS intake answers and date of birth onto the Person Account;
 *   3. creates the Program Engagement in the PMM cohort linked from the Lead's RTS Cohort.
 * RTS Flow 9 then enrols the engagement in each active Service, and linkSchedules() puts those
 * Service Participants on the cohort's schedules so they appear on attendance lists.
 *
 * enrol() is invocable (Flow: "RTS: Enrol accepted applicant") and runs as a Queueable, so it can
 * be called from a record-triggered flow on the same Lead. When a Lead can't be enrolled (no PMM
 * cohort, or the conversion fails), the Queueable rolls back and leaves an "Enrol by hand" task.
 */
public with sharing class RTS_EnrollmentService implements Queueable {

    public static final String CONVERTED_STATUS = 'RTS - Converted';
    private final List<Id> leadIds;

    public RTS_EnrollmentService(List<Id> leadIds) {
        this.leadIds = leadIds;
    }

    @InvocableMethod(label='RTS: Enrol accepted applicant'
        description='Converts the Lead to a Person Account and creates its Program Engagement in the RTS cohort.')
    public static void enrolAsync(List<Id> leadIds) {
        System.enqueueJob(new RTS_EnrollmentService(leadIds));
    }

    public void execute(QueueableContext context) {
        Map<Id, Id> enrolled = new Map<Id, Id>();
        String error;
        Savepoint sp = Database.setSavepoint();
        try {
            enrolled = enrol(leadIds);
        } catch (Exception e) {
            Database.rollback(sp);
            error = e.getMessage();
        }
        flagNotEnrolled(leadIds, enrolled.keySet(), error);
    }

    /** Leaves a task on each Lead that is still unconverted, so the coordinator enrols it by hand. */
    @TestVisible
    static void flagNotEnrolled(List<Id> leadIds, Set<Id> enrolled, String error) {
        String reason = error != null ? error : 'its RTS Cohort is not linked to a PMM Program Cohort.';
        List<Task> tasks = new List<Task>();
        for (Lead l : [SELECT Id, FirstName, LastName, OwnerId FROM Lead WHERE Id IN :leadIds AND IsConverted = false]) {
            if (enrolled.contains(l.Id)) continue;
            Task t = new Task(
                WhoId = l.Id, Subject = 'Enrol by hand — ' + (l.FirstName == null ? '' : l.FirstName + ' ') + l.LastName,
                Description = 'Salesforce could not set up this student automatically: ' + reason
                    + '\nFollow Section 6.9 of the coordinator guide, or ask Dele.',
                Priority = 'High', Status = 'Not Started', ActivityDate = Date.today()
            );
            if (String.valueOf(l.OwnerId).startsWith('005')) t.OwnerId = l.OwnerId;
            tasks.add(t);
        }
        insert tasks;
    }

    /** Returns the Program Engagement id per Lead id, for leads that were enrolled. */
    public static Map<Id, Id> enrol(List<Id> leadIds) {
        List<String> copyFields = copyableFields();
        String soql = 'SELECT Id, FirstName, LastName, Email, Company, IsConverted, CreatedDate, RTS_Date_of_Birth__c, '
            + 'RTS_Cohort__r.PMM_Cohort__c, RTS_Cohort__r.PMM_Cohort__r.pmdm__Program__c, RTS_Cohort__r.Start_Date__c'
            + (copyFields.isEmpty() ? '' : ', ' + String.join(copyFields, ', '))
            + ' FROM Lead WHERE Id IN :leadIds AND IsConverted = false AND RTS_Cohort__r.PMM_Cohort__c != null';
        List<Lead> leads = Database.query(soql);
        if (leads.isEmpty()) {
            return new Map<Id, Id>();
        }

        // Person Accounts are only created when Company is blank; web leads arrive with "N/A".
        List<Lead> clearCompany = new List<Lead>();
        for (Lead l : leads) {
            if (l.Company != null) {
                clearCompany.add(new Lead(Id = l.Id, Company = null));
            }
        }
        update clearCompany;

        Map<String, Account> existingByEmail = new Map<String, Account>();
        Set<String> emails = new Set<String>();
        for (Lead l : leads) {
            if (l.Email != null) emails.add(l.Email.toLowerCase());
        }
        for (Account a : [SELECT Id, PersonContactId, PersonEmail FROM Account
                          WHERE IsPersonAccount = true AND PersonEmail IN :emails ORDER BY CreatedDate]) {
            existingByEmail.put(a.PersonEmail.toLowerCase(), a);
        }

        List<Database.LeadConvert> converts = new List<Database.LeadConvert>();
        for (Lead l : leads) {
            Database.LeadConvert lc = new Database.LeadConvert();
            lc.setLeadId(l.Id);
            lc.setConvertedStatus(CONVERTED_STATUS);
            lc.setDoNotCreateOpportunity(true);
            Account existing = l.Email == null ? null : existingByEmail.get(l.Email.toLowerCase());
            if (existing != null) {
                lc.setAccountId(existing.Id);
                lc.setContactId(existing.PersonContactId);
            }
            converts.add(lc);
        }
        Map<Id, Database.LeadConvertResult> resultByLead = new Map<Id, Database.LeadConvertResult>();
        for (Database.LeadConvertResult r : Database.convertLead(converts, true)) {
            resultByLead.put(r.getLeadId(), r);
        }

        List<Account> accountUpdates = new List<Account>();
        List<pmdm__ProgramEngagement__c> engagements = new List<pmdm__ProgramEngagement__c>();
        for (Lead l : leads) {
            Database.LeadConvertResult r = resultByLead.get(l.Id);
            Account acct = new Account(Id = r.getAccountId());
            for (String f : copyFields) {
                Object v = l.get(f);
                if (v != null && v != false) {
                    acct.put(f.removeEnd('__c') + '__pc', v);
                }
            }
            if (l.RTS_Date_of_Birth__c != null) {
                acct.put('PersonBirthdate', l.RTS_Date_of_Birth__c);
            }
            accountUpdates.add(acct);
            engagements.add(new pmdm__ProgramEngagement__c(
                pmdm__Program__c = l.RTS_Cohort__r.PMM_Cohort__r.pmdm__Program__c,
                pmdm__ProgramCohort__c = l.RTS_Cohort__r.PMM_Cohort__c,
                pmdm__Contact__c = r.getContactId(),
                pmdm__Role__c = 'Client',
                pmdm__Stage__c = 'Enrolled',
                pmdm__ApplicationDate__c = l.CreatedDate.date(),
                pmdm__StartDate__c = l.RTS_Cohort__r.Start_Date__c
            ));
        }
        update accountUpdates;
        insert engagements;

        Map<Id, Id> out = new Map<Id, Id>();
        for (Integer i = 0; i < leads.size(); i++) {
            out.put(leads[i].Id, engagements[i].Id);
        }
        return out;
    }

    /** RTS fields that exist on both Lead (__c) and Person Account (__pc), except the cohort lookup's derived fields. */
    @TestVisible
    static List<String> copyableFields() {
        Map<String, Schema.SObjectField> leadFields = Schema.SObjectType.Lead.fields.getMap();
        Map<String, Schema.SObjectField> acctFields = Schema.SObjectType.Account.fields.getMap();
        List<String> out = new List<String>();
        for (String name : leadFields.keySet()) {
            Schema.DescribeFieldResult d = leadFields.get(name).getDescribe();
            if (!d.getName().startsWith('RTS_') || !d.isCustom()) continue;
            String pc = d.getName().removeEnd('__c') + '__pc';
            if (acctFields.containsKey(pc.toLowerCase()) && acctFields.get(pc.toLowerCase()).getDescribe().isUpdateable()) {
                out.add(d.getName());
            }
        }
        out.sort();
        return out;
    }

    /**
     * Before insert on Service Participant: when no schedule is set, use the schedule for the same
     * Service whose Program Cohort matches the engagement's cohort.
     */
    public static void linkSchedules(List<pmdm__ServiceParticipant__c> participants) {
        Set<Id> engagementIds = new Set<Id>();
        for (pmdm__ServiceParticipant__c p : participants) {
            if (p.pmdm__ServiceSchedule__c == null && p.pmdm__ProgramEngagement__c != null && p.pmdm__Service__c != null) {
                engagementIds.add(p.pmdm__ProgramEngagement__c);
            }
        }
        if (engagementIds.isEmpty()) {
            return;
        }
        Map<Id, Id> cohortByEngagement = new Map<Id, Id>();
        for (pmdm__ProgramEngagement__c e : [SELECT Id, pmdm__ProgramCohort__c FROM pmdm__ProgramEngagement__c WHERE Id IN :engagementIds]) {
            if (e.pmdm__ProgramCohort__c != null) cohortByEngagement.put(e.Id, e.pmdm__ProgramCohort__c);
        }
        Map<String, Id> scheduleByKey = new Map<String, Id>();
        for (pmdm__ServiceSchedule__c s : [SELECT Id, pmdm__Service__c, Program_Cohort__c FROM pmdm__ServiceSchedule__c
                                           WHERE Program_Cohort__c IN :cohortByEngagement.values() ORDER BY CreatedDate]) {
            String key = s.pmdm__Service__c + ':' + s.Program_Cohort__c;
            if (!scheduleByKey.containsKey(key)) scheduleByKey.put(key, s.Id);
        }
        for (pmdm__ServiceParticipant__c p : participants) {
            Id cohort = cohortByEngagement.get(p.pmdm__ProgramEngagement__c);
            if (p.pmdm__ServiceSchedule__c == null && cohort != null) {
                p.pmdm__ServiceSchedule__c = scheduleByKey.get(p.pmdm__Service__c + ':' + cohort);
            }
        }
    }
}
