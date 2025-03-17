// rss-to-ai-feed.js
const axios = require('axios');
const Parser = require('rss-parser');
const fs = require('fs/promises');
const path = require('path');

// Création des instances
const parser = new Parser();
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ai_training_data.jsonl');

// URLs des flux RSS du Monde
const RSS_FEEDS = [
  'https://www.lemonde.fr/rss/une.xml',                // À la une
  'https://www.lemonde.fr/international/rss_full.xml', // International
  'https://www.lemonde.fr/politique/rss_full.xml',     // Politique
  'https://www.lemonde.fr/economie/rss_full.xml',      // Économie
  'https://www.lemonde.fr/sciences/rss_full.xml',      // Sciences
  'https://www.lemonde.fr/technologies/rss_full.xml',  // Technologies
];

// Configuration
const CONFIG = {
  fetchInterval: 3600000, // 1 heure en millisecondes
  maxEntriesPerFeed: 50,
  includeContent: true,
  includeCategories: true,
  includePublishDate: true
};

/**
  Récupère et analyse un flux RSS
  @param {string} feedUrl - URL du flux RSS
  @returns {Promise<Array>} Articles du flux
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

/**
  Transforme un article RSS en format adapté pour l'IA
  @param {Object} item - Article RSS
  @returns {Object} - Données formatées pour l'IA
 */
function transformItemForAI(item) {
  const aiItem = {
    title: item.title || '',
    source: item.link || '',
    timestamp: new Date().toISOString(),
  };

  if (CONFIG.includeContent && (item.content || item.contentSnippet)) {
    aiItem.content = item.content || item.contentSnippet;
  }

  if (CONFIG.includeCategories && item.categories) {
    aiItem.categories = item.categories;
  }

  if (CONFIG.includePublishDate && item.pubDate) {
    aiItem.publishDate = item.pubDate;
  }

  // Informations spécifiques pour Le Monde
  if (item.creator) {
    aiItem.author = item.creator;
  }

  return aiItem;
}

/**
  Sauvegarde les données au format JSONL
  @param {Array} items - Articles transformés
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
  Fonction principale
 */
async function main() {
  try {
    console.log('Démarrage du bot RSS vers IA...');
    
    // Récupération de tous les flux
    const allItemsPromises = RSS_FEEDS.map(feedUrl => fetchRssFeed(feedUrl));
    const allFeedsItems = await Promise.all(allItemsPromises);
    
    // Aplatir le tableau d'articles
    const allItems = allFeedsItems.flat();
    
    if (allItems.length === 0) {
      console.log('Aucun article trouvé dans les flux RSS');
      return;
    }
    
    // Transformation des articles pour l'IA
    const transformedItems = allItems.map(transformItemForAI);
    
    // Enregistrement au format JSONL
    await saveToJsonl(transformedItems);
    
    console.log(`Traitement terminé: ${transformedItems.length} articles récupérés`);
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