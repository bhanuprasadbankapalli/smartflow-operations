# SmartFlow Operations

Build a production-quality, modern web application called "SmartFlow WMS" — a Smart Warehouse Operations & Order Fulfillment System for a college hackathon.

IMPORTANT:

This must NOT be a simple CRUD application or static dashboard. The application must simulate a real warehouse operation and make intelligent operational decisions using rule-based algorithms and mock data. Every major workflow should be functional and connected.

==================================================

1. PROJECT OBJECTIVE

==================================================

Build a warehouse management platform that manages the complete order fulfillment lifecycle:

Order Created

→ Priority Determined

→ Inventory Checked

→ Inventory Allocated

→ Picking

→ Packing

→ Quality Check

→ Dispatch

→ Inventory Updated

→ Order Completed

The system must also handle exceptions:

Exception

→ Analyze

→ Decision

→ Resolution

The main competitive advantage is DECISION MAKING.

The system should automatically:

- Prioritize orders

- Allocate limited inventory

- Detect low-stock and out-of-stock products

- Recommend reorders

- Detect damaged/missing items

- Identify fulfillment bottlenecks

- Recommend operational actions

- Track warehouse performance

==================================================

2. DESIGN / UI REQUIREMENTS

==================================================

Create a premium SaaS-style warehouse dashboard.

Design should feel like a real enterprise Warehouse Management System, not a student CRUD project.

Use:

- Clean modern UI

- Responsive design

- Desktop-first dashboard

- Sidebar navigation

- Top navigation bar

- Cards

- Tables

- Charts

- Status badges

- Progress indicators

- Modal dialogs

- Toast notifications

- Empty states

- Loading states

- Confirmation dialogs

- Error states

Use a professional warehouse/operations visual style.

Use consistent status colors:

- Green = completed / healthy

- Yellow = warning

- Red = critical / exception

- Blue = processing / information

Do NOT overcrowd the dashboard.

Make the interface intuitive enough that a warehouse manager can understand the situation within a few seconds.

==================================================

3. MAIN USER ROLES

==================================================

Implement three roles:

1. Warehouse Manager

- Full dashboard access

- Inventory management

- Order management

- Smart allocation

- Analytics

- Exception handling

- Reorder recommendations

2. Warehouse Worker

- View assigned picking tasks

- Update picking status

- Report missing/damaged products

- Complete packing tasks

3. Dispatcher

- View quality-checked orders

- Verify orders

- Dispatch orders

- Update dispatch status

Create role-based navigation and permissions.

For the hackathon demo, provide realistic demo accounts or a simple role selector.

==================================================

4. DASHBOARD

==================================================

Create an intelligent warehouse operations dashboard.

Top KPI cards:

- Total Orders

- Pending Orders

- Orders in Picking

- Orders in Packing

- Ready for Dispatch

- Completed Orders

- Low Stock Items

- Out of Stock Items

- Delayed Orders

Show:

1. Order Status Overview

2. Inventory Health

3. Order Priority Distribution

4. Fulfillment Performance

5. Picking Performance

6. Packing Performance

7. Recent Exceptions

8. Bottleneck Detection

9. Smart Recommendations

Create a "Smart Operations Assistant" section.

Example recommendations:

"12 orders are waiting for packing. Packing is currently the biggest bottleneck."

"Product SKU-104 is below reorder level. Recommended reorder quantity: 50 units."

"Order #ORD-1024 is urgent but only 7 of 10 required units are available. Allocate available stock and create a backorder for 3 units."

==================================================

5. INVENTORY MANAGEMENT

==================================================

Create an Inventory page.

Product fields:

- Product ID / SKU

- Product Name

- Category

- Quantity

- Reserved Quantity

- Available Quantity

- Minimum Stock Level

- Reorder Point

- Warehouse Location

- Supplier

- Unit Price

- Status

- Last Updated

Inventory statuses:

- In Stock

- Low Stock

- Out of Stock

- Reserved

- Damaged

Features:

- Search

