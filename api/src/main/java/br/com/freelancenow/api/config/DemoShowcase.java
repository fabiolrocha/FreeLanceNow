package br.com.freelancenow.api.config;

import br.com.freelancenow.api.admin.AuditService;
import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.contracts.*;
import br.com.freelancenow.api.demands.*;
import br.com.freelancenow.api.feed.*;
import br.com.freelancenow.api.moderation.ContentReport;
import br.com.freelancenow.api.moderation.ReportDtos;
import br.com.freelancenow.api.moderation.ReportRepository;
import br.com.freelancenow.api.notifications.Notification;
import br.com.freelancenow.api.notifications.NotificationRepository;
import br.com.freelancenow.api.payments.PaymentService;
import br.com.freelancenow.api.reviews.*;
import br.com.freelancenow.api.users.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Second wave of demo data, run after {@link DemoData}: the three evaluation accounts (client,
 * freelancer and admin, listed in docs/README.md), six more freelancers, four more clients and
 * activity in every state the app supports, so each screen has something to show. Every account
 * created here uses the seed password. The whole wave runs once, in one transaction, and only
 * when the evaluation freelancer does not exist yet. Cover images go to every demo listing that
 * has none, on every start.
 */
@Component
@Order(2)
@ConditionalOnProperty(name = "app.seed-demo", havingValue = "true")
public class DemoShowcase implements CommandLineRunner {
    private static final String DOMAIN = "@demo.freelancenow.test";
    private static final ZoneId BRAZIL = ZoneId.of("America/Sao_Paulo");
    private static final Logger log = LoggerFactory.getLogger(DemoShowcase.class);

    private final UserRepository users;
    private final CategoryRepository categories;
    private final ServiceRepository services;
    private final ServiceImageRepository images;
    private final DemandRepository demands;
    private final ProposalRepository proposals;
    private final ContractRepository contracts;
    private final ContractEventRepository events;
    private final ContractMessageRepository messages;
    private final ReviewRepository reviews;
    private final FeedPostRepository posts;
    private final NotificationRepository notifications;
    private final ReportRepository reports;
    private final AuditService audit;
    private final PaymentService payments;
    private final PasswordEncoder passwords;
    private final JdbcTemplate db;
    private final String password;
    private Instant now;
    private int listed;

    public DemoShowcase(
            UserRepository users,
            CategoryRepository categories,
            ServiceRepository services,
            ServiceImageRepository images,
            DemandRepository demands,
            ProposalRepository proposals,
            ContractRepository contracts,
            ContractEventRepository events,
            ContractMessageRepository messages,
            ReviewRepository reviews,
            FeedPostRepository posts,
            NotificationRepository notifications,
            ReportRepository reports,
            AuditService audit,
            PaymentService payments,
            PasswordEncoder passwords,
            JdbcTemplate db,
            @Value("${app.seed-demo-password:}") String password) {
        this.users = users;
        this.categories = categories;
        this.services = services;
        this.images = images;
        this.demands = demands;
        this.proposals = proposals;
        this.contracts = contracts;
        this.events = events;
        this.messages = messages;
        this.reviews = reviews;
        this.posts = posts;
        this.notifications = notifications;
        this.reports = reports;
        this.audit = audit;
        this.payments = payments;
        this.passwords = passwords;
        this.db = db;
        this.password = password == null ? "" : password;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (password.length() < 8 || !users.existsByEmail("marcos" + DOMAIN)) return;
        now = Instant.now();
        if (!users.existsByEmail("freelancer" + DOMAIN)) {
            accounts();
            activity();
            log.info("Dados de vitrine criados (contas de avaliação e atividades).");
        }
        covers();
    }

    // ------------------------------------------------------------------ accounts and listings

