/**
 * SOBHA BOOKINGS DIRECT API SCRAPER
 * ==================================
 * Enterprise-grade scraper for extracting booking data from Sobha Partner Portal
 * Built for BARACA Life Capital Real Estate
 * 
 * @author BARACA Engineering Team
 * @version 1.0.0
 */

import { Actor } from 'apify';
import { Dataset } from 'crawlee';

class SobhaBookingsAPI {
    constructor() {
        this.config = {
            // Authentication values - UPDATE BEFORE RUNNING
            cookieHeader: 'YOUR_COOKIE_HEADER_HERE',
            auraToken: 'YOUR_AURA_TOKEN_HERE',
            auraContext: '{"mode":"PROD","fwuid":"YOUR_FWUID_HERE","app":"siteforce:communityApp","loaded":{"APPLICATION@markup://siteforce:communityApp":"YOUR_APP_ID"},"dn":[],"globals":{},"uad":true}',
            
            // API parameters for bookings query
            apiParams: {
                // These will be populated after capturing from browser
                // Example structure:
                // "status": "All",
                // "dateRange": { "start": null, "end": null },
                // "projectId": null
            }
        };
        
        this.baseUrl = 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura';
    }

    /**
     * Fetch bookings from Sobha API
     */
    async getBookings(params = null) {
        console.log('🚀 Fetching bookings from Sobha API...\n');
        
        const apiParams = params || this.config.apiParams;
        
        const message = {
            "actions": [{
                "id": "301;a",
                "descriptor": "aura://ApexActionController/ACTION$execute",
                "callingDescriptor": "UNKNOWN",
                "params": {
                    "namespace": "",
                    "classname": "BrokerPortalBookingsController", // UPDATE: Actual controller name
                    "method": "getBookings", // UPDATE: Actual method name
                    "params": apiParams,
                    "cacheable": false,
                    "isContinuation": false
                }
            }]
        };

        const formData = new URLSearchParams();
        formData.append('message', JSON.stringify(message));
        formData.append('aura.context', this.config.auraContext);
        formData.append('aura.token', this.config.auraToken);
        formData.append('aura.pageURI', '/partnerportal/s/bookings');

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Cookie': this.config.cookieHeader,
                    'Origin': 'https://www.sobhapartnerportal.com',
                    'Referer': 'https://www.sobhapartnerportal.com/partnerportal/s/bookings',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-SFDC-Request-Id': this.generateRequestId()
                },
                body: formData.toString()
            });

            console.log(`📥 Response Status: ${response.status}`);
            const data = await response.json();
            
            if (data?.actions?.[0]?.state === 'SUCCESS') {
                const returnValue = data.actions[0].returnValue;
                console.log(`✅ SUCCESS! Found ${returnValue?.length || 0} bookings`);
                return returnValue;
            } else {
                console.log('❌ API Error:', data?.actions?.[0]?.error);
                return null;
            }

        } catch (error) {
            console.error('❌ Request failed:', error.message);
            return null;
        }
    }

    /**
     * Parse raw booking data into structured format
     */
    parseBookings(data) {
        if (!data || !Array.isArray(data)) {
            console.log('⚠️ No booking data to parse');
            return [];
        }

        console.log(`📊 Parsing ${data.length} bookings...`);

        return data.map((item, index) => {
            const booking = {
                // Booking identifiers
                bookingId: item.Name || item.Booking_Number__c || '',
                bookingReference: item.Booking_Reference__c || item.Id || '',
                
                // Customer information
                customer: {
                    name: item.Customer_Name__c || item.Lead__r?.Name || '',
                    email: item.Customer_Email__c || item.Lead__r?.Email || '',
                    phone: item.Customer_Phone__c || item.Lead__r?.Phone || '',
                    nationality: item.Customer_Nationality__c || ''
                },
                
                // Property details
                property: {
                    unitNo: item.Unit__r?.Name || item.Unit_Number__c || '',
                    project: item.Project__r?.Name || item.Project_Name__c || '',
                    subProject: item.Tower__r?.Name || item.Sub_Project__c || '',
                    unitType: item.Unit_Type__c || '',
                    floor: item.Floor__c || '',
                    area: item.Area__c || item.Unit__r?.Total_Area__c || 0
                },
                
                // Financial details
                financials: {
                    bookingAmount: item.Booking_Amount__c || 0,
                    totalPrice: item.Total_Price__c || item.Unit_Price__c || 0,
                    paidAmount: item.Paid_Amount__c || 0,
                    balanceAmount: item.Balance_Amount__c || 0,
                    currency: item.Currency__c || 'AED'
                },
                
                // Dates
                dates: {
                    bookingDate: item.Booking_Date__c || item.CreatedDate || '',
                    expiryDate: item.Expiry_Date__c || '',
                    spaDate: item.SPA_Date__c || '',
                    handoverDate: item.Expected_Handover__c || ''
                },
                
                // Status information
                status: {
                    bookingStatus: item.Status__c || item.Booking_Status__c || '',
                    paymentStatus: item.Payment_Status__c || '',
                    spaStatus: item.SPA_Status__c || '',
                    stage: item.Stage__c || ''
                },
                
                // Agent/Broker info
                agent: {
                    name: item.Agent_Name__c || item.Owner?.Name || '',
                    agentId: item.Agent_Id__c || item.OwnerId || '',
                    company: item.Broker_Company__c || ''
                },
                
                // Metadata
                metadata: {
                    createdAt: item.CreatedDate || '',
                    lastModified: item.LastModifiedDate || '',
                    recordType: item.RecordType?.Name || ''
                },
                
                // Raw data for debugging
                _raw: item
            };

            if (index < 3) {
                console.log(`Booking ${index + 1}:`, {
                    bookingId: booking.bookingId,
                    customer: booking.customer.name,
                    unit: booking.property.unitNo,
                    status: booking.status.bookingStatus
                });
            }

            return booking;
        });
    }

    generateRequestId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

