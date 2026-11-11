package br.com.freelancenow.api.admin;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

public class ServiceImageService {

    public void uploadServiceImages(Long serviceId, List<MultipartFile> images) {
        if (images != null && images.size() > 5) {
            throw new IllegalArgumentException("Você pode enviar no máximo 5 imagens por anúncio.");
        }

        if (images != null) {
            for (MultipartFile file : images) {
                // Validar tamanho (5MB)
                if (file.getSize() > 5 * 1024 * 1024) {
                    throw new IllegalArgumentException("A imagem excede o tamanho máximo de 5 MB.");
                }

                // Validar tipo (JPEG ou PNG)
                String contentType = file.getContentType();
                if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png"))) {
                    throw new IllegalArgumentException("Apenas arquivos JPG ou PNG são permitidos.");
                }

                try {
                    String fileName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
                    Path uploadPath = Paths.get("/app/uploads");
                    if (!Files.exists(uploadPath)) {
                        Files.createDirectories(uploadPath);
                    }
                    Path filePath = uploadPath.resolve(fileName);
                    Files.copy(file.getInputStream(), filePath);

                } catch (IOException e) {
                    throw new RuntimeException("Erro ao salvar o arquivo de imagem.", e);
                }
            }
        }
    }
}