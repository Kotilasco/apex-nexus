# Apex Nexus — Office Add-in Integration Guide

## Overview

Apex Nexus documents can be accessed directly from Microsoft Office applications 
(Word, Excel, PowerPoint, Outlook) using Office Web Add-ins. This guide covers 
the architecture and API endpoints required for integration.

## Outlook Web Add-in

### Manifest (manifest.xml)

The add-in is declared via an XML manifest that points to the Apex Nexus frontend.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:type="MailApp">
  <Id>apex-nexus-outlook-addin</Id>
  <Version>1.0.0</Version>
  <ProviderName>Apex Nexus</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="Apex Nexus ECM"/>
  <Description DefaultValue="Manage documents, search the archive, and file emails directly from Outlook."/>
  
  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>

  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.1"/>
    </Sets>
  </Requirements>

  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://your-domain/office/outlook"/>
        <RequestedHeight>400</RequestedHeight>
      </DesktopSettings>
    </Form>
    <Form xsi:type="ItemEdit">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://your-domain/office/outlook/compose"/>
      </DesktopSettings>
    </Form>
  </FormSettings>

  <Permissions>ReadWriteMailbox</Permissions>

  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message"/>
  </Rule>
</OfficeApp>
```

### Key Capabilities

| Feature               | Description                                        | API Endpoint                       |
|-----------------------|----------------------------------------------------|------------------------------------|
| Save email as document| Archive email + attachments to Apex Nexus           | `POST /api/documents`              |
| Search from Outlook   | Search ECM documents without leaving Outlook        | `GET /api/search?q=...`            |
| Attach from ECM       | Browse and attach ECM documents to email compose    | `GET /api/documents/{id}/download` |
| Link sharing          | Insert a share link into email body                 | `POST /api/auth/share-links`       |
| Document preview      | Preview ECM documents in Outlook sidebar            | `GET /api/documents/{id}/preview`  |

### Authentication Flow

1. Office Add-in opens in an iframe within Outlook
2. User clicks "Sign In" → redirected to Apex Nexus login
3. JWT token stored in Office.context.roamingSettings (encrypted)
4. All API calls use `Authorization: Bearer <jwt>` header
5. Token refresh handled transparently via `/api/auth/refresh`

### REST API Endpoints for Office Integration

#### Save Email as Document
```
POST /api/documents
Content-Type: multipart/form-data

Fields:
- file: email .eml or individual attachments
- title: email subject
- description: email preview text
- tags: ["email", "outlook", sender-domain]
- metadataJson: { "emailFrom": "...", "emailTo": "...", "emailDate": "..." }
- folderId: target folder UUID
- projectId: project UUID
```

#### Quick Search
```
GET /api/search?q=contract+renewal&size=5
Authorization: Bearer <jwt>

Returns: SearchResponse with title, description, highlights
```

#### Get Document for Attachment
```
GET /api/documents/{id}/download
Authorization: Bearer <jwt>

Returns: File bytes with Content-Disposition: attachment
```

#### Create Share Link for Email Insert
```
POST /api/auth/share-links
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "documentId": "uuid",
  "expiresInHours": 168,
  "allowPreview": true,
  "allowDownload": true
}

Returns: { "token": "...", "shareUrl": "https://..." }
```

## Word/Excel/PowerPoint Add-in (Task Pane)

For editing applications, the add-in provides a task pane for:
- Browsing ECM folders and opening documents
- Saving current document back to ECM (creates new version)
- Checking out / checking in documents (Redis locking)
- Viewing document metadata and audit trail

### Key Workflow: Edit in Office

1. User opens task pane → browses ECM folders
2. Clicks document → `POST /api/documents/{id}/checkout` (locks)
3. Document opens in Office (downloaded via API)
4. User edits and clicks "Save to ECM"
5. `POST /api/documents/{id}` uploads new version
6. `POST /api/documents/{id}/checkin` releases lock

## Development Setup

```bash
# Install Office Add-in development tools
npm install -g yo generator-office

# Generate add-in project
yo office --projectType taskpane --name ApexNexusAddin --host outlook

# The add-in UI is a React/Next.js page served from the frontend
# See: frontend/web/src/app/office/ (to be created)
```

## Security Notes

- Office Add-ins run in a sandboxed iframe
- All API calls go through the Apex Nexus Gateway with JWT auth
- CORS must be configured to allow the Office domain origin
- Share links use time-limited tokens with optional password protection
