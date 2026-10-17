package br.com.freelancenow.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FreeLanceNowApplication {

    public static void main(String[] args) {
        SpringApplication.run(FreeLanceNowApplication.class, args);
    }
}
