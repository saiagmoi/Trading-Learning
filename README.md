# Aula Inversora · Simulador de Inversiones y Trading (Paper Trading)

Plataforma web educativa completa de simulación de inversiones y trading con **dinero virtual**, cotizaciones históricas y de mercado, diseñada para aprender a invertir desde cero en los mercados de **Estados Unidos** y **Argentina (BYMA / MERVAL)** sin arriesgar dinero real.

> ⚠️ **AVISO EDUCATIVO Y DE RIESGO**:
> Esta plataforma opera exclusivamente en **MODO SIMULACIÓN (SIMULATION MODE)** con saldo ficticio.
> **NO se opera dinero real**, no hay depósitos, transferencias ni conexión con brokers reales.
> Las rentabilidades pasadas no garantizan rendimientos futuros. La herramienta tiene fines pedagógicos y no constituye asesoramiento financiero ni recomendación de inversión.

---

## 🚀 Funcionalidades Principales

1. **Mercados Disponibles (EE.UU. y Argentina)**:
   - 🇺🇸 **Estados Unidos**: Acciones populares (`AAPL`, `MSFT`, `NVDA`, `AMZN`, `GOOGL`, `META`, `TSLA`, `KO`, `BRK.B`) y ETFs (`SPY`, `QQQ`, `DIA`, `IWM`).
   - 🇦🇷 **Argentina (BYMA / S&P Merval)**: Acciones argentinas (`GGAL`, `PAMP`, `YPFD`, `BMA`, `SUPV`, `CEPU`, `TXAR`, `ALUA`, `BYMA`, `COME`).
   - Catálogo completamente configurable en `src/data/assets.json` con incorporación automática de activos adicionales al buscarlos.

2. **Dashboard Financiero Profesional**:
   - Resumen de patrimonio total, rendimiento acumulado, efectivo disponible (dólares y pesos) e importe invertido.
   - Cotizaciones de índices clave en tiempo real / retrasados: S&P 500, Nasdaq, Dow Jones y S&P Merval.
   - Posiciones abiertas, últimas operaciones ejecutadas y watchlist en seguimiento.

3. **Terminal de Trading Operativa**:
   - Panel de compra y venta interactivo con estimación inmediata de comisiones, costo total y saldo restante.
   - Tipos de órdenes:
     - **Orden de Mercado**: Ejecución al precio simulado disponible.
     - **Orden Límite**: Queda pendiente hasta que el precio del mercado alcance la condición.
     - **Stop Loss**: Salida protectora simulada si el precio cae por debajo del nivel elegido.
     - **Take Profit**: Venta automática con ganancia al tocar el objetivo.
   - Resumen de confirmación previo a cada orden para prevenir errores operativos.

4. **Gráficos Financieros Profesionales**:
   - Construidos con **Lightweight Charts** (librería de TradingView).
   - Alternancia entre **Velas Japonesas** y **Línea**.
   - Selector de 9 períodos: `1 día`, `1 semana`, `1 mes`, `3 meses`, `6 meses`, `1 año`, `5 años`, `10 años`, `Máximo`.
   - Volumen interactivo y crosshair con fecha, precio, variación y volumen.
   - Indicadores técnicos configurables: **SMA 20**, **SMA 50**, **SMA 200**, **EMA 20**, **RSI** y **MACD**.

5. **Simulador Histórico ("¿Qué habría pasado si...?")**:
   - Calculadora retrospectiva con precios de mercado históricos reales: seleccioná un activo, fecha inicial (ej. 2020) y capital simulado.
   - Comparación automática de rendimiento frente a los benchmarks: **S&P 500 (SPY)**, **Nasdaq (QQQ)** y **S&P Merval**.

6. **Simulador de Inversión Periódica (DCA)**:
   - Herramienta para practicar Dollar-Cost Averaging mensual: monto mensual, fecha de inicio y fin.
   - Gráfico de acumulación y desglose entre capital aportado, valor de cartera y ganancia nuta.

7. **Gestión de Cartera y Multi-moneda**:
   - Vista detallada de posiciones: Activo, Cantidad, Precio promedio, Precio actual, Valor, P&L y P&L % con insignias verde/rojo.
   - Gráfico de evolución del patrimonio en el tiempo.
   - Diferenciación rigurosa entre **USD** y **ARS** con tipo de cambio de referencia visible (USD/ARS), fecha y hora de actualización.

