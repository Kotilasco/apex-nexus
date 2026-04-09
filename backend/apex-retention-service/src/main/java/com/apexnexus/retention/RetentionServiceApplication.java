package com.apexnexus.retention;

import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = {"com.apexnexus.retention", "com.apexnexus.common"})
@EnableScheduling
@EnableBatchProcessing
public class RetentionServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RetentionServiceApplication.class, args);
    }
}
