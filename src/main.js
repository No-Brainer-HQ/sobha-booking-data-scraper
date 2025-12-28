/**
 * SOBHA ENTERPRISE SCRAPER (PROPERTIES) — SAFE DATASET + SUMMARY KV
 * Fixes: "Data item is too large" by NEVER pushing a huge wrapper object to Dataset.
 * Saves:
 *  - Key-Value Store: SUMMARY (small object)
 *  - Dataset: each property as its own row (batched + auto-splitting if needed)
 *
 * Input (Apify Actor):
 * {
 *   "cookieHeader": "...",
 *   "auraToken": "...",
 *   "auraContext": "...",
 *   "apiParams": { ... },           // optional but REQUIRED for correct filtering in some portal states
 *   "maxResults": 10000,
 *   "debug": false
 * }
 */

import { Actor, Dataset } from 'apify';

const BASE_URL = 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura';

// --------------------
// DATASET SAFE PUSH
// --------------------
async function pushDatasetSafely(items, label = 'rows') {
    if (!items || items.length === 0) return;

    const stack = [items];
    let pushed = 0;

    while (stack.length) {
        const batch = stack.pop();

        try {
            await Dataset.pushData(batch);

            if (Array.isArray(batch)) pushed += batch.length;
            else pushed += 1;

            if (pushed % 500 === 0) console.log(`📦 Pushed ${pushed} ${label}...`);
        } catch (e) {
            const msg = String(e?.message || e);

            if (!msg.includes('Data item is too large')) throw e;

            // If a single object is too big, you MUST trim fields on that object.
            if (!Array.isArray(batch)) {
                console.log('❌ Single record too large. Trim fields in that record before pushing.');
                throw e;
            }

            // Split array into halves until push works.
            if (batch.length <= 1) {
                stack.push(batch[0]);
                continue;
            }

            const mid = Math.ceil(batch.length / 2);
            const left = batch.slice(0, mid);
            const right = batch.slice(mid);

            console.log(`⚠️ Batch too large. Splitting ${batch.length} -> ${left.length} + ${right.length}`);
            stack.push(right);
            stack.push(left);
        }
    }

    console.log(`✅ Finished pushing ${pushed} ${label} to Dataset.`);
}

// --------------------
// SOBHA DIRECT API CLIENT (PROPERTIES)
// --------------------
class SobhaDirectAPI {
    constructor({ cookieHeader, auraToken, auraContext, apiParams = {}, debug = false }) {
        this.cookieHeader = cookieHeader;
        this.auraToken = auraToken;
        this.auraContext = auraContext;
        this.apiParams = apiParams || {};
        this.debug = debug;
    }

