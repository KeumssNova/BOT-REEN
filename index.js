
const axios = require('axios');
const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const fs = require('fs/promises');
const path = require('path');

// Création des instances
const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'description']
    ]
  }
});

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ai_training_data.jsonl');

// URLs des flux RSS du Monde
const RSS_FEEDS = [
  'https://www.lemonde.fr/rss/une.xml',
  'https://www.lemonde.fr/international/rss_full.xml',
  'https://www.lemonde.fr/politique/rss_full.xml',
  'https://www.lemonde.fr/economie/rss_full.xml',
];

// Configuration des mots-clés ciblés sur l'Afrique
const CONFIG = {
  fetchInterval: 3600000, // 1 heure en millisecondes
  maxEntriesPerFeed: 50,
  includeContent: true,
  includeCategories: true,
  includePublishDate: true,
  extractFullContent: true, // Extraction du contenu complet
  filterByKeywords: true, // Filtrage par mots-clés
  // Mots-clés d'intérêt par catégorie, centrés sur l'Afrique
  keywords: {
    technology: [
      // 'technologie afrique', 
      // 'innovation africaine', 
      // 'startup africaine', 
      // 'inclusion numérique afrique', 
      // 'fintech afrique', 
      // 'agritech afrique', 
      // 'énergie solaire afrique', 
      // 'mobile banking afrique', 
      // 'e-commerce afrique', 
      // 'connectivité afrique'
      'technologie émergente', 
      'innovation locale', 
      'startups émergentes', 
      'inclusion numérique', 
      'fintech émergente', 
      'agritech', 
      'énergie solaire', 
      'mobile banking', 
      'e-commerce', 
      'connectivité rurale'
    ],
    politics: [
      // 'démocratie afrique', 
      // 'élection afrique', 
      // 'gouvernance africaine', 
      // 'union africaine', 
      // 'cedeao', 
      // 'politique panafricaine', 
      // 'souveraineté africaine', 
      // 'diplomatie africaine', 
      // 'indépendance afrique', 
      // 'intégration régionale afrique'
      'démocratie émergente', 
      'élections locales', 
      'gouvernance régionale', 
      'union continentale', 
      'intégration régionale', 
      'souveraineté nationale', 
      'diplomatie Sud-Sud', 
      'indépendance économique', 
      'politique panafricaine'
    ],
    economy: [
      // 'économie africaine', 
      // 'zlecaf', 
      // 'développement afrique', 
      // 'investissement afrique', 
      // 'commerce intra-africain', 
      // 'ressources naturelles afrique', 
      // 'industrialisation afrique', 
      // 'entrepreneuriat africain', 
      // 'diaspora économie', 
      // 'microfinance afrique'
      'croissance économique', 
      'libre-échange continental', 
      'développement durable', 
      'investissement émergent', 
      'commerce intracontinental', 
      'ressources naturelles', 
      'industrialisation émergente', 
      'entrepreneuriat local', 
      'diaspora économique', 
      'microfinance'

    ],
    culture: [
      // 'héritage africain', 
      // 'langue africaine', 
      // 'art africain', 
      // 'musique africaine', 
      // 'littérature africaine', 
      // 'cinéma africain', 
      // 'tradition africaine', 
      // 'afrofuturisme', 
      // 'décolonisation culturelle', 
      // 'patrimoine africain'
      'héritage culturel', 
      'langues locales', 
      'art contemporain', 
      'musique traditionnelle', 
      'littérature postcoloniale', 
      'cinéma émergent', 
      'traditions locales', 
      'afrofuturisme', 
      'décolonisation culturelle', 
      'patrimoine mondial'
    ]
  },
  // Score minimum pour qu'un article soit conservé (nombre de mots-clés trouvés)
  keywordScoreThreshold: 1
};

/**
 * Récupère et analyse un flux RSS
 * @param {string} feedUrl - URL du flux RSS
 * @returns {Promise<Array>} Articles du flux
 */