- Filter

- Sort

- Pagination

- Add product

- Edit product

- View product details

- Stock adjustment

- Stock history

Automatically calculate:

Available Stock =

Total Stock - Reserved Stock

Automatically detect:

IF available stock <= reorder point

→ Low Stock Alert

IF available stock = 0

→ Out of Stock Alert

==================================================

6. SMART REORDER RECOMMENDATION

==================================================

Create a rule-based reorder recommendation engine.

Use:

Current Stock

Average Daily Demand

Lead Time

Safety Stock

Reorder Point

Example logic:

Reorder Point =

(Average Daily Demand × Lead Time) + Safety Stock

Recommended Order Quantity =

Maximum Stock Level - Current Stock

Display recommendations such as:

Product: Wireless Mouse

Current Stock: 8

Average Daily Demand: 12

Lead Time: 3 days

Safety Stock: 10

Recommendation:

"Reorder 38 units"

Allow manager to:

- Approve recommendation

- Reject recommendation

- Mark as ordered

==================================================

7. ORDER MANAGEMENT

==================================================

Create Orders page.

Order fields:

- Order ID

- Customer

- Order Date

- Delivery Deadline

- Priority

- Items

- Total Quantity

- Order Value

- Current Status

- Assigned Worker

- Warehouse Location

- Delay Status

Statuses:

NEW

PRIORITIZED

ALLOCATED

PICKING

PACKING

QUALITY_CHECK

READY_FOR_DISPATCH

DISPATCHED

COMPLETED

BACKORDER

EXCEPTION

CANCELLED

Create an Order Details page with a visual timeline showing:

Order Created

→ Priority

→ Inventory Allocated

→ Picking

→ Packing

→ Quality Check

→ Dispatch

→ Completed

==================================================

8. SMART ORDER PRIORITIZATION

==================================================

Implement a rule-based order priority algorithm.

Priority should consider:

- Delivery deadline

- Customer priority

- Order age

- Stock availability

- Order value

Example scoring:

Urgent delivery deadline = +40

VIP customer = +20

Older order = +15

Available inventory = +15

High order value = +10

Convert score into:

80+ = CRITICAL

60-79 = HIGH

40-59 = MEDIUM

Below 40 = NORMAL

Show the reason for the priority.

Example:

"Order #ORD-1042 is HIGH priority because:

- Delivery deadline is within 8 hours

- Customer is VIP

- Inventory is fully available"

==================================================

9. SMART INVENTORY ALLOCATION

==================================================

This is one of the most important hackathon features.

When multiple orders compete for limited stock, automatically allocate inventory based on priority.

Example:

Product:

Laptop Pro 15

Available:

7 units

Order A:

Priority = CRITICAL

Required = 10

Order B:

Priority = NORMAL

Required = 5

Decision:

Allocate 7 units to Order A.

Create backorder for remaining 3 units.

Order B waits for replenishment.

Show a "Decision Explanation":

"7 available units were allocated to Order A because it has higher priority."

The system must never allocate more stock than is available.

Prevent negative inventory.

==================================================

10. PICKING MANAGEMENT

==================================================

Create a Picking page.

Show:

- Picking Task ID

- Order ID

- Worker

- Product

- Quantity

- Location

- Priority

- Status

- Start Time

- Completion Time

Statuses:

ASSIGNED

IN_PROGRESS

COMPLETED

MISSING

DAMAGED

Create a worker-friendly picking interface.

Example:

Order #ORD-1042

Pick:

Laptop Pro 15 × 2

Location:

Aisle A

Rack A-04

Shelf 02

Buttons:

START PICKING

MARK PICKED

REPORT MISSING

REPORT DAMAGED

When picking is completed, automatically move order to PACKING.

==================================================

11. PICKING OPTIMIZATION

==================================================

Implement a simple picking optimization algorithm.

Group products by warehouse location.

Instead of:

Aisle A

→ Aisle C

→ Aisle A

→ Aisle D

Optimize:

Aisle A

