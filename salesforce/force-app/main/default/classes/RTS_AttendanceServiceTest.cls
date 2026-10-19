@IsTest
private class RTS_AttendanceServiceTest {

    @TestSetup
    static void setup() {
        Contact c = new Contact(LastName = 'ZZTEST Attendance');
        insert c;
        pmdm__Program__c program = new pmdm__Program__c(Name = 'ZZTEST Program', pmdm__Status__c = 'Active');
        insert program;
        pmdm__Service__c service = new pmdm__Service__c(Name = 'ZZTEST Service', pmdm__Program__c = program.Id, pmdm__Status__c = 'Active');
        insert service;
        insert new pmdm__ProgramEngagement__c(
            Name = 'ZZTEST Engagement', pmdm__Program__c = program.Id, pmdm__Contact__c = c.Id, pmdm__Stage__c = 'Active'
        );
    }

    @IsTest
    static void calculatesHoursDefaultsModeAndRollsUp() {
        pmdm__ProgramEngagement__c eng = [SELECT Id, pmdm__Contact__c FROM pmdm__ProgramEngagement__c LIMIT 1];
        pmdm__Service__c service = [SELECT Id FROM pmdm__Service__c LIMIT 1];

        pmdm__ServiceSchedule__c schedule = new pmdm__ServiceSchedule__c(
            Name = 'ZZTEST Remote', pmdm__Service__c = service.Id, Delivery_Mode__c = 'Remote'
        );
        insert schedule;
        Datetime start = Datetime.newInstance(2026, 11, 5, 10, 0, 0);
        pmdm__ServiceSession__c session = new pmdm__ServiceSession__c(
            Name = 'ZZTEST Session', pmdm__ServiceSchedule__c = schedule.Id,
            pmdm__SessionStart__c = start, pmdm__SessionEnd__c = start.addHours(6)
        );
        insert session;
        System.assertEquals('Remote', [SELECT Delivery_Mode__c FROM pmdm__ServiceSession__c WHERE Id = :session.Id].Delivery_Mode__c);

        Test.startTest();
        pmdm__ServiceDelivery__c d1 = new pmdm__ServiceDelivery__c(
            Name = 'ZZTEST D1', pmdm__Service__c = service.Id, pmdm__ServiceSession__c = session.Id,
            pmdm__ProgramEngagement__c = eng.Id, pmdm__Contact__c = eng.pmdm__Contact__c,
            pmdm__AttendanceStatus__c = 'Present', Time_In__c = start, Time_Out__c = start.addMinutes(330)
        );
        pmdm__ServiceDelivery__c d2 = new pmdm__ServiceDelivery__c(
            Name = 'ZZTEST D2', pmdm__Service__c = service.Id, pmdm__ProgramEngagement__c = eng.Id,
            pmdm__Contact__c = eng.pmdm__Contact__c, pmdm__AttendanceStatus__c = 'Present', pmdm__Quantity__c = 2,
            Attendance_Mode__c = 'In Person'
        );
        insert new List<pmdm__ServiceDelivery__c>{ d1, d2 };

        d1 = [SELECT pmdm__Quantity__c, Attendance_Mode__c FROM pmdm__ServiceDelivery__c WHERE Id = :d1.Id];
        System.assertEquals(5.5, d1.pmdm__Quantity__c);
        System.assertEquals('Remote', d1.Attendance_Mode__c);
        System.assertEquals(7.5, [SELECT Hours_Attended__c FROM pmdm__ProgramEngagement__c WHERE Id = :eng.Id].Hours_Attended__c);

        d2.pmdm__Quantity__c = 3;
        update d2;
        System.assertEquals(8.5, [SELECT Hours_Attended__c FROM pmdm__ProgramEngagement__c WHERE Id = :eng.Id].Hours_Attended__c);

        delete d1;
        System.assertEquals(3, [SELECT Hours_Attended__c FROM pmdm__ProgramEngagement__c WHERE Id = :eng.Id].Hours_Attended__c);
        Test.stopTest();
    }

    @IsTest
    static void remoteDaysMarkSessionsRemote() {
        pmdm__Service__c service = [SELECT Id FROM pmdm__Service__c LIMIT 1];
        pmdm__ServiceSchedule__c schedule = new pmdm__ServiceSchedule__c(
            Name = 'ZZTEST Hybrid', pmdm__Service__c = service.Id, Delivery_Mode__c = 'In Person', Remote_Days__c = 'Thursday;Friday'
        );
        insert schedule;
        Datetime wed = Datetime.newInstance(2026, 11, 4, 10, 0, 0);   // Wednesday
        Datetime thu = Datetime.newInstance(2026, 11, 5, 10, 0, 0);   // Thursday
        insert new List<pmdm__ServiceSession__c>{
            new pmdm__ServiceSession__c(Name = 'Wed', pmdm__ServiceSchedule__c = schedule.Id, pmdm__SessionStart__c = wed, pmdm__SessionEnd__c = wed.addHours(6)),
            new pmdm__ServiceSession__c(Name = 'Thu', pmdm__ServiceSchedule__c = schedule.Id, pmdm__SessionStart__c = thu, pmdm__SessionEnd__c = thu.addHours(6))
        };
        Map<String, String> modes = new Map<String, String>();
        for (pmdm__ServiceSession__c s : [SELECT Name, Delivery_Mode__c FROM pmdm__ServiceSession__c WHERE pmdm__ServiceSchedule__c = :schedule.Id]) {
            modes.put(s.Name, s.Delivery_Mode__c);
        }
        System.assertEquals('In Person', modes.get('Wed'));
        System.assertEquals('Remote', modes.get('Thu'));
    }
}
