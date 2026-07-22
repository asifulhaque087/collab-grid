# GitHub Secrets Directory

## 🎯 Purpose
This folder holds local `.env.*` files used to import encrypted Repository Secrets into GitHub via the **GitHub CLI (`gh`)**.

> ⚠️ **Never commit real secret files.** `.env.*` files in this directory are ignored by Git.

---

## 🏷️ Prefix System
Because all apps in a monorepo share **one global GitHub secrets vault**, every key in these files must use a service prefix—such as `WEB_`, `API_`, `GATEWAY_`, `AUTH_`, `USER_`, `PAYMENT_`, `NOTIFICATION_`, and so on.

### Simple Rule: Every service gets its own prefixed secrets
Even if two services share the exact same database or API key, **do not combine them into a shared variable**. Give each service its own prefixed key:

```env
# .github/secrets/.env.auth
AUTH_JWT_TOKEN="abcd"

# .github/secrets/.env.user
USER_JWT_TOKEN="abcd"
```

### Why We Use Prefixes

1. **Prevents Naming Collisions:** Stops `web` and `api` from overwriting each other's secrets (e.g., `WEB_DATABASE_URL` vs. `API_DATABASE_URL`).
    
2. **No Auditing:** You never have to search across services to see if a variable is "common."

3. **Mapped in Actions:** Prefixed keys are renamed to standard environment variables inside your GitHub Actions workflows:
    

```yaml
# .github/workflows/ci.yml
- name: Build Web App
  env:
    NEXT_PUBLIC_AUTH_DOMAIN: ${{ secrets.WEB_NEXT_PUBLIC_AUTH_DOMAIN }}
  run: npx turbo run build --filter=web
```

## 📁 File Structure & Naming

Create your local `.env.*` files inside this folder, grouped by service or domain:

```text
.github/secrets/
├── .env.auth       # AUTH_* secrets
├── .env.gateway    # GATEWAY_* secrets
├── .env.user       # USER_* secrets
└── and so on ...   
```