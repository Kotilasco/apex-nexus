package com.apexnexus.document.service;

import com.apexnexus.common.security.EncryptionUtil;
import io.minio.*;
import io.minio.errors.MinioException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.draft-bucket}")
    private String draftBucket;

    @Value("${encryption.key}")
    private String encryptionKey;

    /**
     * Store file with AES-256-GCM encryption at rest
     */
    public String storeFile(byte[] fileData, String storageKey, String contentType) throws Exception {
        // Encrypt before storing
        byte[] encrypted = EncryptionUtil.encrypt(fileData, encryptionKey);

        minioClient.putObject(PutObjectArgs.builder()
                .bucket(bucket)
                .object(storageKey)
                .stream(new ByteArrayInputStream(encrypted), encrypted.length, -1)
                .contentType("application/octet-stream")
                .build());

        log.info("Stored encrypted file: {} ({} bytes)", storageKey, encrypted.length);
        return storageKey;
    }

    /**
     * Retrieve and decrypt file
     */
    public byte[] retrieveFile(String storageKey) throws Exception {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(storageKey)
                .build())) {
            byte[] encrypted = stream.readAllBytes();
            return EncryptionUtil.decrypt(encrypted, encryptionKey);
        }
    }

    /**
     * Delete file from storage
     */
    public void deleteFile(String storageKey) throws Exception {
        minioClient.removeObject(RemoveObjectArgs.builder()
                .bucket(bucket)
                .object(storageKey)
                .build());
        log.info("Deleted file: {}", storageKey);
    }

    // ============ Draft Bucket Operations ============

    public void storeDraft(byte[] fileData, String draftKey, String contentType) throws Exception {
        byte[] encrypted = EncryptionUtil.encrypt(fileData, encryptionKey);
        minioClient.putObject(PutObjectArgs.builder()
                .bucket(draftBucket)
                .object(draftKey)
                .stream(new ByteArrayInputStream(encrypted), encrypted.length, -1)
                .contentType("application/octet-stream")
                .build());
        log.info("Stored draft: {} ({} bytes)", draftKey, encrypted.length);
    }

    public byte[] retrieveDraft(String draftKey) throws Exception {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(draftBucket)
                .object(draftKey)
                .build())) {
            byte[] encrypted = stream.readAllBytes();
            return EncryptionUtil.decrypt(encrypted, encryptionKey);
        }
    }

    public void deleteDraft(String draftKey) throws Exception {
        minioClient.removeObject(RemoveObjectArgs.builder()
                .bucket(draftBucket)
                .object(draftKey)
                .build());
        log.info("Deleted draft: {}", draftKey);
    }

    public boolean draftExists(String draftKey) {
        try {
            minioClient.statObject(StatObjectArgs.builder()
                    .bucket(draftBucket)
                    .object(draftKey)
                    .build());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Calculate SHA-256 hash of file data
     */
    public String calculateSha256(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(data);
        return HexFormat.of().formatHex(hash);
    }
}