    private void accounts() {
        var admin =
                new User(
                        "Administração FreeLanceNow",
                        "admin" + DOMAIN,
                        passwords.encode(password),
                        "0000000000",
                        Role.ADMIN);
        admin.markEmailVerified(admin.getCreatedAt());
        users.saveAndFlush(admin);
        audit.record(
                admin, "ADMIN_CREATED", "USER", admin.getId(), "", "ADMIN", "Conta de avaliação");

        client("cliente", "Beatriz Almeida", "Sudoeste, DF", "Arquiteta, reformando o apartamento novo.");
        client("carlos", "Carlos Menezes", "Guará, DF", "Dono de uma oficina mecânica.");
        client("helena", "Helena Costa", "Lago Sul, DF", "Gerente de uma padaria de bairro.");
        client("roberto", "Roberto Nunes", "Vicente Pires, DF", "Aposentado, cuida da casa e do jardim.");

        freelancer(
                "freelancer",
                "Tiago Ferreira",
                "Sudoeste, DF",
                "Eletricista e técnico em automação residencial. Iluminação em LED, tomadas,"
                        + " câmeras e revisão completa da instalação.",
                "1",
                new String[][] {
                    {"Instalação de iluminação LED", "350", "1",
                        "Projeto e instalação de fitas, spots e trilhos de LED em sala, cozinha e"
                                + " quartos. Uso drivers adequados e deixo tudo testado."},
                    {"Instalação de tomadas e interruptores", "150", "1",
                        "Instalo ou troco tomadas, interruptores e pontos novos, no padrão novo de"
                                + " tomadas e com a fiação dimensionada."},
                    {"Instalação de câmeras de segurança", "690", "2",
                        "Instalo até 4 câmeras com gravador e configuro o acesso pelo celular."
                                + " Passo os cabos de forma discreta."},
                    {"Revisão elétrica completa", "520", "2",
                        "Inspeção do quadro, disjuntores, aterramento e tomadas, com relatório do"
                                + " que precisa de troca. Indicado para imóveis antigos.",
                        "INACTIVE"}
                });
        freelancer(
                "renata",
                "Renata Souza",
                "Samambaia, DF",
                "Higienização de estofados e limpeza de vidros com produtos biodegradáveis.",
                "3",
                new String[][] {
                    {"Limpeza de sofá e estofados", "220", "1",
                        "Higienização a seco ou com extratora, removendo manchas e ácaros. Sofá"
                                + " pronto para uso no mesmo dia."},
                    {"Limpeza de vidros e janelas", "180", "1",
                        "Limpeza de vidros, esquadrias e box, por dentro e por fora, com"
                                + " equipamento para janelas altas."}
                });
        freelancer(
                "diego",
                "Diego Martins",
                "Taguatinga, DF",
                "Técnico de informática. Atendo residências e pequenos negócios.",
                "4",
                new String[][] {
                    {"Instalação de impressora e rede Wi-Fi", "190", "1",
                        "Configuro impressoras, roteador e repetidores para todos os computadores"
                                + " e celulares da casa ou do escritório."},
                    {"Remoção de vírus e otimização do computador", "160", "1",
                        "Removo vírus e programas indesejados, atualizo o sistema e deixo o"
                                + " computador mais rápido, sem perder arquivos."},
                    {"Criação de site institucional simples", "1200", "10",
                        "Site de uma página com apresentação, serviços, mapa e botão de contato."
                                + " Domínio e hospedagem orçados à parte."}
                });
        freelancer(
                "fernanda",
                "Fernanda Lima",
                "Sobradinho, DF",
                "Pintora de fachadas, portões e áreas externas. Trabalho com equipe de dois"
                        + " ajudantes.",
                "5",
                new String[][] {
                    {"Pintura de portões e grades", "380", "2",
                        "Lixamento, tratamento de ferrugem com fundo anticorrosivo e duas demãos de"
                                + " esmalte sintético."},
                    {"Aplicação de textura em fachada", "1600", "4",
                        "Textura acrílica em fachadas de até 60 m², com proteção de janelas e"
                                + " limpeza ao final."}
                });
        freelancer(
                "gustavo",
                "Gustavo Ribeiro",
                "Gama, DF",
                "Encanador e instalador de aquecedores a gás com certificação.",
                "2",
                new String[][] {
                    {"Instalação de aquecedor a gás", "450", "1",
                        "Instalo aquecedor de passagem com teste de estanqueidade e orientação de"
                                + " uso. Material orçado à parte."},
                    {"Troca de registro e reparo de vazamento", "200", "1",
                        "Troco registros, sifões e flexíveis e reparo vazamentos aparentes em"
                                + " cozinha, banheiro e área de serviço."},
                    {"Limpeza de caixa d'água", "260", "1",
                        "Esvaziamento, escovação e desinfecção da caixa d'água de até 1.000"
                                + " litros, com etiqueta da data da limpeza."}
                });
        freelancer(
                "leandro",
                "Leandro Costa",
                "Planaltina, DF",
                "Eletricista residencial, com foco em ventiladores e padrões de entrada.",
                "1",
                new String[][] {
                    {"Instalação de ventilador de teto", "140", "1",
                        "Instalo ventilador de teto com controle ou interruptor próprio,"
                                + " balanceado e sem barulho."},
                    {"Padrão de entrada de energia", "1350", "3",
                        "Monto o padrão de entrada conforme as normas da distribuidora e"
                                + " acompanho a vistoria."}
                });
    }

