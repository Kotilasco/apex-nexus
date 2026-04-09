package com.apexnexus.document.repository;

import com.apexnexus.document.model.WopiAccessToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WopiTokenRepository extends JpaRepository<WopiAccessToken, UUID> {
    Optional<WopiAccessToken> findByToken(String token);

    @Modifying
    @Query("DELETE FROM WopiAccessToken t WHERE t.expiresAt < :now")
    void deleteExpiredTokens(Instant now);
}
