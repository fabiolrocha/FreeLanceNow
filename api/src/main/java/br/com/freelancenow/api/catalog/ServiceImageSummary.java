package br.com.freelancenow.api.catalog;

import java.util.UUID;

/** Image metadata without the binary content, used to build listing views. */
public record ServiceImageSummary(UUID id, UUID serviceId, String contentType) {}
