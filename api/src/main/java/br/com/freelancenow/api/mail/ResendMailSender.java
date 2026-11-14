package br.com.freelancenow.api.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Delivers e-mail through the Resend HTTP API (https://resend.com/docs/api-reference). */
public class ResendMailSender implements MailSender {
    private static final Logger log = LoggerFactory.getLogger(ResendMailSender.class);
    private static final URI ENDPOINT = URI.create("https://api.resend.com/emails");

    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final String apiKey;
    private final String from;

    public ResendMailSender(String apiKey, String from) {
        this.apiKey = apiKey;
        this.from = from;
    }

    @Override
    public void send(Mail mail) {
        var body =
                "{\"from\":"
                        + json(from)
                        + ",\"to\":["
                        + json(mail.to())
                        + "],\"subject\":"
                        + json(mail.subject())
                        + ",\"text\":"
                        + json(mail.text())
                        + ",\"html\":"
                        + json(mail.html())
                        + "}";
        var request =
                HttpRequest.newBuilder(ENDPOINT)
                        .timeout(Duration.ofSeconds(10))
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300)
                log.warn(
                        "Resend recusou o envio de \"{}\" (HTTP {}).",
                        mail.subject(),
                        response.statusCode());
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("Falha ao enviar e-mail \"{}\": {}", mail.subject(), e.toString());
        }
    }

    static String json(String value) {
        var out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.append('"').toString();
    }
}
