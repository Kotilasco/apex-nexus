package com.apexnexus.document.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;
import org.xml.sax.InputSource;

import javax.net.ssl.*;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.Authenticator;
import java.net.PasswordAuthentication;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.*;

/**
 * Lightweight EWS (Exchange Web Services) SOAP client.
 * Uses Java built-in HttpClient with native NTLM authenticator.
 * SSL trust-all enabled for internal CA certificates.
 */
@Slf4j
@Service
public class EwsClient {

  private static final String TYPES_NS = "http://schemas.microsoft.com/exchange/services/2006/types";

  public record EwsMessage(String itemId, String changeKey, String subject, String from, boolean hasAttachments) {
  }

  public record EwsAttachmentInfo(String id, String name, String contentType, long size) {
  }

  public record EwsAttachmentContent(String name, String contentType, byte[] data) {
  }

  public HttpClient buildHttpClient(String ewsUrl, String username, String password) throws Exception {
    // Trust-all SSL context for corporate CAs
    TrustManager[] trustAll = { new X509TrustManager() {
      public void checkClientTrusted(X509Certificate[] c, String a) {
      }

      public void checkServerTrusted(X509Certificate[] c, String a) {
      }

      public X509Certificate[] getAcceptedIssuers() {
        return new X509Certificate[0];
      }
    } };
    SSLContext sc = SSLContext.getInstance("TLS");
    sc.init(null, trustAll, new SecureRandom());

    // Java built-in Authenticator handles NTLM challenge-response natively
    Authenticator auth = new Authenticator() {
      @Override
      protected PasswordAuthentication getPasswordAuthentication() {
        log.debug("NTLM auth challenge from {} (scheme={})", getRequestingHost(), getRequestingScheme());
        return new PasswordAuthentication(username, password.toCharArray());
      }
    };

    log.info("EWS client: user={}, url={}", username, ewsUrl);

    return HttpClient.newBuilder()
        .sslContext(sc)
        .authenticator(auth)
        .build();
  }

  /* --- SOAP operations --- */

  public List<EwsMessage> findUnreadWithAttachments(HttpClient client, String ewsUrl) throws Exception {
    String soap = """
        <?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
                       xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
          <soap:Body>
            <m:FindItem Traversal="Shallow">
              <m:ItemShape>
                <t:BaseShape>IdOnly</t:BaseShape>
                <t:AdditionalProperties>
                  <t:FieldURI FieldURI="item:Subject"/>
                  <t:FieldURI FieldURI="item:HasAttachments"/>
                  <t:FieldURI FieldURI="message:From"/>
                  <t:FieldURI FieldURI="message:IsRead"/>
                </t:AdditionalProperties>
              </m:ItemShape>
              <m:IndexedPageItemView MaxEntriesReturned="100" Offset="0" BasePoint="Beginning"/>
              <m:Restriction>
                <t:And>
                  <t:IsEqualTo>
                    <t:FieldURI FieldURI="message:IsRead"/>
                    <t:FieldURIOrConstant><t:Constant Value="false"/></t:FieldURIOrConstant>
                  </t:IsEqualTo>
                  <t:IsEqualTo>
                    <t:FieldURI FieldURI="item:HasAttachments"/>
                    <t:FieldURIOrConstant><t:Constant Value="true"/></t:FieldURIOrConstant>
                  </t:IsEqualTo>
                </t:And>
              </m:Restriction>
              <m:ParentFolderIds>
                <t:DistinguishedFolderId Id="inbox"/>
              </m:ParentFolderIds>
            </m:FindItem>
          </soap:Body>
        </soap:Envelope>
        """;
    String xml = executeSoap(client, ewsUrl, soap);
    return parseMessages(xml);
  }

