@IsTest
private class RTS_EnrollmentServiceTest {

    @TestSetup
    static void setup() {
        pmdm__Program__c program = new pmdm__Program__c(Name = 'ZZTEST Program', pmdm__Status__c = 'Active');
        insert program;
        pmdm__ProgramCohort__c cohort = new pmdm__ProgramCohort__c(
            Name = 'ZZTEST Cohort', pmdm__Program__c = program.Id, pmdm__Status__c = 'Planned',
            pmdm__StartDate__c = Date.newInstance(2026, 11, 2)
        );
        insert cohort;
        pmdm__Service__c service = new pmdm__Service__c(Name = 'ZZTEST Foundations', pmdm__Program__c = program.Id, pmdm__Status__c = 'Active');
        insert service;
        insert new pmdm__ServiceSchedule__c(Name = 'ZZTEST Foundations - Cohort', pmdm__Service__c = service.Id, Program_Cohort__c = cohort.Id);
        insert new RTS_Cohort__c(Name = 'ZZTEST RTS Cohort', PMM_Cohort__c = cohort.Id, Start_Date__c = Date.newInstance(2026, 11, 2));
    }

    static Lead newLead(String email) {
        RTS_Cohort__c rc = [SELECT Id FROM RTS_Cohort__c LIMIT 1];
        Id rtsApplicant = Schema.SObjectType.Lead.getRecordTypeInfosByDeveloperName().get('RTS_Applicant').getRecordTypeId();
        return new Lead(RecordTypeId = rtsApplicant, FirstName = 'Zz', LastName = 'ZZTEST Enrol', Company = 'N/A', Email = email,
            RTS_Cohort__c = rc.Id, RTS_Date_of_Birth__c = Date.newInstance(1990, 1, 2), RTS_Zip_Code__c = '02119');
    }

    @IsTest
    static void convertsToPersonAccountAndEnrols() {
        Lead l = newLead('zztest.enrol@example.com');
        insert l;
        Test.startTest();
        Map<Id, Id> result = RTS_EnrollmentService.enrol(new List<Id>{ l.Id });
        Test.stopTest();

        Lead after = [SELECT IsConverted, ConvertedAccountId, ConvertedOpportunityId FROM Lead WHERE Id = :l.Id];
        System.assert(after.IsConverted);
        System.assertEquals(null, after.ConvertedOpportunityId);
        Account a = [SELECT IsPersonAccount, PersonBirthdate, RTS_Zip_Code__pc FROM Account WHERE Id = :after.ConvertedAccountId];
        System.assert(a.IsPersonAccount, 'should be a Person Account');
        System.assertEquals(Date.newInstance(1990, 1, 2), a.PersonBirthdate);
        System.assertEquals('02119', a.RTS_Zip_Code__pc);

        pmdm__ProgramEngagement__c e = [SELECT pmdm__Stage__c, pmdm__ProgramCohort__r.Name, pmdm__StartDate__c FROM pmdm__ProgramEngagement__c WHERE Id = :result.get(l.Id)];
        System.assertEquals('Enrolled', e.pmdm__Stage__c);
        System.assertEquals('ZZTEST Cohort', e.pmdm__ProgramCohort__r.Name);
        System.assertEquals(Date.newInstance(2026, 11, 2), e.pmdm__StartDate__c);
    }

    @IsTest
    static void reusesExistingPersonAccountByEmail() {
        Id personType = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('PersonAccount').getRecordTypeId();
        Account existing = new Account(RecordTypeId = personType, FirstName = 'Zz', LastName = 'ZZTEST Existing', PersonEmail = 'zztest.again@example.com');
        insert existing;
        Lead l = newLead('zztest.again@example.com');
        insert l;
        Test.startTest();
        RTS_EnrollmentService.enrol(new List<Id>{ l.Id });
        Test.stopTest();
        System.assertEquals(existing.Id, [SELECT ConvertedAccountId FROM Lead WHERE Id = :l.Id].ConvertedAccountId);
    }

    @IsTest
    static void invocableRunsAsQueueable() {
        Lead l = newLead('zztest.queue@example.com');
        insert l;
        Test.startTest();
        RTS_EnrollmentService.enrolAsync(new List<Id>{ l.Id });
        Test.stopTest();
        System.assert([SELECT IsConverted FROM Lead WHERE Id = :l.Id].IsConverted);
    }

    @IsTest
    static void leavesTaskWhenCohortHasNoPmmCohort() {
        RTS_Cohort__c unlinked = new RTS_Cohort__c(Name = 'ZZTEST Unlinked Cohort');
        insert unlinked;
        Lead l = newLead('zztest.unlinked@example.com');
        l.RTS_Cohort__c = unlinked.Id;
        insert l;
        Test.startTest();
        RTS_EnrollmentService.enrolAsync(new List<Id>{ l.Id });
        Test.stopTest();
        System.assert(![SELECT IsConverted FROM Lead WHERE Id = :l.Id].IsConverted);
        System.assertEquals(1, [SELECT COUNT() FROM Task WHERE WhoId = :l.Id AND Subject LIKE 'Enrol by hand%']);
    }

    @IsTest
    static void leavesTaskWhenConversionFails() {
        Lead l = newLead('zztest.fail@example.com');
        insert l;
        RTS_EnrollmentService.flagNotEnrolled(new List<Id>{ l.Id }, new Set<Id>(), 'boom');
        Task t = [SELECT Description FROM Task WHERE WhoId = :l.Id AND Subject LIKE 'Enrol by hand%'];
        System.assert(t.Description.contains('boom'));
    }

    @IsTest
    static void linksParticipantsToCohortSchedule() {
        pmdm__ProgramCohort__c cohort = [SELECT Id, pmdm__Program__c FROM pmdm__ProgramCohort__c LIMIT 1];
        pmdm__Service__c service = [SELECT Id FROM pmdm__Service__c LIMIT 1];
        pmdm__ServiceSchedule__c schedule = [SELECT Id FROM pmdm__ServiceSchedule__c LIMIT 1];
        Contact c = new Contact(LastName = 'ZZTEST Participant');
        insert c;
        pmdm__ProgramEngagement__c e = new pmdm__ProgramEngagement__c(
            pmdm__Program__c = cohort.pmdm__Program__c, pmdm__ProgramCohort__c = cohort.Id, pmdm__Contact__c = c.Id, pmdm__Stage__c = 'Enrolled'
        );
        insert e;
        // RTS Flow 9 may already have created the participant; either way it must be on the schedule.
        List<pmdm__ServiceParticipant__c> existing = [SELECT pmdm__ServiceSchedule__c FROM pmdm__ServiceParticipant__c WHERE pmdm__ProgramEngagement__c = :e.Id];
        if (existing.isEmpty()) {
            insert new pmdm__ServiceParticipant__c(pmdm__ProgramEngagement__c = e.Id, pmdm__Contact__c = c.Id, pmdm__Service__c = service.Id, pmdm__Status__c = 'Enrolled');
            existing = [SELECT pmdm__ServiceSchedule__c FROM pmdm__ServiceParticipant__c WHERE pmdm__ProgramEngagement__c = :e.Id];
        }
        System.assertEquals(schedule.Id, existing[0].pmdm__ServiceSchedule__c);
    }
}
