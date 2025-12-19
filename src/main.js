/**
 * SOBHA BOOKINGS SCRAPER - DIRECT API APPROACH
 * =============================================
 * Enterprise-grade scraper for Sobha Partner Portal bookings data
 * Built for BARACA Life Capital Real Estate
 *
 * Author: BARACA Engineering Team
 * Version: 1.1.0
 * License: Proprietary
 */

import { Actor } from 'apify';
import { Dataset } from 'crawlee';

// ============================================
// API CLIENT
// ============================================

class SobhaBookingsAPI {
    constructor(config) {
        this.config = {
            cookieHeader: config.cookieHeader || '',
            auraToken: config.auraToken || '',
            auraContext: config.auraContext || '',
            baseUrl: 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura'
        };
    }

    generateRequestId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async getBookings(year = 2025) {
        console.log(`\n🚀 Fetching bookings for year ${year}...`);

        const url = `${this.config.baseUrl}?aura.ApexAction.execute=1`;

        const message = {
            actions: [{
                id: '197;a',
                descriptor: 'aura://ApexActionController/ACTION$execute',
                callingDescriptor: 'UNKNOWN',
                params: {
                    namespace: '',
                    classname: 'SitevisitChartController',
                    method: 'getBookingDataDetails',
                    params: { selectedYear: year },
                    cacheable: false,
                    isContinuation: false
                }
            }]
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
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Cookie: this.config.cookieHeader,
                Origin: 'https://www.sobhapartnerportal.com',
                Referer: 'https://www.sobhapartnerportal.com/partnerportal/s/performance',
                'User-Agent': 'Mozilla/5.0',
                'X-SFDC-Request-Id': this.generateRequestId()
            },
            body: formData.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const action = data?.actions?.[0];

        if (action?.state !== 'SUCCESS') {
            throw new Error(`Aura error: ${JSON.stringify(action?.error)}`);
        }

        const rv = action.returnValue;
        const v = rv?.returnValue ?? rv;

        const candidates = [
            v,
            v?.records,
            v?.data,
            v?.result,
            v?.items,
            v?.bookingData,
            v?.details
        ];

        const arr = candidates.find(x => Array.isArray(x));

        if (!arr) {
            console.log('⚠️ SUCCESS but no array found');
            console.log('Return keys:', v && typeof v === 'object' ? Object.keys(v) : typeof v);
            return [];
        }

        console.log(`✅ SUCCESS! Found ${arr.length} bookings for ${year}`);
        return arr;
    }
}

// ============================================
// MAIN
// ============================================

Actor.main(async () => {
    const input = await Actor.getInput() || {};
    const { cookieHeader, auraToken, auraContext, years = [2025] } = input;

    if (!cookieHeader || !auraToken || !auraContext) {
        throw new Error('Missing cookieHeader / auraToken / auraContext');
    }

    const api = new SobhaBookingsAPI({ cookieHeader, auraToken, auraContext });

    let allBookings = [];

    for (const year of years) {
        const raw = await api.getBookings(year);

        const parsed = raw.map(b => ({
            bookingId: b.Name || '',
            salesforceId: b.Id || '',
            customerName: b.Primary_Applicant_Name__c || '',
            nationality: b.Nationality_V2__c || '',
            project: b.Project__r?.Name || '',
            unitNumber: b.Unit__r?.Name || '',
            towerName: b.Tower_Name__c || '',
            bedrooms: b.Unit__r?.No_of_Bedroom__c || '',
            areaSqFt: b.Unit__r?.Chargeable_Area__c || 0,
            agreementValue: b.Agreement_Value__c || 0,
            dldAmount: b.DLD_Amount__c || 0,
            status: b.Status__c || '',
            bookingDate: b.Booking_Date__c || '',
            scrapedYear: year,
            extractedAt: new Date().toISOString()
        }));

        allBookings.push(...parsed);
    }

    console.log(`\n📊 Total bookings parsed: ${allBookings.length}`);

    // ============================================
    // STORAGE STRATEGY (NO SIZE LIMIT ISSUES)
    // ============================================

    // 1) Store full dataset as file
    await Actor.setValue('bookings.json', allBookings);

    // 2) Push summary
    const summary = {
        totalBookings: allBookings.length,
        years,
        scrapedAt: new Date().toISOString()
    };

    await Dataset.pushData({
        type: 'summary',
        summary
    });

    // 3) Push per-booking rows (batched)
    const BATCH_SIZE = 500;
    for (let i = 0; i < allBookings.length; i += BATCH_SIZE) {
        await Dataset.pushData(allBookings.slice(i, i + BATCH_SIZE));
    }

    console.log('\n✅ SCRAPE COMPLETE');
    console.log('• Full data: Key-Value Store → bookings.json');
    console.log('• Dataset: summary + per-booking rows');
});
