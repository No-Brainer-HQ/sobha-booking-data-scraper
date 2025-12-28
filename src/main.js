/**
 * SOBHA BOOKINGS SCRAPER - DIRECT API APPROACH
 * =============================================
 * Enterprise-grade scraper for Sobha Partner Portal bookings data
 * Built for BARACA Life Capital Real Estate
 *
 * Author: BARACA Engineering Team
 * Version: 1.0.1
 * License: Proprietary
 */

import { Actor, Dataset } from 'apify';

class SobhaBookingsAPI {
    constructor(config) {
        this.config = {
            cookieHeader: config.cookieHeader || '',
            auraToken: config.auraToken || '',
            auraContext: config.auraContext || '',
            baseUrl: 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura',
        };
    }

    generateRequestId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }

    async getBookings(year = 2025) {
        console.log(`\n🚀 Fetching bookings for year ${year}...`);

        const url = `${this.config.baseUrl}?r=18&aura.ApexAction.execute=1`;

        const message = {
            actions: [
                {
                    id: '197;a',
                    descriptor: 'aura://ApexActionController/ACTION$execute',
                    callingDescriptor: 'UNKNOWN',
                    params: {
                        namespace: '',
                        classname: 'SitevisitChartController',
                        method: 'getBookingDataDetails',
                        params: { selectedYear: year },
                        cacheable: false,
                        isContinuation: false,
                    },
                },
            ],
        };

        const formData = new URLSearchParams();
        formData.append('message', JSON.stringify(message));
        formData.append('aura.context', this.config.auraContext);
        formData.append('aura.pageURI', '/partnerportal/s/performance');
        formData.append('aura.token', this.config.auraToken);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Cookie: this.config.cookieHeader,
                Origin: 'https://www.sobhapartnerportal.com',
                Referer: 'https://www.sobhapartnerportal.com/partnerportal/s/performance',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                'X-SFDC-Request-Id': this.generateRequestId(),
                'X-SFDC-LDS-Endpoints': 'ApexActionController.execute:SitevisitChartController.getBookingDataDetails',
            },
            body: formData.toString(),
        });

        console.log(`📥 API Response Status: ${response.status}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json();

        if (data?.actions?.[0]?.state === 'SUCCESS') {
            const returnValue = data.actions[0].returnValue?.returnValue ?? data.actions[0].returnValue;
            if (Array.isArray(returnValue)) {
                console.log(`✅ SUCCESS! Found ${returnValue.length} bookings for ${year}`);
                return returnValue;
            }
            console.log('⚠️ Unexpected return value structure');
            console.log('Return value type:', typeof returnValue);
            return [];
        }

        if (data?.actions?.[0]?.state === 'ERROR') {
            const error = data.actions[0].error;
            console.log('❌ API Error:', JSON.stringify(error, null, 2));
            const errStr = JSON.stringify(error);
            if (errStr.includes('expired') || errStr.includes('INVALID_SESSION_ID')) {
                throw new Error('SESSION_EXPIRED: Please update authentication tokens');
            }
            throw new Error(`API Error: ${errStr}`);
        }

        console.log('⚠️ Unexpected response structure');
        console.log('Full response:', JSON.stringify(data, null, 2).substring(0, 800));
        return [];
    }

    parseBookings(rawBookings) {
        if (!rawBookings || !Array.isArray(rawBookings)) return [];

        console.log(`\n📊 Parsing ${rawBookings.length} bookings...`);

        return rawBookings.map((booking, index) => {
            const project = booking.Project__r?.Name || '';
            const unitName = booking.Unit__r?.Name || '';
            const bedrooms = booking.Unit__r?.No_of_Bedroom__c || '';
            const area = booking.Unit__r?.Chargeable_Area__c || 0;
            const towerType = booking.Unit__r?.Tower__r?.Tower_Type__c || '';
            const opportunityName = booking.Opportunity__r?.Name || '';

            const salesManager = `${booking.Sales_Managers__r?.FirstName || ''} ${booking.Sales_Managers__r?.LastName || ''}`.trim();
            const salesHead = `${booking.Sales_Head__r?.FirstName || ''} ${booking.Sales_Head__r?.LastName || ''}`.trim();

            const parsed = {
                bookingId: booking.Name || '',
                salesforceId: booking.Id || '',

                customerName: booking.Primary_Applicant_Name__c || '',
                nationality: booking.Nationality_V2__c || '',

                project,
                unitNumber: unitName,
                towerName: booking.Tower_Name__c || '',
                towerType,
                bedrooms,
                areaSqFt: area,

                agreementValue: booking.Agreement_Value__c || 0,
                dldAmount: booking.DLD_Amount__c || 0,
                dldPercentage: booking.DLD_Percentage__c || '',
                paidPercentage: booking.Paid_Percentage__c || 0,

                status: booking.Status__c || '',
                currentStatus: booking.Current_Status__c || '',
                signedStatus: booking.Signed_Status__c || '',
                preRegistration: booking.Pre_registration__c || '',

                spaExecuted: booking.SPA_Executed__c || '',
                spaExecutedDate: booking.SPA_Executed_Date__c || '',

                bookingDate: booking.Booking_Date__c || '',
                signedDate: booking.Signed_Date__c || '',

                salesManager,
                salesHead,

                channelPartner: booking.Channel_Partner__r?.Name || '',
                contactPerson: booking.Channel_Partner_Contact_Person__c || '',

                opportunityName,
                opportunityId: booking.Opportunity__c || '',

                extractedAt: new Date().toISOString(),
            };

            if (index < 3) console.log(`  Booking ${index + 1}: ${parsed.bookingId} - ${parsed.customerName} - ${parsed.unitNumber}`);
            return parsed;
        });
    }
}

Actor.main(async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     SOBHA BOOKINGS SCRAPER - BARACA ENTERPRISE          ║');
    console.log('║     Direct API Approach - Production Ready               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const input = (await Actor.getInput()) || {};
    const { cookieHeader, auraToken, auraContext, years = [2025], maxResults = 10000 } = input;

    if (!cookieHeader || !auraToken || !auraContext) {
        await Actor.setValue('SUMMARY', {
            success: false,
            error: 'Missing required authentication parameters',
            requiredInputs: ['cookieHeader', 'auraToken', 'auraContext'],
            timestamp: new Date().toISOString(),
        });
        return;
    }

    console.log('📋 Configuration:');
    console.log(`  ✅ Cookie header: Set (${cookieHeader.length} chars)`);
    console.log(`  ✅ Aura token: Set`);
    console.log(`  ✅ Aura context: Set`);
    console.log(`  📅 Years to scrape: ${years.join(', ')}`);
    console.log(`  📊 Max results: ${maxResults}`);

    const api = new SobhaBookingsAPI({ cookieHeader, auraToken, auraContext });

    let allBookings = [];
    const successfulYears = [];
    const failedYears = [];

    for (const year of years) {
        try {
            console.log(`\n${'─'.repeat(50)}`);
            console.log(`📅 Processing year: ${year}`);
            console.log('─'.repeat(50));

            const raw = await api.getBookings(year);

            if (raw && raw.length > 0) {
                const parsed = api.parseBookings(raw);
                parsed.forEach((b) => (b.scrapedYear = year));
                allBookings = allBookings.concat(parsed);
                successfulYears.push({ year, count: parsed.length });
                console.log(`✅ Year ${year}: ${parsed.length} bookings extracted`);
            } else {
                successfulYears.push({ year, count: 0 });
                console.log(`⚠️ Year ${year}: No bookings found`);
            }

            if (years.indexOf(year) < years.length - 1) {
                await new Promise((r) => setTimeout(r, 2000));
            }
        } catch (e) {
            failedYears.push({ year, error: e.message });
            console.error(`❌ Failed year ${year}: ${e.message}`);
        }
    }

    if (allBookings.length > maxResults) {
        console.log(`\n⚠️ Limiting results from ${allBookings.length} to ${maxResults}`);
        allBookings = allBookings.slice(0, maxResults);
    }

    const summary = {
        totalBookings: allBookings.length,
        yearBreakdown: successfulYears,
        failedYears,
        projectBreakdown: {},
        statusBreakdown: {},
        financials: { totalAgreementValue: 0, totalDLDAmount: 0, averageAgreementValue: 0 },
    };

    allBookings.forEach((b) => {
        const project = b.project || 'Unknown';
        summary.projectBreakdown[project] = (summary.projectBreakdown[project] || 0) + 1;

        const status = b.status || 'Unknown';
        summary.statusBreakdown[status] = (summary.statusBreakdown[status] || 0) + 1;

        summary.financials.totalAgreementValue += b.agreementValue || 0;
        summary.financials.totalDLDAmount += b.dldAmount || 0;
    });

    if (allBookings.length > 0) {
        summary.financials.averageAgreementValue = summary.financials.totalAgreementValue / allBookings.length;
    }

    await Actor.setValue('SUMMARY', {
        success: true,
        summary,
        metadata: {
            scrapedAt: new Date().toISOString(),
            scrapedYears: years,
            method: 'direct_aura_api',
            version: '1.0.1',
        },
    });

    // ✅ FIX: smaller batches to avoid 9MB dataset item limit
    const BATCH = 100; // if still too big: 50 or 25
    for (let i = 0; i < allBookings.length; i += BATCH) {
        await Dataset.pushData(allBookings.slice(i, i + BATCH));
    }

    console.log('\n✅ Bookings saved as dataset rows. Summary saved to Key-Value Store as SUMMARY.');
});
