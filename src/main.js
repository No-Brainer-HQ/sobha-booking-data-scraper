/**
 * SOBHA ENTERPRISE SCRAPER — DATASET SIZE FIX (HARDENED)
 * Fixes: "Data item is too large" by NEVER pushing big arrays/objects into ONE dataset item.
 *
 * Writes:
 * 1) KV Store key: SUMMARY   (small object)
 * 2) Dataset rows: ONE ROW PER PROPERTY  (so dataset count == properties count)
 *
 * INPUT (Actor):
 * {
 *   "cookieHeader": "...",
 *   "auraToken": "...",
 *   "auraContext": "...",
 *   "apiParams": {...},                // optional
 *   "maxResults": 20000,
 *   "actionConfig": {                  // OPTIONAL OVERRIDE (recommended if your portal changes)
 *     "classname": "<<<PASTE>>>",
 *     "method": "<<<PASTE>>>",
 *     "pageURI": "/partnerportal/s/<<<PAGE>>>",
 *     "referer": "https://www.sobhapartnerportal.com/partnerportal/s/<<<PAGE>>>",
 *     "actionId": "197;a",
 *     "sfdcEndpoints": "ApexActionController.execute:<<<Controller>>>.<<<Method>>>"
 *   }
 * }
 */

import { Actor, Dataset } from 'apify';

const BASE_URL = 'https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura';
const AURA_URL = `${BASE_URL}?r=11&aura.ApexAction.execute=1`;

// ---------------------
// Utils
// ---------------------
function generateRequestId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

// IMPORTANT: push ONE item at a time (zero chance of “item too large” unless your single row is huge)
async function pushRowsOneByOne(rows) {
    let pushed = 0;
    for (const row of rows) {
        await Dataset.pushData(row);
        pushed++;
        if (pushed % 500 === 0) console.log(`📦 Saved ${pushed} rows...`);
    }
    console.log(`✅ Saved ${pushed} rows to Dataset.`);
}

