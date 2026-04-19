package com.apexnexus.document.service;

import com.apexnexus.common.security.SecurityContextUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Hash-chain ledger providing blockchain-style tamper-proof notarization.
 * Each block links to the previous block's hash, so any tampering breaks the chain.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotarizationService {

    private final JdbcTemplate jdbc;

    public Map<String, Object> notarize(UUID documentId) {
        UUID userId = SecurityContextUtil.currentUserId();
        Map<String, Object> doc = jdbc.queryForMap(
                "SELECT id, current_version, sha256_hash, title FROM documents WHERE id = ?", documentId);
        String contentHash = (String) doc.get("sha256_hash");
        Integer version = (Integer) doc.get("current_version");

        // Pull previous block (chain tip)
        String prevBlockHash = null;
        Long nextBlockNumber = 1L;
        List<Map<String, Object>> prev = jdbc.queryForList(
                "SELECT block_hash, block_number FROM document_notarizations ORDER BY block_number DESC LIMIT 1");
        if (!prev.isEmpty()) {
            prevBlockHash = (String) prev.get(0).get("block_hash");
            nextBlockNumber = ((Number) prev.get(0).get("block_number")).longValue() + 1;
        }

        OffsetDateTime ts = OffsetDateTime.now(java.time.ZoneOffset.UTC)
                .truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        String tsCanonical = ts.toInstant().toString();
        String payload = String.join("|",
                documentId.toString(),
                String.valueOf(version),
                contentHash,
                prevBlockHash == null ? "GENESIS" : prevBlockHash,
                userId.toString(),
                tsCanonical,
                String.valueOf(nextBlockNumber));
        String blockHash = sha256(payload);

        jdbc.update("""
                INSERT INTO document_notarizations
                (document_id, version, content_hash, previous_block_hash, block_hash, block_number, notarized_by, notarized_at, network)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'apex-chain-v1')
                """, documentId, version, contentHash, prevBlockHash, blockHash, nextBlockNumber, userId, ts);

        log.info("Notarized document {} as block #{}: {}", documentId, nextBlockNumber, blockHash);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("documentId", documentId);
        result.put("version", version);
        result.put("contentHash", contentHash);
        result.put("blockHash", blockHash);
        result.put("previousBlockHash", prevBlockHash);
        result.put("blockNumber", nextBlockNumber);
        result.put("network", "apex-chain-v1");
        result.put("notarizedAt", ts);
        result.put("notarizedBy", userId);
        result.put("verified", true);
        return result;
    }

    public Map<String, Object> verify(UUID documentId) {
        List<Map<String, Object>> blocks = jdbc.queryForList("""
                SELECT dn.block_number, dn.block_hash, dn.previous_block_hash,
                       dn.content_hash, dn.version, dn.notarized_at, dn.notarized_by,
                       dn.network, u.username AS notarized_by_name
                FROM document_notarizations dn
                LEFT JOIN users u ON u.id = dn.notarized_by
                WHERE dn.document_id = ?
                ORDER BY dn.block_number ASC
                """, documentId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("documentId", documentId);
        result.put("notarized", !blocks.isEmpty());
        if (blocks.isEmpty()) {
            result.put("verified", false);
            result.put("reason", "Not yet notarized");
            result.put("blocks", List.of());
            return result;
        }

        // Verify current doc hash matches latest block's content hash
        String currentHash = jdbc.queryForObject(
                "SELECT sha256_hash FROM documents WHERE id = ?", String.class, documentId);
        Map<String, Object> latest = blocks.get(blocks.size() - 1);
        boolean hashMatches = currentHash != null && currentHash.equals(latest.get("content_hash"));

        // Verify chain integrity — recompute each block hash
        boolean chainValid = true;
        String lastTamperedBlock = null;
        for (Map<String, Object> b : blocks) {
            Object tsObj = b.get("notarized_at");
            String tsStr;
            if (tsObj instanceof OffsetDateTime odt) {
                tsStr = odt.toInstant().toString();
            } else if (tsObj instanceof java.sql.Timestamp tts) {
                tsStr = tts.toInstant().toString();
            } else {
                tsStr = String.valueOf(tsObj);
            }
            String payload = String.join("|",
                    documentId.toString(),
                    String.valueOf(b.get("version")),
                    String.valueOf(b.get("content_hash")),
                    b.get("previous_block_hash") == null ? "GENESIS" : String.valueOf(b.get("previous_block_hash")),
                    String.valueOf(b.get("notarized_by")),
                    tsStr,
                    String.valueOf(b.get("block_number")));
            String recomputed = sha256(payload);
            if (!recomputed.equals(b.get("block_hash"))) {
                chainValid = false;
                lastTamperedBlock = String.valueOf(b.get("block_number"));
                break;
            }
        }

        result.put("verified", hashMatches && chainValid);
        result.put("currentHashMatches", hashMatches);
        result.put("chainValid", chainValid);
        result.put("tamperedBlock", lastTamperedBlock);
        result.put("currentHash", currentHash);
        result.put("latestBlockHash", latest.get("block_hash"));
        result.put("blockCount", blocks.size());
        result.put("blocks", blocks);
        return result;
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 failed", e);
        }
    }
}
