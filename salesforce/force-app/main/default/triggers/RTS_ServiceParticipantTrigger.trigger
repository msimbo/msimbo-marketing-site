trigger RTS_ServiceParticipantTrigger on pmdm__ServiceParticipant__c (before insert) {
    RTS_EnrollmentService.linkSchedules(Trigger.new);
}
