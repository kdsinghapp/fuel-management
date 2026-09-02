# 📊 Fuel Management System - API & Calculations Guide (Complete Documentation)

Ye document Fuel Management Application ke sabhi sidebar modules, unme use hone wali **APIs**, **API Request/Response Data Structure**, aur **Calculations & Business Logic** ka detailed technical guide hai.

---

## 📑 Index
1. [Backend Architecture & Authentication](#1-backend-architecture--authentication)
2. [Client Configuration & Multi-Tenancy](#2-client-configuration--multi-tenancy)
3. [Module 1: Dashboard](#3-module-1-dashboard)
4. [Module 2: Fuel Levels (Tank Levels)](#4-module-2-fuel-levels)
5. [Module 3: Deliveries (Fuel Receipts)](#5-module-3-deliveries)
6. [Module 4: Transactions (Fuel Issues / Dispensed)](#6-module-4-transactions)
7. [Module 5: Fuel Efficiency (Vehicles)](#7-module-5-fuel-efficiency)
8. [Module 6: Fuel Efficiency Summary](#8-module-6-fuel-efficiency-summary)
9. [Module 7: Fuel Limits](#9-module-7-fuel-limits)
10. [Module 8: Reconciliation (Stock & Audit Reconciliation)](#10-module-8-reconciliation)
11. [Summary Table (Quick Reference)](#11-summary-table-quick-reference)

---

## 1. Backend Architecture & Authentication

### 🔗 Base URL
- **Base URL**: `https://api.fmafrica.com:4801` (From `.env.local` `NEXT_PUBLIC_FMA_API_URL`)

### 🔐 Authentication API
- **File**: [`src/services/api.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/api.ts)
- **Endpoint**: `POST /api/Users/login`
- **Request Body**:
  ```json
  {
    "email": "NEXT_PUBLIC_FMA_USERNAME",
    "password": "NEXT_PUBLIC_FMA_PASSWORD"
  }
  ```
- **Response**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
  ```
- **Logic / Calculation**:
  - JWT token ko memory me cache kiya jata hai (`cachedToken`).
  - Expiry time: **55 minutes** (`Date.now() + 55 * 60 * 1000`).
  - Subsequent requests me header lagta hai: `Authorization: Bearer <token>`.

---

## 2. Client Configuration & Multi-Tenancy

Client dropdown se select hone par poore application ke context me `selectedClient` update hota hai:
- **Zustand Store**: `useClientStore` ([`src/services/api.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/api.ts))
- **Parameters Provided**:
  - `clientid`: Client ID string/number
  - `userid`: User ID (e.g. 2094)
  - `divisionid`: Division ID (e.g. 845, 586, 757, etc.)

Har API call me ye teeno IDs automatically pass hoti hain.

---

## 3. Module 1: Dashboard

### 📍 Page Route & Source Files
- **Route**: `/dashboard`
- **Page File**: [`src/app/(dashboard)/dashboard/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/dashboard/page.tsx)

### 🔌 APIs Used (Parallel Fetching)
Dashboard 4 alag-alag APIs se real-time data lata hai via `Promise.allSettled`:
1. `fuelLevelService.getFuelLevels({ pageSize: 10000, startDate: 7DaysAgo, endDate: today })`
2. `deliveryService.getDeliveries({ pageSize: 500, startDate: 90DaysAgo, endDate: today })`
3. `fuelIssueService.getFuelIssues({ pageSize: 5000 })`
4. `vehicleService.getVehicles({ pageSize: 500 })`

---

### 🧮 Dashboard Calculations & Metrics

#### A. Current Stock & Capacity %
- **Formula**:
  - Latest reading li jaati hai (Date & Time descending sort karke).
  $$\text{Current Stock} = \text{latestLevel.fuelLevel}$$
  $$\text{Stock Capacity \%} = \text{round}\left( \frac{\text{Current Stock}}{20,000} \times 100 \right)$$
  *(Base tank capacity: 20,000 Litres)*

#### B. 7-Day Tank Level Trend Chart
- Daily end-of-day reading ko aggregate kiya jata hai:
  - Ek din me multiple entries hone par sabse latest time (`time >= existing.time`) wali entry select hoti hai.
  - Date format: `DD-MMM` (e.g., `Aug 14`).

#### C. Deliveries KPI
- Recent 90 din ki total deliveries ka sum:
  $$\text{Total Delivery Volume} = \sum \text{delivery.quantity}$$
  $$\text{Total Deliveries Count} = \text{deliveriesRes.total}$$

#### D. Fuel Issued Today / Latest Day
- Aaj ki date (`YYYY-MM-DD`) se match hone wali transactions filter ki jaati hain:
  $$\text{Issued Today} = \sum_{\text{date} = \text{today}} \text{transaction.fuelQuantity}$$
- Agar aaj koi transaction nahi hui hai, to system automatically latest transaction date ka total dikhata hai (`Issued on YYYY-MM-DD`).

#### E. Fleet Consumption Breakdown (Donut Chart)
- Har transaction ko vehicle type me categorize kiya jata hai:
  - **Heavy Fleet**: Vehicle ID me `truck`, `bus`, `heavy`, `ht`, ya `semi` ho.
  - **Unassigned**: Vehicle ID khali ho ya `unknown`/`unassigned` ho.
  - **Light Vehicles**: Baki sabhi vehicles.
- **Percentage Formula**:
  $$\text{Category \%} = \text{round}\left( \frac{\text{Category Volume}}{\text{Total Volume}} \times 100 \right)$$

---

## 4. Module 2: Fuel Levels

### 📍 Page Route & Source Files
- **Route**: `/fuel-levels`
- **Page File**: [`src/app/(dashboard)/fuel-levels/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/fuel-levels/page.tsx)
- **Service**: [`src/services/fuelLevelService.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/fuelLevelService.ts)

### 🔌 API Endpoint
- **URL**: `POST /api/fmatanklevels/GetLevels`
- **Request Payload**:
  ```json
  {
    "clientid": 2591,
    "userid": 2094,
    "divisionid": 845,
    "datefrom": "2026-07-15",
    "dateto": "2026-08-15",
    "tankno": 1
  }
  ```
  *(Note: Backend database query me end date include karne ke liye `dateto` me +1 day add karke API ko bheja jata hai).*

### 📥 API Se Kya Aata Hai (Raw Response)
```json
[
  {
    "Id": 10542,
    "Date": "2026-08-14",
    "Time": "16:00:00",
    "Level": 14250.50
  }
]
```

### 🧮 Calculations
1. **Percentage Calculation**:
   $$\text{percentage} = \text{Number}\left( \left(\frac{\text{Level}}{20000} \times 100\right).\text{toFixed}(1) \right)$$
2. **Status Determination**:
   $$\text{Status} = \begin{cases} \text{"Low"}, & \text{if percentage} < 15\% \\ \text{"Normal"}, & \text{otherwise} \end{cases}$$

---

## 5. Module 3: Deliveries

### 📍 Page Route & Source Files
- **Route**: `/deliveries`
- **Page File**: [`src/app/(dashboard)/deliveries/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/deliveries/page.tsx)
- **Service**: [`src/services/deliveryService.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/deliveryService.ts)

### 🔌 API Endpoint
- **URL**: `POST /api/fmaweldandeliveries/GetDeliveries`
- **Request Payload**:
  ```json
  {
    "clientid": 2591,
    "userid": 2094,
    "divisionid": 845,
    "datefrom": "2025-08-15",
    "dateto": "2026-09-14",
    "tankno": 1
  }
  ```

### 📥 API Se Kya Aata Hai (Raw Response)
```json
[
  {
    "pk": 3412,
    "Delivery Start": "2026-08-10T11:30:00",
    "Delivery End": "2026-08-10T12:15:00",
    "Delivery amount": 5000,
    "Quantity": 5000,
    "Name": "Mobil Oil PNG",
    "Supplier": "Mobil Oil PNG",
    "Acronym": "AD"
  }
]
```

### 🧮 Calculations & Field Normalization
1. **Deduplication / Auto Delivery Filtering**:
   - Backend API se har delivery ke do records aate hain: `Auto Delivery` (Acronym: `AD`) aur `Calculated Delivery` (Acronym: `CD`).
   - Duplicate delivery quantities ko rokne ke liye `AD` / `Auto Delivery` ko filter karke discard kiya jata hai, aur sirf **`Calculated Delivery` (`CD`)** ko retain kiya jata hai.
2. **Date & Time Extraction**:
   - `Delivery Start` string ko split karke Date (`2026-08-10`) aur Time (`11:30:00`) nikala jata hai.
3. **Quantity Extraction**:
   - `item['Delivery amount'] || item.Quantity || 0`
4. **Reconciliation Impact**:
   - Reconciliation calculation me sirf **Calculated Delivery** count hoti hai jisse deliveries double na hon (e.g. 4,915.5 L single time add hoga na ki 9,830.9 L).

---

## 6. Module 4: Transactions (Fuel Issues)

### 📍 Page Route & Source Files
- **Route**: `/fuel-issues`
- **Page File**: [`src/app/(dashboard)/fuel-issues/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/fuel-issues/page.tsx)
- **Service**: [`src/services/fuelIssueService.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/fuelIssueService.ts)

### 🔌 API Endpoint
- **URL**: `POST /api/fmacontrollertrans/GetTransactions`
- **Request Payload**:
  ```json
  {
    "clientid": "2591",
    "userid": 2094,
    "divisionid": 845,
    "datefrom": "2026-05-15",
    "dateto": "2026-09-14"
  }
  ```

### 📥 API Se Kya Aata Hai (Raw Response)
```json
[
  {
    "TransactionId": 98231,
    "Date": "2026-08-14",
    "Time": "14:22:10",
    "RegistrationNo": "BAP 102",
    "FleetId": "FL-09",
    "DriverAttendant": "John Doe",
    "Depot": "POM Main Bowser",
    "DEM": "Matched DEM",
    "Quantity": 65.40,
    "Pump": "Pump 1",
    "Odometer": 128450,
    "EngineHours": 3420
  }
]
```

### 🧮 Calculations & Normalization
1. **DEM Status Check**:
   $$\text{Status} = \begin{cases} \text{"Matched"}, & \text{if DEM contains "matched" (case-insensitive)} \\ \text{"Unmatched"}, & \text{otherwise} \end{cases}$$
2. **Vehicle Identification**:
   - `vehicleId = RegistrationNo || DriverAttendant || 'Unassigned'`
3. **Sorting**:
   - Date + Time ke basis par descending order me sort hota hai (`latest first`).

---

## 7. Module 5: Fuel Efficiency (Vehicles)

### 📍 Page Route & Source Files
- **Route**: `/vehicles`
- **Page File**: [`src/app/(dashboard)/vehicles/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/vehicles/page.tsx)
- **Service**: [`src/services/vehicleService.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/vehicleService.ts)

### 🔌 Underlying API
- Ye page `fuelIssueService.getFuelIssues()` ki live transactions API call use karta hai (`/api/fmacontrollertrans/GetTransactions`).

### 🧮 Calculations & Business Logic
1. **Vehicle Categorization**:
   - Agar Vehicle ID me `truck` ya `bus` ho:
     - `vehicleType = "Truck"` ya `"Bus"`
     - `assetType = "Heavy"`
   - Baki sab: `vehicleType = "Car"`, `assetType = "Light"`
2. **Fuel Consumption & Distance**:
   - `odometer = tx.Odometer || 0`
   - `fuelIssued = Number(tx.Quantity.toFixed(2))`
   - Real-time row-by-row transaction audit track karta hai.

---

## 8. Module 6: Fuel Efficiency Summary

### 📍 Page Route & Source Files
- **Route**: `/fuel-efficiency-summary`
- **Page File**: [`src/app/(dashboard)/fuel-efficiency-summary/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/fuel-efficiency-summary/page.tsx)

### 🔌 Underlying API
- Call: `fuelIssueService.getFuelIssues({ pageSize: 100000, startDate, endDate })`

### 🧮 Core Efficiency Formulas
Har transaction ke liye Odometer reading aur Fuel Issued (Litres) ke beech mathematical calculation:

#### 1. Km per Litre (km/L)
$$\text{KmPerLtr} = \begin{cases} \dfrac{\text{Odometer}}{\text{Fuel Quantity}}, & \text{if Odometer} > 0 \text{ and Quantity} > 0 \\ 0, & \text{otherwise} \end{cases}$$
*(Code: `(odo / qty).toFixed(2)`)*

#### 2. Litres per 100 Km (L/100km)
$$\text{LtrsPer100Km} = \begin{cases} \left(\dfrac{\text{Fuel Quantity}}{\text{Odometer}}\right) \times 100, & \text{if Odometer} > 0 \text{ and Quantity} > 0 \\ 0, & \text{otherwise} \end{cases}$$
*(Code: `((qty / odo) * 100).toFixed(1)`)*

---

## 9. Module 7: Fuel Limits

### 📍 Page Route & Source Files
- **Route**: `/fuel-limits`
- **Page File**: [`src/app/(dashboard)/fuel-limits/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/fuel-limits/page.tsx)

### 🔌 APIs & Storage
1. **Live Fuel Usage**: `fuelIssueService.getFuelIssues()` se live consumption aati hai.
2. **Limit Configurations**: `localStorage` key `fuel_limits_config_<clientid>` me store hoti hai.

### 🧮 Calculations & Business Logic
1. **Monthly/Period Fuel Used**:
   - Har asset ka actual dispensed fuel `tx.Quantity` se nikalta hai.
2. **Limit Comparison**:
   - Agar custom limit set hai (e.g. 500 L):
   - Table me badge dikhaya jata hai (`Limit: 500 L` vs `Used: 350 L`).
   - Agar user ne koi limit nahi lagai: `No Limit`.

---

## 10. Module 8: Reconciliation (Stock & Audit Reconciliation)

### 📍 Page Route & Source Files
- **Route**: `/reconciliation`
- **Page File**: [`src/app/(dashboard)/reconciliation/page.tsx`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/app/(dashboard)/reconciliation/page.tsx)
- **Service**: [`src/services/reconciliationService.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/services/reconciliationService.ts)
- **Calculation Core**: [`src/lib/reconciliation.ts`](file:///d:/Ankit/Fuel-Management/Fuel-Management-KD-Id/src/lib/reconciliation.ts)

### 🔌 APIs Used (Data Aggregation from 3 APIs)
1. **Tank Levels**: `fuelLevelService.getFuelLevels()` -> `Level`, `Date`, `Time`
2. **Deliveries**: `deliveryService.getDeliveries()` -> `Quantity`, `Date`, `Time`
3. **Fuel Issues**: `fuelIssueService.getFuelIssues()` -> `Quantity`, `Date`, `Time`

---

### 🧮 Deep Dive: Daily Reconciliation Logic

#### A. 4:00 PM to 4:00 PM Cutoff Interval
Reconciliation standard 24-hour cycle **Previous Day 4:00 PM** se lekar **Current Day 4:00 PM** par operate karti hai:
- **Interval Start**: `prevDate 16:00:00`
- **Interval End**: `currentDate 16:00:00`

#### B. Opening Dip vs Actual Closing Dip
1. **Opening Balance (Opening Dip)**:
   - Previous Day ke sabhi tank levels me se jo reading 16:00 (4:00 PM) ke sabse kareeb hoti hai:
     $$\min | \text{recordTime} - 16:00:00 |$$
2. **Actual Closing Dip**:
   - Current Day ke sabhi tank levels me se jo reading 16:00 (4:00 PM) ke sabse kareeb hoti hai:
     $$\min | \text{recordTime} - 16:00:00 |$$

#### C. Deliveries & Fuel Issues in Interval
- Deliveries: Sabhi fuel deliveries jinka timestamp `[prevDate 16:00, currentDate 16:00]` ke beech ho:
  $$\text{Deliveries} = \sum \text{delivery.quantity}$$
- Fuel Issues: Sabhi transactions jinka timestamp `[prevDate 16:00, currentDate 16:00]` ke beech ho:
  $$\text{Fuel Issues} = \sum \text{issue.fuelQuantity}$$

#### D. Expected Closing & Variance Formulas
1. **Expected Closing Stock**:
   $$\text{Expected Closing} = \text{Opening Balance} + \text{Deliveries} - \text{Fuel Issues}$$
2. **Variance (Net Gain/Loss)**:
   $$\text{Variance} = \text{Actual Closing Dip} - \text{Expected Closing}$$
3. **Variance %**:
   $$\text{Variance \%} = \left(\frac{\text{Variance}}{\text{Expected Closing}}\right) \times 100$$
4. **Audit Status Classification**:
   $$\text{Status} = \begin{cases} 
   \text{"Exception"}, & \text{if } |\text{Variance}| > 50\text{ Litres} \\
   \text{"Warning"}, & \text{if } |\text{Variance}| > 30\text{ Litres} \\
   \text{"Reconciled"}, & \text{if } |\text{Variance}| \le 30\text{ Litres}
   \end{cases}$$

---

### 🧮 Deep Dive: Stock Demand Plan & Forecast Cards
Reconciliation page ke top right me **Stock Demand Plan** card ka calculation:

1. **Current Tank Stock**:
   $$\text{Stock} = \text{Closing Dip of the latest day}$$
2. **Average Daily Consumption (Av Daily Cons)**:
   $$\text{Av Daily Cons} = \frac{\sum \text{Fuel Issues}}{\text{Number of Days in Range}}$$
3. **Days Stock Remaining**:
   $$\text{Days Stock} = \text{round}\left( \frac{\text{Current Tank Stock}}{\text{Av Daily Cons}} \right)$$
4. **Target Re-Order Date**:
   - Lead time: `7 days` (`reorderDays`)
   $$\text{Re-Order Date} = \text{Today} + (\text{Days Stock} - 7 \text{ days})$$
5. **Expected Stock Arrival Date**:
   $$\text{Arrival Date} = \text{Today} + \text{Days Stock}$$

---

## 11. Summary Table (Quick Reference)

| Module | Route | API Endpoint | Primary API Fields Received | Main Calculation / Formula |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | — | `POST /api/Users/login` | `token`, `user` | JWT Bearer cache (55 mins) |
| **Dashboard** | `/dashboard` | Parallel 4 APIs | Level, Delivery, Issues, Odo | KPI sums, 7-Day trends, Fleet % breakdown |
| **Fuel Levels** | `/fuel-levels` | `POST /api/fmatanklevels/GetLevels` | `Level`, `Date`, `Time` | `(Level / 20000) * 100`, Status (<15% = Low) |
| **Deliveries** | `/deliveries` | `POST /api/fmaweldandeliveries/GetDeliveries` | `Delivery amount`, `Delivery Start`, `Name`, `Acronym` | Quantity extraction, Date/Time parsing |
| **Transactions** | `/fuel-issues` | `POST /api/fmacontrollertrans/GetTransactions` | `Quantity`, `RegistrationNo`, `DEM`, `Odometer`, `Pump` | `DEM.includes('matched') ? 'Matched' : 'Unmatched'` |
| **Fuel Efficiency** | `/vehicles` | `POST /api/fmacontrollertrans/GetTransactions` | `RegistrationNo`, `Odometer`, `Quantity` | Vehicle Type classification (Truck/Bus/Car) |
| **Efficiency Summary**| `/fuel-efficiency-summary`| `POST /api/fmacontrollertrans/GetTransactions`| `Odometer`, `Quantity`, `Date`, `Time` | `km/L = Odo / Ltrs`, `L/100km = (Ltrs / Odo) * 100` |
| **Fuel Limits** | `/fuel-limits` | `POST /api/fmacontrollertrans/GetTransactions` + LocalStorage | `Quantity`, `RegistrationNo` | `monthlyFuelUsed = Quantity`, Limit threshold check |
| **Reconciliation** | `/reconciliation`| Levels + Deliveries + Issues (3 APIs combined) | Levels, Deliveries, Issues in 4PM-4PM cycle | `Expected = Open + Deliv - Issues`<br>`Variance = Actual - Expected`<br>`Variance % = (Variance / Expected) * 100`<br>`Days Stock = Closing / DailyAvg` |

---
*Documentation generated for Fuel Management KD-Id Project.*
