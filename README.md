# AutoPrime — Painel para Revendedoras de Automóveis

Sistema de gestão (estoque, financeiro, CRM, comissões) + site público de vitrine.

## Estrutura

```
painel-revenda/
├── painel/          # Admin (login obrigatório)
├── site/            # Vitrine pública
├── shared/          # Utilitários compartilhados (segurança XSS)
├── firestore.rules  # Regras de segurança do banco
└── firebase.json
```

## Pré-requisitos

- Conta [Firebase](https://firebase.google.com) com Auth (e-mail/senha) e Firestore
- Conta [Cloudinary](https://cloudinary.com) para fotos dos veículos
- [Node.js](https://nodejs.org) (só para deploy das rules via CLI)

## Configuração local

1. Clone o repositório
2. Abra `painel/index.html` ou use um servidor local (Live Server no VS Code)
3. Crie usuários no Firebase Console → Authentication → Add user

## Deploy das regras Firestore (importante!)

As regras em `firestore.rules` protegem o banco. Sem elas, qualquer pessoa pode alterar seus dados.

```bash
npm install -g firebase-tools
firebase login
firebase use painelrevenda-2bc8b
firebase deploy --only firestore:rules
```

## Coleções Firestore

| Coleção     | Leitura pública | Escrita        |
|-------------|-----------------|----------------|
| `carros`    | Sim (site)      | Só autenticado |
| Demais      | Não             | Só autenticado |

## Segurança

- **Firestore Rules**: auth obrigatório para dados sensíveis
- **XSS**: dados do banco passam por `esc()` antes de ir para o HTML (`shared/seguranca.js`)
- **Cloudinary**: preset unsigned — restrinja no painel Cloudinary (tamanho, formato, pasta)

## Próximos passos (roadmap)

1. ~~Firestore Rules + XSS~~
2. Edição de veículos + correção do relatório mensal
3. Multi-tenancy (várias revendas no mesmo sistema)
4. Billing e onboarding
