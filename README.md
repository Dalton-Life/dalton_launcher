# Dalton Launcher

Launcher de escritorio para conectar a **Dalton Life** (servidor FiveM). Construido con Electron.

## Requisitos

- Node.js 18+
- Windows (objetivo principal)
- FiveM instalado en el equipo del jugador

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Copia el entorno de desarrollo:

```bash
copy .env.example .env
```

3. Edita `.env` con la IP/puerto del servidor y la configuración de Discord Rich Presence.

Para builds de distribución, copia `.env.production.example` a `.env.production` antes de empaquetar.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm start` | Ejecuta el launcher |
| `npm run dev` | Desarrollo con DevTools |
| `npm run pack` | Empaqueta sin instalador |
| `npm run dist` | Genera el instalador NSIS en `release/` |

## Estructura

- `electron/` — proceso principal (IPC, FiveM, instalación)
- `src/` — interfaz (HTML, CSS, renderer)
- `assets/` — iconos y recursos de build

## Notas

- La IP del servidor se define en `.env` / `.env.production`, no en la UI.
