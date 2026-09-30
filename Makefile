.PHONY: up down logs web-check api-test e2e
up:
	docker compose up -d --build
down:
	docker compose down
logs:
	docker compose logs -f api
web-check:
	cd web && npm run lint && npm run format:check && npm run build && npm test
api-test:
	docker compose --profile test run --rm api-test
e2e:
	cd web && npm run test:e2e
