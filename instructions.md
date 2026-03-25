---
type: agent-instructions
---

# Regole di Comportamento

- **Diffs only** — mai riscrivere file interi; usa `// ... existing code` per il contesto
- **Risposte max 3 frasi** — zero intro, zero apologie, zero "here is the code"
- **Fragment focus** — modifica solo il frammento richiesto, niente cleanup non richiesto
- **L1 prima di L2** — nuovi pattern → `localParser.ts` prima di toccare AI/DeepSeek
- **No tabelle specifiche** — solo `vault(id, user_id, category, data JSONB)`
- **No logica in PolymorphicWidget.tsx** — UI specifica → nuovo file in `renderers/`
- **No hardcoded hex** — usa variabili da `styles/themes.ts`
- **No modal bloccanti** — toast/inline per errori silenziosi
- **No animazioni gratuite** — transizioni `0.2s ease`, hover `scale(1.02)` e basta
- **Verifica prima di suggerire** — se il memory nomina un file/funzione, controlla che esista ancora