→ Aisle A

→ Aisle C

→ Aisle D

Display:

"Optimized picking route"

and show estimated distance/time saved.

Use mock warehouse locations.

==================================================

12. PACKING MANAGEMENT

==================================================

Create Packing page.

Show orders waiting for packing.

Packing worker can see:

- Order ID

- Items

- Quantities

- Packaging recommendation

- Estimated weight

- Packing status

Create packing verification.

Example:

Required:

Laptop × 2

Mouse × 1

Picked:

Laptop × 2

Mouse × 1

Result:

"Packing verification passed."

Allow:

START PACKING

COMPLETE PACKING

REPORT MISSING ITEM

When packing is completed, move order to QUALITY_CHECK.

==================================================

13. QUALITY CHECK

==================================================

Create Quality Check page.

Checklist:

- Correct Product

- Correct Quantity

- Product Condition

- Packaging

- Order Label

- Customer Information

Buttons:

PASS QUALITY CHECK

FAIL QUALITY CHECK

If failed:

Create an exception automatically.

==================================================

14. EXCEPTION MANAGEMENT

==================================================

Create an Exceptions page.

Exception types:

- Missing Item

- Damaged Item

- Stock Shortage

- Wrong Item

- Packing Error

- Quality Failure

- Dispatch Delay

Every exception must follow:

EXCEPTION

→ ANALYSIS

→ DECISION

→ RESOLUTION

Example:

Exception:

"2 units of Product X are damaged."

System checks inventory.

If replacement stock exists:

Decision:

"Replace damaged units from available inventory."

If replacement stock doesn't exist:

Decision:

"Create backorder and notify manager."

Show:

- Exception severity

- Affected order

- Product

- Detected time

- Recommended action

- Resolution status

==================================================

15. DISPATCH MANAGEMENT

==================================================

Create Dispatch page.

Show:

- Order ID

- Customer

- Destination

- Package Weight

- Courier

- Tracking ID

- Dispatch Time

- Status

Statuses:

READY

DISPATCHED

IN_TRANSIT

DELIVERED

Use mock tracking IDs.

When dispatched:

- Update order status

- Reduce inventory

- Record dispatch time

- Add activity log

==================================================

16. BOTTLENECK DETECTION

==================================================

This is another major smart feature.

Analyze workflow stages:

Orders

→ Picking

→ Packing

→ Quality Check

→ Dispatch

Calculate waiting orders and average processing time per stage.

If one stage exceeds a threshold, identify it as a bottleneck.

Example:

Picking:

Average = 8 minutes

Packing:

Average = 25 minutes

Quality Check:

Average = 7 minutes

System should display:

"PACKING BOTTLENECK DETECTED"

Recommendation:

"Assign 2 additional workers to packing."

Create a Bottleneck Alert card.

==================================================

17. ANALYTICS

==================================================

Create an Analytics page.

Include charts for:

- Orders per day

- Orders by priority

- Orders by status

- Inventory health

- Low-stock products

- Fulfillment rate

- Average fulfillment time

- Picking efficiency

- Packing efficiency

- Exception frequency

- Bottlenecks

Calculate:

Fulfillment Rate =

Completed Orders / Total Orders × 100

Show performance indicators.

==================================================

18. SMART OPERATIONS ASSISTANT

==================================================

Create a dedicated "Smart Decisions" section.

This should show automatically generated recommendations.

Examples:

1.

"URGENT ORDER ALERT

Order #ORD-1008 requires 10 units but only 7 are available.

Recommended action: Allocate 7 units and backorder 3."

2.

"LOW STOCK ALERT

Wireless Mouse has 4 available units.

Recommended reorder: 50 units."

3.

"BOTTLENECK ALERT

Packing is processing orders 42% slower than picking.

Recommended action: Assign additional packing capacity."

4.

"DELAY ALERT

Order #ORD-1022 may miss its delivery deadline.

Recommended action: Increase priority."

Each recommendation should have:

- Severity

- Reason

- Recommended action

- Action button