8. **Historial Completo de Operaciones y Órdenes**:
   - Registro de cada orden y trade con fecha, hora, tipo, cantidad, precio, comisión y resultado.
   - Filtros dinámicos por activo, sentido (compra/venta) y rango de fechas.
   - Gestión y cancelación de órdenes límite pendientes.

9. **Modo Aprendizaje y Desafíos**:
   - 16 lecciones explicativas redactadas en español argentino para principiantes (Acciones, ETFs, S&P 500, MERVAL, Orden límite, Stop loss, Diversificación, Volatilidad, P/E, Dividend Yield, Market Cap, DCA, etc.).
   - Sistema de desafíos con puntos de experiencia (XP), niveles y badges virtuales (ej. "Paciencia", "Diversificador", "Comparador", "Estratega", "Indexado").
   - Modo principiante con explicaciones contextuales para no abrumar al usuario novato.

10. **Nivel de Realismo y Comisiones Configurables**:
    - **Principiante**: Sin comisiones ni slippage.
    - **Realista**: Comisión, spread y slippage simulados.
    - **Avanzado**: Condiciones de mercado más exigentes.
    - Editor interactivo para personalizar porcentajes y mínimos tanto de EE.UU. como del mercado argentino.

11. **Onboarding y Reinicio de Cuenta**:
    - Bienvenida guiada al ingresar por primera vez con elección de capital inicial (USD 1.000, 5.000, 10.000, 50.000 o personalizado) e intereses de aprendizaje.
    - Botón de reinicio completo de simulación con confirmación obligatoria.

---

## 📊 Fuente de Datos y Frescura

- **Proveedor por defecto (`yahoo`)**: Conexión con Yahoo Finance mediante `yahoo-finance2`.
  - **Cotizaciones de acciones/ETFs**: Cotizaciones de mercado típicamente retrasadas ~15 minutos durante horario hábil. No inventamos precios.
  - **Históricos**: Precios diarios y semanales oficiales ajustados.
  - **Tipo de cambio**: Par oficial/financiero `ARS=X` / `USDARS=X`.
  - **Noticias**: Titulares reales obtenidos de Yahoo Finance para el activo consultado.
- **Proveedor de desarrollo (`demo`)**: Serie sintética determinista identificada claramente en pantalla con la etiqueta `"DATOS DE DEMOSTRACIÓN"`.
- **Capa Abstracta (`MarketDataProvider`)**: El frontend consume una interfaz desacoplada del proveedor subyacente.

---

## 🛠️ Cómo Ejecutar el Proyecto Localmente

### Requisitos
- **Node.js** v20 o superior (recomendado v22)
- **npm** o **pnpm**

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/saiagmoi/Trading-Learning.git
cd Trading-Learning

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Variables de Entorno

Creá un archivo `.env.local` a partir de `.env.example`:

```bash
# Proveedor de cotizaciones: "yahoo" (por defecto) o "demo"
MARKET_DATA_PROVIDER=yahoo

# El modo real permanece estrictamente deshabilitado
LIVE_TRADING_ENABLED=false
```

---

## 🔄 Cómo Cambiar de Proveedor de Datos

La aplicación implementa el patrón **Factory** y una interfaz abstracta:

1. Creá una clase que implemente `MarketDataProvider` y `HistoricalDataProvider` en `src/lib/market/providers/tu_proveedor.ts`:
   ```ts
   import type { MarketDataProvider, HistoricalDataProvider } from "@/lib/market/provider";

   export class MiNuevoProveedor implements MarketDataProvider, HistoricalDataProvider {
     id = "minuevo";
     // Implementá getQuotes, getHistory, getHistoryBetween, search, getNews, getFxRate
   }
   ```
2. Registrala en el switch de `src/lib/market/factory.ts`:
   ```ts
   export function getMarketDataProvider(): MarketDataProvider & HistoricalDataProvider {
     const id = (process.env.MARKET_DATA_PROVIDER ?? "yahoo").toLowerCase();
     if (id === "demo") return demoProvider;
     if (id === "minuevo") return miNuevoProvider;
     return yahooProvider;
   }
   ```
3. Configurá `MARKET_DATA_PROVIDER=minuevo` en tu `.env.local`.
