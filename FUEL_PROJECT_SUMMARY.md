# Fuel Management Dashboard - Project Summary & API Configuration

This document contains a complete summary of the API details, configuration setup, and page overhauls implemented in the dashboard. You can copy this file or present it to any AI agent in the future to immediately context-load the project state.

---

## 1. API Configurations & Env Setup
- **Base URL:** Loaded from `.env.local` (`NEXT_PUBLIC_FMA_API_URL=https://api.fmafrica.com:4801`)
- **Login Credentials:**
  - Loaded from `.env.local` (`NEXT_PUBLIC_FMA_USERNAME` & `NEXT_PUBLIC_FMA_PASSWORD`)
  - **Endpoint:** `POST /api/Users/login`
- **Core Endpoints:**
  - **Tank Levels:** `POST /api/fmatanklevels/GetLevels`
    - **Payload:** `{"clientid": number, "userid": number, "divisionid": number, "datefrom": "YYYY-MM-DD", "dateto": "YYYY-MM-DD", "tankno": number}`
  - **Deliveries:** `POST /api/fmaweldandeliveries/GetDeliveries`
    - **Payload:** `{"clientid": number, "userid": number, "divisionid": number, "datefrom": "YYYY-MM-DD", "dateto": "YYYY-MM-DD", "tankno": number}`
  - **Transactions:** `POST /api/fmacontrollertrans/GetTransactions`
    - **Payload:** `{"clientid": "string", "userid": number, "divisionid": number, "datefrom": "YYYY-MM-DD", "dateto": "YYYY-MM-DD"}`
    - *Note:* In `GetTransactions`, the `clientid` must be passed as a string, while `userid` and `divisionid` must be numbers.

- **Configured Identifiers (Clients 1, 2, 4, 5, 6):**
  - All default to: `ClientID: 2591`, `UserID: 2094`, `DivisionID: 845`. Managed via a client switcher.

---

## 2. Implemented Features & Routing
- **Clean API Integration:** All mock databases under `src/data/` were completely removed. Services connect directly to the live FMA port 4801 API endpoints.
- **Client Switcher:** Added to [`Header.tsx`](./src/components/layout/Header.tsx). Retains settings using a Zustand store inside [`api.ts`](./src/services/api.ts) and automatically reloads active page states on change.
- **Sidebar & Route Access:**
  - Removed **Dashboard** and **Reports** pages. Redirected `/dashboard` and `/reports` to `/fuel-levels` inside page components.
  - Added new routes in [`auth.ts`](./src/lib/auth.ts) to prevent middleware intercepts: `/fuel-efficiency-summary` and `/fuel-limits`.
- **Page Overhauls:**
  - **Fuel Levels Page:** Removed the "Current Tank Status" panel. Renders levels history directly from the `GetLevels` endpoint using a blue gradient `AreaChart` with formatted X-Axis date ticks and custom tooltips. Unique `createdAt` is used for `XAxis` dataKey to fix hover values mismatch.
  - **Deliveries Page:** Removed `Supplier`, `Status`, and `Actions` columns from the listing table.
  - **Transactions Page:** Matches columns exactly to the layout (Date/Time, ID, Vehicle Req, Fleet Id, Vehicle Detail, Site, Litres, Pump, Odo Meter, Hour Meter, DEM). Removed the Actions column. Filters (From/To dates, status, vehicle, search) only trigger loading on clicking "Search". Added "Reset" button.
  - **Fuel Efficiency Page:** Aggregates vehicles live from the Transactions API (`GetTransactions`), computing odometer, distance, and consumption. Added Date Filters (From/To), Search, and Reset button. Removed Actions column.
  - **Fuel Efficiency Summary Page:** Aggregates transactions by vehicle to calculate live mileage (`Km/L` and `L/100Km`). Added Date Filters (From/To), Search, and Reset button.
  - **Fuel Limits Page:** Auto-populates all active vehicles retrieved from live transactions. Limits default to `No Limit`. Clicking "Edit" is removed; limits are read directly. Removed Actions column.
  - **Reconciliation Page:** Dynamic calculations based on the 4 PM to 4 PM time boundaries from live levels, deliveries, and transactions. Renders a custom styled "Stock Reconciliation Summary" and "Stock Demand Plan" table at the top matching the client's Excel sheet with brand teal background colors and dark borders. Added Date Filters (From/To) and Variance % column. Removed Actions column.
  - **Login Page Auto-fill:** Made the demo account credentials clickable buttons which automatically fill the form fields for instant login.

---

## 3. Files Created / Modified
- [`src/services/api.ts`](./src/services/api.ts) - Base HTTP fetch client, authentication token caching, and Client Selection Zustand store. (Configured to use `.env.local` variables).
- [`.env.local`](./.env.local) - **[NEW]** Environment variables for API config and credentials (ignored in git).
- [`src/services/fuelLevelService.ts`](./src/services/fuelLevelService.ts) - Connects to `/api/fmatanklevels/GetLevels`.
- [`src/services/deliveryService.ts`](./src/services/deliveryService.ts) - Connects to `/api/fmaweldandeliveries/GetDeliveries`.
- [`src/services/fuelIssueService.ts`](./src/services/fuelIssueService.ts) - Connects to `/api/fmacontrollertrans/GetTransactions`.
- [`src/services/vehicleService.ts`](./src/services/vehicleService.ts) - Aggregates vehicles live from the Transactions API.
- [`src/services/reconciliationService.ts`](./src/services/reconciliationService.ts) - Aggregates daily variance logs using 4 PM - 4 PM window.
- [`src/components/layout/Header.tsx`](./src/components/layout/Header.tsx) - Client switcher select element.
- [`src/components/layout/Sidebar.tsx`](./src/components/layout/Sidebar.tsx) - Cleaned up sidebar tabs and brand redirection.
- [`src/lib/auth.ts`](./src/lib/auth.ts) - Added permission routes.
- [`src/app/login/page.tsx`](./src/app/login/page.tsx) - Added demo credentials click-to-fill features.
- [`src/app/(dashboard)/fuel-efficiency-summary/page.tsx`](./src/app/\(dashboard\)/fuel-efficiency-summary/page.tsx) - **[NEW]** Fuel Efficiency Summary grouping logic, date range inputs, Search/Reset.
- [`src/app/(dashboard)/fuel-limits/page.tsx`](./src/app/\(dashboard\)/fuel-limits/page.tsx) - **[NEW]** Manual limits CRUD and LocalStorage store. Removed actions.
- `src/data/` - **[DELETED]** Mock files folder.
