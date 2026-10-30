# BarbeariaShop — Product Requirements Document (PRD)

## Visão Geral
App mobile (Expo/React Native) para barbearia, atendendo os requisitos dos documentos PIM IV (Banco de Dados + Desenvolvimento Web). Backend em FastAPI + MongoDB, autenticação JWT com três perfis (cliente, barbeiro, admin).

## Entidades
- **User**: id, nome, email, senha_hash, role, telefone, cpf, barbeiro_id (link opcional)
- **Barbeiro**: id, nome, especialidade, telefone, foto_url, bio, status
- **Servico**: id, nome, descricao, preco, duracao_minutos, imagem_url
- **Produto**: id, nome, descricao, preco, estoque, imagem_url
- **Agendamento**: id, cliente_id, barbeiro_id, servico_id, data, horario, status (Pendente/Confirmado/Realizado/Cancelado), observacao
- Trigger de conflito: barbeiro não pode ter 2 agendamentos ativos na mesma data+horário (409).

## Telas (implementadas)
### Autenticação
- `/(auth)/login` — Login com e-mail e senha
- `/(auth)/register` — Cadastro de cliente

### Cliente (tabs)
- `/(tabs)/` — Home com próximo agendamento, barbeiros, serviços em destaque
- `/(tabs)/servicos` — Catálogo de serviços e produtos (segmented)
- `/(tabs)/agendamentos` — Meus agendamentos (próximos/histórico)
- `/(tabs)/perfil` — Perfil, logout, acesso ao admin

### Fluxos
- `/booking` — Fluxo de agendamento em 4 passos (serviço → barbeiro → data → horário)
- `/barbeiro/[id]` — Perfil do barbeiro com CTA de agendamento

### Admin
- `/admin` — Dashboard com métricas (receita, agendamentos hoje, totais)
- `/admin/barbeiros` — CRUD de barbeiros
- `/admin/servicos` — CRUD de serviços
- `/admin/produtos` — CRUD de produtos
- `/admin/usuarios` — Lista e promoção de usuários (cliente ↔ barbeiro ↔ admin)

## APIs (/api)
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET/POST/PUT/DELETE /barbeiros`
- `GET/POST/PUT/DELETE /servicos`
- `GET/POST/PUT/DELETE /produtos`
- `GET /horarios?barbeiro_id=&data=` — Lista horários (09:00–18:30 em slots de 30 min) com disponibilidade
- `POST /agendamentos`, `GET /agendamentos/me`, `GET /agendamentos` (role-filtered)
- `PATCH /agendamentos/{id}/status`
- `GET /admin/users`, `PATCH /admin/users/{id}/role`
- `GET /admin/stats`

## Segurança
- JWT HS256, 24h de validade
- bcrypt (12 rounds) para hash de senhas
- Role-based authorization em todos endpoints sensíveis
- Admin é semeado no startup com credenciais do `.env`
- Token armazenado em `expo-secure-store` no mobile e `localStorage` no web (dev)

## Design
Classical barbershop: midnight black (`#141414`) + antique gold (`#D4AF37`), tipografia serifada (Georgia/serif) para títulos. Tabs com cor dourada ativa.

## Seeds Iniciais
- 1 admin (admin@barbearia.com / Admin@12345)
- 3 barbeiros, 4 serviços, 3 produtos

## Enhancement de Negócio
Dashboard do admin mostra receita total realizada e agendamentos de hoje, permitindo visualizar performance diária e tomar decisões de alocação de barbeiros em tempo real.