// MAIN EXECUTION
Actor.main(async () => {
    console.log('========================================');
    console.log('SOBHA BOOKINGS SCRAPER - ENTERPRISE');
    console.log('BARACA Life Capital Real Estate');
    console.log('========================================\n');

    const input = await Actor.getInput() || {};
    const api = new SobhaBookingsAPI();

    // Override config with input if provided
    if (input.cookieHeader) api.config.cookieHeader = input.cookieHeader;
    if (input.auraToken) api.config.auraToken = input.auraToken;
    if (input.auraContext) api.config.auraContext = input.auraContext;

    console.log('📋 Configuration Status:');
    console.log(`  Cookie Header: ${api.config.cookieHeader !== 'YOUR_COOKIE_HEADER_HERE' ? '✅ Set' : '❌ Not Set'}`);
    console.log(`  Aura Token: ${api.config.auraToken !== 'YOUR_AURA_TOKEN_HERE' ? '✅ Set' : '❌ Not Set'}`);
    console.log('');

    // Fetch bookings
    const rawData = await api.getBookings();

    if (rawData) {
        const bookings = api.parseBookings(rawData);

        if (bookings.length > 0) {
            // Save to dataset
            await Dataset.pushData({
                success: true,
                totalBookings: bookings.length,
                bookings: bookings,
                extractedAt: new Date().toISOString(),
                summary: {
                    totalBookings: bookings.length,
                    statuses: [...new Set(bookings.map(b => b.status.bookingStatus))],
                    projects: [...new Set(bookings.map(b => b.property.project))],
                    totalValue: bookings.reduce((sum, b) => sum + (b.financials.totalPrice || 0), 0)
                }
            });

            console.log(`\n🎉 SUCCESS! Extracted ${bookings.length} bookings`);
            
            // Summary statistics
            console.log('\n📈 Summary:');
            const statuses = {};
            bookings.forEach(b => {
                const status = b.status.bookingStatus || 'Unknown';
                statuses[status] = (statuses[status] || 0) + 1;
            });
            Object.entries(statuses).forEach(([status, count]) => {
                console.log(`  ${status}: ${count}`);
            });

        } else {
            console.log('\n⚠️ No bookings found');
            await Dataset.pushData({
                success: true,
                totalBookings: 0,
                bookings: [],
                message: 'No bookings found for the given parameters'
            });
        }

    } else {
        console.log('\n❌ Failed to fetch bookings');
        await Dataset.pushData({
            success: false,
            error: 'Failed to retrieve bookings - check authentication',
            timestamp: new Date().toISOString()
        });
    }

    console.log('\n========================================');
    console.log('Scraping Complete');
    console.log('========================================');
});
