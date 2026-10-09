# Traduce la estrategia

Estructura:
- index.html, styles.css, app.js  → frontend estático
- api/ai.js                       → función serverless que llama a la API de Claude

## Despliegue en Vercel
1. Sube esta carpeta a un repositorio de GitHub (o usa `vercel` desde la terminal dentro de la carpeta).
2. En Vercel: Add New → Project → importa el repo. Framework Preset: "Other". No hace falta build.
3. En Settings → Environment Variables agrega:
   - ANTHROPIC_API_KEY = tu clave (console.anthropic.com)
   - (opcional) ANTHROPIC_MODEL = claude-sonnet-5-5
4. Deploy (o Redeploy si agregaste la variable después).

## Importante
La URL queda pública y cada uso consume tu clave. Activa Deployment Protection / contraseña en Vercel
(Settings → Deployment Protection) o fija un límite de gasto en la consola de Anthropic.
