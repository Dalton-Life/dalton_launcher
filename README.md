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

- `electron/` — proceso principal (IPC, FiveM, instalación, auto-update)
- `src/` — interfaz (HTML, CSS, renderer)
- `assets/` — iconos y recursos de build

## Versionado

La versión oficial vive en `package.json` (semver `MAJOR.MINOR.PATCH`). En la UI se muestra solo `MAJOR.MINOR` (por ejemplo `0.1.0` → `v0.1`).

Para publicar una nueva versión:

```bash
npm version patch   # o minor / major
git push origin main --tags
```

Esto crea un tag `v0.1.1` (ejemplo) y dispara el workflow de release en GitHub Actions.

## Releases y auto-update

Los instaladores se publican en [GitHub Releases](https://github.com/Dalton-Life/dalton_launcher/releases) del repositorio `Dalton-Life/dalton_launcher`.

### CI (GitHub Actions)

El workflow `.github/workflows/release.yml` se ejecuta al pushear un tag `v*`. Necesitas configurar en el repositorio:

| Secret | Descripción |
|--------|-------------|
| `ENV_PRODUCTION` | Contenido completo de `.env.production` (SERVER_IP, Discord, etc.) |

`GITHUB_TOKEN` se usa automáticamente para publicar el release.

El build genera:

- `Dalton-Launcher-Setup-X.Y.Z.exe`
- `latest.yml` (manifiesto para `electron-updater`)
- `*.blockmap` (actualizaciones delta)

### Comportamiento en el launcher

- Solo busca actualizaciones cuando la app está **empaquetada** (`app.isPackaged`).
- En desarrollo (`npm start` / `npm run dev`) no se comprueban updates.
- Al arrancar, comprueba updates ~3 s después de abrir la ventana.
- Si hay update: descarga automática con barra de progreso; al terminar puedes reiniciar ahora o posponer desde el overlay.
- La comprobación al arrancar es silenciosa (sin overlay); el botón **Buscar actualizaciones** muestra feedback si ya estás al día o si hubo error.
- En ajustes: botón **Buscar actualizaciones**.

### Publicar manualmente (sin CI)

```bash
copy .env.production.example .env.production
# editar .env.production
npm run dist -- --publish always
```

Requiere `GH_TOKEN` con permisos de release en el repositorio.

### Firma de código

Actualmente el build **no firma** el ejecutable (`signAndEditExecutable: false`). Windows SmartScreen puede mostrar avisos hasta que se configure un certificado Authenticode (OV/EV).

## Pruebas de auto-update

1. Instala `v0.1.0` desde el instalador NSIS.
2. Publica `v0.1.1` en GitHub Releases (tag + workflow o manual).
3. Abre el launcher → overlay de descarga → reinicio automático.
4. Verifica que el footer muestra la nueva versión.
5. Confirma que `npm start` no intenta actualizar.
6. Simula fallo de red (sin internet): el launcher debe seguir usable.

## Notas

- La IP del servidor se define en `.env` / `.env.production`, no en la UI.
