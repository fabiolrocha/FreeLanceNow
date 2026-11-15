package br.com.freelancenow.api.config;

import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.contracts.*;
import br.com.freelancenow.api.demands.*;
import br.com.freelancenow.api.feed.*;
import br.com.freelancenow.api.reviews.*;
import br.com.freelancenow.api.users.*;

import org.springframework.boot.CommandLineRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Demo data for local development and presentations, enabled with SEED_DEMO=true. Locally every
 * account uses the password listed in docs/contas-desenvolvimento.md; the prod profile has no
 * default and seeds nothing until SEED_DEMO_PASSWORD is set, so a published database never gets
 * accounts with a password that is in the repository. Accounts are created once. Contract history,
 * reviews and feed posts are created only when the demo client Pedro does not exist yet, so
 * restarts never duplicate them.
 */
@Component
@ConditionalOnProperty(name = "app.seed-demo", havingValue = "true")
public class DemoData implements CommandLineRunner {
    private static final String DOMAIN = "@demo.freelancenow.test";
    private static final ZoneId BRAZIL = ZoneId.of("America/Sao_Paulo");
    private static final Logger log = LoggerFactory.getLogger(DemoData.class);

    private final UserRepository users;
    private final CategoryRepository categories;
    private final ServiceRepository services;
    private final DemandRepository demands;
    private final ProposalRepository proposals;
    private final ContractRepository contracts;
    private final ContractEventRepository events;
    private final ContractMessageRepository messages;
    private final ReviewRepository reviews;
    private final FeedPostRepository posts;
    private final PasswordEncoder passwords;
    private final String password;

    public DemoData(
            UserRepository users,
            CategoryRepository categories,
            ServiceRepository services,
            DemandRepository demands,
            ProposalRepository proposals,
            ContractRepository contracts,
            ContractEventRepository events,
            ContractMessageRepository messages,
            ReviewRepository reviews,
            FeedPostRepository posts,
            PasswordEncoder passwords,
            @Value("${app.seed-demo-password:}") String password) {
        this.users = users;
        this.categories = categories;
        this.services = services;
        this.demands = demands;
        this.proposals = proposals;
        this.contracts = contracts;
        this.events = events;
        this.messages = messages;
        this.reviews = reviews;
        this.posts = posts;
        this.passwords = passwords;
        this.password = password == null ? "" : password;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (password.length() < 8) {
            log.warn("SEED_DEMO ligado sem SEED_DEMO_PASSWORD (mín. 8 caracteres): seed ignorado.");
            return;
        }
        boolean freshActivity = !users.existsByEmail("pedro" + DOMAIN);
        seed("Ana Lopes", "ana", Role.CLIENT, "Taguatinga, DF", "Cliente da demonstração.", null);
        seed(
                "Pedro Santos",
                "pedro",
                Role.CLIENT,
                "Águas Claras, DF",
                "Síndico de um prédio residencial.",
                null);
        seed(
                "Lúcia Martins",
                "lucia",
                Role.CLIENT,
                "Asa Sul, DF",
                "Dona de uma pequena loja de roupas.",
                null);
        seed(
                "Marcos Vieira",
                "marcos",
                Role.FREELANCER,
                "Taguatinga, DF",
                "Eletricista predial e residencial. Doze anos de experiência, NR-10 em dia.",
                "1");
        seed(
                "Juliana Prado",
                "juliana",
                Role.FREELANCER,
                "Águas Claras, DF",
                "Limpeza residencial e pós-obra, com produtos próprios.",
                "3");
        seed(
                "Rafael Andrade",
                "rafael",
                Role.FREELANCER,
                "Ceilândia, DF",
                "Encanador e especialista em caça-vazamento com geofone.",
                "2");
        seed(
                "Camila Rocha",
                "camila",
                Role.FREELANCER,
                "Asa Norte, DF",
                "Suporte de TI e redes para pequenos escritórios.",
                "4");
        seed(
                "Bruno Teles",
                "bruno",
                Role.FREELANCER,
                "Guará, DF",
                "Pintor residencial. Textura, grafiato e pintura de fachadas.",
                "5");
        seedDemands();
        if (freshActivity) seedActivity();
    }

