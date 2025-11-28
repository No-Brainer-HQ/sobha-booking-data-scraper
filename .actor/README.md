# Sobha Bookings Scraper

**Version: 1.0.0 | Status: Production Ready | For: BARACA Life Capital Real Estate**

Enterprise-grade scraper for extracting booking data from the Sobha Partner Portal using direct Salesforce Aura API calls.

## Features

- **Direct API Access**: Bypasses browser automation by making direct Salesforce Aura API calls
- **Comprehensive Data Extraction**: Captures all booking details including customer info, financials, and status
- **Multi-Year Support**: Scrape bookings from multiple years in a single run
- **Financial Summaries**: Automatic calculation of total agreement values and DLD amounts
- **Enterprise Logging**: Detailed logging with progress tracking and error reporting

## Data Extracted

| Category | Fields |
|----------|--------|
| **Booking Info** | Booking ID, Salesforce ID, Booking Date, Status |
| **Customer** | Customer Name, Nationality |
| **Property** | Project, Unit Number, Tower, Bedrooms, Area (sq ft) |
| **Financial** | Agreement Value, DLD Amount, Paid Percentage |
| **Status** | Current Status, Signed Status, SPA Status, Pre-registration |
| **Sales Team** | Sales Manager, Sales Head, Channel Partner, Contact Person |
| **Dates** | Booking Date, Signed Date, SPA Executed Date |

## Setup Instructions

### Step 1: Get Authentication Tokens

1. Open Chrome and log into [Sobha Partner Portal](https://www.sobhapartnerportal.com)
2. Navigate to **Performance** → **Bookings** tab
3. Open Chrome DevTools (F12) → **Network** tab
4. Click on any filter or refresh the page
5. Find a request to `aura?r=...`
6. Extract these values:

   **From Headers tab:**
   - `Cookie` - Full cookie string
   
   **From Payload tab:**
   - `aura.token` - JWT token string
   - `aura.context` - JSON context string

### Step 2: Configure Input

```json
{
    "cookieHeader": "renderCtx=...; sid=...; ...",
    "auraToken": "eyJub25jZSI...",
    "auraContext": "{\"mode\":\"PROD\",...}",
    "years": [2025, 2024],
    "maxResults": 10000
}
```

### Step 3: Run the Scraper

Deploy to Apify and run with your configuration.

## Input Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cookieHeader` | String | Yes | Full Cookie header from browser |
| `auraToken` | String | Yes | Aura authentication token |
| `auraContext` | String | Yes | Aura context JSON string |
| `years` | Array | No | Years to scrape (default: [2025]) |
| `maxResults` | Integer | No | Max bookings to return (default: 10000) |

## Output Structure

```json
{
  "success": true,
  "summary": {
    "totalBookings": 150,
    "yearBreakdown": [{"year": 2025, "count": 150}],
    "projectBreakdown": {"Sobha Solis": 45, "Downtown UAQ": 30},
    "statusBreakdown": {"Processed": 140, "Pending": 10},
    "financials": {
      "totalAgreementValue": 150000000,
      "totalDLDAmount": 6000000,
      "averageAgreementValue": 1000000
    }
  },
  "bookings": [
    {
      "bookingId": "B-44695",
      "customerName": "Ms. Lian Liesbeth Maria Tindemans",
      "nationality": "Dutch",
      "project": "Downtown UAQ",
      "unitNumber": "DT-AQ-A407",
      "towerName": "Sobha Aquamont-Sobha Aquamont Tower A",
      "bedrooms": "1BR",
      "areaSqFt": 565.212389,
      "agreementValue": 1186946.02,
      "agreementValueFormatted": "AED 1,186,946.02",
      "dldAmount": 48627.84,
      "paidPercentage": 20.77,
      "status": "Processed",
      "currentStatus": "SalesOps Assurance Accepted",
      "bookingDate": "2025-10-28T14:02:58.000Z",
      "bookingDateFormatted": "28/10/2025",
      "salesManager": "Sayed Zaffar Ali",
      "salesHead": "Puneet Tripathi",
      "channelPartner": "BARACA LIFE CAPITAL REAL ESTATE L.L.C"
    }
  ],
  "metadata": {
    "scrapedAt": "2025-01-28T15:00:00.000Z",
    "scrapedYears": [2025],
    "method": "direct_aura_api",
    "version": "1.0.0"
  }
}
```

## Token Expiry

Authentication tokens typically expire after:
- **Session timeout**: ~2-4 hours of inactivity
- **Daily refresh**: Usually need new tokens each day

If you see "SESSION_EXPIRED" errors, get fresh tokens from the browser.

## Technical Details

- **API Endpoint**: `https://www.sobhapartnerportal.com/partnerportal/s/sfsites/aura`
- **Controller**: `SitevisitChartController`
- **Method**: `getBookingDataDetails`
- **Parameters**: `{ selectedYear: <year> }`

## Support

For issues or feature requests, contact the BARACA Engineering Team.

---

*Built for BARACA Life Capital Real Estate - Multi-Billion Dollar Operations*
