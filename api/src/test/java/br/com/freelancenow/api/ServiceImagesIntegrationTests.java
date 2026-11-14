package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;

import javax.imageio.ImageIO;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ServiceImagesIntegrationTests {
    private static final String CATEGORY = "10000000-0000-0000-0000-000000000001";

    @Value("${local.server.port}")
    int port;

    @Autowired JdbcTemplate jdbc;

    String freelancer, otherFreelancer, client, serviceId;

    RestClient http() {
        return RestClient.create("http://localhost:" + port);
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> call(HttpMethod method, String path, Object body, String token) {
        var req =
                http().method(method)
                        .uri("/api/v1" + path)
                        .headers(
                                h -> {
                                    if (token != null) h.setBearerAuth(token);
                                });
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().body(Map.class);
    }

    String register(String role) {
        return call(
                        HttpMethod.POST,
                        "/auth/register",
                        Map.of(
                                "name",
                                "Pessoa " + role,
                                "email",
                                UUID.randomUUID() + "@example.test",
                                "password",
                                "Strong12345",
                                "phone",
                                "61999990000",
                                "role",
                                role,
                                "acceptedTerms",
                                true),
                        null)
                .get("accessToken")
                .toString();
    }

    String createService(String token, String status) {
        return call(
                        HttpMethod.POST,
                        "/services",
                        Map.of(
                                "title",
                                "Pintura de parede",
                                "description",
                                "Pintura interna com acabamento.",
                                "categoryId",
                                CATEGORY,
                                "price",
                                300,
                                "deliveryDays",
                                2,
                                "status",
                                status),
                        token)
                .get("id")
                .toString();
    }

    static byte[] image(String format, int width, int height) {
        try {
            var out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    static ByteArrayResource file(byte[] data, String name) {
        return new ByteArrayResource(data) {
            @Override
            public String getFilename() {
                return name;
            }
        };
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> upload(String id, String token, ByteArrayResource... files) {
        var parts = new LinkedMultiValueMap<String, Object>();
        for (var f : files) parts.add("files", f);
        return http().post()
                .uri("/api/v1/services/" + id + "/images")
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(parts)
                .retrieve()
                .body(Map.class);
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> images(Map<String, Object> service) {
        return (List<Map<String, Object>>) service.get("images");
    }

    void expect(int code, Runnable work) {
        var e = assertThrows(RestClientResponseException.class, work::run);
        assertEquals(code, e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    @BeforeEach
    void actors() {
        freelancer = register("FREELANCER");
        otherFreelancer = register("FREELANCER");
        client = register("CLIENT");
        serviceId = createService(freelancer, "ACTIVE");
    }

    @Test
    void ownerUploadsListsServesAndRemovesImages() {
        var png = image("png", 40, 30);
        var jpg = image("jpg", 20, 20);
        var saved = upload(serviceId, freelancer, file(png, "a.png"), file(jpg, "b.jpg"));
        var gallery = images(saved);
        assertEquals(2, gallery.size());
        assertEquals("image/png", gallery.get(0).get("contentType"));
        assertEquals("image/jpeg", gallery.get(1).get("contentType"));

        var detail = call(HttpMethod.GET, "/services/" + serviceId, null, null);
        assertEquals(2, images(detail).size());
        @SuppressWarnings("unchecked")
        var page =
                (List<Map<String, Object>>)
                        call(HttpMethod.GET, "/services?size=50", null, null).get("items");
        var listed = page.stream().filter(s -> serviceId.equals(s.get("id"))).findFirst();
        assertTrue(listed.isPresent());
        assertEquals(2, images(listed.get()).size());

        var firstId = gallery.get(0).get("id").toString();
        var served =
                http().get()
                        .uri("/api/v1/services/" + serviceId + "/images/" + firstId)
                        .retrieve()
                        .toEntity(byte[].class);
        assertEquals(MediaType.IMAGE_PNG, served.getHeaders().getContentType());
        assertEquals("nosniff", served.getHeaders().getFirst("X-Content-Type-Options"));
        assertArrayEquals(png, served.getBody());

        var afterDelete =
                call(
                        HttpMethod.DELETE,
                        "/services/" + serviceId + "/images/" + firstId,
                        null,
                        freelancer);
        assertEquals(1, images(afterDelete).size());
        expect(
                404,
                () ->
                        http().get()
                                .uri("/api/v1/services/" + serviceId + "/images/" + firstId)
                                .retrieve()
                                .toBodilessEntity());
    }

    @Test
    void limitsToFiveImagesPerListing() {
        var png = image("png", 10, 10);
        upload(
                serviceId,
                freelancer,
                file(png, "1.png"),
                file(png, "2.png"),
                file(png, "3.png"),
                file(png, "4.png"));
        expect(
                409,
                () -> upload(serviceId, freelancer, file(png, "5.png"), file(png, "6.png")));
        assertEquals(5, images(upload(serviceId, freelancer, file(png, "5.png"))).size());
        expect(409, () -> upload(serviceId, freelancer, file(png, "6.png")));
    }

    @Test
    void rejectsWrongTypesCorruptedAndOversizedFiles() {
        var gif = image("gif", 10, 10);
        expect(415, () -> upload(serviceId, freelancer, file(gif, "falso.png")));
        expect(
                415,
                () ->
                        upload(
                                serviceId,
                                freelancer,
                                file("<svg></svg>".getBytes(), "imagem.jpg")));
        var corrupted = Arrays.copyOf(image("png", 10, 10), 12);
        expect(415, () -> upload(serviceId, freelancer, file(corrupted, "quebrada.png")));

        var big = new byte[5 * 1024 * 1024 + 1];
        big[0] = (byte) 0xFF;
        big[1] = (byte) 0xD8;
        big[2] = (byte) 0xFF;
        expect(413, () -> upload(serviceId, freelancer, file(big, "grande.jpg")));
        assertTrue(images(call(HttpMethod.GET, "/services/" + serviceId, null, null)).isEmpty());
    }

    @Test
    void onlyTheOwnerManagesImages() {
        var png = image("png", 10, 10);
        expect(403, () -> upload(serviceId, otherFreelancer, file(png, "x.png")));
        expect(403, () -> upload(serviceId, client, file(png, "x.png")));
        var imageId =
                images(upload(serviceId, freelancer, file(png, "x.png"))).get(0).get("id").toString();
        expect(
                403,
                () ->
                        call(
                                HttpMethod.DELETE,
                                "/services/" + serviceId + "/images/" + imageId,
                                null,
                                otherFreelancer));
        var otherService = createService(otherFreelancer, "DRAFT");
        expect(
                404,
                () ->
                        call(
                                HttpMethod.DELETE,
                                "/services/" + otherService + "/images/" + imageId,
                                null,
                                otherFreelancer));
        expect(
                401,
                () ->
                        http().post()
                                .uri("/api/v1/services/" + serviceId + "/images")
                                .contentType(MediaType.MULTIPART_FORM_DATA)
                                .body(new LinkedMultiValueMap<String, Object>())
                                .retrieve()
                                .toBodilessEntity());
    }

    @Test
    void moderatedListingsHideAndLockTheirImages() {
        var png = image("png", 10, 10);
        var imageId =
                images(upload(serviceId, freelancer, file(png, "x.png"))).get(0).get("id").toString();
        jdbc.update(
                "update service_listing set moderated = true, status = 'INACTIVE' where id = ?",
                UUID.fromString(serviceId));
        expect(
                404,
                () ->
                        http().get()
                                .uri("/api/v1/services/" + serviceId + "/images/" + imageId)
                                .retrieve()
                                .toBodilessEntity());
        expect(409, () -> upload(serviceId, freelancer, file(png, "y.png")));
    }
}