    private User user(String handle) {
        return users.findByEmail(handle + DOMAIN).orElseThrow();
    }

    private ServiceListing service(String handle, String title) {
        var owner = user(handle).getId();
        return services.findAll().stream()
                .filter(s -> s.getFreelancer().getId().equals(owner))
                .filter(s -> s.getTitle().equals(title))
                .findFirst()
                .orElseThrow();
    }

    private Category category(String n) {
        return categories
                .findById(UUID.fromString("10000000-0000-0000-0000-00000000000" + n))
                .orElseThrow();
    }

    private void seedDemands() {
        if (demands.count() > 0) return;
        var now = Instant.now();
        var demand =
                demands.saveAndFlush(
                        new Demand(
                                user("ana"),
                                category("1"),
                                "Quadro de distribuição vive desarmando",
                                "Preciso de avaliação do quadro e troca dos disjuntores se necessário.",
                                new BigDecimal("800.00"),
                                2,
                                "Taguatinga, DF",
                                now));
        proposals.save(
                new Proposal(
                        demand,
                        user("marcos"),
                        new BigDecimal("720.00"),
                        2,
                        "Avalio o quadro na mesma visita. Material será orçado separadamente.",
                        now));
        demands.save(
                new Demand(
                        user("lucia"),
                        category("5"),
                        "Pintar a fachada da loja antes do Natal",
                        "Fachada de 6 m por 4 m, parede lisa, cor a definir. Prefiro trabalho fora"
                                + " do horário comercial.",
                        new BigDecimal("1500.00"),
                        3,
                        "Asa Sul, DF",
                        now.minus(Duration.ofHours(20))));
        demands.save(
                new Demand(
                        user("pedro"),
                        category("4"),
                        "Wi-Fi não chega aos fundos do salão de festas",
                        "Salão do condomínio com cerca de 120 m². Procuro solução com repetidor ou"
                                + " cabo.",
                        new BigDecimal("600.00"),
                        2,
                        "Águas Claras, DF",
                        now.minus(Duration.ofHours(5))));
    }

