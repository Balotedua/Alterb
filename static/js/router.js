// Router SPA per Alter
const routes = {
    'dashboard': '/partials/dashboard.html',
    'finance': '/partials/finance.html',
    'psychology': '/partials/psychology.html',
    'health': '/partials/health.html',
    'consciousness': '/partials/consciousness.html',
    'badges': '/partials/badges.html',
    'settings': '/partials/settings.html'
};

const pageTitles = {
    'dashboard': 'Dashboard',
    'finance': 'Finanza',
    'psychology': 'Psicologia',
    'health': 'Salute & Fisico',
    'consciousness': 'Coscienza',
    'badges': 'Badge & Obiettivi',
    'settings': 'Impostazioni'
};

let currentRoute = 'dashboard';

// Funzione per navigare a una route
async function navigateTo(route, pushState = true) {
    if (!routes[route]) {
        console.warn(`Route non trovata: ${route}`);
        route = 'dashboard';
    }

    // Aggiorna lo stato attuale
    currentRoute = route;

    // Aggiorna la barra laterale
    document.querySelectorAll('.sb-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-route') === route) {
            item.classList.add('active');
        }
    });

    // Aggiorna il titolo della pagina mobile
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        pageTitleEl.textContent = pageTitles[route] || 'Alter';
    }

    // Aggiorna l'URL nella barra degli indirizzi
    if (pushState) {
        history.pushState({ route }, '', `/${route}`);
    }

    // Mostra un indicatore di caricamento
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = `
        <div style="text-align:center; padding: 60px 20px; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 20px;">⌂</div>
            <h3 style="font-weight: 500; margin-bottom: 10px;">Caricamento...</h3>
            <p>Alter sta caricando ${pageTitles[route] || 'la pagina'}</p>
        </div>
    `;

    try {
        // Carica il contenuto della route
        const response = await fetch(routes[route]);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const html = await response.text();
        
        // Inietta il contenuto
        contentEl.innerHTML = html;
        
        // Esegui eventuali script presenti nel contenuto
        const scripts = contentEl.querySelectorAll('script');
        for (const script of scripts) {
            const newScript = document.createElement('script');
            if (script.src) {
                newScript.src = script.src;
            } else {
                newScript.textContent = script.textContent;
            }
            document.body.appendChild(newScript);
            script.remove();
        }
        
        // Scrolla in cima
        contentEl.scrollTop = 0;
        
        // Aggiorna il tema (nel caso il partial abbia elementi che dipendono dal tema)
        if (window.loadUserTheme) {
            window.loadUserTheme();
        }
        
    } catch (error) {
        console.error('Errore nel caricamento della pagina:', error);
        contentEl.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; color: var(--muted);">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h3 style="font-weight: 500; margin-bottom: 10px;">Errore di caricamento</h3>
                <p>Impossibile caricare la pagina. Riprova più tardi.</p>
                <button onclick="navigateTo('dashboard')" style="margin-top: 20px; padding: 10px 20px; background: var(--accent); border: none; border-radius: 8px; color: var(--bg); cursor: pointer;">Torna alla Dashboard</button>
            </div>
        `;
    }
}

// Gestione del click sui link della sidebar
function setupRouter() {
    // Intercetta i click sui link della sidebar
    document.addEventListener('click', (event) => {
        const link = event.target.closest('.sb-item[data-route]');
        if (link) {
            event.preventDefault();
            const route = link.getAttribute('data-route');
            navigateTo(route);
        }
    });

    // Gestione del pulsante indietro/avanti del browser
    window.addEventListener('popstate', (event) => {
        const route = event.state?.route || 'dashboard';
        navigateTo(route, false);
    });

    // Naviga alla route corrente all'avvio
    const path = window.location.pathname.substring(1); // Rimuove lo slash iniziale
    const initialRoute = routes[path] ? path : 'dashboard';
    
    // Imposta lo stato iniziale
    history.replaceState({ route: initialRoute }, '', `/${initialRoute}`);
    
    // Naviga alla route iniziale
    navigateTo(initialRoute, false);
}

// Avvia il router quando la pagina è pronta
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRouter);
} else {
    setupRouter();
}