async function fetchRssFeed(feedUrl) {
  try {
    console.log(`Récupération du flux: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    return feed.items.slice(0, CONFIG.maxEntriesPerFeed);
  } catch (error) {
    console.error(`Erreur lors de la récupération du flux ${feedUrl}:`, error.message);
    return [];
  }
}

// Configuration des sélecteurs par domaine
const SITE_SELECTORS = {
  'lemonde.fr': {
    articleSelectors: ['article', '.article__content', '.article__body', 'main'],
    paragraphSelector: 'p',
    minParagraphLength: 50
  },
  'nouvelobs.com': {
    articleSelectors: ['.article-body', '.obs-article-body', 'article'],
    paragraphSelector: 'p',
    minParagraphLength: 50
  },
  // Ajoutez d'autres sites ici
  'default': {
    articleSelectors: ['article', '.article', '.content', '.post-content', 'main', '.entry-content'],
    paragraphSelector: 'p',
    minParagraphLength: 40
  }
};

/**
 * Extrait le contenu textuel d'une page web
 * @param {string} url - URL de l'article
 * @returns {Promise<string>} Contenu textuel de l'article
 */
async function extractArticleContent(url) {
  try {
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;
    
    // Déterminer le site à partir de l'URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    // Obtenir les sélecteurs pour ce site ou utiliser les sélecteurs par défaut
    const selectors = Object.keys(SITE_SELECTORS).find(key => domain.includes(key))
      ? SITE_SELECTORS[Object.keys(SITE_SELECTORS).find(key => domain.includes(key))]
      : SITE_SELECTORS['default'];
    
    let content = '';
    
    // Essayer de trouver l'élément principal de l'article avec les sélecteurs spécifiques au site
    let articleElement = null;
    for (const selector of selectors.articleSelectors) {
      articleElement = document.querySelector(selector);
      if (articleElement) break;
    }
    
    if (articleElement) {
      // Extraire tous les paragraphes
      const paragraphs = articleElement.querySelectorAll(selectors.paragraphSelector);
      paragraphs.forEach(p => {
        content += p.textContent + '\n\n';
      });
      
      // Si aucun paragraphe n'est trouvé, prendre le texte de l'élément principal
      if (!content.trim()) {
        content = articleElement.textContent;
      }
    } else {
      // Recours aux balises de paragraphes si l'élément principal n'est pas trouvé
      const paragraphs = document.querySelectorAll(selectors.paragraphSelector);
      paragraphs.forEach(p => {
        // Filtrer les paragraphes trop courts qui sont probablement des menus, etc.
        if (p.textContent.length > selectors.minParagraphLength) {
          content += p.textContent + '\n\n';
        }
      });
    }
    
    // Nettoyage du texte
    content = content.replace(/\s+/g, ' ').trim();
    
    console.log(`Site détecté: ${domain}, contenu extrait: ${content.length} caractères`);
    return content;
  } catch (error) {
    console.error(`Erreur lors de l'extraction du contenu de ${url}:`, error.message);
    return '';
  }
}


/**
 * Calcule un score de pertinence basé sur les mots-clés trouvés dans le texte
 * @param {string} text - Texte à analyser
 * @returns {Object} Score et catégories trouvées
 */
function calculateKeywordScore(text) {
  if (!text) return { score: 0, categories: {} };
  
  const lowercaseText = text.toLowerCase();
  let totalScore = 0;
  const categories = {};
  
  // Parcourir chaque catégorie et ses mots-clés
  for (const [category, keywords] of Object.entries(CONFIG.keywords)) {
    let categoryScore = 0;
    const foundKeywords = [];
    
    // Compter les occurrences de chaque mot-clé
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowercaseText.match(regex);
      if (matches && matches.length > 0) {
        categoryScore += matches.length;
        foundKeywords.push(`${keyword} (${matches.length})`);
      }
    }
    
    if (categoryScore > 0) {
      categories[category] = {
        score: categoryScore,
        keywords: foundKeywords
      };
      totalScore += categoryScore;
    }
  }
  
  return { score: totalScore, categories };
}

/**
 * Transforme un article RSS en format adapté pour l'IA
 * @param {Object} item - Article RSS
 * @returns {Promise<Object>} - Données formatées pour l'IA
 */
async function transformItemForAI(item) {
  // Extraction du contenu de l'article si demandé
  let fullContent = '';
  if (CONFIG.extractFullContent) {
    fullContent = await extractArticleContent(item.link);
  }
  
  // Utiliser le contenu complet ou le résumé selon la disponibilité
  const contentToAnalyze = fullContent || item.contentEncoded || item.content || item.contentSnippet || item.description || '';
  
  // Calcul du score basé sur les mots-clés si le filtrage est activé
  const keywordAnalysis = CONFIG.filterByKeywords ? calculateKeywordScore(contentToAnalyze) : { score: 0, categories: {} };
  
  // Créer l'objet de base
  const aiItem = {
    title: item.title || '',
    source: item.link || '',
    timestamp: new Date().toISOString(),
    keywordScore: keywordAnalysis.score,
    keywordCategories: keywordAnalysis.categories
  };
  
  // Ajouter le contenu complet si disponible
  if (fullContent) {
    aiItem.fullContent = fullContent;
  }
  
  // Ajouter le résumé RSS si disponible
  if (CONFIG.includeContent && (item.contentEncoded || item.content || item.contentSnippet || item.description)) {
    aiItem.summaryContent = item.contentEncoded || item.content || item.contentSnippet || item.description;
  }
  
  if (CONFIG.includeCategories && item.categories) {
    aiItem.categories = item.categories;
  }
  
  if (CONFIG.includePublishDate && item.pubDate) {
    aiItem.publishDate = item.pubDate;
  }
  
  if (item.creator) {
    aiItem.author = item.creator;
  }
  
  return aiItem;
}