    private void client(String handle, String name, String city, String bio) {
        account(handle, name, Role.CLIENT, city, bio);
    }

    private void freelancer(
            String handle, String name, String city, String bio, String cat, String[][] rows) {
        var user = account(handle, name, Role.FREELANCER, city, bio);
        var category = category(cat);
        for (var row : rows) {
            var saved =
                    services.saveAndFlush(
                    new ServiceListing(
                            user,
                            category,
                            new CatalogDtos.SaveService(
                                    row[0],
                                    row[3],
                                    category.getId(),
                                    new BigDecimal(row[1]),
                                    Integer.valueOf(row[2]),
                                    row.length > 4
                                            ? ServiceStatus.valueOf(row[4])
                                            : ServiceStatus.ACTIVE)));
            // Listed months ago, before the contracts that use them.
            db.update(
                    "update service_listing set created_at = ? where id = ?",
                    Timestamp.from(now.minus(Duration.ofDays(65 + 4L * listed++))),
                    saved.getId());
        }
    }

    private User account(String handle, String name, Role role, String city, String bio) {
        var user =
                new User(name, handle + DOMAIN, passwords.encode(password), "61988887777", role);
        user.updateProfile(
                name, user.getPhone(), city, bio, role == Role.FREELANCER ? city + " e região" : "");
        user.markEmailVerified(user.getCreatedAt());
        return users.saveAndFlush(user);
    }

    // ------------------------------------------------------------------ activity

