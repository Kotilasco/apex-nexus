package com.apexnexus.document.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "email_ingestion_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailIngestionConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String protocol; // IMAP or EWS

    @Column(name = "imap_host")
    private String imapHost;

    @Column(name = "imap_port")
    private Integer imapPort;

    @Column(name = "ews_url")
    private String ewsUrl;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(name = "folder_name")
    private String folderName;

    @Column(name = "use_ssl")
    private Boolean useSsl;

    @Column(name = "poll_interval", nullable = false)
    private Integer pollInterval;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "target_folder_id")
    private UUID targetFolderId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(mappedBy = "config", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<EmailIngestionRule> rules = new ArrayList<>();

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (protocol == null)
            protocol = "IMAP";
        if (enabled == null)
            enabled = false;
        if (useSsl == null)
            useSsl = true;
        if (pollInterval == null)
            pollInterval = 5;
        if (folderName == null)
            folderName = "INBOX";
        if (imapPort == null && "IMAP".equalsIgnoreCase(protocol))
            imapPort = 993;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
