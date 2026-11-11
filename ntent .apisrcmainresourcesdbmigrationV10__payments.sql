[1mdiff --git a/api/src/main/resources/db/migration/V10__payments.sql b/api/src/main/resources/db/migration/V10__payments.sql[m
[1mindex e69de29..e6a2016 100644[m
[1m--- a/api/src/main/resources/db/migration/V10__payments.sql[m
[1m+++ b/api/src/main/resources/db/migration/V10__payments.sql[m
[36m@@ -0,0 +1,8 @@[m
[32m+[m[32mCREATE TABLE payments ([m
[32m+[m[32m    id BIGSERIAL PRIMARY KEY,[m
[32m+[m[32m    contract_id BIGINT NOT NULL,[m
[32m+[m[32m    amount DECIMAL(10, 2) NOT NULL,[m
[32m+[m[32m    status VARCHAR(50) DEFAULT 'PENDING',[m
[32m+[m[32m    payment_date TIMESTAMP,[m
[32m+[m[32m    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP[m
[32m+[m[32m);[m
\ No newline at end of file[m
[1mdiff --git a/api/src/main/resources/db/migration/V11__reviews.sql b/api/src/main/resources/db/migration/V11__reviews.sql[m
[1mindex 67a2df8..d496beb 100644[m
[1m--- a/api/src/main/resources/db/migration/V11__reviews.sql[m
[1m+++ b/api/src/main/resources/db/migration/V11__reviews.sql[m
[36m@@ -5,4 +5,5 @@[m [mCREATE TABLE reviews ([m
     reviewed_id BIGINT NOT NULL,[m
     rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),[m
     comment TEXT,[m
[31m-    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP[m
\ No newline at end of file[m
[32m+[m[32m    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP[m
[32m+[m[32m    );[m
\ No newline at end of file[m
[1mdiff --git a/api/src/main/resources/db/migration/V12__portfolio.sql b/api/src/main/resources/db/migration/V12__portfolio.sql[m
[1mindex e69de29..9851dda 100644[m
[1m--- a/api/src/main/resources/db/migration/V12__portfolio.sql[m
[1m+++ b/api/src/main/resources/db/migration/V12__portfolio.sql[m
[36m@@ -0,0 +1,8 @@[m
[32m+[m[32mCREATE TABLE portfolio_projects ([m
[32m+[m[32m    id BIGSERIAL PRIMARY KEY,[m
[32m+[m[32m    freelancer_id BIGINT NOT NULL,[m
[32m+[m[32m    title VARCHAR(150) NOT NULL,[m
[32m+[m[32m    description TEXT,[m
[32m+[m[32m    project_url VARCHAR(255),[m
[32m+[m[32m    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP[m
[32m+[m[32m);[m
\ No newline at end of file[m