    private void activity() {
        // Finished work with reviews: gives every new professional a rating.
        completed("cliente", "freelancer", "Instalação de iluminação LED", 30, 5,
                "O projeto de iluminação da sala ficou lindo. Muito cuidadoso com o gesso.",
                "Obrigado, Beatriz! Foi um prazer trabalhar no seu apartamento.");
        completed("cliente", "juliana", "Limpeza pós-obra completa", 22, 5,
                "Deixou o apartamento pronto para a mudança, sem nenhum pó.", null);
        completed("cliente", "renata", "Limpeza de vidros e janelas", 8, 5,
                "Vidros impecáveis, inclusive os da varanda.", null);
        completed("carlos", "freelancer", "Instalação de câmeras de segurança", 45, 5,
                "Instalou 4 câmeras na oficina e configurou o acesso pelo celular.", null);
        completed("helena", "freelancer", "Instalação de tomadas e interruptores", 16, 4,
                "Bom trabalho. Voltou para ajustar uma tomada sem cobrar nada.",
                "Obrigado pela confiança, Helena!");
        completed("pedro", "freelancer", "Instalação de iluminação LED", 9, 5,
                "A iluminação do hall do prédio ficou excelente.", null);
        completed("roberto", "gustavo", "Limpeza de caixa d'água", 35, 5,
                "Pontual e explicou como manter a caixa limpa.", null);
        completed("helena", "gustavo", "Instalação de aquecedor a gás", 20, 5,
                "O aquecedor da padaria está funcionando perfeitamente.", null);
        completed("carlos", "diego", "Instalação de impressora e rede Wi-Fi", 27, 5,
                "Resolveu a rede da oficina em uma tarde.", null);
        completed("roberto", "diego", "Remoção de vírus e otimização do computador", 11, 4,
                "O computador ficou bem mais rápido.", "Que bom, seu Roberto! Qualquer coisa, chame.");
        completed("ana", "diego", "Criação de site institucional simples", 60, 5,
                "Site simples e bonito, entregue antes do prazo.", null);
        completed("helena", "renata", "Limpeza de sofá e estofados", 19, 5,
                "Os sofás da área de clientes ficaram como novos.", null);
        completed("roberto", "fernanda", "Pintura de portões e grades", 24, 5,
                "Portão sem ferrugem e com pintura impecável.", null);
        completed("carlos", "fernanda", "Aplicação de textura em fachada", 40, 4,
                "Fachada ficou ótima; atrasou um dia por causa da chuva.",
                "A chuva atrapalhou, mas compensamos no acabamento.");
        completed("roberto", "leandro", "Instalação de ventilador de teto", 14, 5,
                "Ventilador firme e silencioso.", null);
        completed("helena", "leandro", "Padrão de entrada de energia", 50, 5,
                "Cuidou de tudo, até da vistoria da distribuidora.", null);
        // Finished two days ago and not reviewed yet: the evaluation client can review it.
        completed("cliente", "camila", "Configuração de rede para escritório", 3, 0, null, null);

        // The evaluation client's contracts in every other state.
        var painting = open("cliente", "bruno", "Pintura de apartamento de 2 quartos", 4, null,
                ContractStatus.ACEITO, ContractStatus.EM_ANDAMENTO);
        chat(painting, 70,
                "cliente", "Bruno, a cor da sala é o branco gelo que te mandei por foto.",
                "bruno", "Combinado! Hoje termino a massa corrida e amanhã começo a pintura.",
                "cliente", "Ótimo. O porteiro já está avisado.");
        var sockets = open("cliente", "freelancer", "Instalação de tomadas e interruptores", 3,
                "Instalei 8 tomadas e 3 interruptores. Mandei as fotos pelo chat.",
                ContractStatus.ACEITO, ContractStatus.EM_ANDAMENTO,
                ContractStatus.AGUARDANDO_CONFIRMACAO);
        chat(sockets, 40,
                "freelancer", "Beatriz, terminei! Testei todas as tomadas da cozinha.",
                "cliente", "Vou conferir à noite e já confirmo por aqui.");
        open("cliente", "rafael", "Caça-vazamento sem quebra", 1, null, ContractStatus.ACEITO);
        open("cliente", "freelancer", "Instalação de câmeras de segurança", 0, null);
        var dispute = open("cliente", "diego", "Instalação de impressora e rede Wi-Fi", 9, null,
                ContractStatus.ACEITO, ContractStatus.EM_ANDAMENTO,
                ContractStatus.AGUARDANDO_CONFIRMACAO);
        move(dispute, ContractStatus.EM_DISPUTA, dispute.getClient(),
                "A impressora continua sem imprimir pela rede e o profissional não voltou.",
                dispute.getStatusUpdatedAt().plus(Duration.ofHours(10)));
        open("cliente", "fernanda", "Aplicação de textura em fachada", 12,
                "Agenda cheia até o fim do mês.", ContractStatus.RECUSADO);
        open("cliente", "gustavo", "Instalação de aquecedor a gás", 15,
                "Resolvi com o síndico do prédio.", ContractStatus.CANCELADO);

        // The evaluation freelancer's queue.
        open("helena", "freelancer", "Instalação de iluminação LED", 0, null);
        var shop = open("carlos", "freelancer", "Instalação de tomadas e interruptores", 2, null,
                ContractStatus.ACEITO, ContractStatus.EM_ANDAMENTO);
        chat(shop, 30,
                "carlos", "Tiago, precisa de mais uma tomada perto do compressor.",
                "freelancer", "Sem problema, levo o material amanhã cedo.");
        open("roberto", "freelancer", "Instalação de câmeras de segurança", 1, null,
                ContractStatus.ACEITO);

        demandsAndProposals();
        payments();
        feed();
        favorites();
        reportsAndInbox();
    }

