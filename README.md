# BikeDash — Velocímetro & Ciclocomputador PWA

Aplicação **Offline-First PWA** de alto contraste projetada para leitura sob luz solar direta no guidão da bicicleta (~60cm de distância), construída com **React 19 + Vite + TypeScript + Tailwind CSS v4 + Zustand + IndexedDB (`idb`) + Leaflet (`react-leaflet`)**.

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
  - Gerenciado fora do ciclo de renderização via **Zustand** com persistência offline, guardando apenas métricas agregadas essenciais para a UI (velocidade, distância acumulada, tempo ativo e status).
  - **Filtro de Pontos Falsos**: Ignora coordenadas com `accuracy > 20m` (ajustável), prevenindo distância fantasma.
  - **Auto-Pause & Filtro de Semáforo**: Pausa automaticamente o tempo de pedalada quando a velocidade suavizada cai abaixo de `1.0 km/h` e só emite coordenadas (`TrackPoint`) para gravação no banco quando a bicicleta está em movimento.

---

## 2. Trip Logger & Persistência Offline em IndexedDB

Para evitar re-renders desnecessários no React e perda de dados caso o iOS/Android encerre o processo em background:

- **Buffer em Memória ([`useTripLogger.ts`](src/hooks/useTripLogger.ts))**:
  - Os pontos validados em movimento são acumulados em `useRef<TrackPoint[]>([])` sem engatilhar re-renderizações na UI.
  - **Batch Flush Automático**: Descarrega os pontos em lote para o IndexedDB a cada **30 pontos**, a cada **30 segundos**, ao pausar o pedal, ao minimizar o app (`visibilitychange`) ou ao encerrar a viagem.
- **Modelagem IndexedDB (`bikedash_db` em [`TripDatabase.ts`](src/services/TripDatabase.ts))**:
  - Store `trips`: Armazena os metadados leves da sessão (`id`, `startTime`, `endTime`, `totalDistance`, `elapsedTimeMs`, `averageSpeedKmh`, `maxSpeedKmh`, `isFinished`), permitindo listar o histórico instantaneamente sem carregar milhares de coordenadas na RAM.
  - Store `trackpoints`: Série temporal de coordenadas (`tripId`, `timestamp`, `lat`, `lng`, `alt`, `accuracy`) com chave composta `['tripId', 'timestamp']` e índice `by-trip` para consultas rápidas e deleção em cascata (`deleteTripCascade`).

---

## 3. Exportação, Importação & File Handling (`.GPX` 1.1)

- **Exportação Client-Side ([`GpxExporter.ts`](src/services/GpxExporter.ts))**:
  - Gera arquivos `.gpx` (padrão GPX 1.1) compatíveis com **Strava**, **Garmin Connect** e **GPX Viewer** diretamente no navegador usando `Blob` e `URL.createObjectURL`.
- **Importação de Rotas**:
  - Permite importar arquivos `.gpx` gravados em outros dispositivos diretamente pelo modal de **Histórico de Pedais**, recalculando automaticamente distância Haversine, tempo em movimento, velocidade média, máxima e ganho de elevação.
- **PWA File Handling API & Drag-and-Drop ([`useGpxFileHandler.ts`](src/hooks/useGpxFileHandler.ts))**:
  - Registra `file_handlers` no `manifest.webmanifest` para que o BikeDash instalado apareça na opção **"Abrir com..."** do sistema operacional para arquivos `.gpx` (`window.launchQueue`), além de aceitar **Arrastar e Soltar (Drag & Drop)** de arquivos `.gpx` em qualquer lugar da janela.

---

## 4. Módulo de Visualização de Rota (Trip Viewer)

- **Pipeline Geométrico & Douglas-Peucker ([`geometry.ts`](src/domain/geometry.ts))**:
  - Sanitiza coordenadas inválidas (`0,0`, `NaN`) e ordena estritamente por `timestamp`.
  - Aplica o algoritmo iterativo de **Ramer-Douglas-Peucker** (`simplifyTrackPointsDouglasPeucker`) com tolerância métrica ajustável (`5m`, `7m`, `10m`), reduzindo milhares de pontos brutos de GPS para poucos vértices visuais sem perder a precisão das curvas.
  - Calcula estatísticas completas pós-sessão (`computeTripSummaryStats`): **Distância Total**, **Velocidade Média**, **Velocidade Máxima**, **Tempo Ativo**, **Duração Total** e **Ganho de Elevação Acumulado (`+m`)**.
- **Mapa Interativo Offline-Resilient ([`TripDetailsContainer.tsx`](src/components/TripDetailsContainer.tsx), [`RouteMap.tsx`](src/components/RouteMap.tsx), [`MapAutoFitter.tsx`](src/components/MapAutoFitter.tsx))**:
  - Enquadramento automático de rota via `map.fitBounds(bounds, { padding: [30, 30] })`.
  - Linha da rota (`<Polyline>`) de alto contraste alternável entre **Azul Ciano Neon (`#00f0ff`)** e **Laranja Elétrico (`#ff5f1f`)**, sobre fundo sólido `#1a1a1a` (garantindo visualização do desenho da rota mesmo sem internet) e cache dinâmico de até 500 tiles via Workbox.

---

## 5. UI/UX Outdoor (AMOLED High-Contrast & Gauge 60fps)

- **Velocímetro Gráfico com Física de Mola ([`SpeedDisplay.tsx`](src/components/SpeedDisplay.tsx))**:
  - Arco SVG de `260°` animado a **60fps** (`requestAnimationFrame` com interpolação spring-damper e `strokeDashoffset` contínuo) para movimento fluido e orgânico entre os pulsos de 1Hz do GPS.
  - Marcações no arco para **Velocidade Média** (ciano) e **Velocidade Máxima** (laranja), além de indicador em tempo real de ritmo (`▲ +X.X vs MÉD`).
- **Contraste Absoluto**: Fundo `#000000` (AMOLED Black) e tipografia `JetBrains Mono` com `tabular-nums`.
- **Orientação Fluida**:
  - **Portrait (Mesa do Guidão)** e **Landscape (Tubo Superior)** adaptáveis automaticamente.

---

## 6. Configuração de Variáveis de Ambiente (Mapbox / OpenStreetMap)

O projeto funciona out-of-the-box com **OpenStreetMap** caso nenhuma variável seja definida, ou utiliza seu estilo customizado do **Mapbox** configurando o `.env.local`:

```bash
cp .env.example .env.local
```

Edite o `.env.local`:

```dotenv
VITE_MAPBOX_STYLE_ID="seu_usuario/seu_style_id"
VITE_MAPBOX_ACCESS_TOKEN="pk.seu_token_publico_aqui"
```

---

## 7. Comandos de Desenvolvimento

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

## 8. Deploy Estático (Caddy / Micro-PaaS Amora / Cloudflare Pages)

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
