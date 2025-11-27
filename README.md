# 🏢 Enterprise Sobha Bookings Scraper

**Version: 1.0.0 | Status: Production Ready | For: BARACA Life Capital Real Estate**

Enterprise-grade Apify actor for extracting booking data from the Sobha Partner Portal using direct Salesforce Lightning API integration.

---

## 📊 Data Extracted

This scraper extracts comprehensive booking information:

| Category | Fields |
|----------|--------|
| **Booking Info** | Booking ID, Reference Number, Status, Stage |
| **Customer** | Name, Email, Phone, Nationality |
| **Property** | Unit No, Project, Sub-Project, Type, Floor, Area |
| **Financials** | Booking Amount, Total Price, Paid, Balance, Currency |
| **Dates** | Booking Date, Expiry, SPA Date, Handover |
| **Agent** | Agent Name, ID, Broker Company |

---

## 🚀 Quick Start

### 1. Get Authentication Values

Run this in Chrome DevTools Console on Sobha Portal:

```javascript
// Copy from Network tab after any API request
console.log('Cookie:', document.cookie);
```

### 2. Configure Actor Input

```json
{
  "cookieHeader": "your_cookie_header",
  "auraToken": "your_aura_token",
  "auraContext": "your_aura_context",
  "maxResults": 1000
}
```

### 3. Run Actor

```bash
npx apify run
```

---

## 📁 Output Structure

```json
{
  "success": true,
  "totalBookings": 150,
  "bookings": [
    {
      "bookingId": "BK-2024-001234",
      "customer": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+971501234567"
      },
      "property": {
        "unitNo": "SSH-A4105",
        "project": "Sobha SeaHaven",
        "unitType": "2 Bed Type A"
      },
      "financials": {
        "totalPrice": 2500000,
        "paidAmount": 250000,
        "balanceAmount": 2250000
      },
      "status": {
        "bookingStatus": "Confirmed",
        "paymentStatus": "Partial"
      },
      "dates": {
        "bookingDate": "2024-01-15",
        "handoverDate": "2025-06-30"
      }
    }
  ],
  "summary": {
    "totalBookings": 150,
    "statuses": ["Confirmed", "Pending", "Completed"],
    "projects": ["Sobha SeaHaven", "Sobha Hartland"],
    "totalValue": 375000000
  }
}
```

---

## 🔧 Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Sobha Partner Portal                   │
│              (Salesforce Lightning Platform)             │
└─────────────────────┬───────────────────────────────────┘
                      │ Aura API
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Direct API Integration Layer                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Cookie    │  │    Aura     │  │      Aura       │ │
│  │   Header    │  │    Token    │  │     Context     │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Apify Actor Runtime                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │            SobhaBookingsAPI Class               │   │
│  │  • getBookings() - Fetch from Aura endpoint    │   │
│  │  • parseBookings() - Transform to schema       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Apify Dataset                          │
│            (Structured JSON Output)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Requirements

- Node.js >= 18.0.0
- Apify Account
- Valid Sobha Partner Portal credentials

---

## 🔐 Security Notes

- Never commit authentication values to Git
- Session tokens expire - refresh before each run
- Use Apify's secret input fields for credentials

---

## 📞 Support

**BARACA Life Capital Real Estate Engineering Team**
- Email: engineering@baraca.com

---

© 2024 BARACA Life Capital Real Estate. Proprietary and Confidential.
