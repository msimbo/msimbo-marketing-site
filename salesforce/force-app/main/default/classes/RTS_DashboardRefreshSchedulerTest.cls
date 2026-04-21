@isTest
private class RTS_DashboardRefreshSchedulerTest {

    private class RefreshMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"attributes":{"dashboardId":"01ZUV000003a8jh2AA"}}');
            return res;
        }
    }

    @isTest
    static void refreshDashboard_returnsStatusCode() {
        Test.setMock(HttpCalloutMock.class, new RefreshMock());

        Test.startTest();
        Id fakeId = '01ZUV000003a8jh2AA';
        Integer statusCode = RTS_DashboardRefreshScheduler.refreshDashboard(fakeId);
        Test.stopTest();

        System.assertEquals(200, statusCode);
    }

    @isTest
    static void findDashboardId_doesNotThrow() {
        Test.startTest();
        RTS_DashboardRefreshScheduler.findDashboardId();
        Test.stopTest();
    }

    @isTest
    static void schedule_canBeScheduled() {
        Test.setMock(HttpCalloutMock.class, new RefreshMock());

        Test.startTest();
        String cron = '0 0 1 1 1 ? 2099';
        String jobId = System.schedule('RTS Dashboard Refresh Test', cron, new RTS_DashboardRefreshScheduler());
        Test.stopTest();

        CronTrigger ct = [SELECT Id, CronExpression FROM CronTrigger WHERE Id = :jobId];
        System.assertEquals(cron, ct.CronExpression);
    }
}
