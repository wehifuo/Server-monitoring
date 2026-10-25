.PHONY: up down restart logs ps build reset

COMPOSE = docker compose

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps

# ВНИМАНИЕ: удаляет контейнеры и данные PostgreSQL
reset:
	$(COMPOSE) down -v
