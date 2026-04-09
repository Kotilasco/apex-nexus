package com.apexnexus.search.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;

/**
 * Generates document embeddings (feature vectors) for semantic/similarity search.
 * Uses feature hashing (hashing trick) to create fixed-dimension vectors from text.
 * This is a lightweight, dependency-free approach that can be swapped out for
 * a proper ML embedding API (OpenAI, Hugging Face, etc.) later.
 */
@Service
@Slf4j
public class EmbeddingService {

    private static final int DIMENSIONS = 256;

    /**
     * Generate a normalized feature vector from text content.
     * Uses n-gram feature hashing with TF weighting.
     */
    public float[] generateEmbedding(String text) {
        if (text == null || text.isBlank()) {
            return new float[DIMENSIONS];
        }

        float[] vector = new float[DIMENSIONS];
        String normalized = text.toLowerCase().replaceAll("[^a-z0-9äöüß\\s]", " ");
        String[] tokens = normalized.split("\\s+");

        // Unigram hashing
        for (String token : tokens) {
            if (token.length() < 2) continue;
            int hash = murmurHash(token);
            int index = Math.abs(hash % DIMENSIONS);
            float sign = (hash & 0x80000000) == 0 ? 1.0f : -1.0f;
            vector[index] += sign;
        }

        // Bigram hashing for phrase-level semantics
        for (int i = 0; i < tokens.length - 1; i++) {
            if (tokens[i].length() < 2 || tokens[i + 1].length() < 2) continue;
            String bigram = tokens[i] + "_" + tokens[i + 1];
            int hash = murmurHash(bigram);
            int index = Math.abs(hash % DIMENSIONS);
            float sign = (hash & 0x80000000) == 0 ? 1.0f : -1.0f;
            vector[index] += sign * 0.5f; // Lower weight for bigrams
        }

        // L2 normalize
        float norm = 0;
        for (float v : vector) norm += v * v;
        norm = (float) Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < DIMENSIONS; i++) {
                vector[i] /= norm;
            }
        }

        return vector;
    }

    public int getDimensions() {
        return DIMENSIONS;
    }

    /**
     * Simple MurmurHash3-inspired 32-bit hash for consistent hashing.
     */
    private static int murmurHash(String key) {
        int h = 0x811c9dc5;
        for (int i = 0; i < key.length(); i++) {
            h ^= key.charAt(i);
            h *= 0x01000193;
        }
        h ^= h >>> 16;
        h *= 0x85ebca6b;
        h ^= h >>> 13;
        h *= 0xc2b2ae35;
        h ^= h >>> 16;
        return h;
    }
}
