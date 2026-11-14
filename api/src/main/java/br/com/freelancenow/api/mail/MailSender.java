package br.com.freelancenow.api.mail;

/** Sends transactional e-mail. Implementations must not throw on delivery failure. */
public interface MailSender {
    void send(Mail mail);

    record Mail(String to, String subject, String text, String html) {}
}