    /** Past contracts with reviews give the catalog real ratings; open ones fill the dashboards. */
    private void seedActivity() {
        var now = Instant.now();
        completed(
                "ana",
                "marcos",
                "Instalação de chuveiro elétrico",
                40,
                5,
                "Pontual, explicou tudo e deixou o banheiro limpo.",
                "Obrigado, Ana! Qualquer coisa é só chamar.");
        completed(
                "pedro",
                "marcos",
                "Troca de quadro de distribuição",
                25,
                5,
                "Trocou o quadro do salão em uma manhã. Recomendo.",
                null);
        completed(
                "lucia",
                "marcos",
                "Instalação de chuveiro elétrico",
                12,
                4,
                "Bom serviço, só atrasou meia hora.",
                "Desculpe pelo atraso, o trânsito estava parado.");
        completed(
                "ana",
                "juliana",
                "Limpeza pós-obra completa",
                33,
                5,
                "Apartamento entregue impecável depois da reforma.",
                null);
        completed(
                "pedro",
                "juliana",
                "Diária de limpeza residencial",
                18,
                5,
                "Caprichosa e muito organizada.",
                null);
        completed(
                "lucia",
                "rafael",
                "Caça-vazamento sem quebra",
                28,
                5,
                "Achou o vazamento sem quebrar o piso. Economizei muito.",
                "Fico feliz em ajudar!");
        completed(
                "ana",
                "rafael",
                "Desentupimento de esgoto",
                9,
                4,
                "Resolveu rápido e cobrou o combinado.",
                null);
        completed(
                "lucia",
                "camila",
                "Configuração de rede para escritório",
                21,
                5,
                "Rede da loja e maquininha funcionando sem queda.",
                null);
        completed(
                "pedro",
                "bruno",
                "Pintura de apartamento de 2 quartos",
                15,
                5,
                "Acabamento excelente e protegeu todos os móveis.",
                null);

        var inProgress =
                open(
                        "ana",
                        "camila",
                        "Formatação e backup de notebook",
                        3,
                        ContractStatus.ACEITO,
                        ContractStatus.EM_ANDAMENTO);
        messages.save(
                new ContractMessage(
                        inProgress,
                        user("ana"),
                        "Oi, Camila! Posso deixar o notebook na portaria amanhã cedo?",
                        now.minus(Duration.ofHours(30))));
        messages.save(
                new ContractMessage(
                        inProgress,
                        user("camila"),
                        "Pode sim. Já separei o HD externo para o backup.",
                        now.minus(Duration.ofHours(29))));
        open("ana", "bruno", "Textura e grafiato em parede", 1);
        open(
                "pedro",
                "rafael",
                "Caça-vazamento sem quebra",
                2,
                ContractStatus.ACEITO,
                ContractStatus.EM_ANDAMENTO,
                ContractStatus.AGUARDANDO_CONFIRMACAO);

        posts.save(
                new FeedPost(
                        user("marcos"),
                        "Dica de segurança: disjuntor que desarma sempre não é defeito, é aviso."
                                + " Antes de trocar, vale medir a carga do circuito.",
                        category("1"),
                        service("marcos", "Troca de quadro de distribuição"),
                        now.minus(Duration.ofHours(26))));
        posts.save(
                new FeedPost(
                        user("juliana"),
                        "Agenda de dezembro aberta para limpeza pós-obra. Levo os produtos e o"
                                + " aspirador de pó fino.",
                        category("3"),
                        service("juliana", "Limpeza pós-obra completa"),
                        now.minus(Duration.ofHours(9))));
        posts.save(
                new FeedPost(
                        user("bruno"),
                        "Terminei um grafiato na Asa Sul esta semana. Para fachada, prefira tinta"
                                + " acrílica premium: dura o dobro.",
                        category("5"),
                        null,
                        now.minus(Duration.ofHours(3))));
    }

    private void completed(
            String client,
            String freelancer,
            String title,
            int daysAgo,
            int rating,
            String comment,
            String reply) {
        var start = Instant.now().minus(Duration.ofDays(daysAgo));
        var contract =
                contract(
                        client,
                        freelancer,
                        title,
                        start,
                        LocalDate.ofInstant(start, BRAZIL).plusDays(2));
        var at = start;
        for (var status :
                List.of(
                        ContractStatus.ACEITO,
                        ContractStatus.EM_ANDAMENTO,
                        ContractStatus.AGUARDANDO_CONFIRMACAO,
                        ContractStatus.CONCLUIDO)) {
            at = at.plus(Duration.ofHours(20));
            move(contract, status, at);
        }
        var review = new Review(contract, rating, comment, at.plus(Duration.ofHours(3)));
        if (reply != null) review.registerReply(reply, at.plus(Duration.ofHours(8)));
        reviews.save(review);
    }

    private Contract open(
            String client,
            String freelancer,
            String title,
            int daysAgo,
            ContractStatus... path) {
        var start = Instant.now().minus(Duration.ofDays(daysAgo));
        var contract =
                contract(client, freelancer, title, start, LocalDate.now(BRAZIL).plusDays(3));
        var at = start;
        for (var status : path) {
            at = at.plus(Duration.ofHours(6));
            move(contract, status, at);
        }
        return contract;
    }

    private Contract contract(
            String client, String freelancer, String title, Instant at, LocalDate date) {
        var c =
                new Contract(
                        service(freelancer, title),
                        user(client),
                        date,
                        "Pedido criado pela demonstração. Detalhes combinados pelo chat.",
                        "Endereço combinado pelo chat",
                        at);
        contracts.save(c);
        events.save(new ContractEvent(c, c.getClient(), null, ContractStatus.PENDENTE, null, at));
        return c;
    }