// ---------------------
// Aura call
// ---------------------
async function callAura({ cookieHeader, auraToken, auraContext, actionConfig, apiParams }) {
    const cfg = {
        // You SHOULD paste the real values from DevTools Network -> aura request payload
        classname: actionConfig?.classname || 'BrokerPortalSobhaProjectsController',
        method: actionConfig?.method || 'getUnits',
        pageURI: actionConfig?.pageURI || '/partnerportal/s/performance',
        referer: actionConfig?.referer || 'https://www.sobhapartnerportal.com/partnerportal/s/performance',
        actionId: actionConfig?.actionId || '205;a',
        sfdcEndpoints:
            actionConfig?.sfdcEndpoints ||
            'ApexActionController.BrokerPortalSobhaProjectsController.getUnits',
    };

    // If you didn’t paste classname/method yet, this will still run but likely return empty/wrong data.
    const message = {
        actions: [
            {
                id: cfg.actionId,
                descriptor: 'aura://ApexActionController/ACTION$execute',
                callingDescriptor: 'UNKNOWN',
                params: {
                    namespace: '',
                    classname: cfg.classname,
                    method: cfg.method,
                    params: apiParams || {}, // this is your “API Parameters” blob
                    cacheable: false,
                    isContinuation: false,
                },
            },
        ],
    };

    const formData = new URLSearchParams();
    formData.append('message', JSON.stringify(message));
    formData.append('aura.context', auraContext);
    formData.append('aura.pageURI', cfg.pageURI);
    formData.append('aura.token', auraToken);

    console.log('📤 Sending request with message: {}');

    const res = await fetch(AURA_URL, {
        method: 'POST',
        headers: {
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Cookie: cookieHeader,
            Origin: 'https://www.sobhapartnerportal.com',
            Referer: cfg.referer,
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'X-SFDC-Request-Id': generateRequestId(),
            'X-SFDC-LDS-Endpoints': cfg.sfdcEndpoints,
        },
        body: formData.toString(),
    });

    console.log(`📥 API Response Status: ${res.status}`);
    if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${t.slice(0, 400)}`);
    }

    return res.json();
}

// Extract returnValue (Aura has multiple shapes)
function extractAuraReturnValue(json) {
    const a0 = json?.actions?.[0];
    if (!a0) return null;

    if (a0.state === 'ERROR') {
        const err = a0.error || a0.returnValue?.error || a0.returnValue;
        const msg = JSON.stringify(err || '').toLowerCase();
        if (msg.includes('expired') || msg.includes('session')) {
            throw new Error('SESSION_EXPIRED: update cookieHeader/auraToken/auraContext');
        }
        throw new Error(`AURA_ERROR: ${JSON.stringify(err || {})}`);
    }

    if (a0.state !== 'SUCCESS') return null;

    const rv = a0.returnValue;
    return rv?.returnValue ?? rv ?? null;
}

function findFirstArray(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];

    // common keys
    const candidates = [
        value.records,
        value.data,
        value.items,
        value.properties,
        value.result,
        value.returnValue,
    ].filter(Boolean);

    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }

    // shallow scan
    for (const v of Object.values(value)) {
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
    }

    return [];
}

// Your logged structure -> parse into small rows (keep rows tiny)
function parseProperties(rawArr) {
    console.log(`📊 Parsing ${rawArr.length} properties...`);

    if (rawArr.length) {
        console.log('Property structure keys:', Object.keys(rawArr[0]));
        console.log('First property sample:', rawArr[0]);
    }

    return rawArr.map((p, idx) => {
        const row = {
            unitNo: p?.Name || '',
            project: p?.Project__r?.Name || '',
            subProject: p?.Tower__r?.Cluster__r?.Name || '',
            price: safeNumber(p?.Puchase_Price__c),
            area: safeNumber(p?.Total_Area__c),
            startingPrice: safeNumber(p?.Puchase_Price__c),
            totalUnitArea: safeNumber(p?.Total_Area__c),
            floor: String(p?.Floor_No_to_print__c ?? ''),
            salesforceId: p?.Id || '',
            extractedAt: new Date().toISOString(),
        };

        if (idx < 3) console.log(`Property ${idx + 1}:`, row);
        return row;
    });
}

// ---------------------
// MAIN
// ---------------------
Actor.main(async () => {
    const input = (await Actor.getInput()) || {};
    const {
        cookieHeader,
        auraToken,
        auraContext,
        apiParams = null,
        maxResults = 20000,
        actionConfig = null,
    } = input;

    console.log('====================================');
    console.log('SOBHA DIRECT API - WITH PARAMETERS FIX');
    console.log('====================================');

    console.log('\n📋 Config status:');
    console.log(`✅ Cookie header: ${cookieHeader ? 'Set' : 'MISSING'}`);
    console.log(`✅ Aura token: ${auraToken ? 'Set' : 'MISSING'}`);
    console.log(`✅ Aura context: ${auraContext ? 'Set' : 'MISSING'}`);
    console.log(`❌ API Parameters: ${apiParams ? 'SET' : 'NOT SET (This is why you get 0 properties!)'}`);

    if (!cookieHeader || !auraToken || !auraContext) {
        throw new Error('Missing required authentication parameters');
    }

    console.log('\n🚀 Calling Sobha API with parameters...\n');

    const json = await callAura({
        cookieHeader,
        auraToken,
        auraContext,
        actionConfig,
        apiParams: apiParams || {},
    });

    console.log('📄 Raw response received');

    const rv = extractAuraReturnValue(json);

    let rawProperties = [];
    if (Array.isArray(rv)) {
        rawProperties = rv;
        console.log(`✅ SUCCESS! Found ${rawProperties.length} properties!`);
    } else {
        console.log('✅ SUCCESS! Found 0 properties!');
        console.log(`⚠️ Data is not an array: ${typeof rv}`);
        rawProperties = findFirstArray(rv);
        console.log(`📊 Detected array length: ${rawProperties.length}`);
    }

    const parsed = parseProperties(rawProperties);

    let rows = parsed;
    if (rows.length > maxResults) {
        console.log(`\n⚠️ Limiting results from ${rows.length} to ${maxResults}`);
        rows = rows.slice(0, maxResults);
    }

    // Summary
    const projectBreakdown = {};
    for (const r of rows) {
        const k = r.project || 'Unknown';
        projectBreakdown[k] = (projectBreakdown[k] || 0) + 1;
    }

    const summary = {
        totalUnits: rows.length,
        projectBreakdown,
    };

    // KV summary (small)
    await Actor.setValue('SUMMARY', {
        success: true,
        summary,
        metadata: {
            scrapedAt: new Date().toISOString(),
            method: 'direct_aura_api',
        },
    });

    // DATASET: ONE ROW PER ITEM (this is the hard fix)
    await pushRowsOneByOne(rows);

    console.log('\n✅ DONE');
    console.log(`Total Units saved: ${rows.length}`);
    console.log('Summary saved to KV key: SUMMARY');
});
