# ⚡ Alter: Surgical Context

## 🛠 Quick Ops
- **Dev**: `npm run dev` (in `/client`) | **Build**: `npm run build`
- **Check**: `npx tsc` | `npm run lint`
- **Stack**: React 18 + Vite + TS | Supabase (`/services/supabase.ts`) | NebulaStore (Zod/Store)

## 🎨 UI/UX (Premium Minimal)
- **Style**: Dark, Glassmorphism (border 0.05 opacity), High Whitespace.
- **Motion**: Transitions 0.2s, Hover scale 1.02x.
- **Rules**: Use variables from `styles/themes.ts`. No hardcoded hex. Elite/Minimal tone.

## 🧠 Token-Saver Skills (Strict)
1. **Diffs Only**: Never rewrite full files. Use `// ... existing code` for unchanged parts.
2. **Path Priority**: 
   - AI Logic: `/prompts/nebula.ts`
   - Database: `/sql/*.sql`
   - Components: `/components/nebula/`
   - Fragments: `/modules/`
3. **No Fluff**: Skip intros, apologies, and "Here is the code". Output ONLY code or 1-line bullets.
4. **Fragment Focus**: Modify only the requested fragment (Finance, Health, etc.)—ignore the rest.
5. **Briefing**: Keep all explanations under 3 sentences.