    generateRequestId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let out = '';
        for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
    }

    buildAuraMessageForProperties() {
        /**
         * IMPORTANT:
         * Your portal can require extra params (filters) to return full inventory.
         * Your logs showed "API Parameters: NOT SET" -> 0 properties in some states.
         *
         * If you already have a proven message from your old actor, paste it HERE.
         * This default version matches the common Aura ApexAction execute structure.
         */

        return {
            actions: [
                {
                    id: '197;a',
                    descriptor: 'aura://ApexActionController/ACTION$execute',
                    callingDescriptor: 'UNKNOWN',
                    params: {
                        namespace: '',
                        // ✅ This is the part that differs per portal build:
                        // If your old actor used a different classname/method, replace these 2 lines.
                        classname: 'PropertyInventoryController',
                        method: 'getProperties',
                        // ✅ API params (filters/paging) live here:
                        params: this.apiParams || {},
                        cacheable: false,
                        isContinuation: false,
                    },
                },
            ],
        };
    }

    async callAura({ pageURI = '/partnerportal/s/inventory', referer = 'https://www.sobhapartnerportal.com/partnerportal/s/inventory' } = {}) {
        const url = `${BASE_URL}?r=18&aura.ApexAction.execute=1`;

        const message = this.buildAuraMessageForProperties();

        const formData = new URLSearchParams();
        formData.append('message', JSON.stringify(message));
        formData.append('aura.context', this.auraContext);
        formData.append('aura.pageURI', pageURI);
        formData.append('aura.token', this.auraToken);

        if (this.debug) {
            console.log('📤 Sending request with message:', JSON.stringify(message).slice(0, 800));
        } else {
            console.log('📤 Sending request with message: {}');
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Cookie: this.cookieHeader,
                Origin: 'https://www.sobhapartnerportal.com',
                Referer: referer,
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                'X-SFDC-Request-Id': this.generateRequestId(),
            },
            body: formData.toString(),
        });

        console.log(`📥 API Response Status: ${res.status}`);

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${res.statusText} :: ${text.slice(0, 400)}`);
        }

        return res.json();
    }

    extractReturnValue(json) {
        // Aura response often: { actions: [ { state:'SUCCESS', returnValue: { returnValue: ... } } ] }
        const a0 = json?.actions?.[0];
        if (!a0) return null;

        if (a0.state === 'ERROR') {
            const err = a0.error || a0?.returnValue?.error || a0?.returnValue;
            const msg = JSON.stringify(err || {}).toLowerCase();
            if (msg.includes('expired') || msg.includes('session')) {
                throw new Error('SESSION_EXPIRED: update cookieHeader/auraToken/auraContext');
            }
            throw new Error(`AURA_ERROR: ${JSON.stringify(err || {})}`);
        }

        if (a0.state !== 'SUCCESS') return null;

        // Try common nesting patterns
        const rv = a0.returnValue;
        return rv?.returnValue ?? rv ?? null;
    }

    extractPropertiesArray(returnValue) {
        // Your logs: "Data is not an array: object" then "Parsing 8061 properties..."
        // So sometimes returnValue is an object that CONTAINS the list.
        if (Array.isArray(returnValue)) return returnValue;

        if (!returnValue || typeof returnValue !== 'object') return [];

        // Try common keys
        const candidates = [
            returnValue.records,
            returnValue.data,
            returnValue.items,
            returnValue.properties,
            returnValue.result,
            returnValue.returnValue,
        ].filter(Boolean);

        for (const c of candidates) {
            if (Array.isArray(c)) return c;
        }

        // Deep scan (safe) for the first big array of objects that looks like properties
        for (const [k, v] of Object.entries(returnValue)) {
            if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
        }

        return [];
    }

    parseProperty(p, idx = 0) {
        // Works with the structure you logged: Id/Name/Project__r/Tower__r/... etc.
        const project = p?.Project__r?.Name || p?.ProjectName || p?.project || '';
        const subProject =
            p?.Tower__r?.Cluster__r?.Name || p?.Cluster__r?.Name || p?.subProject || p?.SubProject || '';
        const unitNo = p?.Name || p?.unitNo || p?.UnitNo || '';
        const unitType = p?.Unit_Type__c || p?.UnitType || p?.unitType || '';
        const floor = p?.Floor_No_to_print__c || p?.floor || '';
        const area = Number(p?.Total_Area__c ?? p?.area ?? 0) || 0;
        const price = Number(p?.Puchase_Price__c ?? p?.price ?? 0) || 0;

        if (idx < 3) {
            console.log(`Property ${idx + 1}:`, {
                unitNo,
                project,
                subProject,
                price,
                area,
                floor,
            });
        }

        return {
            unitNo,
            project,
            subProject,
            unitType,
            floor: String(floor ?? ''),
            area,
            price,

            // Keep IDs if you need them later:
            salesforceId: p?.Id || '',
            projectId: p?.Project__c || '',
            towerId: p?.Tower__c || '',

            extractedAt: new Date().toISOString(),
        };
    }

    async getAllProperties() {
        console.log('\n🚀 Calling Sobha API with parameters...\n');

        const json = await this.callAura({
            pageURI: '/partnerportal/s/inventory',
            referer: 'https://www.sobhapartnerportal.com/partnerportal/s/inventory',
        });

        console.log('📄 Raw response received');

        const rv = this.extractReturnValue(json);

        if (Array.isArray(rv)) {
            console.log(`✅ SUCCESS! Found ${rv.length} properties!`);
            return rv;
        }

        console.log(`✅ SUCCESS! Found 0 properties!`);
        console.log(`⚠️ Data is not an array: ${typeof rv}`);

        const arr = this.extractPropertiesArray(rv);
        console.log(`📊 Parsing ${arr.length} properties...`);

        if (arr.length && typeof arr[0] === 'object') {
            console.log('Property structure keys:', Object.keys(arr[0]).slice(0, 25));
            console.log('First property sample:', arr[0]);
        }

        return arr;
    }
}

// --------------------
// MAIN
// --------------------
Actor.main(async () => {
    const input = (await Actor.getInput()) || {};

    const {
        cookieHeader,
        auraToken,
        auraContext,
        apiParams = null,
        maxResults = 10000,
        debug = false,
    } = input;

    console.log('====================================');
    console.log('SOBHA DIRECT API - WITH PARAMETERS FIX');
    console.log('====================================\n');

    console.log('📋 Config status:');
    console.log(`✅ Cookie header: ${cookieHeader ? 'Set' : 'MISSING'}`);
    console.log(`✅ Aura token: ${auraToken ? 'Set' : 'MISSING'}`);
    console.log(`✅ Aura context: ${auraContext ? 'Set' : 'MISSING'}`);
    console.log(`✅ API Parameters: ${apiParams ? 'Set' : 'NOT SET (This is why you get 0 properties!)'}`);

    if (!cookieHeader || !auraToken || !auraContext) {
        throw new Error('Missing required auth: cookieHeader/auraToken/auraContext');
    }

    if (!apiParams) {
        console.log('\n🔧 TO FIX THIS:');
        console.log('1. Open Sobha Portal in Chrome');
        console.log('2. Press F12 -> Console');
        console.log('3. Run your capture_complete_api.js');
        console.log('4. Click the portal filter/search button');
        console.log('5. Copy the API PARAMETERS section');
        console.log('6. Paste into actor input as "apiParams" (JSON object)');
        console.log('');
    }

    const api = new SobhaDirectAPI({ cookieHeader, auraToken, auraContext, apiParams: apiParams || {}, debug });

    const raw = await api.getAllProperties();

    // Parse to clean rows
    const parsed = raw.map((p, i) => api.parseProperty(p, i));

    // Limit if needed
    let rows = parsed;
    if (rows.length > maxResults) {
        console.log(`\n⚠️ Limiting results from ${rows.length} to ${maxResults}`);
        rows = rows.slice(0, maxResults);
    }

    // Summary
    const projects = new Map();
    for (const r of rows) projects.set(r.project || 'Unknown', (projects.get(r.project || 'Unknown') || 0) + 1);

    const summary = {
        totalUnits: rows.length,
        projectBreakdown: Object.fromEntries([...projects.entries()].sort((a, b) => b[1] - a[1])),
    };

    // ✅ KV SUMMARY (small)
    await Actor.setValue('SUMMARY', {
        success: true,
        summary,
        metadata: {
            scrapedAt: new Date().toISOString(),
            method: 'direct_aura_api',
        },
    });

    // ✅ DATASET ROWS (safe)
    await pushDatasetSafely(rows, 'properties');

    console.log('\n🎉 SUCCESS!');
    console.log(`📊 Total Units: ${rows.length}`);
    console.log(`📁 Projects: ${Object.keys(summary.projectBreakdown).length}`);
    console.log('✅ Summary saved to KV as SUMMARY.');
    console.log('✅ Properties saved as dataset rows.');
});