/**
 * Filtre les articles selon leur score de mots-clés
 * @param {Array} items 
 */
function filterItemsByKeywords(items) {
  if (!CONFIG.filterByKeywords) return items;
  
  return items.filter(item => item.keywordScore >= CONFIG.keywordScoreThreshold);
}

/**
 * Sauvegarde les données au format JSONL
 * @param {Array} items - Articles transformés
 */
async function saveToJsonl(items) {
  try {
    // Créer le répertoire de sortie s'il n'existe pas
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Chaque ligne est un objet JSON (format JSONL)
    const jsonlContent = items.map(item => JSON.stringify(item)).join('\n');
    
    await fs.writeFile(OUTPUT_FILE, jsonlContent);
    console.log(`Données sauvegardées dans ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error.message);
  }
}

/**
 * Génère un rapport sur les articles récupérés
 * @param {Array} items - Articles avant filtrage
 * @param {Array} filteredItems - Articles après filtrage
 */
async function generateReport(items, filteredItems) {
  try {
    const reportFile = path.join(OUTPUT_DIR, 'rapport.txt');
    
    let report = `RAPPORT DE RÉCUPÉRATION DES FLUX RSS\n`;
    report += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
    report += `Nombre total d'articles récupérés: ${items.length}\n`;
    report += `Nombre d'articles conservés après filtrage: ${filteredItems.length}\n\n`;
    
    report += `ARTICLES CONSERVÉS PAR CATÉGORIE:\n`;
    const categoryCounts = {};
    filteredItems.forEach(item => {
      Object.keys(item.keywordCategories).forEach(category => {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    });
    
    for (const [category, count] of Object.entries(categoryCounts)) {
      report += `- ${category}: ${count} articles\n`;
    }
    
    report += `\nDÉTAIL DES ARTICLES CONSERVÉS:\n`;
    filteredItems.forEach((item, index) => {
      report += `${index + 1}. "${item.title}" (Score: ${item.keywordScore})\n`;
      report += `   Catégories: ${Object.keys(item.keywordCategories).join(', ')}\n`;
      report += `   Source: ${item.source}\n\n`;
    });
    
    await fs.writeFile(reportFile, report);
    console.log(`Rapport généré dans ${reportFile}`);
  } catch (error) {
    console.error('Erreur lors de la génération du rapport:', error.message);
  }
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('Démarrage du bot RSS amélioré...');
    
    // Récupération de tous les flux
    const allItemsPromises = RSS_FEEDS.map(feedUrl => fetchRssFeed(feedUrl));
    const allFeedsItems = await Promise.all(allItemsPromises);
    
    // Aplatir le tableau d'articles
    const allItems = allFeedsItems.flat();
    
    if (allItems.length === 0) {
      console.log('Aucun article trouvé dans les flux RSS');
      return;
    }
    
    console.log(`Traitement de ${allItems.length} articles...`);
    
    // Transformation des articles pour l'IA (avec extraction de contenu)
    const transformedItemsPromises = allItems.map(transformItemForAI);
    const transformedItems = await Promise.all(transformedItemsPromises);
    
    // Filtrage des articles selon les mots-clés
    const filteredItems = filterItemsByKeywords(transformedItems);
    
    // Enregistrement au format JSONL
    await saveToJsonl(filteredItems);
    
    // Génération d'un rapport
    await generateReport(transformedItems, filteredItems);
    
    console.log(`Traitement terminé: ${filteredItems.length}/${transformedItems.length} articles conservés`);
  } catch (error) {
    console.error('Erreur dans le processus principal:', error.message);
  }
}

// Exécution immédiate puis à intervalles réguliers
main();
setInterval(main, CONFIG.fetchInterval);

// Gestion propre de la fermeture
process.on('SIGINT', () => {
  console.log('Bot arrêté');
  process.exit(0);
});