    private void move(Contract c, ContractStatus next, Instant at) {
        var previous = c.getStatus();
        var actor = next == ContractStatus.CONCLUIDO ? c.getClient() : c.getFreelancer();
        c.transitionTo(next, null, at);
        // Explicit save: the integration test calls run() without the transactional proxy.
        contracts.save(c);
        events.save(new ContractEvent(c, actor, previous, next, null, at));
    }

    private void seed(String name, String handle, Role role, String city, String bio, String cat) {
        String email = handle + DOMAIN;
        if (users.existsByEmail(email)) return;
        var user = new User(name, email, passwords.encode(password), "61999990000", role);
        user.updateProfile(
                name, user.getPhone(), city, bio, role == Role.FREELANCER ? city + " e região" : "");
        user.markEmailVerified(user.getCreatedAt());
        users.saveAndFlush(user);
        if (cat == null) return;
        var category = category(cat);
        String[][] rows =
                switch (cat) {
                    case "1" ->
                            new String[][] {
                                {
                                    "Instalação de chuveiro elétrico",
                                    "180",
                                    "1",
                                    "Instalo ou troco o chuveiro com fiação e disjuntor adequados à"
                                            + " potência. Confiro o aterramento e testo antes de sair."
                                },
                                {
                                    "Troca de quadro de distribuição",
                                    "640",
                                    "2",
                                    "Troco o quadro antigo por um novo com DR e disjuntores"
                                            + " identificados. Entrego a lista do que foi trocado."
                                }
                            };
                    case "2" ->
                            new String[][] {
                                {
                                    "Caça-vazamento sem quebra",
                                    "220",
                                    "1",
                                    "Localizo vazamentos com geofone e câmera, sem quebrar piso nem"
                                            + " parede à toa. Entrego o ponto marcado."
                                },
                                {
                                    "Desentupimento de esgoto",
                                    "290",
                                    "1",
                                    "Desentupo pia, ralo, vaso e caixa de gordura com máquina"
                                            + " rotativa. Deixo o local limpo."
                                }
                            };
                    case "3" ->
                            new String[][] {
                                {
                                    "Limpeza pós-obra completa",
                                    "380",
                                    "2",
                                    "Removo pó fino e respingos de tinta e cimento de pisos, vidros"
                                            + " e azulejos. Levo produtos e equipamentos."
                                },
                                {
                                    "Diária de limpeza residencial",
                                    "160",
                                    "1",
                                    "Diária de 8 horas com cozinha, banheiros, quartos e área de"
                                            + " serviço. Roupa passada sob combinação."
                                }
                            };
                    case "4" ->
                            new String[][] {
                                {
                                    "Configuração de rede para escritório",
                                    "480",
                                    "3",
                                    "Planejo e configuro roteador, repetidores e cabos para até 15"
                                            + " computadores, com rede separada para visitantes."
                                },
                                {
                                    "Formatação e backup de notebook",
                                    "250",
                                    "2",
                                    "Faço backup completo, formatação, drivers e programas do dia a"
                                            + " dia. Devolvo com tudo funcionando."
                                }
                            };
                    default ->
                            new String[][] {
                                {
                                    "Pintura de apartamento de 2 quartos",
                                    "1900",
                                    "5",
                                    "Massa corrida onde precisar, lixamento e duas demãos de tinta"
                                            + " acrílica. Protejo móveis e pisos."
                                },
                                {
                                    "Textura e grafiato em parede",
                                    "420",
                                    "2",
                                    "Textura ou grafiato em paredes internas ou muros, com"
                                            + " acabamento uniforme e cor à escolha."
                                }
                            };
                };
        for (var row : rows)
            services.save(
                    new ServiceListing(
                            user,
                            category,
                            new CatalogDtos.SaveService(
                                    row[0],
                                    row[3],
                                    category.getId(),
                                    new BigDecimal(row[1]),
                                    Integer.valueOf(row[2]),
                                    ServiceStatus.ACTIVE)));
    }
}