==================================================

19. NOTIFICATION CENTER

==================================================

Create notifications for:

- Low stock

- Out of stock

- Urgent orders

- Stock shortage

- Damaged products

- Missing products

- Delayed orders

- Bottlenecks

- Reorder recommendations

Allow notifications to be marked as read.

==================================================

20. ACTIVITY LOG

==================================================

Create an activity timeline.

Examples:

"Order #ORD-1021 prioritized as HIGH"

"5 units allocated to Order #ORD-1021"

"Worker John started picking"

"2 items picked successfully"

"Packing completed"

"Quality check passed"

"Order dispatched"

This should help managers audit warehouse activity.

==================================================

21. DATABASE / DATA MODEL

==================================================

Create a proper relational data structure.

Entities:

Users

Products

Categories

Inventory

Orders

OrderItems

PickingTasks

PackingTasks

QualityChecks

Exceptions

Shipments

Notifications

Recommendations

ActivityLogs

Suppliers

ReorderRequests

Use relationships between entities.

Do not store everything in one table.

==================================================

22. MOCK DATA

==================================================

Seed realistic mock data.

Create at least:

30 products

20 customers

40 orders

10 warehouse workers

5 suppliers

Multiple inventory locations

Several low-stock products

Several out-of-stock products

Several urgent orders

Several exceptions

Several completed orders

Several delayed orders

Make the data realistic and internally consistent.

==================================================

23. IMPORTANT DEMO SCENARIO

==================================================

Create one special demo scenario for the hackathon.

Scenario:

Product:

Industrial Safety Helmet

Available Stock:

7

Order #ORD-5001:

Required = 10

Priority = CRITICAL

Order #ORD-5002:

Required = 5

Priority = NORMAL

When the demo scenario is triggered:

The system should:

1. Detect shortage

2. Compare order priorities

3. Allocate 7 units to ORD-5001

4. Create backorder for 3 units

5. Keep ORD-5002 waiting

6. Generate shortage alert

7. Recommend replenishment

8. Display the complete decision explanation

Create a "Run Smart Decision Demo" button so judges can see this functionality immediately.

==================================================

24. RESPONSIVE DESIGN

==================================================

The application must work on:

- Desktop

- Laptop

- Tablet

- Mobile

Desktop dashboard should be optimized for 1366px+ screens.

==================================================

25. PERFORMANCE / CODE QUALITY

==================================================

Use reusable components.

Avoid duplicated code.

Use proper state management.

Use form validation.

Handle loading and error states.

Prevent invalid operations such as:

- Negative inventory

- Allocating more than available stock

- Completing an order before picking

- Dispatching an order before quality check

- Packing an order with missing items

Enforce workflow transitions.

==================================================

26. HACKATHON DEMO EXPERIENCE

==================================================

The application should be easy to demonstrate in 5-10 minutes.

Create a clear demo flow:

1. Open Dashboard

2. Show inventory shortage

3. Open Orders

4. Show smart priority

5. Run Smart Allocation

6. Show picking task

7. Complete picking

8. Complete packing

9. Run quality check

10. Dispatch order

11. Show inventory update

12. Show analytics

13. Show bottleneck detection

14. Show Smart Decision recommendations

Add realistic toast messages and animations where appropriate.

==================================================

27. FINAL PRODUCT REQUIREMENT

==================================================

The final application must feel like a real-world warehouse operations product.

DO NOT create:

- A basic CRUD dashboard

- Static charts

- Fake buttons that do nothing

- Pages with placeholder text

- Unconnected modules

Instead create:

- Connected workflows

- Real state changes

- Decision-making logic

- Exception handling

- Smart recommendations

- Realistic mock data

- Professional UI

- Strong dashboard

- Clear user experience

The most important message of the product should be:

"Don't just monitor the warehouse — help the warehouse make better decisions."

Build the complete application with all pages, navigation, components, mock data, business logic, workflows, and polished UI.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/96862463-4d99-40b6-80ec-061dfb965337).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
