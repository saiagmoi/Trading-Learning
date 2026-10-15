#!/usr/bin/env bash

# ==============================================================================
# Script de inicio rápido para Trading Learning
# ==============================================================================

# 1. Entrar a la carpeta del proyecto, sin importar desde dónde se abra
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || {
    echo "❌ Error: No se pudo ingresar al directorio del proyecto: $SCRIPT_DIR"
    echo "Presioná cualquier tecla para salir..."
    read -n 1 -s
    exit 1
}

echo "📂 Directorio del proyecto: $SCRIPT_DIR"
echo ""

# Cargar configuraciones de entorno del usuario si existen
[ -f "$HOME/.profile" ] && source "$HOME/.profile" 2>/dev/null
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null
[ -f "$HOME/.bash_profile" ] && source "$HOME/.bash_profile" 2>/dev/null
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null

# Rutas estándar de Node en macOS (incluyendo Homebrew, .local, /usr/local)
export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -d "$HOME/.nvm" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh" 2>/dev/null
fi

# 2. Ver si Node está instalado. Si no, instalarlo o decir exactamente qué hacer.
echo "🔍 Verificando Node.js..."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo ""
    echo "=============================================================="
    echo "  ❌ Node.js o npm no están disponibles en tu sistema"
    echo "=============================================================="
    echo ""
    if command -v brew >/dev/null 2>&1; then
        echo "Detecté Homebrew. Intentando instalar Node.js..."
        brew install node
    fi

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        echo "Por favor sigue estos pasos para instalarlo:"
        echo ""
        echo "  1. Entrá a la web oficial: https://nodejs.org/"
        echo "  2. Descargá e instalá la versión 'LTS' (Recomendada para la mayoría)."
        echo "  3. Una vez instalado el paquete, volvé a abrir este archivo con doble click."
        echo ""
        echo "Presioná cualquier tecla para salir..."
        read -n 1 -s
        exit 1
    fi
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "✅ Node.js encontrado ($NODE_VERSION) con npm ($NPM_VERSION)."
echo ""

# 3. Correr npm install solo si falta la carpeta node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 No se encontró 'node_modules'. Instalando dependencias (npm install)..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Error al instalar las dependencias con npm install."
        echo "Por favor revisá tu conexión a internet o los errores detallados arriba."
        echo "Presioná cualquier tecla para salir..."
        read -n 1 -s
        exit 1
    fi
    echo "✅ Dependencias instaladas correctamente."
else
    echo "✅ Dependencias ('node_modules') ya instaladas."
fi
echo ""

# 4. Crear el archivo .env copiando .env.example si todavía no existe
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚙️  Creando archivo .env a partir de .env.example..."
        cp .env.example .env
        echo "✅ Archivo .env creado."
    else
        echo "ℹ️  No existe .env.example para copiar, continuando..."
    fi
else
    echo "✅ Archivo .env ya presente."
fi
echo ""

# 5 y 6. Iniciar el servidor de desarrollo y abrir el navegador en la dirección correcta apenas esté listo
echo "🚀 Iniciando servidor de desarrollo de Trading Learning..."

# Tarea en segundo plano para detectar cuándo el servidor esté listo y abrir el navegador
(
    MAX_WAIT=60
    COUNT=0
    FOUND_PORT=""
    while [ $COUNT -lt $((MAX_WAIT * 2)) ]; do
        for p in 3000 3001 3002 3003; do
            if curl -s "http://localhost:$p" >/dev/null 2>&1; then
                FOUND_PORT="$p"
                break 2
            fi
        done
        sleep 0.5
        COUNT=$((COUNT + 1))
    done

    if [ -n "$FOUND_PORT" ]; then
        echo ""
        echo "🌐 ¡Servidor listo en http://localhost:$FOUND_PORT! Abriendo navegador..."
        open "http://localhost:$FOUND_PORT"
    else
        echo "⚠️  El servidor tardó en responder. Podés abrir http://localhost:3000 manualmente."
    fi
) &
BROWSER_WATCHER_PID=$!

cleanup() {
    kill "$BROWSER_WATCHER_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "💡 Para detener la aplicación, presioná Ctrl + C o cerrá esta ventana de Terminal."
echo ""

npm run dev
