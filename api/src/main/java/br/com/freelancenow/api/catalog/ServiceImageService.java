package br.com.freelancenow.api.catalog;

import br.com.freelancenow.api.common.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Clock;
import java.util.*;

import javax.imageio.ImageIO;

/**
 * Stores listing photos (RN08): at most 5 JPG/PNG files of up to 5 MB per listing. The bytes live
 * in PostgreSQL so they follow the same backup and hosting as the rest of the data.
 */
@Service
@Transactional(readOnly = true)
public class ServiceImageService {
    public static final int MAX_IMAGES = 5;
    public static final long MAX_BYTES = 5L * 1024 * 1024;
    static final int MAX_DIMENSION = 8000;

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {
        (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'
    };

    private final CatalogService catalog;
    private final ServiceImageRepository images;
    private final Clock clock;

    public ServiceImageService(
            CatalogService catalog, ServiceImageRepository images, Clock clock) {
        this.catalog = catalog;
        this.images = images;
        this.clock = clock;
    }

    @Transactional
    public CatalogDtos.ServiceView upload(Jwt jwt, UUID serviceId, List<MultipartFile> files) {
        var service = catalog.ownedForUpdate(jwt, serviceId);
        var received = files == null ? List.<MultipartFile>of() : files;
        if (received.isEmpty() || received.stream().allMatch(MultipartFile::isEmpty))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecione ao menos uma imagem.");
        if (images.countByService(serviceId) + received.size() > MAX_IMAGES)
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cada anúncio pode ter no máximo " + MAX_IMAGES + " imagens.");
        var now = clock.instant();
        var accepted = new ArrayList<ServiceImage>();
        for (var file : received) {
            var data = read(file);
            var type = detectType(data);
            checkReadable(data);
            accepted.add(new ServiceImage(service, type, data, now));
            now = now.plusNanos(1000);
        }
        images.saveAll(accepted);
        return catalog.view(service);
    }

    @Transactional
    public CatalogDtos.ServiceView delete(Jwt jwt, UUID serviceId, UUID imageId) {
        var service = catalog.ownedForUpdate(jwt, serviceId);
        if (images.deleteInService(serviceId, imageId) == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "Imagem não encontrada.");
        return catalog.view(service);
    }

    /**
     * Public read used by {@code <img>} tags, which cannot send the bearer token. Image ids are
     * random UUIDs; listings removed by moderation or owned by suspended accounts stay hidden.
     */
    public ServiceImage find(UUID serviceId, UUID imageId) {
        var image =
                images.findInService(serviceId, imageId)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND, "Imagem não encontrada."));
        var service = image.getService();
        if (service.isModerated() || !service.getFreelancer().isActive())
            throw new ApiException(HttpStatus.NOT_FOUND, "Imagem não encontrada.");
        return image;
    }

    private static byte[] read(MultipartFile file) {
        if (file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "A imagem enviada está vazia.");
        if (file.getSize() > MAX_BYTES)
            throw new ApiException(
                    HttpStatus.PAYLOAD_TOO_LARGE, "Cada imagem pode ter no máximo 5 MB.");
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não foi possível ler a imagem.");
        }
    }

    /** Trusts the file signature, not the client-supplied name or Content-Type. */
    static String detectType(byte[] data) {
        if (startsWith(data, JPEG)) return "image/jpeg";
        if (startsWith(data, PNG)) return "image/png";
        throw new ApiException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Envie apenas imagens JPG ou PNG.");
    }

    /** Parses the header to reject corrupted files and oversized dimensions without decoding. */
    static void checkReadable(byte[] data) {
        try (var in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            var readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) throw unreadable();
            var reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1) throw unreadable();
                if (width > MAX_DIMENSION || height > MAX_DIMENSION)
                    throw new ApiException(
                            HttpStatus.BAD_REQUEST,
                            "A imagem pode ter no máximo "
                                    + MAX_DIMENSION
                                    + " pixels de largura ou altura.");
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof ApiException api) throw api;
            throw unreadable();
        }
    }

    private static ApiException unreadable() {
        return new ApiException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE, "A imagem está corrompida ou não pôde ser lida.");
    }

    private static boolean startsWith(byte[] data, byte[] signature) {
        if (data.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) if (data[i] != signature[i]) return false;
        return true;
    }
}
