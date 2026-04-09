package com.apexnexus.document.service;

import com.apexnexus.document.model.WopiAccessToken;
import com.apexnexus.document.repository.WopiTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * Manages WOPI access tokens for Office Online session authentication.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WopiTokenService {

    private static final Duration TOKEN_TTL = Duration.ofHours(4);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final WopiTokenRepository tokenRepository;

    @Transactional
    public WopiAccessToken createToken(UUID documentId, UUID userId, String permissions) {
        byte[] tokenBytes = new byte[48];
        SECURE_RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        WopiAccessToken wopiToken = WopiAccessToken.builder()
                .token(token)
                .documentId(documentId)
                .userId(userId)
                .permissions(permissions != null ? permissions : "VIEW")
                .expiresAt(Instant.now().plus(TOKEN_TTL))
                .build();

        return tokenRepository.save(wopiToken);
    }

    @Transactional(readOnly = true)
    public Optional<WopiAccessToken> validateToken(String token) {
        return tokenRepository.findByToken(token)
                .filter(t -> t.getExpiresAt().isAfter(Instant.now()));
    }

    @Scheduled(fixedRate = 600_000) // Every 10 minutes
    @Transactional
    public void cleanupExpiredTokens() {
        tokenRepository.deleteExpiredTokens(Instant.now());
    }
}
