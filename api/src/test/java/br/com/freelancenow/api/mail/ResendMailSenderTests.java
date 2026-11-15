package br.com.freelancenow.api.mail;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ResendMailSenderTests {
    @Test
    void reservedTestDomainsAreNeverSent() {
        assertTrue(ResendMailSender.reservedTestAddress("ana@demo.freelancenow.test"));
        assertTrue(ResendMailSender.reservedTestAddress("Ana <ANA@DEMO.FREELANCENOW.TEST>"));
        assertTrue(ResendMailSender.reservedTestAddress(null));
        assertFalse(ResendMailSender.reservedTestAddress("pessoa@gmail.com"));
        assertFalse(ResendMailSender.reservedTestAddress("contato@test.com.br"));
    }
}
