/**
 * Hybrid attendance on PMM Service Deliveries.
 * - Quantity (hours) is calculated from Time In / Time Out when both are set.
 * - Attendance Mode defaults from the session's Delivery Mode, which defaults from its schedule
 *   (Remote on the schedule's Remote Days, otherwise the schedule's Delivery Mode).
 * - Program Engagement Hours Attended is the sum of its deliveries' Quantity.
 */
public with sharing class RTS_AttendanceService {

    public static void applyDefaults(List<pmdm__ServiceDelivery__c> deliveries) {
        Set<Id> sessionIds = new Set<Id>();
        for (pmdm__ServiceDelivery__c d : deliveries) {
            if (d.Time_In__c != null && d.Time_Out__c != null && d.Time_Out__c > d.Time_In__c) {
                Decimal hours = (d.Time_Out__c.getTime() - d.Time_In__c.getTime()) / 3600000.0;
                d.pmdm__Quantity__c = hours.setScale(2);
            }
            if (d.Attendance_Mode__c == null && d.pmdm__ServiceSession__c != null) {
                sessionIds.add(d.pmdm__ServiceSession__c);
            }
        }
        if (sessionIds.isEmpty()) {
            return;
        }
        Map<Id, pmdm__ServiceSession__c> sessions = new Map<Id, pmdm__ServiceSession__c>(
            [SELECT Id, Delivery_Mode__c FROM pmdm__ServiceSession__c WHERE Id IN :sessionIds]
        );
        for (pmdm__ServiceDelivery__c d : deliveries) {
            pmdm__ServiceSession__c s = sessions.get(d.pmdm__ServiceSession__c);
            if (d.Attendance_Mode__c == null && s != null) {
                d.Attendance_Mode__c = s.Delivery_Mode__c;
            }
        }
    }

    public static void defaultSessionMode(List<pmdm__ServiceSession__c> sessions) {
        Set<Id> scheduleIds = new Set<Id>();
        for (pmdm__ServiceSession__c s : sessions) {
            if (s.Delivery_Mode__c == null && s.pmdm__ServiceSchedule__c != null) {
                scheduleIds.add(s.pmdm__ServiceSchedule__c);
            }
        }
        if (scheduleIds.isEmpty()) {
            return;
        }
        Map<Id, pmdm__ServiceSchedule__c> schedules = new Map<Id, pmdm__ServiceSchedule__c>(
            [SELECT Id, Delivery_Mode__c, Remote_Days__c FROM pmdm__ServiceSchedule__c WHERE Id IN :scheduleIds]
        );
        for (pmdm__ServiceSession__c s : sessions) {
            pmdm__ServiceSchedule__c sched = schedules.get(s.pmdm__ServiceSchedule__c);
            if (s.Delivery_Mode__c != null || sched == null) {
                continue;
            }
            String weekday = s.pmdm__SessionStart__c == null ? null : s.pmdm__SessionStart__c.format('EEEE', 'America/New_York');
            Boolean remoteDay = weekday != null && sched.Remote_Days__c != null
                && sched.Remote_Days__c.split(';').contains(weekday);
            s.Delivery_Mode__c = remoteDay ? 'Remote' : sched.Delivery_Mode__c;
        }
    }

    public static void rollUpHours(List<pmdm__ServiceDelivery__c> deliveries, Map<Id, pmdm__ServiceDelivery__c> oldMap) {
        Set<Id> engagementIds = new Set<Id>();
        for (pmdm__ServiceDelivery__c d : deliveries) {
            pmdm__ServiceDelivery__c old = oldMap == null ? null : oldMap.get(d.Id);
            if (old != null
                    && old.pmdm__Quantity__c == d.pmdm__Quantity__c
                    && old.pmdm__ProgramEngagement__c == d.pmdm__ProgramEngagement__c
                    && !Trigger.isDelete) {
                continue;
            }
            if (d.pmdm__ProgramEngagement__c != null) {
                engagementIds.add(d.pmdm__ProgramEngagement__c);
            }
            if (old != null && old.pmdm__ProgramEngagement__c != null) {
                engagementIds.add(old.pmdm__ProgramEngagement__c);
            }
        }
        if (engagementIds.isEmpty()) {
            return;
        }
        Map<Id, Decimal> totals = new Map<Id, Decimal>();
        for (Id engagementId : engagementIds) {
            totals.put(engagementId, 0);
        }
        for (AggregateResult ar : [
            SELECT pmdm__ProgramEngagement__c eng, SUM(pmdm__Quantity__c) hrs
            FROM pmdm__ServiceDelivery__c
            WHERE pmdm__ProgramEngagement__c IN :engagementIds
            GROUP BY pmdm__ProgramEngagement__c
        ]) {
            Decimal hrs = (Decimal) ar.get('hrs');
            totals.put((Id) ar.get('eng'), hrs == null ? 0 : hrs);
        }
        List<pmdm__ProgramEngagement__c> updates = new List<pmdm__ProgramEngagement__c>();
        for (Id engagementId : totals.keySet()) {
            updates.add(new pmdm__ProgramEngagement__c(Id = engagementId, Hours_Attended__c = totals.get(engagementId)));
        }
        update updates;
    }
}