  public List<EwsAttachmentInfo> getAttachmentInfo(HttpClient client, String ewsUrl,
      String itemId, String changeKey) throws Exception {
    String soap = """
        <?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
                       xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
          <soap:Body>
            <m:GetItem>
              <m:ItemShape>
                <t:BaseShape>IdOnly</t:BaseShape>
                <t:AdditionalProperties>
                  <t:FieldURI FieldURI="item:Attachments"/>
                </t:AdditionalProperties>
              </m:ItemShape>
              <m:ItemIds>
                <t:ItemId Id="%s" ChangeKey="%s"/>
              </m:ItemIds>
            </m:GetItem>
          </soap:Body>
        </soap:Envelope>
        """.formatted(escapeXml(itemId), escapeXml(changeKey));
    String xml = executeSoap(client, ewsUrl, soap);
    return parseAttachmentInfoList(xml);
  }

  public EwsAttachmentContent downloadAttachment(HttpClient client, String ewsUrl,
      String attachmentId) throws Exception {
    String soap = """
        <?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
                       xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
          <soap:Body>
            <m:GetAttachment>
              <m:AttachmentIds>
                <t:AttachmentId Id="%s"/>
              </m:AttachmentIds>
            </m:GetAttachment>
          </soap:Body>
        </soap:Envelope>
        """.formatted(escapeXml(attachmentId));
    String xml = executeSoap(client, ewsUrl, soap);
    return parseAttachmentContent(xml);
  }

  public void markAsRead(HttpClient client, String ewsUrl,
      String itemId, String changeKey) throws Exception {
    String soap = """
        <?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
                       xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
          <soap:Body>
            <m:UpdateItem MessageDisposition="SaveOnly" ConflictResolution="AlwaysOverwrite">
              <m:ItemChanges>
                <t:ItemChange>
                  <t:ItemId Id="%s" ChangeKey="%s"/>
                  <t:Updates>
                    <t:SetItemField>
                      <t:FieldURI FieldURI="message:IsRead"/>
                      <t:Message>
                        <t:IsRead>true</t:IsRead>
                      </t:Message>
                    </t:SetItemField>
                  </t:Updates>
                </t:ItemChange>
              </m:ItemChanges>
            </m:UpdateItem>
          </soap:Body>
        </soap:Envelope>
        """.formatted(escapeXml(itemId), escapeXml(changeKey));
    executeSoap(client, ewsUrl, soap);
  }

  /* --- SOAP transport (Java HttpClient with native NTLM) --- */

  private String executeSoap(HttpClient client, String ewsUrl, String soapBody) throws Exception {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(ewsUrl))
        .header("Content-Type", "text/xml; charset=UTF-8")
        .POST(HttpRequest.BodyPublishers.ofString(soapBody))
        .build();

    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
    int status = response.statusCode();
    String body = response.body();

