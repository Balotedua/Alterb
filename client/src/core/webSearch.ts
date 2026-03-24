// ── Web search: Tavily (con chiave) + DuckDuckGo (gratuito, fallback) ─

interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
}

// Tavily: risultati ottimali per AI, richiede VITE_TAVILY_API_KEY
async function tavilySearch(query: string): Promise<SearchResult[] | null> {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic',
        include_answer: true,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const results: SearchResult[] = [];
    if (json.answer) results.push({ title: 'Risposta diretta', snippet: json.answer as string });
    for (const r of ((json.results ?? []) as Array<{ title?: string; content?: string; url?: string }>).slice(0, 4)) {
      results.push({ title: r.title ?? '', snippet: r.content ?? '', url: r.url });
    }
    return results.length > 0 ? results : null;
  } catch { return null; }
}

// DuckDuckGo: gratuito, nessuna chiave, CORS supportato
async function duckduckgoSearch(query: string): Promise<SearchResult[] | null> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const results: SearchResult[] = [];
    if (json.Abstract) {
      results.push({ title: (json.Heading as string) || query, snippet: json.Abstract as string, url: json.AbstractURL as string });
    }
    for (const t of ((json.RelatedTopics ?? []) as Array<{ Text?: string }>).slice(0, 4)) {
      if (t.Text) results.push({ title: (t.Text as string).split(' - ')[0], snippet: t.Text as string });
    }
    return results.length > 0 ? results : null;
  } catch { return null; }
}

/**
 * Cerca informazioni aggiornate sul web.
 * Usa Tavily se VITE_TAVILY_API_KEY è configurata, altrimenti DuckDuckGo.
 * Ritorna una stringa markdown con i risultati, o null se vuoto.
 */
export async function webSearch(query: string): Promise<string | null> {
  const results = (await tavilySearch(query)) ?? (await duckduckgoSearch(query));
  if (!results || results.length === 0) return null;
  return results
    .map(r => `**${r.title}**\n${r.snippet}${r.url ? `\n↗ ${r.url}` : ''}`)
    .join('\n\n');
}
