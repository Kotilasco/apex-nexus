package com.apexnexus.document.config;

import com.apexnexus.document.model.WopiAccessToken;
import com.apexnexus.document.service.WopiTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Authenticates WebDAV requests via multiple mechanisms (in priority order):
 * 1. access_token query parameter (initial URL from frontend)
 * 2. APEX_WEBDAV cookie (set after first successful auth — Word sends cookies automatically)
 * 3. HTTP Basic auth (password = access_token — fallback for Windows credential prompt)
 *
 * This is needed because Word's WebDAV client may strip query parameters on
 * subsequent requests (LOCK, PUT) after the initial GET.
 */
@Slf4j
@RequiredArgsConstructor
public class WebDavTokenFilter extends OncePerRequestFilter {

    private static final String COOKIE_NAME = "APEX_WEBDAV";
    private final WopiTokenService wopiTokenService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/webdav/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 1. Try access_token query parameter
        String token = request.getParameter("access_token");

        // 2. Try cookie
        if (token == null || token.isBlank()) {
            token = extractFromCookie(request);
        }

        // 3. Try HTTP Basic auth (password field = access_token)
        if (token == null || token.isBlank()) {
            token = extractFromBasicAuth(request);
        }

        if (token == null || token.isBlank()) {
            log.debug("[WebDAV] No credentials on {} {}", request.getMethod(), request.getRequestURI());
            response.setHeader("WWW-Authenticate", "Basic realm=\"Apex Nexus WebDAV\"");
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
            return;
        }

        Optional<WopiAccessToken> validated = wopiTokenService.validateToken(token);
        if (validated.isEmpty()) {
            log.warn("[WebDAV] Invalid or expired token on {} {}", request.getMethod(), request.getRequestURI());
            response.setHeader("WWW-Authenticate", "Basic realm=\"Apex Nexus WebDAV\"");
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired token");
            return;
        }

        WopiAccessToken wopiToken = validated.get();
        log.debug("[WebDAV] Authenticated user {} for doc {} via token", wopiToken.getUserId(), wopiToken.getDocumentId());

        // Set session cookie so Word includes it on subsequent requests (LOCK, PUT, etc.)
        Cookie cookie = new Cookie(COOKIE_NAME, token);
        cookie.setPath("/");  // Use root path — gateway strips /api prefix, Word may use either path
        cookie.setHttpOnly(true);
        cookie.setMaxAge((int) java.time.Duration.between(java.time.Instant.now(), wopiToken.getExpiresAt()).getSeconds());
        response.addCookie(cookie);

        // Set Spring Security authentication context
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                wopiToken.getUserId(),  // principal = UUID
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        filterChain.doFilter(request, response);
    }

    private String extractFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if (COOKIE_NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return c.getValue();
            }
        }
        return null;
    }

    private String extractFromBasicAuth(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Basic ")) return null;
        try {
            String decoded = new String(Base64.getDecoder().decode(authHeader.substring(6)), StandardCharsets.UTF_8);
            // Format: username:password — we use the password as the access_token
            int colon = decoded.indexOf(':');
            if (colon >= 0) {
                return decoded.substring(colon + 1);
            }
        } catch (IllegalArgumentException e) {
            log.debug("[WebDAV] Invalid Basic auth header");
        }
        return null;
    }
}
