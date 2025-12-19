/**
 * SOBHA BOOKINGS SCRAPER – ENTERPRISE STABLE VERSION
 * =================================================
 * - No dataset size crashes
 * - Correct Aura parsing
 * - Clean storage strategy
 *
 * Author: No Brainer HQ
 * Version: 1.2.0
 * reverted back
 */

import { Actor } from 'apify';
import { Dataset } from 'crawlee';

// ============================================
// AURA API CLIENT
// ============================================

class SobhaBookingsAPI {
    constructor({ cookieHeader, auraToken, auraContext }) {
        this.cookieHeader = cookieHeader;
        this.auraToken = auraToken;
        this.auraContext = auraContext;
        this.baseUrl = 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura';
    }

    generateRequestId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async fetchBookings(year) {
        console.log(`🚀 Fetching bookings for ${year}`);

        const message = {
            actions: [{
                id: '1;a',
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

        const form = new URLSearchParams();
        form.append('message', JSON.stringify(message));
        form.append('aura.context', this.auraContext);
        form.append('aura.pageURI', '/partnerportal/s/performance');
        form.append('aura.token', this.auraToken);

        const res = await fetch(`${this.baseUrl}?aura.ApexAction.execute=1`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': this.cookieHeader,
                'Origin': 'https://www.sobhapartnerportal.com',
                'Referer': 'https://www.sobhapartnerportal.com/partnerportal/s/performance',
                'User-Agent': 'Mozilla/5.0',
                'X-SFDC-Request-Id': this.generateRequestId()
            },
            body: form.toString()
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const action = json?.actions?.[0];

        if (action?.state !== 'SUCCESS') {
            throw new Error(`Aura error: ${JSON.stringify(action?.error)}`);
        }

        const rv = action.returnValue?.returnValue ?? action.returnValue;

        const candidates = [
            rv,
            rv?.records,
            rv?.data,
            rv?.result,
            rv?.items,
            rv?.bookingData,
            rv?.details
        ];

        const bookings = candidates.find(Array.isArray);

        if (!bookings) {
            console.log('⚠️ SUCCESS but no array found');
            console.log('Return keys:', rv && typeof rv === 'object' ? Object.keys(rv) : typeof rv);
            return [];
        }

        console.log(`✅ Found ${bookings.length} bookings`);
        return bookings;
    }
}

// ============================================
// MAIN ACTOR
// ============================================

Actor.main(async () => {
    const input = await Actor.getInput() || {};
    const {
        cookieHeader,
        auraToken,
        auraContext,
        years = [2025]
    } = input;

    if (!cookieHeader || !auraToken || !auraContext) {
        throw new Error('Missing cookieHeader, auraToken or auraContext');
    }

    const api = new SobhaBookingsAPI({ cookieHeader, auraToken, auraContext });

    let allBookings = [];

    for (const year of years) {
        const raw = await api.fetchBookings(year);

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

    console.log(`📊 Total parsed bookings: ${allBookings.length}`);

    // ============================================
    // STORAGE (SAFE)
    // ============================================

    // 1. Full payload → KV Store
    await Actor.setValue('bookings.json', allBookings);

    // 2. Summary → Dataset
    await Dataset.pushData({
        type: 'summary',
        totalBookings: allBookings.length,
        years,
        scrapedAt: new Date().toISOString()
    });

    // 3. Per-booking rows → Dataset (batched)
    const BATCH_SIZE = 500;

    for (let i = 0; i < allBookings.length; i += BATCH_SIZE) {
        await Dataset.pushData(allBookings.slice(i, i + BATCH_SIZE));
    }

    console.log('✅ SCRAPE COMPLETE');
    console.log('• Full file: KV Store → bookings.json');
    console.log('• Dataset: summary + per-booking rows');
});
