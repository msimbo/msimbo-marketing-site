# Web-to-Lead Field ID Reference

Use these Field IDs as the `name` attribute on HTML form inputs when posting to the Salesforce Web-to-Lead endpoint.

**Endpoint:** `https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8`
**Org ID (`oid` hidden field):** `00D50000000cxiS`
**Return URL suggestion:** `https://msimbo.org/thank-you-application.html`

## Standard fields (use these names as-is)

| Form field | HTML `name` |
|---|---|
| First Name | `first_name` |
| Last Name | `last_name` |
| Email | `email` |
| Phone | `phone` |
| Description (motivation) | `description` |

## Custom Lead fields (use the Field IDs below)

| API Name | Field ID | Label |
|---|---|---|
| RTS_Assessment_Date__c | 00NUV00001BlCa9 | Assessment Date |
| RTS_Assessment_Notes__c | 00NUV00001BlCaA | Assessment Notes |
| RTS_Assessment_Status__c | 00NUV00001BlCaB | Assessment Status |
| RTS_CBST2_Score__c | 00NUV00001BlCaC | CBST2 Score |
| RTS_CCAT_Score__c | 00NUV00001BlCaD | CCAT Score |
| RTS_CLIK_Score__c | 00NUV00001BlCaE | CLIK Score |
| RTS_Childcare_Barrier__c | 00NUV00001BlCaI | Childcare Barrier |
| RTS_Childcare_Granted__c | 00NUV00001BlCaJ | Childcare Granted |
| RTS_CM_Interview_DateTime__c | 00NUV00001BlCaF | Case Manager Interview Date/Time |
| RTS_CM_Interview_Notes__c | 00NUV00001BlCaG | Case Manager Interview Notes |
| RTS_CM_Interview_Outcome__c | 00NUV00001BlCaH | Case Manager Interview Outcome |
| RTS_Cohort__c | 00NUV00001BlCaK | Cohort (lookup) |
| RTS_Daytime_Available__c | 00NUV00001BlCaL | Available Daytime (M-W) |
| RTS_Decision__c | 00NUV00001BlCaO | Decision |
| RTS_Decision_Date__c | 00NUV00001BlCaM | Decision Date |
| RTS_Decision_Reason__c | 00NUV00001BlCaN | Decision Reason |
| RTS_Education_Level__c | 00NUV00001BlCaP | Highest Education |
| RTS_Emergency_Fund_Granted__c | 00NUV00001BlCaQ | Emergency Fund Granted |
| RTS_Employment_Status__c | 00NUV00001BlCaR | Employment Status |
| RTS_Instructor_Interview_DateTime__c | 00NUV00001BlCaS | Instructor Interview Date/Time |
| RTS_Instructor_Interview_Notes__c | 00NUV00001BlCaT | Instructor Interview Notes |
| RTS_Instructor_Interview_Outcome__c | 00NUV00001BlCaU | Instructor Interview Outcome |
| RTS_Internet_Barrier__c | 00NUV00001BlCaV | Internet/Device Barrier |
| RTS_Laptop_Granted__c | 00NUV00001BlCaW | Laptop Granted |
| RTS_Meals_Granted__c | 00NUV00001BlCaX | Meals Granted |
| RTS_Motivation__c | 00NUV00001BlCaY | Motivation Statement |
| RTS_Neighborhood__c | 00NUV00001BlCaZ | Neighborhood |
| RTS_Offer_Response__c | 00NUV00001BlCab | Offer Response |
| RTS_Offer_Response_Date__c | 00NUV00001BlCaa | Offer Response Date |
| RTS_Offer_Sent_Date__c | 00NUV00001BlCac | Offer Sent Date |
| RTS_Primary_Language__c | 00NUV00001BlCad | Primary Language |
| RTS_Referral_Source__c | 00NUV00001BlCae | How Did You Hear |
| RTS_Transportation_Barrier__c | 00NUV00001BlCaf | Transportation Barrier |
| RTS_Transportation_Granted__c | 00NUV00001BlCag | Transportation Granted |
| RTS_Wraparound_Notes__c | 00NUV00001BlCah | Wraparound Notes |
| RTS_Zip_Code__c | 00NUV00001BlCai | Zip Code |

## Fields the Application Form should collect

Only a subset of these are populated at application time. Most are filled in later by Coordinator, Instructor, or Case Manager. The Netlify proxy function should only POST these fields when forwarding an application:

| Purpose | API Name | Field ID |
|---|---|---|
| Applicant's first name | - | `first_name` |
| Applicant's last name | - | `last_name` |
| Applicant's email | - | `email` |
| Applicant's phone | - | `phone` |
| Zip code | RTS_Zip_Code__c | 00NUV00001BlCai |
| Neighborhood | RTS_Neighborhood__c | 00NUV00001BlCaZ |
| Employment status | RTS_Employment_Status__c | 00NUV00001BlCaR |
| Education level | RTS_Education_Level__c | 00NUV00001BlCaP |
| Primary language | RTS_Primary_Language__c | 00NUV00001BlCad |
| How did you hear about us | RTS_Referral_Source__c | 00NUV00001BlCae |
| Available M to W daytime | RTS_Daytime_Available__c | 00NUV00001BlCaL |
| Childcare barrier | RTS_Childcare_Barrier__c | 00NUV00001BlCaI |
| Transportation barrier | RTS_Transportation_Barrier__c | 00NUV00001BlCaf |
| Internet/device barrier | RTS_Internet_Barrier__c | 00NUV00001BlCaV |
| Motivation statement | RTS_Motivation__c | 00NUV00001BlCaY |
| Lead Source | - | `lead_source` = `RTS Website` |
