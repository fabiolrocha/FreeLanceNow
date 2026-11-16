FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw --batch-mode dependency:go-offline
COPY src src
RUN ./mvnw --batch-mode package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/target/api-0.0.1-SNAPSHOT.jar app.jar
# Class Data Sharing: a training run records the classes loaded while the Spring context starts,
# and later starts map them from app.jsa instead of parsing them again. On Render's free instance
# (a fraction of a CPU) this shortens the cold start after the service sleeps.
# The training run needs no database: Flyway is off, Hibernate skips JDBC metadata, and the
# process exits as soon as the context is refreshed, before any runner or request.
RUN java -Djarmode=tools -jar app.jar extract --destination extracted \
    && rm app.jar \
    && java -XX:ArchiveClassesAtExit=extracted/app.jsa \
        -Dspring.context.exit=onRefresh \
        -jar extracted/app.jar \
        --spring.profiles.active=default \
        --spring.datasource.url=jdbc:postgresql://127.0.0.1:1/cds \
        --spring.datasource.password=cds \
        --spring.flyway.enabled=false \
        --spring.jpa.hibernate.ddl-auto=none \
        --spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
        --spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
        --app.jwt.secret=cds-training-run-secret-not-used-at-runtime \
        --app.contracts.deadline-check-ms=3600000 \
        --app.stripe.transfer-check-ms=3600000 \
    && chown -R app:app extracted
USER app
EXPOSE 8081
ENV SPRING_PROFILES_ACTIVE=prod
# -Xshare:auto (the default) falls back to a normal start if the archive cannot be used.
ENTRYPOINT ["java", "-XX:SharedArchiveFile=extracted/app.jsa", "-jar", "extracted/app.jar"]
