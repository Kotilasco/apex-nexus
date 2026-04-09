# Apex Nexus — End-to-End Browser Testing Guide

**Version:** 2.0  
**Date:** April 5, 2026  
**Classification:** Internal — QA Engineering

> **This guide is 100% browser-based.** Every test is performed through the Apex Nexus web UI at `http://localhost:3000`. No curl commands, no terminal interactions.

---

## Table of Contents

1. [Prerequisites & Environment](#1-prerequisites--environment)
2. [Test 1: Login & Authentication](#2-test-1-login--authentication)
3. [Test 2: Registration](#3-test-2-registration)
4. [Test 3: Dashboard](#4-test-3-dashboard)
5. [Test 4: Document Management](#5-test-4-document-management)
6. [Test 5: Folder Hierarchy](#6-test-5-folder-hierarchy)
7. [Test 6: Document Checkout & Versioning](#7-test-6-document-checkout--versioning)
8. [Test 7: Document Notes](#8-test-7-document-notes)
9. [Test 8: Workflow Engine](#9-test-8-workflow-engine)
10. [Test 9: Workflow Designer](#10-test-9-workflow-designer)
11. [Test 10: Search](#11-test-10-search)
12. [Test 11: Retention Management](#12-test-11-retention-management)
13. [Test 12: Compliance & Jurisdictions](#13-test-12-compliance--jurisdictions)
14. [Test 13: AI Trust Center](#14-test-13-ai-trust-center)
15. [Test 14: Analytics](#15-test-14-analytics)
16. [Test 15: Industry Solutions](#16-test-15-industry-solutions)
17. [Test 16: Plugin Marketplace](#17-test-16-plugin-marketplace)
18. [Test 17: SAP ERP Integration](#18-test-17-sap-erp-integration)
19. [Test 18: Audit Log](#19-test-18-audit-log)
20. [Test 19: Notifications](#20-test-19-notifications)
21. [Test 20: Admin — User Management](#21-test-20-admin--user-management)
22. [Test 21: Admin — System Settings](#22-test-21-admin--system-settings)
23. [Test 22: Sidebar Navigation](#23-test-22-sidebar-navigation)
24. [Test 23: Security from the Browser](#24-test-23-security-from-the-browser)
25. [Test Result Tracker](#25-test-result-tracker)

---

## 1. Prerequisites & Environment

### What You Need

- A modern web browser (Chrome or Firefox recommended)
- Docker Desktop running with all Apex Nexus containers up
- Access to `http://localhost:3000`

### Default Credentials

| User | Password | Role |
|------|----------|------|
| admin | Admin@2024! | SYSTEM_ADMIN |

### Verify the Platform is Running

1. Open your browser
2. Navigate to `http://localhost:3000`
3. You should see the Apex Nexus login screen with the sign-in form
4. If the page doesn't load, ensure Docker containers are running

---

## 2. Test 1: Login & Authentication

**Page:** `http://localhost:3000/login`

### T1.1 — Valid Login

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000` | Login page appears with "Sign in to your account" heading |
| 2 | Type `admin` in the Username field | Text appears in field |
| 3 | Type `Admin@2024!` in the Password field | Password is masked (dots) |
| 4 | Click the **eye icon** next to password | Password becomes visible as plain text |
| 5 | Click the **eye icon** again | Password is masked again |
| 6 | Click the **Sign In** button | Page redirects to `/dashboard`, "Welcome back" heading appears |

### T1.2 — Invalid Password

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/login` | Login page appears |
| 2 | Type `admin` in Username | Text appears |
| 3 | Type `wrongpassword` in Password | Text appears (masked) |
| 4 | Click **Sign In** | Error message appears (red), stays on login page |

### T1.3 — Empty Credentials

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/login` | Login page appears |
| 2 | Leave both fields empty | Fields are empty |
| 3 | Click **Sign In** | Validation error or no action (button may be disabled) |

### T1.4 — Session Persistence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as admin (T1.1) | Dashboard loads |
| 2 | Open a new browser tab | New tab opens |
| 3 | Navigate to `http://localhost:3000/dashboard` | Dashboard loads directly (no redirect to login) |

### T1.5 — Protected Route Redirect

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open a private/incognito window | Fresh browser session |
| 2 | Navigate to `http://localhost:3000/documents` | Redirected to `/login` page |

---

## 3. Test 2: Registration

**Page:** `http://localhost:3000/register`

### T2.1 — Successful Registration

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From the login page, click the **Register** link | Register page loads with "Register" heading |
| 2 | Fill in: Full Name = `Test User` | Field populated |
| 3 | Fill in: Username = `testuser` | Field populated |
| 4 | Fill in: Email = `test@apex.io` | Field populated |
| 5 | Fill in: Password = `Test@1234` | Password masked |
| 6 | Fill in: Confirm Password = `Test@1234` | Password masked |
| 7 | Click **Create Account** | Success state shown with "Go to Login" button |
| 8 | Click **Go to Login** | Redirected to login page |

### T2.2 — Password Mismatch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Register page loads |
| 2 | Fill in all fields, but set Confirm Password = `Different123` | Fields populated |
| 3 | Click **Create Account** | Error: passwords don't match |

### T2.3 — Navigate Back to Login

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On register page, click **Sign In** link | Navigated back to login page |

---

## 4. Test 3: Dashboard

**Page:** `http://localhost:3000/dashboard`  
**Prerequisite:** Logged in as admin

### T3.1 — Dashboard Loads with Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Dashboard** in sidebar | Dashboard page loads |
| 2 | Observe the greeting | "Welcome back, admin" (or first name) |
| 3 | Check the 4 stat cards | Four cards visible: **Total Documents**, **Pending Approvals**, **Pending Dispositions**, **Audit Entries** — each with a numeric value |
| 4 | Check the charts section | Three charts render: Weekly Activity (bar), Document Categories (donut pie), 6-Month Trend (area) |

### T3.2 — Stat Card Navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Total Documents** stat card | Navigated to `/documents` |
| 2 | Go back to Dashboard | Dashboard loads |
| 3 | Click the **Pending Approvals** stat card | Navigated to `/workflow` |
| 4 | Go back to Dashboard | Dashboard loads |
| 5 | Click the **Pending Dispositions** stat card | Navigated to `/retention` |
| 6 | Go back to Dashboard | Dashboard loads |
| 7 | Click the **Audit Entries** stat card | Navigated to `/audit` |

### T3.3 — Quick Action Links

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to Quick Actions section | 8 icon buttons visible |
| 2 | Click **Upload** quick action | Navigated to documents page (or upload modal) |
| 3 | Go back, click **Search** quick action | Navigated to `/search` |
| 4 | Go back, click **Compliance** quick action | Navigated to `/compliance` |

---

## 5. Test 4: Document Management

**Page:** `http://localhost:3000/documents`  
**Prerequisite:** Logged in as admin

### T4.1 — Document List Loads

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Documents** in sidebar | Documents page loads with folder grid and document table |
| 2 | Observe the seed folders | Root folders visible: **Root**, **Shared Documents**, **Templates**, **Archive** |
| 3 | Observe the documents table | Columns visible: Name, Size, Status, Version, Modified, Actions (⋮) |

### T4.2 — Upload a Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Upload** button (top of page) | Upload modal opens |
| 2 | Select a file from your computer (e.g., a .txt or .pdf file) | File name appears in the modal |
| 3 | Enter a title (e.g., "Browser Test Document") | Title field populated |
| 4 | Click the **Upload** / **Submit** button in the modal | Modal closes, document appears in the list |
| 5 | Verify the new document row | Title matches, Status shows DRAFT or ACTIVE, Version shows v1 |

### T4.3 — View Document Detail

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on the document name in the table | Detail panel slides in from the right |
| 2 | Observe the metadata | Type, Size, Version, Status, Created, Modified, Description are displayed |
| 3 | If the file is an image or PDF | Preview renders in the panel (image or PDF viewer) |

### T4.4 — Download a Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **⋮** (three dots) menu on a document row | Context menu appears |
| 2 | Click **Download** | File downloads to your computer |
| 3 | Open the downloaded file | Content matches what was uploaded |

### T4.5 — Delete a Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **⋮** menu on a document row | Context menu appears |
| 2 | Click **Delete** | Confirmation dialog appears |
| 3 | Confirm the deletion | Document is removed from the list |
| 4 | Refresh the page | Document is no longer visible |

### T4.6 — Pagination

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload 21+ documents (or have them pre-existing) | Documents listed on page 1 |
| 2 | Click **Next** | Page 2 loads with remaining documents |
| 3 | Click **Previous** | Returns to page 1 |
| 4 | Page indicator shows "Page X of Y" | Correct page numbers |

---

## 6. Test 5: Folder Hierarchy

**Page:** `http://localhost:3000/documents`

### T5.1 — Create a New Folder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **New Folder** button | Inline folder creation form appears |
| 2 | Type `E2E Test Folder` in the folder name input | Text appears |
| 3 | Press **Enter** or click **Create** | New folder card appears in the folder grid |

### T5.2 — Navigate into a Folder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on the **E2E Test Folder** card | Page loads the folder's contents (empty initially) |
| 2 | Observe the breadcrumb trail | Shows: Root > E2E Test Folder |
| 3 | Click **Root** in the breadcrumb | Returns to root folder listing |

### T5.3 — Upload Document to Folder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate into **E2E Test Folder** | Empty folder view |
| 2 | Click **Upload** and upload a file | Document appears inside the folder |
| 3 | Navigate back to root | The document is NOT in the root listing (it's in the subfolder) |

### T5.4 — Navigate Nested Folders

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate into a folder | Folder contents load |
| 2 | Click **New Folder** and create a subfolder | Subfolder card appears |
| 3 | Click the subfolder | Breadcrumb shows: Root > Parent > Subfolder |

---

## 7. Test 6: Document Checkout & Versioning

**Page:** `http://localhost:3000/documents`

### T6.1 — Check Out a Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **⋮** menu on a document row | Context menu appears |
| 2 | Click **Check Out** | Document gets a lock icon/badge next to the name |
| 3 | The context menu now shows **Cancel Checkout** instead of **Check Out** | Checkout state is reflected |

### T6.2 — Cancel Checkout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **⋮** on the checked-out document | Context menu appears |
| 2 | Click **Cancel Checkout** | Lock icon disappears, document is unlocked |

### T6.3 — View Version History

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **⋮** on a document | Context menu appears |
| 2 | Click **Versions** | Versions panel opens showing version history |
| 3 | Observe version entries | Version 1 at minimum, with date, author, hash |

---

## 8. Test 7: Document Notes

**Page:** `http://localhost:3000/documents`

### T7.1 — Add a Note to a Document

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **⋮** on a document row | Context menu appears |
| 2 | Click **Notes** | Notes panel opens |
| 3 | Type a note: "This is a test note from E2E" | Text appears in the input |
| 4 | Submit the note (Enter or button) | Note appears in the notes list with timestamp |

### T7.2 — View Multiple Notes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 2-3 more notes to the same document | Each note appears in chronological order |
| 2 | All notes visible with content, author, timestamp | Notes panel shows the full history |

---

## 9. Test 8: Workflow Engine

**Page:** `http://localhost:3000/workflow`

### T8.1 — Workflow Page Loads with Tabs

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Workflow** in sidebar | Workflow page loads |
| 2 | Observe the 3 tabs | **Pending Approvals** (with badge count), **My Workflows**, **All Workflows** |

### T8.2 — View Pending Approvals

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Pending Approvals** tab | List of workflows awaiting approval (may be empty) |
| 2 | If items exist, observe each card | Status badge, document ID, notes field, Approve/Reject buttons |

### T8.3 — View My Workflows

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **My Workflows** tab | List of your workflow instances |
| 2 | Observe workflow cards | Each shows: status badge (color-coded), document ID, timestamps |

### T8.4 — Submit a Workflow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a workflow in DRAFT status (My Workflows tab) | Card visible with **Submit** button |
| 2 | Enter notes in the text input (optional) | Text appears |
| 3 | Click **Submit** | Status changes from DRAFT to IN_REVIEW or PENDING_APPROVAL |

### T8.5 — Approve a Workflow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch to **Pending Approvals** tab | Find the submitted workflow |
| 2 | Enter approval notes: "Approved by E2E tester" | Text appears |
| 3 | Click **Approve** ✓ | Workflow status changes to APPROVED |
| 4 | The item disappears from Pending Approvals | Moved to completed |

### T8.6 — Reject a Workflow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a pending workflow | Card visible |
| 2 | Enter notes: "Rejected — needs revision" | Text appears |
| 3 | Click **Reject** ✗ | Status changes to REJECTED |

### T8.7 — View Workflow History

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **History** toggle on any workflow card | History panel expands below the card |
| 2 | Observe the transition timeline | Table showing: fromStatus → toStatus, action, notes, timestamp |
| 3 | Click **History** again | Panel collapses |

### T8.8 — Cancel a Workflow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a workflow not in APPROVED/ARCHIVED/CANCELLED state | Card visible with **Cancel** button |
| 2 | Click **Cancel** | Status changes to CANCELLED |

---

## 10. Test 9: Workflow Designer

**Page:** `http://localhost:3000/workflow-designer`

### T9.1 — Template Selection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Designer** in sidebar | Workflow Designer loads with template grid |
| 2 | Observe template cards | Each shows: name, category, description, estimated duration |
| 3 | See the "Blank Workflow" dashed card | Available for starting from scratch |

### T9.2 — Load a Template

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on a template card (e.g., Standard Approval) | Canvas view loads with pre-placed state nodes and connections |
| 2 | Observe the canvas | Colored nodes (green=start, red=end, blue=states) connected by arrows |
| 3 | Dot-grid background is visible | Grid pattern behind the nodes |

### T9.3 — Start from Scratch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Templates** button in toolbar (if on canvas) | Returns to template selector |
| 2 | Click **Start from Scratch** | Empty canvas opens with workflow name input |

### T9.4 — Add States to Canvas

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From the left palette, click **Start State** | Green start node appears on canvas |
| 2 | Click **State** | Blue state node appears |
| 3 | Click **End State** | Red end node appears |
| 4 | Drag nodes to reposition them | Nodes move smoothly, arrows follow |

### T9.5 — Connect States

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click a node to select it | Properties panel appears on the right |
| 2 | Click **Connect From Here** in properties | Connection mode activated |
| 3 | Click a target node | Arrow drawn between the two nodes |
| 4 | Arrow has arrowhead marker | Visual connection visible |

### T9.6 — Edit Properties

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click a state node | Properties panel shows: Label, Color picker, Initial/Final checkboxes |
| 2 | Change the label to "Review" | Node text updates on canvas |
| 3 | Click a different color (from 10-color picker) | Node color changes |
| 4 | Click a connection arrow | Properties show: Label, Action, Delete Connection |
| 5 | Change the edge label to "Submit" | Label appears on the arrow |

### T9.7 — Zoom Controls

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Zoom In** in toolbar | Canvas zooms in, percentage increases |
| 2 | Click **Zoom Out** | Canvas zooms out, percentage decreases |
| 3 | Zoom range is 30%–200% | Cannot zoom beyond these limits |

### T9.8 — Save Workflow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit the workflow name in the toolbar input | Name updates |
| 2 | Click **Save** | Toast/confirmation appears: workflow saved |

### T9.9 — Delete Elements

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a state node | Properties panel with **Delete State** button |
| 2 | Click **Delete State** | Node and its connected edges are removed |
| 3 | Select a connection arrow | Properties panel with **Delete Connection** button |
| 4 | Click **Delete Connection** | Arrow removed |

---

## 11. Test 10: Search

**Page:** `http://localhost:3000/search`

### T10.1 — Quick Search

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Search** in sidebar | Search page loads with autofocused search bar |
| 2 | Type `test` in the search input | Text appears |
| 3 | Press **Enter** or click the **Search** button | Results appear below: cards with title, description, snippets, tags |
| 4 | If results exist, check each result card | Shows: file icon, title, folder path, author, date, status badge, relevance score |

### T10.2 — Clear Search

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After performing a search, click the **X** button in the search bar | Search field clears, results reset |

### T10.3 — Advanced Filters

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Filters** toggle button | Advanced filter panel slides open |
| 2 | Observe the 6 filter fields | Tags, MIME Type dropdown, Status dropdown, Folder Path, Date From, Date To |
| 3 | Select MIME Type = **PDF** from dropdown | "PDF" selected |
| 4 | Select Status = **Active** from dropdown | "Active" selected |
| 5 | Click **Search** | Results are filtered by the selected criteria |
| 6 | Click **Filters** toggle again | Filter panel collapses |

### T10.4 — Facet Sidebar

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Perform a search with results | Right sidebar shows facets (e.g., MIME types, statuses) with counts |
| 2 | Click a facet option (e.g., "application/pdf (3)") | Results auto-filter to that facet |

### T10.5 — Search Pagination

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for a term with 20+ results | Page 1 loads |
| 2 | Click **Next** | Page 2 loads |
| 3 | Page indicator shows "Page 2 of X" | Correct |

---

## 12. Test 11: Retention Management

**Page:** `http://localhost:3000/retention`

### T11.1 — Page Loads with Tabs

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Retention** in sidebar | Retention Management page loads |
| 2 | Observe 3 tabs | **Dispositions**, **Policies**, **Statistics** |
| 3 | Observe the **Run Scan** button at the top | Button visible |

### T11.2 — View Retention Policies

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Policies** tab | Policy card grid appears |
| 2 | Observe the seed policies | **Standard 7-Year**, **Regulatory 20-Year**, **Permanent** (999 years) |
| 3 | Each card shows | Name, retention years, auto-dispose (Yes/No), approval required (Yes/No), created date |

### T11.3 — View Dispositions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Dispositions** tab | Disposition list loads |
| 2 | Observe the status filter pills | **PENDING**, **APPROVED**, **REJECTED**, **ON_HOLD**, **EXECUTED** |
| 3 | Click a different status pill | List filters to that status |

### T11.4 — Approve a Disposition

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On Dispositions tab, find a PENDING item | Item visible with ✓ button |
| 2 | Click the **Approve** (✓) button | Item status changes to APPROVED |

### T11.5 — Reject/Hold a Disposition

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand a PENDING disposition item | Reject and Hold forms visible |
| 2 | Enter a reason: "Not ready for disposal" | Text appears in reason field |
| 3 | Click **Reject** | Status changes to REJECTED |
| 4 | For Hold: enter a reason and click **Hold** | Status changes to ON_HOLD |

### T11.6 — View Statistics

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Statistics** tab | Stat cards appear with key-value data |
| 2 | Observe the data | Counts for policies, dispositions, statuses |

### T11.7 — Run Retention Scan

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Run Scan** button | Scan executes, new dispositions may appear |

---

## 13. Test 12: Compliance & Jurisdictions

**Page:** `http://localhost:3000/compliance`

### T12.1 — Page Loads with Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Compliance** in sidebar | Compliance & Jurisdiction Rules page loads |
| 2 | Observe jurisdiction selector buttons | **All** button plus buttons for each jurisdiction code (EU, DE, US, etc.) with rule counts |

### T12.2 — Filter by Jurisdiction

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **DE** jurisdiction button | Table filters to Germany rules only |
| 2 | Click **US** | Table filters to United States rules |
| 3 | Click **All** | All rules shown |

### T12.3 — Search and Category Filter

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type in the search box: "financial" | Rules filter to those matching "financial" |
| 2 | Select a category from the dropdown | Further filtering applied |
| 3 | Clear the search and reset category | Full list returns |

### T12.4 — Legal Frameworks Accordion

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to Legal Frameworks section | Expandable list of frameworks |
| 2 | Click on a framework entry | Expands to show: jurisdiction code, framework code, name, description, authority, effective date |
| 3 | Click again | Collapses |

### T12.5 — Retention Rules Table

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to the retention rules table | Columns: Jurisdiction, Category, Framework, Min Years, Max Years, Legal Citation, Description, Mandatory |
| 2 | Min Years values are color-coded | Higher values have more intense colors (severity indicator) |
| 3 | Mandatory column shows ⚠ icon for mandatory rules | Dash (—) for non-mandatory |

---

## 14. Test 13: AI Trust Center

**Page:** `http://localhost:3000/trust-center`

### T13.1 — Page Loads with Policies

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Trust Center** in sidebar | AI Trust Center page loads |
| 2 | Observe the summary badge | Shows "X Active / Y Disabled" |
| 3 | Observe the policy cards (up to 5) | AI Classification, Auto-Tag, Content Generation, AI Search Assist, Workflow AI Routing |

### T13.2 — Toggle a Policy

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find an ENABLED policy card | Toggle switch shown in ON position |
| 2 | Click the **toggle switch** | Policy becomes DISABLED, card updates |
| 3 | Summary badge updates | Active count decreases by 1 |
| 4 | Click the toggle again | Policy re-enabled |

### T13.3 — View Audit Trail

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Audit Trail** link on a policy card | Audit timeline panel opens |
| 2 | Observe the timeline entries | ENABLED/DISABLED/CREATED badges with timestamps and reasons |
| 3 | Click the **Close** button | Panel closes |

### T13.4 — Policy Card Details

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe each policy card | Shows: scope badge (GLOBAL/PROJECT/USER), description, settings preview (JSON key-values, up to 4) |

---

## 15. Test 14: Analytics

**Page:** `http://localhost:3000/analytics`

### T14.1 — Summary Cards

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Analytics** in sidebar | Analytics & Bottleneck Analysis page loads |
| 2 | Observe 4 summary cards | **Total Workflows**, **Avg Completion** (hours), **Avg Corrections**, **AI Actions** |
| 3 | Total Workflows shows a number | Matches sum of all workflow statuses |

### T14.2 — Workflow Status Distribution

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe the status distribution chart | Horizontal bar chart showing percentages per status |
| 2 | Statuses include | DRAFT, REVIEW, PENDING_APPROVAL, APPROVED, REJECTED, CORRECTION, ARCHIVED, CANCELLED |
| 3 | Each bar is color-coded | Different colors for each status |

### T14.3 — Bottleneck Analysis

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe the Bottleneck States panel | Ranked list (1-3) showing states with longest processing time |
| 2 | Progress bars | Visual indicator of relative time spent |

### T14.4 — Human vs AI Activity

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe the activity panel | Stacked horizontal bar: Human % vs AI Service % |
| 2 | Counts shown | Raw numbers for human and AI actions |
| 3 | Total audit entries displayed | Matches audit service data |

---

## 16. Test 15: Industry Solutions

**Page:** `http://localhost:3000/industry`

### T15.1 — Template Cards Load

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Industry** in sidebar | Industry Solutions page loads |
| 2 | Observe template cards | Cards with industry icons (Healthcare ♥, Banking ���, Legal ⚖, Manufacturing ���, Public Sector ���) |
| 3 | Each card shows | Display name, description, summary tags (X Plugins, X Workflows, X Frameworks, X Retention Rules) |

### T15.2 — Expand Template Details

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Show Details** on a template card | Card expands to show included components |
| 2 | Observe the expanded content | Included Plugins (tag list), Default Workflows (tag list), Compliance Frameworks (tag list), Retention Rules (tag list) |
| 3 | Click **Hide Details** | Card collapses back |

---

## 17. Test 16: Plugin Marketplace

**Page:** `http://localhost:3000/marketplace`

### T16.1 — Page Loads with Plugins

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Marketplace** in sidebar | Plugin Marketplace loads |
| 2 | Observe the counter in the header | "X / Y active" showing active vs total plugins |
| 3 | Observe plugin cards in grid | Each shows: icon, name, vendor, version, description, type badge, status badge, category badge |

### T16.2 — Filter Plugins

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `sap` in the search field | Cards filter to show SAP-related plugins |
| 2 | Clear the search | All plugins return |
| 3 | Select Type = **CONNECTOR** from dropdown | Only connector plugins shown |
| 4 | Select a Category from the second dropdown | Further filtering |
| 5 | Reset both filters | All plugins shown |

### T16.3 — Activate a Plugin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a plugin with status **INACTIVE** | **Activate** button visible |
| 2 | Click **Activate** | Status badge changes to ACTIVE, button changes to **Deactivate** |
| 3 | Active counter in header increases | "X+1 / Y active" |

### T16.4 — Deactivate a Plugin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a plugin with status **ACTIVE** | **Deactivate** button visible |
| 2 | Click **Deactivate** | Status badge changes to INACTIVE, button changes to **Activate** |

### T16.5 — Plugin Card Details

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe a plugin card | Premium plugins show a ⭐ star badge |
| 2 | Install count visible | Number of installs shown |
| 3 | Description is 2-line clamped | Long descriptions truncated |

---

## 18. Test 17: SAP ERP Integration

**Page:** `http://localhost:3000/sap`

### T17.1 — Page Loads with Plugin Status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **SAP Integration** in sidebar | SAP ERP Integration page loads |
| 2 | Observe the Plugin Status card | Shows: SAP ERP Connector name, description, version, vendor, type |
| 3 | Status badge | ACTIVE or UNKNOWN |
| 4 | Capability badges visible | Document Import, Document Export, Metadata Sync, Invoice Posting |

### T17.2 — Toggle SAP Plugin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Activate** / **Deactivate** toggle button | Plugin status changes |
| 2 | Status badge updates | Reflects new state |

### T17.3 — Run Connection Tests

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand the Connection Test panel (if collapsed) | Panel opens |
| 2 | Click **Run Connection Tests** | Tests execute sequentially — spinner on each row |
| 3 | Observe the results table | 6 rows: Auth, Documents, Workflow, Search, Retention, Audit |
| 4 | Each row shows | Service name, endpoint URL, status (✓ or ✗), latency in ms |
| 5 | Summary banner | "All services reachable" (if all pass) or "Some services unreachable" |
| 6 | All latencies should be < 5000ms | Reasonable response times |

### T17.4 — View Live Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand the Live Data panel | Panel opens |
| 2 | Observe 4 summary cards | **Documents** (count), **Pending Approvals** (count), **Audit Entries** (count), **Retention Policies** (count) |
| 3 | Observe Recent Documents table | Up to 5 rows with: Title, Type, Status, Size, Created |
| 4 | Values are real data from the APIs | Counts match other pages (Dashboard, Audit, Retention) |

### T17.5 — Run Sync Simulation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand the Sync Simulation panel | Panel opens |
| 2 | Click **Run Sync Cycle** | Three operations execute sequentially |
| 3 | Sync Log table populates | Shows timestamped entries with: #, Time, Direction (↑↓), Object, Status (✓/✗), Detail |
| 4 | Import entry | Direction ↓, imports documents from SAP |
| 5 | Export entry | Direction ↑, exports invoice to Apex Nexus |
| 6 | Sync entry | Direction ↕, syncs workflow definitions |

### T17.6 — Integration Architecture Diagram

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to the Integration Architecture section | Visual diagram of SAP ↔ Apex Nexus integration |
| 2 | Observe 3 info cards | Document Archival, Approval Sync, Retention Compliance |
| 3 | Each card has numbered steps | Describing the integration flow |

### T17.7 — Refresh Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Refresh** button at the top | All panels reload with fresh data from APIs |

---

## 19. Test 18: Audit Log

**Page:** `http://localhost:3000/audit`

### T18.1 — Audit Log Loads

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Audit Log** in sidebar | Audit Log page loads |
| 2 | Observe the view toggle | Two buttons: **Logs** and **Statistics** |
| 3 | Default view is **Logs** | Audit table visible with entries |

### T18.2 — View Audit Entries (Date Filter)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select filter mode: **Date** | From and To date pickers appear |
| 2 | Default range is last 30 days | Entries loaded |
| 3 | Observe the table columns | Timestamp, User (avatar + username), Action (color-coded badge), Resource (type + ID), IP Address |

### T18.3 — Filter by Action

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch filter to **Action** mode | Action pill buttons appear |
| 2 | Available actions | CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, CHECKOUT, CHECKIN, APPROVE, REJECT, DOWNLOAD |
| 3 | Click **CREATE** pill | Table filters to CREATE actions only |
| 4 | Click **LOGIN** pill | Table filters to LOGIN actions |

### T18.4 — Filter by Resource Type

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch filter to **Resource Type** mode | Resource type pill buttons appear |
| 2 | Available types | DOCUMENT, FOLDER, USER, WORKFLOW, RETENTION_POLICY |
| 3 | Click **DOCUMENT** | Only document-related audit entries shown |

### T18.5 — View Statistics

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Statistics** view toggle | Statistics view loads |
| 2 | Observe stat cards | Dynamic cards showing all key-value pairs from audit stats |
| 3 | Nested objects render as sub-lists | Grouped data visible |

### T18.6 — Audit Pagination

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With many audit entries | Pagination controls visible |
| 2 | Click **Next** | Next page of entries loads |
| 3 | Page indicator is correct | "Page X of Y" |

---

## 20. Test 19: Notifications

**Page:** `http://localhost:3000/notifications`

### T19.1 — Page Loads with Tabs

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Notifications** in sidebar | Notifications page loads |
| 2 | Observe 2 tabs | **Unread** (with red badge count), **All Notifications** |

### T19.2 — View Unread Notifications

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **Unread** tab | Unread notifications listed |
| 2 | Each notification shows | Type icon (DOCUMENT/WORKFLOW/RETENTION/SYSTEM), title (bold), message (2-line), timestamp, resource type badge |
| 3 | Unread items have highlighted background | Visually distinct from read items |

### T19.3 — Mark Individual Notification as Read

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find an unread notification | Has a ✓ button |
| 2 | Click the **Mark as Read** (✓) button | Notification moves from unread to read, background changes |
| 3 | Unread badge count decreases by 1 | Tab badge updates |

### T19.4 — Mark All as Read

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With multiple unread notifications | **Mark All Read** button visible at top |
| 2 | Click **Mark All Read** | All notifications marked as read |
| 3 | Unread count becomes 0 | Badge disappears or shows 0 |
| 4 | **Mark All Read** button disappears | No more unread items |

### T19.5 — All Notifications Tab

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **All Notifications** tab | Full list with pagination |
| 2 | Both read and unread items visible | Read items have normal background, unread are highlighted |
| 3 | Pagination works | Previous / Next / Page indicator |

---

## 21. Test 20: Admin — User Management

**Page:** `http://localhost:3000/admin/users`

### T20.1 — User List Loads

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Users** under Admin section in sidebar | User Management page loads |
| 2 | Observe the users table | Columns: User (avatar + name + @username), Email, Roles, Status, Created, Actions |
| 3 | Admin user is in the list | admin user with SYSTEM_ADMIN role badge |

### T20.2 — Search Users

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `admin` in the search field | Table filters to admin user only |
| 2 | Clear the search | All users return |
| 3 | Type `test` | Filters to testuser (if registered in T2.1) |

### T20.3 — View User Permissions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the expand arrow (▼) on a user row | Row expands to show permissions |
| 2 | Observe the permissions | Individual permission tags with tooltip descriptions |
| 3 | Click the arrow again | Row collapses |

### T20.4 — User Status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe the Status column | Active users show ✓ (green), Inactive show ✗ (red) |
| 2 | Observe the Roles column | Role badges with Shield icon (e.g., SYSTEM_ADMIN, AUTHOR) |

### T20.5 — Pagination

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With many users | Pagination visible: Previous / Page X of Y / Next |

---

## 22. Test 21: Admin — System Settings

**Page:** `http://localhost:3000/admin/settings`

### T21.1 — System Information

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Settings** under Admin section in sidebar | System Settings page loads |
| 2 | Observe the System Information section | 5 info cards: API Gateway (:8080), PostgreSQL (:5432), Encryption (AES-256-GCM), Max Retention (20+ years), Search Engine (Elasticsearch 8.12) |

### T21.2 — View Retention Policies

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to Retention Policies section | Table showing existing policies |
| 2 | Columns | Policy Name (Shield icon), Retention (yrs), Auto-Dispose (Yes/No), Approval (Required/Not Required), Created, Actions |

### T21.3 — Create New Retention Policy

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the **New Policy** button | Creation form expands |
| 2 | Enter Policy Name: `E2E Test Policy` | Text appears |
| 3 | Enter Retention Period: `5` | Number in field |
| 4 | Check the **Auto-dispose after retention** checkbox | Checked |
| 5 | Check the **Requires approval** checkbox | Checked |
| 6 | Click **Create Policy** | Form closes, new policy appears in the table |
| 7 | Verify the table row | "E2E Test Policy", 5 years, Auto-Dispose: Yes, Approval: Required |

### T21.4 — Delete a Retention Policy

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find the "E2E Test Policy" in the table | **Delete** link in Actions column |
| 2 | Click **Delete** | Policy is removed from the table |
| 3 | Refresh the page | Policy stays deleted |

### T21.5 — Cancel Policy Creation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **New Policy** | Form expands |
| 2 | Click **Cancel** | Form closes without creating anything |

### T21.6 — Microservice Endpoints

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to Microservice Endpoints section | 8 services listed |
| 2 | Each service shows | Name, port number, green dot status indicator |
| 3 | Services listed | API Gateway (8080), Auth (8081), Document (8082), Workflow (8083), Search (8084), Retention (8085), Audit (8086), Notification (8087) |

---

## 23. Test 22: Sidebar Navigation

### T22.1 — All Navigation Links

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe the sidebar (left side) | 16 navigation items visible |
| 2 | Click each link and verify the page loads: | |
| | Dashboard | `/dashboard` loads |
| | Documents | `/documents` loads |
| | Workflow | `/workflow` loads |
| | Search | `/search` loads |
| | Retention | `/retention` loads |
| | Compliance | `/compliance` loads |
| | Designer | `/workflow-designer` loads |
| | Marketplace | `/marketplace` loads |
| | Industry | `/industry` loads |
| | SAP Integration | `/sap` loads |
| | Trust Center | `/trust-center` loads |
| | Analytics | `/analytics` loads |
| | Audit Log | `/audit` loads |
| | Notifications | `/notifications` loads |
| | Users | `/admin/users` loads |
| | Settings | `/admin/settings` loads |

### T22.2 — Sidebar Collapse/Expand

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the collapse toggle at the bottom of the sidebar | Sidebar collapses to icon-only (64px wide) |
| 2 | Only icons visible | Labels hidden |
| 3 | Click the toggle again | Sidebar expands back to full width (256px) with labels |

### T22.3 — Active Link Highlighting

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/documents` | Documents link is highlighted/active |
| 2 | Navigate to `/workflow` | Workflow link is highlighted, Documents no longer highlighted |

---

## 24. Test 23: Security from the Browser

### T23.1 — Logout and Access Protection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as admin | Dashboard loads |
| 2 | Open browser DevTools → Application → Local Storage | `apex_token` and `apex_user` exist |
| 3 | Delete `apex_token` from Local Storage | Token removed |
| 4 | Navigate to `/documents` | Redirected to `/login` |

### T23.2 — XSS in Document Title

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload a document with title: `<script>alert('xss')</script>` | Upload succeeds |
| 2 | View the document in the list | Title renders as plain text, no alert popup |
| 3 | Open the detail panel | Title shown as literal text, not executed |

### T23.3 — Password Not Visible in User Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/users` | User list loads |
| 2 | Expand a user row to see permissions | No password field or hash visible |
| 3 | Open DevTools → Network tab, inspect the API response | Password field is null or absent in JSON |

### T23.4 — Session Expiry

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in and note the time | Token issued with 1-hour expiry |
| 2 | Wait > 1 hour (or manually set expired token in Local Storage) | Token expires |
| 3 | Try to navigate to a protected page | Redirected to `/login` |

---

## 25. Test Result Tracker

Copy this table to track your manual testing progress:

| Test ID | Test Description | Status | Notes | Tester | Date |
|---------|-----------------|--------|-------|--------|------|
| **Login & Authentication** | | | | | |
| T1.1 | Valid login | ☐ Pass ☐ Fail | | | |
| T1.2 | Invalid password | ☐ Pass ☐ Fail | | | |
| T1.3 | Empty credentials | ☐ Pass ☐ Fail | | | |
| T1.4 | Session persistence | ☐ Pass ☐ Fail | | | |
| T1.5 | Protected route redirect | ☐ Pass ☐ Fail | | | |
| **Registration** | | | | | |
| T2.1 | Successful registration | ☐ Pass ☐ Fail | | | |
| T2.2 | Password mismatch | ☐ Pass ☐ Fail | | | |
| T2.3 | Navigate back to login | ☐ Pass ☐ Fail | | | |
| **Dashboard** | | | | | |
| T3.1 | Dashboard loads with data | ☐ Pass ☐ Fail | | | |
| T3.2 | Stat card navigation | ☐ Pass ☐ Fail | | | |
| T3.3 | Quick action links | ☐ Pass ☐ Fail | | | |
| **Document Management** | | | | | |
| T4.1 | Document list loads | ☐ Pass ☐ Fail | | | |
| T4.2 | Upload a document | ☐ Pass ☐ Fail | | | |
| T4.3 | View document detail | ☐ Pass ☐ Fail | | | |
| T4.4 | Download a document | ☐ Pass ☐ Fail | | | |
| T4.5 | Delete a document | ☐ Pass ☐ Fail | | | |
| T4.6 | Pagination | ☐ Pass ☐ Fail | | | |
| **Folder Hierarchy** | | | | | |
| T5.1 | Create a new folder | ☐ Pass ☐ Fail | | | |
| T5.2 | Navigate into a folder | ☐ Pass ☐ Fail | | | |
| T5.3 | Upload to folder | ☐ Pass ☐ Fail | | | |
| T5.4 | Navigate nested folders | ☐ Pass ☐ Fail | | | |
| **Checkout & Versioning** | | | | | |
| T6.1 | Check out a document | ☐ Pass ☐ Fail | | | |
| T6.2 | Cancel checkout | ☐ Pass ☐ Fail | | | |
| T6.3 | View version history | ☐ Pass ☐ Fail | | | |
| **Document Notes** | | | | | |
| T7.1 | Add a note | ☐ Pass ☐ Fail | | | |
| T7.2 | View multiple notes | ☐ Pass ☐ Fail | | | |
| **Workflow Engine** | | | | | |
| T8.1 | Page loads with tabs | ☐ Pass ☐ Fail | | | |
| T8.2 | View pending approvals | ☐ Pass ☐ Fail | | | |
| T8.3 | View my workflows | ☐ Pass ☐ Fail | | | |
| T8.4 | Submit a workflow | ☐ Pass ☐ Fail | | | |
| T8.5 | Approve a workflow | ☐ Pass ☐ Fail | | | |
| T8.6 | Reject a workflow | ☐ Pass ☐ Fail | | | |
| T8.7 | View workflow history | ☐ Pass ☐ Fail | | | |
| T8.8 | Cancel a workflow | ☐ Pass ☐ Fail | | | |
| **Workflow Designer** | | | | | |
| T9.1 | Template selection | ☐ Pass ☐ Fail | | | |
| T9.2 | Load a template | ☐ Pass ☐ Fail | | | |
| T9.3 | Start from scratch | ☐ Pass ☐ Fail | | | |
| T9.4 | Add states to canvas | ☐ Pass ☐ Fail | | | |
| T9.5 | Connect states | ☐ Pass ☐ Fail | | | |
| T9.6 | Edit properties | ☐ Pass ☐ Fail | | | |
| T9.7 | Zoom controls | ☐ Pass ☐ Fail | | | |
| T9.8 | Save workflow | ☐ Pass ☐ Fail | | | |
| T9.9 | Delete elements | ☐ Pass ☐ Fail | | | |
| **Search** | | | | | |
| T10.1 | Quick search | ☐ Pass ☐ Fail | | | |
| T10.2 | Clear search | ☐ Pass ☐ Fail | | | |
| T10.3 | Advanced filters | ☐ Pass ☐ Fail | | | |
| T10.4 | Facet sidebar | ☐ Pass ☐ Fail | | | |
| T10.5 | Search pagination | ☐ Pass ☐ Fail | | | |
| **Retention Management** | | | | | |
| T11.1 | Page loads with tabs | ☐ Pass ☐ Fail | | | |
| T11.2 | View retention policies | ☐ Pass ☐ Fail | | | |
| T11.3 | View dispositions | ☐ Pass ☐ Fail | | | |
| T11.4 | Approve a disposition | ☐ Pass ☐ Fail | | | |
| T11.5 | Reject/hold a disposition | ☐ Pass ☐ Fail | | | |
| T11.6 | View statistics | ☐ Pass ☐ Fail | | | |
| T11.7 | Run retention scan | ☐ Pass ☐ Fail | | | |
| **Compliance & Jurisdictions** | | | | | |
| T12.1 | Page loads with data | ☐ Pass ☐ Fail | | | |
| T12.2 | Filter by jurisdiction | ☐ Pass ☐ Fail | | | |
| T12.3 | Search and category filter | ☐ Pass ☐ Fail | | | |
| T12.4 | Legal frameworks accordion | ☐ Pass ☐ Fail | | | |
| T12.5 | Retention rules table | ☐ Pass ☐ Fail | | | |
| **AI Trust Center** | | | | | |
| T13.1 | Page loads with policies | ☐ Pass ☐ Fail | | | |
| T13.2 | Toggle a policy | ☐ Pass ☐ Fail | | | |
| T13.3 | View audit trail | ☐ Pass ☐ Fail | | | |
| T13.4 | Policy card details | ☐ Pass ☐ Fail | | | |
| **Analytics** | | | | | |
| T14.1 | Summary cards | ☐ Pass ☐ Fail | | | |
| T14.2 | Status distribution | ☐ Pass ☐ Fail | | | |
| T14.3 | Bottleneck analysis | ☐ Pass ☐ Fail | | | |
| T14.4 | Human vs AI activity | ☐ Pass ☐ Fail | | | |
| **Industry Solutions** | | | | | |
| T15.1 | Template cards load | ☐ Pass ☐ Fail | | | |
| T15.2 | Expand template details | ☐ Pass ☐ Fail | | | |
| **Plugin Marketplace** | | | | | |
| T16.1 | Page loads with plugins | ☐ Pass ☐ Fail | | | |
| T16.2 | Filter plugins | ☐ Pass ☐ Fail | | | |
| T16.3 | Activate a plugin | ☐ Pass ☐ Fail | | | |
| T16.4 | Deactivate a plugin | ☐ Pass ☐ Fail | | | |
| T16.5 | Plugin card details | ☐ Pass ☐ Fail | | | |
| **SAP ERP Integration** | | | | | |
| T17.1 | Page loads with plugin status | ☐ Pass ☐ Fail | | | |
| T17.2 | Toggle SAP plugin | ☐ Pass ☐ Fail | | | |
| T17.3 | Run connection tests | ☐ Pass ☐ Fail | | | |
| T17.4 | View live data | ☐ Pass ☐ Fail | | | |
| T17.5 | Run sync simulation | ☐ Pass ☐ Fail | | | |
| T17.6 | Integration architecture | ☐ Pass ☐ Fail | | | |
| T17.7 | Refresh data | ☐ Pass ☐ Fail | | | |
| **Audit Log** | | | | | |
| T18.1 | Audit log loads | ☐ Pass ☐ Fail | | | |
| T18.2 | Date filter | ☐ Pass ☐ Fail | | | |
| T18.3 | Filter by action | ☐ Pass ☐ Fail | | | |
| T18.4 | Filter by resource type | ☐ Pass ☐ Fail | | | |
| T18.5 | View statistics | ☐ Pass ☐ Fail | | | |
| T18.6 | Audit pagination | ☐ Pass ☐ Fail | | | |
| **Notifications** | | | | | |
| T19.1 | Page loads with tabs | ☐ Pass ☐ Fail | | | |
| T19.2 | View unread notifications | ☐ Pass ☐ Fail | | | |
| T19.3 | Mark individual as read | ☐ Pass ☐ Fail | | | |
| T19.4 | Mark all as read | ☐ Pass ☐ Fail | | | |
| T19.5 | All notifications tab | ☐ Pass ☐ Fail | | | |
| **Admin — User Management** | | | | | |
| T20.1 | User list loads | ☐ Pass ☐ Fail | | | |
| T20.2 | Search users | ☐ Pass ☐ Fail | | | |
| T20.3 | View user permissions | ☐ Pass ☐ Fail | | | |
| T20.4 | User status display | ☐ Pass ☐ Fail | | | |
| T20.5 | Pagination | ☐ Pass ☐ Fail | | | |
| **Admin — System Settings** | | | | | |
| T21.1 | System information | ☐ Pass ☐ Fail | | | |
| T21.2 | View retention policies | ☐ Pass ☐ Fail | | | |
| T21.3 | Create new retention policy | ☐ Pass ☐ Fail | | | |
| T21.4 | Delete a retention policy | ☐ Pass ☐ Fail | | | |
| T21.5 | Cancel policy creation | ☐ Pass ☐ Fail | | | |
| T21.6 | Microservice endpoints | ☐ Pass ☐ Fail | | | |
| **Sidebar Navigation** | | | | | |
| T22.1 | All navigation links | ☐ Pass ☐ Fail | | | |
| T22.2 | Sidebar collapse/expand | ☐ Pass ☐ Fail | | | |
| T22.3 | Active link highlighting | ☐ Pass ☐ Fail | | | |
| **Security** | | | | | |
| T23.1 | Logout and access protection | ☐ Pass ☐ Fail | | | |
| T23.2 | XSS in document title | ☐ Pass ☐ Fail | | | |
| T23.3 | Password not visible | ☐ Pass ☐ Fail | | | |
| T23.4 | Session expiry | ☐ Pass ☐ Fail | | | |

**Total Browser Tests: 97**
