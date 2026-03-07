// Definizione dei temi
const THEMES = {
    minimal: {
        label: 'Minimal',
        desc: 'Toni neutri',
        bg: '#0c0b09',
        accent: '#c87350',
        text: '#e8e4da',
        muted: '#786e62',
        vars: {
            '--bg': '#0c0b09',
            '--bg-card': 'rgba(255,255,255,0.026)',
            '--border': 'rgba(255,255,255,0.07)',
            '--text': '#e8e4da',
            '--muted': '#786e62',
            '--accent': '#c87350',
            '--accent-dim': 'rgba(200,115,80,0.1)',
            '--accent-border': 'rgba(200,115,80,0.28)'
        }
    },
    neon: {
        label: 'Neon',
        desc: 'Cyberpunk vivido',
        bg: '#030309',
        accent: '#00e4c8',
        text: '#d8f0ff',
        muted: '#445868',
        vars: {
            '--bg': '#030309',
            '--bg-card': 'rgba(0,228,200,0.045)',
            '--border': 'rgba(0,228,200,0.15)',
            '--text': '#d8f0ff',
            '--muted': '#445868',
            '--accent': '#00e4c8',
            '--accent-dim': 'rgba(0,228,200,0.1)',
            '--accent-border': 'rgba(0,228,200,0.32)'
        }
    },
    carbon: {
        label: 'Carbon',
        desc: 'Monocromatico puro',
        bg: '#080808',
        accent: '#a0a4b8',
        text: '#d4d4d8',
        muted: '#565660',
        vars: {
            '--bg': '#080808',
            '--bg-card': 'rgba(255,255,255,0.03)',
            '--border': 'rgba(255,255,255,0.06)',
            '--text': '#d4d4d8',
            '--muted': '#565660',
            '--accent': '#a0a4b8',
            '--accent-dim': 'rgba(160,164,184,0.08)',
            '--accent-border': 'rgba(160,164,184,0.2)'
        }
    },
    aurora: {
        label: 'Aurora',
        desc: 'Verde bioluminescente',
        bg: '#020c08',
        accent: '#1edc82',
        text: '#c8eeda',
        muted: '#3a6050',
        vars: {
            '--bg': '#020c08',
            '--bg-card': 'rgba(30,220,130,0.04)',
            '--border': 'rgba(30,220,130,0.13)',
            '--text': '#c8eeda',
            '--muted': '#3a6050',
            '--accent': '#1edc82',
            '--accent-dim': 'rgba(30,220,130,0.1)',
            '--accent-border': 'rgba(30,220,130,0.28)'
        }
    },
    velvet: {
        label: 'Velvet',
        desc: 'Viola lussuoso',
        bg: '#0a0610',
        accent: '#b45af0',
        text: '#e4d8f8',
        muted: '#6e5882',
        vars: {
            '--bg': '#0a0610',
            '--bg-card': 'rgba(180,90,240,0.05)',
            '--border': 'rgba(180,90,240,0.15)',
            '--text': '#e4d8f8',
            '--muted': '#6e5882',
            '--accent': '#b45af0',
            '--accent-dim': 'rgba(180,90,240,0.1)',
            '--accent-border': 'rgba(180,90,240,0.28)'
        }
    },
    paper: {
        label: 'Paper',
        desc: 'Chiaro e leggibile',
        bg: '#f4f0e8',
        accent: '#8c5c2e',
        text: '#1c1814',
        muted: '#8a8070',
        vars: {
            '--bg': '#f4f0e8',
            '--bg-card': 'rgba(0,0,0,0.03)',
            '--border': 'rgba(0,0,0,0.08)',
            '--text': '#1c1814',
            '--muted': '#8a8070',
            '--accent': '#8c5c2e',
            '--accent-dim': 'rgba(140,92,46,0.08)',
            '--accent-border': 'rgba(140,92,46,0.22)'
        }
    }
};

// Applica un tema
function applyTheme(name) {
    const theme = THEMES[name];
    if (!theme) return;
    
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
    
    localStorage.setItem('alter_theme', name);
    
    // Aggiorna l'interfaccia se necessario
    const event = new CustomEvent('themeChanged', { detail: { theme: name } });
    document.dispatchEvent(event);
}

// Carica il tema salvato
function loadUserTheme() {
    const savedTheme = localStorage.getItem('alter_theme') || 'minimal';
    applyTheme(savedTheme);
    return savedTheme;
}

// Esposizione delle funzioni e oggetti
window.THEMES = THEMES;
window.applyTheme = applyTheme;
window.loadUserTheme = loadUserTheme;
