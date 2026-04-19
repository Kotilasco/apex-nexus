package com.apexnexus.common.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long jwtExpirationMs;
    private final long refreshExpirationMs;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms:3600000}") long jwtExpirationMs,
            @Value("${jwt.refresh-expiration-ms:86400000}") long refreshExpirationMs) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.jwtExpirationMs = jwtExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public String generateAccessToken(UUID userId, String username, List<String> roles) {
        return generateAccessToken(userId, username, roles, null);
    }

    public String generateAccessToken(UUID userId, String username, List<String> roles,
                                       Map<UUID, List<String>> projectPermissions) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        var builder = Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey);

        if (projectPermissions != null && !projectPermissions.isEmpty()) {
            // Encode project permissions as Map<String, List<String>> (UUID keys as strings)
            Map<String, List<String>> encoded = new java.util.HashMap<>();
            projectPermissions.forEach((k, v) -> encoded.put(k.toString(), v));
            builder.claim("projectPerms", encoded);
        }

        return builder.compact();
    }

    public String generateRefreshToken(UUID userId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshExpirationMs);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("type", "refresh")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();
    }

    public UUID getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        return UUID.fromString(claims.getSubject());
    }

    public String getUsernameFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("username", String.class);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("roles", List.class);
    }

    /**
     * Extract the project permissions map from the token.
     * Returns a map of projectId -> list of permission names (e.g. "READ", "WRITE", "ADMIN").
     * Returns an empty map if the token has no projectPerms claim.
     */
    @SuppressWarnings("unchecked")
    public Map<UUID, List<String>> getProjectPermsFromToken(String token) {
        Claims claims = parseToken(token);
        Object raw = claims.get("projectPerms");
        if (!(raw instanceof Map<?, ?> rawMap)) {
            return Map.of();
        }
        Map<UUID, List<String>> result = new java.util.HashMap<>();
        for (Map.Entry<?, ?> e : rawMap.entrySet()) {
            try {
                UUID projectId = UUID.fromString(String.valueOf(e.getKey()));
                Object v = e.getValue();
                if (v instanceof List<?> list) {
                    List<String> perms = new java.util.ArrayList<>();
                    for (Object o : list) perms.add(String.valueOf(o));
                    result.put(projectId, perms);
                }
            } catch (IllegalArgumentException ignored) {
                // skip malformed project id
            }
        }
        return result;
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
