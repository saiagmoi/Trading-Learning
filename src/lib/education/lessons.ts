export interface Lesson {
  id: string;
  title: string;
  summary: string;
  body: string;
  example?: string;
  interactive?: "dca" | "diversify" | "order";
}

export const LESSONS: Lesson[] = [
  {
    id: "accion",
    title: "¿Qué es una acción?",
    summary: "Una parte chica de una empresa.",
    body: "Cuando comprás una acción, estás comprando una fracción de una compañía. Si a la empresa le va bien, el precio puede subir. Si le va mal, puede bajar. Ser accionista no garantiza ganancias y no es lo mismo que tener plata en el banco.",
    example: "Si Apple tiene millones de acciones y comprás 1, eres dueño de una porción minúscula de Apple.",
  },
  {
    id: "etf",
    title: "¿Qué es un ETF?",
    summary: "Un paquete de muchos activos en un solo instrumento.",
    body: "Un ETF (fondo cotizado) agrupa varias acciones o bonos y se compra en el mercado como si fuera una acción. Sirve para diversificar sin elegir empresa por empresa. SPY, por ejemplo, busca seguir al S&P 500.",
  },
  {
    id: "sp500",
    title: "¿Qué es el S&P 500?",
    summary: "Un índice de 500 empresas grandes de EE.UU.",
    body: "El S&P 500 no se compra directo: es un número que resume el desempeño de 500 compañías estadounidenses grandes. Mucha gente usa ETFs como SPY para aproximarse a ese índice.",
  },
  {
    id: "nasdaq",
    title: "¿Qué es el Nasdaq?",
    summary: "Una bolsa y también índices tecnológicos.",
    body: "Nasdaq es una bolsa de Estados Unidos, famosa por empresas de tecnología. El Nasdaq Composite y el Nasdaq-100 miden grupos de esas compañías. QQQ es un ETF que se relaciona con las más grandes del Nasdaq-100.",
  },
  {
    id: "merval",
    title: "¿Qué es el MERVAL?",
    summary: "El índice de referencia de acciones argentinas.",
    body: "El S&P Merval agrupa las acciones más líquidas de BYMA. Sube o baja según esas empresas, en pesos. No es una inversión en sí: es un termómetro del mercado local.",
  },
  {
    id: "comprar",
    title: "¿Qué significa comprar una acción?",
    summary: "Intercambiás dinero por unidades del activo.",
    body: "Comprar 5 acciones de NVDA a USD 100 (ejemplo) implica gastar USD 500 más comisiones. A partir de ahí, tu resultado depende del precio futuro. En este simulador el dinero es virtual.",
  },
  {
    id: "mercado",
    title: "¿Qué es una orden de mercado?",
    summary: "Comprás o vendés al precio disponible ahora.",
    body: "La orden de mercado no elige un precio exacto: busca ejecutarse ya al último precio (más spread/slippage si activaste realismo). Es simple, pero no controlás el precio exacto de llenado.",
    interactive: "order",
  },
  {
    id: "limite",
    title: "¿Qué es una orden límite?",
    summary: "Solo opera si el precio llega a un nivel que vos elegís.",
    body: "Ejemplo: comprar 10 AAPL si el precio baja a USD 200. La orden queda pendiente. Si el precio nunca llega, no se ejecuta. Sirve para no pagar más de lo que estás dispuesto.",
  },
  {
    id: "stop",
    title: "¿Qué es un stop loss?",
    summary: "Una salida automática si el precio cae demasiado.",
    body: "Si compraste a 100 y ponés un stop en 90, el simulador intenta vender cuando el precio toca 90. No elimina el riesgo: en un mercado real el precio de salida puede ser peor. Acá se usa el precio simulado disponible.",
  },
  {
    id: "diversificacion",
    title: "¿Qué es diversificación?",
    summary: "No poner toda la plata en un solo lugar.",
    body: "Si invertís todo en una sola empresa y esa empresa tiene un mal año, tu cartera entera lo sufre. Diversificar (distintos activos, sectores o mercados) no garantiza ganancias, pero reduce el riesgo de un solo evento.",
    interactive: "diversify",
  },
  {
    id: "volatilidad",
    title: "¿Qué es volatilidad?",
    summary: "Cuánto se mueve el precio, para arriba y para abajo.",
    body: "Un activo volátil puede subir mucho... y bajar mucho. No es bueno ni malo por sí solo: implica más incertidumbre. Las acciones individuales suelen ser más volátiles que un índice amplio.",
  },
  {
    id: "riesgo",
    title: "¿Qué es riesgo?",
    summary: "La chance de perder plata, o de no lograr tu objetivo.",
    body: "Invertir implica la posibilidad de que el valor de tu cartera baje. El simulador usa dinero virtual para que puedas ver ese vaivén sin arriesgar fondos reales. Una ganancia pasada no garantiza ganancias futuras.",
  },
  {
    id: "dca",
    title: "¿Qué es DCA?",
    summary: "Invertir el mismo monto en forma periódica.",
    body: "Dollar Cost Averaging (promedio de costo en dólares) consiste en aportar, por ejemplo, USD 200 todos los meses. Comprás más unidades cuando está barato y menos cuando está caro. No elimina pérdidas, pero evita apostar todo a un solo día.",
    interactive: "dca",
  },
  {
    id: "pe",
    title: "¿Qué significa P/E?",
    summary: "Precio dividido por ganancia por acción.",
    body: "El ratio precio/ganancias (P/E) compara cuánto pagás por la acción versus las utilidades de la empresa. Un P/E alto o bajo no alcanza para decidir: hay que entender el contexto. Si no hay dato, el simulador muestra un guión.",
  },
  {
    id: "divyield",
    title: "¿Qué es dividend yield?",
    summary: "Los dividendos como porcentaje del precio.",
    body: "Algunas empresas reparten parte de las ganancias como dividendos. El yield estima ese cobro anual sobre el precio actual. No todas las empresas pagan dividendos y el porcentaje puede cambiar.",
  },
  {
    id: "mcap",
    title: "¿Qué es market cap?",
    summary: "El valor total de la empresa en el mercado.",
    body: "Capitalización de mercado ≈ precio de la acción × cantidad de acciones. Sirve para dimensionar si una empresa es enorme, mediana o chica. No dice si está 'barata' o 'cara'.",
  },
];
