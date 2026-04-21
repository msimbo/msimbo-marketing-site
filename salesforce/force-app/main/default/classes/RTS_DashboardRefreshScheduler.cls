public with sharing class RTS_DashboardRefreshScheduler implements Schedulable {

    @TestVisible
    private static final String DASHBOARD_DEVELOPER_NAME = 'RTS_Cohort_1_Recruitment_Tracker';

    public void execute(SchedulableContext sc) {
        Id dashboardId = findDashboardId();
        if (dashboardId != null) {
            refreshDashboard(dashboardId);
        }
    }

    @TestVisible
    private static Id findDashboardId() {
        List<Dashboard> dashboards = [
            SELECT Id
            FROM Dashboard
            WHERE DeveloperName = :DASHBOARD_DEVELOPER_NAME
            LIMIT 1
        ];
        return dashboards.isEmpty() ? null : dashboards[0].Id;
    }

    @TestVisible
    private static Integer refreshDashboard(Id dashboardId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() + '/services/data/v60.0/analytics/dashboards/' + dashboardId + '/results');
        req.setMethod('PUT');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        req.setHeader('Content-Type', 'application/json');
        req.setBody('{}');

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            System.debug(LoggingLevel.ERROR, 'Dashboard refresh failed: ' + res.getStatusCode() + ' ' + res.getBody());
        }
        return res.getStatusCode();
    }
}