    if (status == 401) {
      log.error("EWS auth failed (401). Check username/password. For NTLM use DOMAIN\\\\user format.");
      throw new RuntimeException("EWS authentication failed (HTTP 401). Check credentials.");
    }
    if (status != 200) {
      log.error("EWS request failed: HTTP {} - {}", status,
          body != null ? body.substring(0, Math.min(500, body.length())) : "(empty)");
      throw new RuntimeException("EWS request failed: HTTP " + status);
    }
    if (body != null && body.contains("Fault") && body.contains("faultstring")) {
      log.error("EWS SOAP fault: {}", body.substring(0, Math.min(800, body.length())));
      throw new RuntimeException("EWS SOAP fault in response");
    }
    return body;
  }

  /* --- XML parsing --- */

  private List<EwsMessage> parseMessages(String xml) throws Exception {
    Document doc = parseXml(xml);
    List<EwsMessage> messages = new ArrayList<>();
    NodeList items = doc.getElementsByTagNameNS(TYPES_NS, "Message");
    for (int i = 0; i < items.getLength(); i++) {
      Element el = (Element) items.item(i);
      String itemId = "", changeKey = "", subject = "", from = "";
      boolean hasAtt = false;

      NodeList ids = el.getElementsByTagNameNS(TYPES_NS, "ItemId");
      if (ids.getLength() > 0) {
        itemId = ((Element) ids.item(0)).getAttribute("Id");
        changeKey = ((Element) ids.item(0)).getAttribute("ChangeKey");
      }
      NodeList subjs = el.getElementsByTagNameNS(TYPES_NS, "Subject");
      if (subjs.getLength() > 0)
        subject = subjs.item(0).getTextContent();
      NodeList atts = el.getElementsByTagNameNS(TYPES_NS, "HasAttachments");
      if (atts.getLength() > 0)
        hasAtt = "true".equalsIgnoreCase(atts.item(0).getTextContent());
      NodeList emails = el.getElementsByTagNameNS(TYPES_NS, "EmailAddress");
      if (emails.getLength() > 0)
        from = emails.item(0).getTextContent();

      if (!itemId.isBlank())
        messages.add(new EwsMessage(itemId, changeKey, subject, from, hasAtt));
    }
    return messages;
  }

  private List<EwsAttachmentInfo> parseAttachmentInfoList(String xml) throws Exception {
    Document doc = parseXml(xml);
    List<EwsAttachmentInfo> list = new ArrayList<>();
    NodeList fileAtts = doc.getElementsByTagNameNS(TYPES_NS, "FileAttachment");
    for (int i = 0; i < fileAtts.getLength(); i++) {
      Element el = (Element) fileAtts.item(i);
      String id = "", name = "", ct = "";
      long size = 0;
      NodeList ids = el.getElementsByTagNameNS(TYPES_NS, "AttachmentId");
      if (ids.getLength() > 0)
        id = ((Element) ids.item(0)).getAttribute("Id");
      NodeList names = el.getElementsByTagNameNS(TYPES_NS, "Name");
      if (names.getLength() > 0)
        name = names.item(0).getTextContent();
      NodeList cts = el.getElementsByTagNameNS(TYPES_NS, "ContentType");
      if (cts.getLength() > 0)
        ct = cts.item(0).getTextContent();
      NodeList sizes = el.getElementsByTagNameNS(TYPES_NS, "Size");
      if (sizes.getLength() > 0)
        try {
          size = Long.parseLong(sizes.item(0).getTextContent());
        } catch (NumberFormatException ignored) {
        }
      if (!id.isBlank())
        list.add(new EwsAttachmentInfo(id, name, ct, size));
    }
    return list;
  }

  private EwsAttachmentContent parseAttachmentContent(String xml) throws Exception {
    Document doc = parseXml(xml);
    NodeList fileAtts = doc.getElementsByTagNameNS(TYPES_NS, "FileAttachment");
    if (fileAtts.getLength() == 0)
      throw new RuntimeException("No FileAttachment in EWS response");
    Element el = (Element) fileAtts.item(0);
    String name = "", ct = "";
    byte[] data = new byte[0];
    NodeList names = el.getElementsByTagNameNS(TYPES_NS, "Name");
    if (names.getLength() > 0)
      name = names.item(0).getTextContent();
    NodeList cts = el.getElementsByTagNameNS(TYPES_NS, "ContentType");
    if (cts.getLength() > 0)
      ct = cts.item(0).getTextContent();
    NodeList contents = el.getElementsByTagNameNS(TYPES_NS, "Content");
    if (contents.getLength() > 0)
      data = Base64.getDecoder().decode(contents.item(0).getTextContent().replaceAll("\\s+", ""));
    return new EwsAttachmentContent(name, ct, data);
  }

  private Document parseXml(String xml) throws Exception {
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setNamespaceAware(true);
    factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    DocumentBuilder builder = factory.newDocumentBuilder();
    return builder.parse(new InputSource(new StringReader(xml)));
  }

  private String escapeXml(String s) {
    if (s == null)
      return "";
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace("\"", "&quot;").replace("'", "&apos;");
  }
}
