trigger RTS_ServiceDeliveryTrigger on pmdm__ServiceDelivery__c (
    before insert, before update, after insert, after update, after delete, after undelete
) {
    if (Trigger.isBefore) {
        RTS_AttendanceService.applyDefaults(Trigger.new);
    } else {
        RTS_AttendanceService.rollUpHours(Trigger.isDelete ? Trigger.old : Trigger.new, Trigger.oldMap);
    }
}