    private void demandsAndProposals() {
        var kitchen = demand("cliente", "1", "Luminárias e trilho de LED na cozinha",
                "Cozinha americana de 12 m². Quero trilho com spots sobre a bancada e fita de LED"
                        + " embaixo dos armários.",
                "900", 3, "Sudoeste, DF", 50);
        proposal(kitchen, "freelancer", "850", 2,
                "Faço o trilho e a fita no mesmo dia. Já incluo o driver e a mão de obra.", 40);
        proposal(kitchen, "leandro", "780", 3,
                "Consigo começar na segunda. Material por conta da cliente.", 30);
        proposal(kitchen, "marcos", "920", 2,
                "Incluo revisão do circuito da cozinha junto com a instalação.", 20);

        var mesh = demand("cliente", "4", "Rede Wi-Fi mesh no apartamento",
                "Apartamento de 3 quartos com sinal fraco nos fundos. Tenho os aparelhos mesh,"
                        + " preciso de quem configure.",
                "700", 2, "Sudoeste, DF", 24 * 14);
        var won = proposal(mesh, "diego", "650", 1,
                "Configuro os três pontos e deixo uma rede separada para visitas.", 24 * 13);
        var lost = proposal(mesh, "camila", "690", 2,
                "Faço o teste de sinal em todos os cômodos antes de configurar.", 24 * 13 - 5);
        var decided = now.minus(Duration.ofDays(12));
        won.accept(decided);
        lost.reject(decided);
        mesh.close(decided);
        var fromDemand = new Contract(mesh, won, LocalDate.ofInstant(decided, BRAZIL).plusDays(2),
                "", decided);
        contracts.save(fromDemand);
        events.save(new ContractEvent(fromDemand, fromDemand.getClient(), null,
                ContractStatus.ACEITO, "Proposta aceita", decided));
        var at = decided;
        for (var s : List.of(ContractStatus.EM_ANDAMENTO, ContractStatus.AGUARDANDO_CONFIRMACAO,
                ContractStatus.CONCLUIDO)) {
            at = at.plus(Duration.ofHours(20));
            move(fromDemand, s, null, null, at);
        }
        reviews.save(new Review(fromDemand, 5, "Sinal perfeito no apartamento todo.",
                at.plus(Duration.ofHours(2))));

        var carpet = demand("cliente", "3", "Limpeza do carpete do escritório",
                "Sala comercial de 40 m² com carpete.", "350", 1, "Sudoeste, DF", 24 * 20);
        carpet.cancel(now.minus(Duration.ofDays(18)));

        var floor = demand("carlos", "5", "Pintura do piso da oficina com epóxi",
                "Piso de 80 m², precisa de preparo e pintura epóxi cinza.",
                "2500", 5, "Guará, DF", 30);
        proposal(floor, "fernanda", "2300", 5, "Faço o preparo com lixadeira e duas demãos.", 20);
        proposal(floor, "bruno", "2450", 4, "Termino em quatro dias com a minha equipe.", 10);

        var grease = demand("helena", "2", "Desentupir a caixa de gordura da padaria",
                "Caixa de gordura transbordando. Preciso de atendimento rápido.",
                "400", 1, "Lago Sul, DF", 8);
        proposal(grease, "gustavo", "350", 1, "Atendo amanhã às 7h, antes de a padaria abrir.", 6);
        proposal(grease, "rafael", "380", 1, "Levo a máquina rotativa e o hidrojato.", 4);

        var sockets = demand("helena", "1", "Tomadas extras na cozinha da padaria",
                "Preciso de quatro tomadas novas para fornos e batedeira.",
                "500", 2, "Lago Sul, DF", 26);
        proposal(sockets, "freelancer", "480", 2,
                "Instalo as quatro tomadas com circuito próprio para os fornos.", 22);
        var withdrawn = proposal(sockets, "leandro", "450", 2, "Posso fazer na quarta.", 20);
        withdrawn.withdraw(now.minus(Duration.ofHours(12)));

        var video = demand("roberto", "4", "Configurar celular e TV para videochamada",
                "Quero falar com os netos pela TV da sala.", "200", 1, "Vicente Pires, DF", 18);
        proposal(video, "diego", "180", 1, "Configuro a TV, o celular e te ensino a usar.", 12);
        proposal(video, "camila", "150", 1, "Deixo um passo a passo impresso.", 9);

        var house = demand("roberto", "3", "Limpeza completa da casa antes das festas",
                "Casa térrea de 3 quartos, com área externa.", "450", 1, "Vicente Pires, DF", 36);
        proposal(house, "renata", "420", 1, "Inclui limpeza dos vidros e do sofá da sala.", 30);
        proposal(house, "juliana", "440", 1, "Levo uma ajudante e terminamos em um dia.", 28);
    }

