package br.com.freelancenow.api.config;

import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.users.*;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Component
@Profile("dev")
@ConditionalOnProperty(name = "app.seed-demo", havingValue = "true")
public class DemoData implements CommandLineRunner {
    private final UserRepository users;
    private final CategoryRepository categories;
    private final ServiceRepository services;
    private final PasswordEncoder passwords;

    public DemoData(
            UserRepository users,
            CategoryRepository categories,
            ServiceRepository services,
            PasswordEncoder passwords) {
        this.users = users;
        this.categories = categories;
        this.services = services;
        this.passwords = passwords;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seed(
                "Ana Lopes",
                "ana@demo.freelancenow.test",
                Role.CLIENT,
                "Taguatinga, DF",
                "Cliente da demonstração.",
                null);
        seed(
                "Marcos Vieira",
                "marcos@demo.freelancenow.test",
                Role.FREELANCER,
                "Taguatinga, DF",
                "Eletricista predial e residencial. Doze anos de experiência.",
                "1");
        seed(
                "Juliana Prado",
                "juliana@demo.freelancenow.test",
                Role.FREELANCER,
                "Águas Claras, DF",
                "Limpeza residencial e pós-obra.",
                "3");
        seed(
                "Rafael Andrade",
                "rafael@demo.freelancenow.test",
                Role.FREELANCER,
                "Ceilândia, DF",
                "Encanador e especialista em caça-vazamento.",
                "2");
        seed(
                "Camila Rocha",
                "camila@demo.freelancenow.test",
                Role.FREELANCER,
                "Asa Norte, DF",
                "Suporte de TI e redes para pequenos escritórios.",
                "4");
    }

    private void seed(String name, String email, Role role, String city, String bio, String cat) {
        if (users.existsByEmail(email)) return;
        var user = new User(name, email, passwords.encode("Demo12345"), "61999990000", role);
        user.updateProfile(name, user.getPhone(), city, bio);
        users.saveAndFlush(user);
        if (cat == null) return;
        var category =
                categories
                        .findById(UUID.fromString("10000000-0000-0000-0000-00000000000" + cat))
                        .orElseThrow();
        String[][] rows =
                switch (cat) {
                    case "1" ->
                            new String[][] {
                                {"Instalação de chuveiro elétrico", "180", "1"},
                                {"Troca de quadro de distribuição", "640", "2"}
                            };
                    case "2" ->
                            new String[][] {
                                {"Caça-vazamento sem quebra", "220", "1"},
                                {"Desentupimento de esgoto", "290", "1"}
                            };
                    case "3" ->
                            new String[][] {
                                {"Limpeza pós-obra completa", "380", "2"},
                                {"Diária de limpeza residencial", "160", "1"}
                            };
                    default ->
                            new String[][] {
                                {"Configuração de rede para escritório", "480", "3"},
                                {"Formatação e backup de notebook", "250", "2"}
                            };
                };
        for (var row : rows)
            services.save(
                    new ServiceListing(
                            user,
                            category,
                            new CatalogDtos.SaveService(
                                    row[0],
                                    bio + " Combine o escopo antes da execução.",
                                    category.getId(),
                                    new BigDecimal(row[1]),
                                    Integer.valueOf(row[2]),
                                    ServiceStatus.ACTIVE)));
    }
}
