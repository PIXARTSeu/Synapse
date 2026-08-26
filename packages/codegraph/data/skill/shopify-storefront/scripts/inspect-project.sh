#!/usr/bin/env bash
# Ispeziona un progetto Hydrogen e stampa le informazioni necessarie
# a scrivere codice con gli import e le API corrette per quella versione.
#
# Uso: bash inspect-project.sh [percorso-progetto]   (default: directory corrente)

set -uo pipefail
DIR="${1:-.}"

if [ ! -f "$DIR/package.json" ]; then
  echo "❌ Nessun package.json in $DIR — non sembra un progetto Node."
  exit 1
fi

dep() {
  node -e "
    const p = require('$DIR/package.json');
    const d = {...(p.dependencies||{}), ...(p.devDependencies||{})};
    process.stdout.write(d['$1'] || '');
  " 2>/dev/null
}

HYDROGEN=$(dep "@shopify/hydrogen")
RR=$(dep "react-router")
REMIX=$(dep "@remix-run/react")
OXYGEN=$(dep "@shopify/remix-oxygen")
REACT=$(dep "react")
VITE=$(dep "vite")

echo "══════════════════════════════════════════════"
echo "  PROGETTO: $(cd "$DIR" && pwd)"
echo "══════════════════════════════════════════════"
echo

if [ -z "$HYDROGEN" ]; then
  echo "⚠️  @shopify/hydrogen non trovato nelle dependencies."
  echo "    Potrebbe non essere un progetto Hydrogen, o usare hydrogen-react su un altro stack."
else
  echo "@shopify/hydrogen      $HYDROGEN"
fi
[ -n "$OXYGEN" ] && echo "@shopify/remix-oxygen  $OXYGEN"
[ -n "$REACT" ]  && echo "react                  $REACT"
[ -n "$VITE" ]   && echo "vite                   $VITE"
echo

echo "── Framework e import ────────────────────────"
if [ -n "$RR" ]; then
  echo "React Router 7 ($RR)"
  echo "  → import {useLoaderData, Link, Form} from 'react-router'"
elif [ -n "$REMIX" ]; then
  echo "Remix ($REMIX)"
  echo "  → import {useLoaderData, Link, Form} from '@remix-run/react'"
else
  echo "⚠️  Né react-router né @remix-run/react trovati: verifica manualmente."
fi
echo "  → tipi server e utility Oxygen: '@shopify/remix-oxygen'"
echo

echo "── Linguaggio ────────────────────────────────"
if [ -f "$DIR/tsconfig.json" ]; then
  echo "TypeScript"
else
  echo "JavaScript"
fi
echo

echo "── Package manager ───────────────────────────"
if   [ -f "$DIR/pnpm-lock.yaml" ];    then echo "pnpm"
elif [ -f "$DIR/yarn.lock" ];         then echo "yarn"
elif [ -f "$DIR/package-lock.json" ]; then echo "npm"
elif [ -f "$DIR/bun.lockb" ];         then echo "bun"
else echo "⚠️  Nessun lockfile — da committare prima della produzione."
fi
echo

echo "── Struttura ─────────────────────────────────"
for f in server.js server.ts vite.config.js vite.config.ts app/root.jsx app/root.tsx app/entry.server.jsx app/entry.server.tsx; do
  [ -f "$DIR/$f" ] && echo "  ✓ $f"
done
if [ -d "$DIR/app/routes" ]; then
  echo "  ✓ app/routes/ ($(find "$DIR/app/routes" -type f | wc -l | tr -d ' ') file)"
fi
for f in storefrontapi.generated.d.ts customer-accountapi.generated.d.ts; do
  [ -f "$DIR/$f" ] && echo "  ✓ $f"
done
echo

echo "── UI e styling ──────────────────────────────"
TW=$(dep "tailwindcss")
if [ -n "$TW" ]; then
  echo "tailwindcss $TW"
  case "$TW" in
    *4.*) echo "  → v4: config in @theme dentro il CSS, NIENTE tailwind.config.js" ;;
    *3.*) echo "  → v3: config in tailwind.config.js" ;;
  esac
fi
[ -n "$(dep '@vanilla-extract/css')" ] && echo "vanilla-extract $(dep '@vanilla-extract/css')"
find "$DIR/app" -name "*.module.css" 2>/dev/null | head -1 | grep -q . && echo "CSS Modules (rilevati *.module.css)"
if [ -f "$DIR/components.json" ]; then
  echo "shadcn/ui configurato (components.json)"
  node -e "
    const c=require('$DIR/components.json');
    const a=c.aliases||{};
    Object.entries(a).forEach(([k,v])=>console.log('  alias '+k+' → '+v));
  " 2>/dev/null
  echo "  ⚠️  verifica che gli alias combacino con i path del tsconfig (Hydrogen usa ~/*)"
fi
[ -n "$(dep '@radix-ui/react-dialog')" ] && echo "Radix UI presente"
[ -n "$(dep 'embla-carousel-react')" ] && echo "Embla Carousel presente"
if [ -z "$TW" ] && [ ! -f "$DIR/components.json" ]; then
  echo "Nessuna libreria UI rilevata — vedi references/ui-e-styling.md prima di sceglierne una"
fi
echo

echo "── Variabili d'ambiente (solo nomi) ──────────"
if [ -f "$DIR/.env" ]; then
  grep -E '^[A-Z_]+=' "$DIR/.env" | cut -d= -f1 | sed 's/^/  /'
  if grep -q 'mock\.shop' "$DIR/.env" 2>/dev/null; then
    echo
    echo "  ⚠️  Il progetto punta ancora a mock.shop (dati demo)."
    echo "      Per collegare lo store reale: shopify hydrogen link && shopify hydrogen env pull"
  fi
else
  echo "  Nessun .env locale — esegui: npx shopify hydrogen env pull"
fi
echo

echo "── Da verificare prima di scrivere codice ────"
echo "  • API varianti: 2025.x usa getProductOptions + getAdjacentAndFirstAvailableVariants;"
echo "    2024.x usava <VariantSelector> (deprecato). Sono incompatibili."
echo "  • Dopo modifiche alle query GraphQL: npm run codegen"
echo "  • Route /account*: verificare CacheNone() + Cache-Control sulla response"