    private void payments() {
        // Escrow history (provider SIMULATED) for every contract that already started.
        for (var handle : List.of("cliente", "carlos", "helena", "roberto", "ana", "pedro")) {
            for (var c : contracts.findByClientIdOrderByCreatedAtDesc(user(handle).getId())) {
                var started =
                        events.findByContractIdOrderByCreatedAtAsc(c.getId()).stream()
                                .filter(e -> e.getStatus() == ContractStatus.EM_ANDAMENTO)
                                .map(ContractEvent::getCreatedAt)
                                .findFirst();
                if (started.isEmpty()) continue;
                var paidAt = started.get().minus(Duration.ofHours(2));
                if (c.getStatus() == ContractStatus.CONCLUIDO)
                    payments.recordSimulated(c, true, paidAt, c.getCompletedAt());
                else if (c.getStatus() != ContractStatus.CANCELADO)
                    payments.recordSimulated(c, false, paidAt, null);
            }
        }
        db.update(
                "insert into withdrawal (id, user_id, amount, status, created_at)"
                        + " values (?, ?, ?, 'SIMULATED', ?)",
                UUID.randomUUID(),
                user("freelancer").getId(),
                new BigDecimal("300.00"),
                Timestamp.from(now.minus(Duration.ofDays(10))));
    }

    private void feed() {
        post("freelancer", "1", "Instalação de iluminação LED",
                "Antes e depois de uma sala no Sudoeste: trocamos o lustre por trilho e fita de"
                        + " LED. Conta de luz menor e ambiente bem mais aconchegante.", 50);
        post("freelancer", "1", null,
                "Dica: tomada que esquenta não é normal. Desligue o aparelho e chame um"
                        + " eletricista para conferir a fiação.", 7);
        post("renata", "3", "Limpeza de sofá e estofados",
                "Sofá de linho com mancha de café: saiu tudo com higienização a seco.", 20);
        post("diego", "4", null,
                "Seu Wi-Fi cai toda hora? Muitas vezes é o roteador no lugar errado. Deixe-o no"
                        + " alto e no centro da casa.", 33);
        post("fernanda", "5", "Pintura de portões e grades",
                "Portão recuperado em Sobradinho: tratamento da ferrugem faz toda a diferença.",
                60);
        post("gustavo", "2", "Limpeza de caixa d'água",
                "Lembrete: a caixa d'água deve ser limpa a cada seis meses.", 14);
        post("leandro", "1", null,
                "Ventilador de teto balançando? Normalmente é só balancear as pás. Não precisa"
                        + " trocar o aparelho.", 4);
        post("juliana", "3", null,
                "Agenda de janeiro aberta para faxinas pós-festas. Reserve com antecedência!", 2);
    }

    private void favorites() {
        favorite("cliente", "freelancer", "Instalação de iluminação LED");
        favorite("cliente", "renata", "Limpeza de sofá e estofados");
        favorite("cliente", "gustavo", "Limpeza de caixa d'água");
        favorite("carlos", "fernanda", "Aplicação de textura em fachada");
    }

