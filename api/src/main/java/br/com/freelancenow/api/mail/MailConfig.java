package br.com.freelancenow.api.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class MailConfig {
    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    /**
     * Uses Resend when a real key is configured. Without one, local profiles log the message
     * (including links) so password recovery can be exercised; the prod profile only warns.
     */
    @Bean
    MailSender mailSender(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-email}") String from,
            Environment environment) {
        if (apiKey != null && !apiKey.isBlank() && !apiKey.equals("re_placeholder"))
            return new ResendMailSender(apiKey.trim(), from);
        boolean prod = environment.matchesProfiles("prod");
        if (prod) log.warn("RESEND_API_KEY ausente: e-mails não serão enviados.");
        return mail -> {
            if (prod) log.warn("E-mail \"{}\" não enviado: Resend não configurado.", mail.subject());
            else
                log.info(
                        "E-mail de desenvolvimento para {} — {}\n{}",
                        mail.to(),
                        mail.subject(),
                        mail.text());
        };
    }
}
