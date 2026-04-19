package com.apexnexus.document.config;

import com.apexnexus.common.security.JwtAuthenticationFilter;
import com.apexnexus.common.security.JwtTokenProvider;
import com.apexnexus.document.service.WopiTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpStatus;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider tokenProvider;
    private final RedisTemplate<String, String> redisTemplate;
    private final WopiTokenService wopiTokenService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers("/wopi/files/**").permitAll()  // WOPI uses its own token auth
                .requestMatchers("/webdav/**").permitAll()      // WebDAV uses access_token filter
                .requestMatchers("/ws/**").permitAll()           // WebSocket endpoint
                .requestMatchers("/sap-mock/**").permitAll()     // Internal mock-SAP calls (gateway protects externally)
                .requestMatchers("/public/vendor-portal/**").permitAll() // Token-authenticated vendor portal
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            )
            .addFilterBefore(
                new WebDavTokenFilter(wopiTokenService),
                UsernamePasswordAuthenticationFilter.class
            )
            .addFilterBefore(
                new JwtAuthenticationFilter(tokenProvider, redisTemplate),
                UsernamePasswordAuthenticationFilter.class
            );
        return http.build();
    }
}