    private void reportsAndInbox() {
        var site = service("diego", "Criação de site institucional simples");
        report("roberto", ContentReport.Target.SERVICE, site.getId(), site.getTitle(),
                site.getDescription(), "Anúncio enganoso ou incorreto",
                "O anúncio fala em site completo, mas no chat o profissional cobrou à parte por"
                        + " itens que pareciam incluídos.", 20);
        var spam = post("leandro", "1", null,
                "PROMOÇÃO RELÂMPAGO!!! Ventilador instalado pela metade do preço só hoje, chame"
                        + " agora antes que acabe!!!", 26);
        report("helena", ContentReport.Target.POST, spam.getId(), "Publicação de Leandro Costa",
                spam.getText(), "Spam ou propaganda",
                "A mesma promoção foi publicada várias vezes e parece propaganda enganosa.", 18);
        var admin = user("admin");
        var oldPost = post("bruno", "5", null,
                "Faço qualquer pintura pelo menor preço do DF, garantido!", 24 * 9);
        var kept = report("lucia", ContentReport.Target.POST, oldPost.getId(),
                "Publicação de Bruno Teles", oldPost.getText(), "Possível golpe",
                "Promessa de menor preço sem detalhes parece golpe para atrair clientes.",
                24 * 8);
        kept.decide(admin, ContentReport.Status.KEPT,
                "Publicação de divulgação comum, sem indício de golpe.",
                now.minus(Duration.ofDays(7)));
        audit.record(admin, "REPORT_DECIDED", "REPORT", kept.getId(), "PENDING", "KEPT",
                "Publicação de divulgação comum, sem indício de golpe.");

        inbox("cliente", "PROPOSAL_RECEIVED", "Nova proposta: Luminárias e trilho de LED na cozinha",
                "Marcos Vieira enviou uma proposta para sua demanda.", "/demandas", 20, false);
        inbox("cliente", "CONTRACT_STATUS",
                "Instalação de tomadas e interruptores: aguardando confirmação",
                "Tiago Ferreira atualizou a contratação.", "/contratacoes", 26, false);
        inbox("cliente", "CONTRACT_STATUS", "Caça-vazamento sem quebra: aceita",
                "Rafael Andrade aceitou. Faça o pagamento para o serviço começar.",
                "/contratacoes", 18, false);
        inbox("cliente", "CONTRACT_STATUS", "Configuração de rede para escritório: concluída",
                "Avalie o serviço de Camila Rocha.", "/contratacoes", 30, true);
        inbox("freelancer", "CONTRACT_REQUESTED", "Nova solicitação: Instalação de câmeras de segurança",
                "Beatriz Almeida pediu este serviço. Responda em até 48 horas.",
                "/solicitacoes", 3, false);
        inbox("freelancer", "CONTRACT_REQUESTED", "Nova solicitação: Instalação de iluminação LED",
                "Helena Costa pediu este serviço. Responda em até 48 horas.",
                "/solicitacoes", 2, false);
        inbox("freelancer", "CONTRACT_STATUS", "Instalação de iluminação LED: concluída",
                "Valor liberado na sua carteira.", "/carteira", 24 * 8, true);
    }

    // ------------------------------------------------------------------ cover images

    /** Gives every demo listing without photos its cover from resources/demo/servicos. */
    private void covers() {
        for (var s : services.findAll()) {
            if (!s.getFreelancer().getEmail().endsWith(DOMAIN)) continue;
            if (db.queryForObject(
                            "select count(*) from service_image where service_id = ?",
                            Integer.class,
                            s.getId())
                    > 0) continue;
            var file = new ClassPathResource("demo/servicos/" + slug(s.getTitle()) + ".jpg");
            if (!file.exists()) continue;
            try {
                images.save(new ServiceImage(s, "image/jpeg", file.getContentAsByteArray(), now));
            } catch (IOException e) {
                log.warn("Capa de demonstração ilegível: {}", file.getPath());
            }
        }
    }

