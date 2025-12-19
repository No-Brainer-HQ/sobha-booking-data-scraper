/**
 * SOBHA BOOKINGS SCRAPER - DIRECT API APPROACH
 * =============================================
 * Enterprise-grade scraper for Sobha Partner Portal bookings data
 * Built for BARACA Life Capital Real Estate
 * 
 * Author: BARACA Engineering Team
 * Version: 1.0.0
 * License: Proprietary
 */

import { Actor } from 'apify';
import { Dataset } from 'crawlee';

class SobhaBookingsAPI {
    constructor(config) {
        this.config = {
            cookieHeader: config.cookieHeader || '',
            auraToken: config.auraToken || '',
            auraContext: config.auraContext || '',
            baseUrl: 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura'
        };
    }

    /**
     * Generate a unique request ID for Salesforce
     */
    generateRequestId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Fetch bookings data for a specific year
     * @param {number} year - The year to fetch bookings for (e.g., 2025)
     */
    async getBookings(year = 2025) {
        console.log(`\n🚀 Fetching bookings for year ${year}...`);
        
        const url = `${this.config.baseUrl}?r=18&aura.ApexAction.execute=1`;
        
        // Build the Aura message payload
        const message = {
            "actions": [{
                "id": "197;a",
                "descriptor": "aura://ApexActionController/ACTION$execute",
                "callingDescriptor": "UNKNOWN",
                "params": {
                    "namespace": "",
                    "classname": "SitevisitChartController",
                    "method": "getBookingDataDetails",
                    "params": {
                        "selectedYear": year
                    },
                    "cacheable": false,
                    "isContinuation": false
                }
            }]
        };

        // Create form data
        const formData = new URLSearchParams();
        formData.append('message', JSON.stringify(message));
        formData.append('aura.context', this.config.auraContext);
        formData.append('aura.pageURI', '/partnerportal/s/performance');
        formData.append('aura.token', this.config.auraToken);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Cookie': this.config.cookieHeader,
                    'Origin': 'https://www.sobhapartnerportal.com',
                    'Referer': 'https://www.sobhapartnerportal.com/partnerportal/s/performance',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                    'X-SFDC-Request-Id': this.generateRequestId(),
                    'X-SFDC-LDS-Endpoints': 'ApexActionController.execute:SitevisitChartController.getBookingDataDetails'
                },
                body: formData.toString()
            });

            console.log(`📥 API Response Status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Parse the Salesforce Aura response
            if (data?.actions?.[0]?.state === 'SUCCESS') {
    const rv = data.actions[0].returnValue;
    const v = rv?.returnValue ?? rv;

    const candidates = [
        v,
        v?.records,
        v?.data,
        v?.result,
        v?.items,
        v?.bookingData,
        v?.details,
    ];

    const arr = candidates.find(x => Array.isArray(x));

    if (arr) {
        console.log(`✅ SUCCESS! Found ${arr.length} bookings for ${year}`);
        return arr;
    }

    console.log('⚠️ SUCCESS but no array found.');
    console.log('Return value keys:', v && typeof v === 'object' ? Object.keys(v) : typeof v);
    console.log('Return value preview:', JSON.stringify(v).slice(0, 800));
    return [];
}
            } else if (data?.actions?.[0]?.state === 'ERROR') {
                const error = data.actions[0].error;
                console.log('❌ API Error:', JSON.stringify(error, null, 2));
                
                if (JSON.stringify(error).includes('expired')) {
                    throw new Error('SESSION_EXPIRED: Please update authentication tokens');
                }
                throw new Error(`API Error: ${JSON.stringify(error)}`);
            } else {
                console.log('⚠️ Unexpected response structure');
                console.log('Full response:', JSON.stringify(data, null, 2).substring(0, 500));
                return [];
            }

        } catch (error) {
            console.error('❌ Request failed:', error.message);
            
            if (error.message.includes('401') || error.message.includes('SESSION_EXPIRED')) {
                console.log('\n⚠️ Authentication failed! Your session has expired.');
                console.log('Please update the authentication tokens in input.');
            }
            
            throw error;
        }
    }

    /**
     * Parse raw booking data into clean, structured format
     */
    parseBookings(rawBookings) {
        if (!rawBookings || !Array.isArray(rawBookings)) {
            console.log('⚠️ No bookings data to parse');
            return [];
        }

        console.log(`\n📊 Parsing ${rawBookings.length} bookings...`);

        return rawBookings.map((booking, index) => {
            // Extract nested relationship data safely
            const project = booking.Project__r?.Name || '';
            const unitName = booking.Unit__r?.Name || '';
            const bedrooms = booking.Unit__r?.No_of_Bedroom__c || '';
            const area = booking.Unit__r?.Chargeable_Area__c || 0;
            const towerType = booking.Unit__r?.Tower__r?.Tower_Type__c || '';
            const opportunityName = booking.Opportunity__r?.Name || '';
            
            // Sales team info
            const salesManagerFirstName = booking.Sales_Managers__r?.FirstName || '';
            const salesManagerLastName = booking.Sales_Managers__r?.LastName || '';
            const salesManager = `${salesManagerFirstName} ${salesManagerLastName}`.trim();
            
            const salesHeadFirstName = booking.Sales_Head__r?.FirstName || '';
            const salesHeadLastName = booking.Sales_Head__r?.LastName || '';
            const salesHead = `${salesHeadFirstName} ${salesHeadLastName}`.trim();
            
            // Channel partner info
            const channelPartner = booking.Channel_Partner__r?.Name || '';
            const contactPerson = booking.Channel_Partner_Contact_Person__c || '';

            const parsedBooking = {
                // Primary Identifiers
                bookingId: booking.Name || '',
                salesforceId: booking.Id || '',
                
                // Customer Information
                customerName: booking.Primary_Applicant_Name__c || '',
                nationality: booking.Nationality_V2__c || '',
                
                // Property Information
                project: project,
                unitNumber: unitName,
                towerName: booking.Tower_Name__c || '',
                towerType: towerType,
                bedrooms: bedrooms,
                areaSqFt: area,
                
                // Financial Information
                agreementValue: booking.Agreement_Value__c || 0,
                agreementValueFormatted: booking.Agreement_Value__c 
                    ? `AED ${booking.Agreement_Value__c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '',
                dldAmount: booking.DLD_Amount__c || 0,
                dldAmountFormatted: booking.DLD_Amount__c
                    ? `AED ${booking.DLD_Amount__c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '',
                dldPercentage: booking.DLD_Percentage__c || '',
                paidPercentage: booking.Paid_Percentage__c || 0,
                
                // Status Information
                status: booking.Status__c || '',
                currentStatus: booking.Current_Status__c || '',
                signedStatus: booking.Signed_Status__c || '',
                preRegistration: booking.Pre_registration__c || '',
                
                // SPA Information
                spaExecuted: booking.SPA_Executed__c || '',
                spaExecutedDate: booking.SPA_Executed_Date__c || '',
                
                // Dates
                bookingDate: booking.Booking_Date__c || '',
                bookingDateFormatted: booking.Booking_Date__c 
                    ? new Date(booking.Booking_Date__c).toLocaleDateString('en-GB')
                    : '',
                signedDate: booking.Signed_Date__c || '',
                signedDateFormatted: booking.Signed_Date__c
                    ? new Date(booking.Signed_Date__c).toLocaleDateString('en-GB')
                    : '',
                
                // Sales Team
                salesManager: salesManager,
                salesHead: salesHead,
                
                // Channel Partner
                channelPartner: channelPartner,
                contactPerson: contactPerson,
                
                // Opportunity
                opportunityName: opportunityName,
                opportunityId: booking.Opportunity__c || '',
                
                // Metadata
                extractedAt: new Date().toISOString()
            };

            // Log first few bookings for verification
            if (index < 3) {
                console.log(`  Booking ${index + 1}: ${parsedBooking.bookingId} - ${parsedBooking.customerName} - ${parsedBooking.unitNumber}`);
            }

            return parsedBooking;
        });
    }
}

// ============================================
// MAIN EXECUTION
// ============================================
Actor.main(async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     SOBHA BOOKINGS SCRAPER - BARACA ENTERPRISE          ║');
    console.log('║     Direct API Approach - Production Ready               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Get input configuration
    const input = await Actor.getInput() || {};
    
    const {
        cookieHeader,
        auraToken,
        auraContext,
        years = [2025],
        maxResults = 10000
    } = input;

    // Validate required inputs
    if (!cookieHeader || !auraToken || !auraContext) {
        console.log('❌ ERROR: Missing required authentication parameters!');
        console.log('\n📋 Required inputs:');
        console.log('  - cookieHeader: Full Cookie header from browser');
        console.log('  - auraToken: Aura token from request payload');
        console.log('  - auraContext: Aura context from request payload');
        console.log('\n🔧 How to get these values:');
        console.log('  1. Open Chrome DevTools (F12) on Sobha Portal');
        console.log('  2. Go to Network tab');
        console.log('  3. Navigate to Bookings section');
        console.log('  4. Find any "aura" request');
        console.log('  5. Copy Cookie from Headers, aura.token and aura.context from Payload');
        
        await Dataset.pushData({
            success: false,
            error: 'Missing required authentication parameters',
            requiredInputs: ['cookieHeader', 'auraToken', 'auraContext'],
            timestamp: new Date().toISOString()
        });
        
        return;
    }

    console.log('📋 Configuration:');
    console.log(`  ✅ Cookie header: Set (${cookieHeader.length} chars)`);
    console.log(`  ✅ Aura token: Set`);
    console.log(`  ✅ Aura context: Set`);
    console.log(`  📅 Years to scrape: ${years.join(', ')}`);
    console.log(`  📊 Max results: ${maxResults}`);

    // Initialize API client
    const api = new SobhaBookingsAPI({
        cookieHeader,
        auraToken,
        auraContext
    });

    let allBookings = [];
    let successfulYears = [];
    let failedYears = [];

    // Fetch bookings for each year
    for (const year of years) {
        try {
            console.log(`\n${'─'.repeat(50)}`);
            console.log(`📅 Processing year: ${year}`);
            console.log('─'.repeat(50));

            const rawBookings = await api.getBookings(year);
            
            if (rawBookings && rawBookings.length > 0) {
                const parsedBookings = api.parseBookings(rawBookings);
                
                // Add year tag to each booking
                parsedBookings.forEach(b => b.scrapedYear = year);
                
                allBookings = allBookings.concat(parsedBookings);
                successfulYears.push({ year, count: parsedBookings.length });
                
                console.log(`✅ Year ${year}: ${parsedBookings.length} bookings extracted`);
            } else {
                console.log(`⚠️ Year ${year}: No bookings found`);
                successfulYears.push({ year, count: 0 });
            }

            // Respect rate limits
            if (years.indexOf(year) < years.length - 1) {
                console.log('⏳ Waiting 2 seconds before next request...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            console.error(`❌ Failed to fetch year ${year}:`, error.message);
            failedYears.push({ year, error: error.message });
        }
    }

    // Apply max results limit
    if (allBookings.length > maxResults) {
        console.log(`\n⚠️ Limiting results from ${allBookings.length} to ${maxResults}`);
        allBookings = allBookings.slice(0, maxResults);
    }

    // Generate summary statistics
    const summary = {
        totalBookings: allBookings.length,
        yearBreakdown: successfulYears,
        failedYears: failedYears,
        
        // Project breakdown
        projectBreakdown: {},
        
        // Status breakdown
        statusBreakdown: {},
        
        // Financial summary
        financials: {
            totalAgreementValue: 0,
            totalDLDAmount: 0,
            averageAgreementValue: 0
        }
    };

    // Calculate breakdowns
    allBookings.forEach(booking => {
        // Project breakdown
        const project = booking.project || 'Unknown';
        summary.projectBreakdown[project] = (summary.projectBreakdown[project] || 0) + 1;
        
        // Status breakdown
        const status = booking.status || 'Unknown';
        summary.statusBreakdown[status] = (summary.statusBreakdown[status] || 0) + 1;
        
        // Financial totals
        summary.financials.totalAgreementValue += booking.agreementValue || 0;
        summary.financials.totalDLDAmount += booking.dldAmount || 0;
    });

    if (allBookings.length > 0) {
        summary.financials.averageAgreementValue = summary.financials.totalAgreementValue / allBookings.length;
    }

    // Save to dataset
    await Dataset.pushData({
        success: true,
        summary: summary,
        bookings: allBookings,
        metadata: {
            scrapedAt: new Date().toISOString(),
            scrapedYears: years,
            method: 'direct_aura_api',
            version: '1.0.0'
        }
    });

    // Print final summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    SCRAPING COMPLETE                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Results Summary:`);
    console.log(`   Total Bookings: ${allBookings.length}`);
    console.log(`   Years Processed: ${successfulYears.map(y => `${y.year}(${y.count})`).join(', ')}`);
    
    if (failedYears.length > 0) {
        console.log(`   ❌ Failed Years: ${failedYears.map(y => y.year).join(', ')}`);
    }
    
    console.log(`\n💰 Financial Summary:`);
    console.log(`   Total Agreement Value: AED ${summary.financials.totalAgreementValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   Total DLD Amount: AED ${summary.financials.totalDLDAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   Average Agreement Value: AED ${summary.financials.averageAgreementValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    
    console.log(`\n📁 Projects Breakdown:`);
    Object.entries(summary.projectBreakdown)
        .sort((a, b) => b[1] - a[1])
        .forEach(([project, count]) => {
            console.log(`   ${project}: ${count} bookings`);
        });

    console.log(`\n📋 Status Breakdown:`);
    Object.entries(summary.statusBreakdown)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
            console.log(`   ${status}: ${count} bookings`);
        });

    console.log('\n✅ Data saved to dataset. Check Storage > Dataset tab.');
    console.log('════════════════════════════════════════════════════════════\n');
});
