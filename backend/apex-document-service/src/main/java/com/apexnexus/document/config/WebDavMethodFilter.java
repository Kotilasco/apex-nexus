package com.apexnexus.document.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Translates WebDAV-specific HTTP methods (PROPFIND, LOCK, UNLOCK) into
 * standard methods that Spring MVC can route. Word sends these non-standard
 * HTTP methods when interacting with WebDAV endpoints.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class WebDavMethodFilter implements Filter {

    private static final Pattern DOC_PATTERN = Pattern.compile("/webdav/documents/([^/]+)(/.*)?");

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        String method = request.getMethod().toUpperCase();

        if ("PROPFIND".equals(method)) {
            Matcher m = DOC_PATTERN.matcher(request.getRequestURI());
            if (m.matches()) {
                String docId = m.group(1);
                String forwardPath = "/webdav/documents/" + docId + "/propfind";
                // Preserve query string
                String qs = request.getQueryString();
                if (qs != null) forwardPath += "?" + qs;
                log.debug("[WebDAV] Translating PROPFIND {} -> GET {}", request.getRequestURI(), forwardPath);
                // Wrap as GET
                HttpServletRequestWrapper wrapper = new HttpServletRequestWrapper(request) {
                    @Override
                    public String getMethod() { return "GET"; }
                    @Override
                    public String getRequestURI() { return "/webdav/documents/" + docId + "/propfind"; }
                    @Override
                    public String getServletPath() { return "/webdav/documents/" + docId + "/propfind"; }
                };
                chain.doFilter(wrapper, response);
                return;
            }
        }

        if ("LOCK".equals(method)) {
            Matcher m = DOC_PATTERN.matcher(request.getRequestURI());
            if (m.matches()) {
                String docId = m.group(1);
                log.debug("[WebDAV] Translating LOCK {} -> POST /webdav/documents/{}/lock", request.getRequestURI(), docId);
                HttpServletRequestWrapper wrapper = new HttpServletRequestWrapper(request) {
                    @Override
                    public String getMethod() { return "POST"; }
                    @Override
                    public String getRequestURI() { return "/webdav/documents/" + docId + "/lock"; }
                    @Override
                    public String getServletPath() { return "/webdav/documents/" + docId + "/lock"; }
                };
                chain.doFilter(wrapper, response);
                return;
            }
        }

        if ("UNLOCK".equals(method)) {
            Matcher m = DOC_PATTERN.matcher(request.getRequestURI());
            if (m.matches()) {
                String docId = m.group(1);
                log.debug("[WebDAV] Translating UNLOCK {} -> POST /webdav/documents/{}/unlock", request.getRequestURI(), docId);
                HttpServletRequestWrapper wrapper = new HttpServletRequestWrapper(request) {
                    @Override
                    public String getMethod() { return "POST"; }
                    @Override
                    public String getRequestURI() { return "/webdav/documents/" + docId + "/unlock"; }
                    @Override
                    public String getServletPath() { return "/webdav/documents/" + docId + "/unlock"; }
                };
                chain.doFilter(wrapper, response);
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