    static String slug(String title) {
        return Normalizer.normalize(title, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
    }

    // ------------------------------------------------------------------ helpers

    private User user(String handle) {
        return users.findByEmail(handle + DOMAIN).orElseThrow();
    }

    private Category category(String n) {
        return categories
                .findById(UUID.fromString("10000000-0000-0000-0000-00000000000" + n))
                .orElseThrow();
    }

    private ServiceListing service(String handle, String title) {
        var owner = user(handle).getId();
        return services.findAll().stream()
                .filter(s -> s.getFreelancer().getId().equals(owner))
                .filter(s -> s.getTitle().equals(title))
                .findFirst()
                .orElseThrow();
    }

    /** Contract that went all the way; rating 0 leaves it without a review. */
    private void completed(String client, String freelancer, String title, int daysAgo,
            int rating, String comment, String reply) {
        var start = now.minus(Duration.ofDays(daysAgo));
        var c = contract(client, freelancer, title, start,
                LocalDate.ofInstant(start, BRAZIL).plusDays(2));
        var at = start;
        for (var s : List.of(ContractStatus.ACEITO, ContractStatus.EM_ANDAMENTO,
                ContractStatus.AGUARDANDO_CONFIRMACAO, ContractStatus.CONCLUIDO)) {
            at = at.plus(Duration.ofHours(14));
            move(c, s, null, null, at);
        }
        if (rating == 0) return;
        var review = new Review(c, rating, comment, at.plus(Duration.ofHours(3)));
        if (reply != null) review.registerReply(reply, at.plus(Duration.ofHours(8)));
        reviews.save(review);
    }

    private Contract open(String client, String freelancer, String title, int daysAgo,
            String lastNote, ContractStatus... path) {
        var start = now.minus(Duration.ofDays(daysAgo)).minus(Duration.ofHours(5));
        var c = contract(client, freelancer, title, start, LocalDate.now(BRAZIL).plusDays(3));
        var at = start;
        for (int i = 0; i < path.length; i++) {
            at = at.plus(Duration.ofHours(daysAgo == 0 ? 1 : 6));
            move(c, path[i], null, i == path.length - 1 ? lastNote : null, at);
        }
        return c;
    }

    private Contract contract(String client, String freelancer, String title, Instant at,
            LocalDate date) {
        var c = new Contract(service(freelancer, title), user(client), date,
                "Pedido criado pela demonstração. Detalhes combinados pelo chat.",
                "Endereço combinado pelo chat", at);
        contracts.save(c);
        events.save(new ContractEvent(c, c.getClient(), null, ContractStatus.PENDENTE, null, at));
        return c;
    }

    /** Moves a contract; the actor follows the real rules unless one is given. */
    private void move(Contract c, ContractStatus next, User actor, String note, Instant at) {
        var previous = c.getStatus();
        if (actor == null)
            actor = switch (next) {
                case CONCLUIDO, CANCELADO, EM_DISPUTA -> c.getClient();
                default -> c.getFreelancer();
            };
        c.transitionTo(next, note, at);
        contracts.save(c);
        events.save(new ContractEvent(c, actor, previous, next, note, at));
    }

    private void chat(Contract c, int hoursAgo, String... lines) {
        var at = now.minus(Duration.ofHours(hoursAgo));
        for (int i = 0; i < lines.length; i += 2) {
            at = at.plus(Duration.ofMinutes(35));
            messages.save(new ContractMessage(c, user(lines[i]), lines[i + 1], at));
        }
    }

    private Demand demand(String client, String cat, String title, String description,
            String budget, int days, String city, int hoursAgo) {
        return demands.saveAndFlush(new Demand(user(client), category(cat), title, description,
                new BigDecimal(budget), days, city, now.minus(Duration.ofHours(hoursAgo))));
    }

    private Proposal proposal(Demand d, String freelancer, String price, int days, String message,
            int hoursAgo) {
        return proposals.save(new Proposal(d, user(freelancer), new BigDecimal(price), days,
                message, now.minus(Duration.ofHours(hoursAgo))));
    }

    private FeedPost post(String author, String cat, String serviceTitle, String text,
            int hoursAgo) {
        return posts.save(new FeedPost(user(author), text, category(cat),
                serviceTitle == null ? null : service(author, serviceTitle),
                now.minus(Duration.ofHours(hoursAgo))));
    }

    private void favorite(String handle, String owner, String title) {
        db.update(
                "insert into favorite_service (user_id, service_id, created_at) values (?, ?, ?)"
                        + " on conflict do nothing",
                user(handle).getId(),
                service(owner, title).getId(),
                Timestamp.from(now.minus(Duration.ofDays(3))));
    }

    private ContentReport report(String reporter, ContentReport.Target type, UUID target,
            String title, String content, String reason, String comment, int hoursAgo) {
        return reports.save(new ContentReport(user(reporter),
                new ReportDtos.Create(type, target, reason, comment), title,
                content.length() > 1000 ? content.substring(0, 1000) : content,
                now.minus(Duration.ofHours(hoursAgo))));
    }

    private void inbox(String handle, String type, String title, String body, String link,
            int hoursAgo, boolean read) {
        var at = now.minus(Duration.ofHours(hoursAgo));
        var n = new Notification(user(handle), type, title, body, link, at);
        if (read) n.markRead(at.plus(Duration.ofHours(1)));
        notifications.save(n);
    }
}
