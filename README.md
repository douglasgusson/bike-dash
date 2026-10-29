# BikeDash — Velocímetro & Ciclocomputador PWA

Aplicação **Offline-First PWA** de alto contraste projetada para leitura sob luz solar direta no guidão da bicicleta (~60cm de distância), construída com **React 19 + Vite + TypeScript + Tailwind CSS v4 + Zustand**.

---

## 1. Arquitetura & Modelagem de Domínio (DDD)

- **Adapter de Sensores ([`LocationService.ts`](src/services/LocationService.ts))**:
  - Encapsula `navigator.geolocation.watchPosition` com `enableHighAccuracy: true`.
  - Emite eventos tipados de coordenadas (`GeoPoint`) e status de sinal (`SEARCHING`, `CONNECTED`, `WEAK_SIGNAL`, `SIMULATING`, `ERROR`).
  - Inclui um **Simulador de Pedal** integrado com variações de velocidade, ruído sintético de GPS e paradas em semáforo para testes de bancada.
- **Engine Matemática ([`math.ts`](src/domain/math.ts))**:
  - **Filtro de Média Móvel Exponencial (`applyEMA`)**:
    $$\text{currentSpeed} = (\text{newSpeed} \times \alpha) + (\text{previousSpeed} \times (1 - \alpha))$$
    Suaviza saltos bruscos de GPS sob árvores/prédios sem introduzir atraso perceptível na frenagem ($\alpha$ padrão `0.45`, ajustável em tempo real entre `0.15` e `0.85`).
  - **Fórmula de Haversine (`calculateHaversineDistanceMeters`)**:
    Calcula a distância exata entre coordenadas sucessivas e atua como fallback automático de velocidade quando `coords.speed` retorna `null`.
- **Domínio da Sessão ([`TripTracker.ts`](src/domain/TripTracker.ts))**:
  - Gerenciado fora do ciclo de renderização via **Zustand** com persistência offline.
  - **Filtro de Pontos Falsos**: Ignora coordenadas com `accuracy > 20m` (ajustável), prevenindo distância fantasma.
  - **Auto-Pause**: Pausa automaticamente o tempo de pedalada quando a velocidade suavizada cai para `0 km/h`.
- **Hardware Hooks**:
  - [`useGeolocation.ts`](src/hooks/useGeolocation.ts): Conecta o `LocationService` e o relógio de precisão ao `TripTracker`.
  - [`useWakeLock.ts`](src/hooks/useWakeLock.ts): Gerencia a **Screen Wake Lock API** com reaquisição automática ao retornar do background (`visibilitychange`).

---

## 2. UI/UX Outdoor (AMOLED High-Contrast)

- **Contraste Absoluto**: Fundo `#000000` (AMOLED Black para economia de bateria em telas OLED) e tipografia `#FFFFFF`.
- **Tipografia Monoespaçada**: `JetBrains Mono` com `tabular-nums` para evitar que os dígitos "dancem" durante mudanças rápidas de velocidade.
- **Orientação Fluida**:
  - **Portrait (Mesa do Guidão)**: Velocímetro gigante ocupando os 50% superiores + Grid 2x2 inferior (Distância, Tempo, Média, Máxima) + controles grandes para uso com luva.
  - **Landscape (Tubo Superior)**: Layout dividido 50/50 lado a lado.

---

## 3. Comandos de Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento
pnpm dev

# Executar testes unitários (Vitest)
pnpm test

# Gerar bundle estático de produção + Service Worker PWA
pnpm build

# Visualizar build de produção localmente
pnpm preview
```

---

## 4. Deploy Estático (Caddy / Micro-PaaS Amora / Cloudflare Pages)

O comando `pnpm build` gera a pasta `dist/` 100% estática com `manifest.webmanifest` e Service Worker (`sw.js`) pré-configurados via Workbox.

Exemplo de configuração no **Caddyfile** (ex: Raspberry Pi / Amora):

```caddyfile
bikedash.seudominio.com {
    root * /var/www/bike-dash/dist
    encode zstd gzip
    try_files {path} /index.html
    file_server
}
```
