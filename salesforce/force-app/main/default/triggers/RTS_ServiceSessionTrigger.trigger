trigger RTS_ServiceSessionTrigger on pmdm__ServiceSession__c (before insert) {
    RTS_AttendanceService.defaultSessionMode(Trigger.new);
}
