import { parse } from 'node-html-parser';
import fs from 'fs';
import path from 'path';

async function scrapeJobs() {
  try {
    const BASE_URL = 'https://www.tourmag.com/welcometothetravel/';
    const allOffers = [];
    const maxPages = 30; // Charger jusqu'à 30 pages (300 offres)
    
    console.log('🚀 Début du scraping...');
    
    // Charger toutes les pages en parallèle pour plus de rapidité
    const pagesToFetch = Array.from({ length: maxPages }, (_, i) => i);
    
    const fetchPromises = pagesToFetch.map(async (pageNum) => {
      const start = pageNum * 10;
      const url = pageNum === 0 ? BASE_URL : `${BASE_URL}?start=${start}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          }
        });
        
        if (!response.ok) {
          console.warn(`⚠️ Page ${pageNum} : HTTP ${response.status}`);
          return [];
        }
        
        const html = await response.text();
        const root = parse(html);
        
        // Cibler uniquement les offres dans le bloc avec l'ID spécifique
        const offerBlock = root.querySelector('#mod_38716852');
        if (!offerBlock) {
          console.warn(`⚠️ Page ${pageNum} : Bloc #mod_38716852 non trouvé`);
          return [];
        }
        
        const offerElements = offerBlock.querySelectorAll('div.cel1');
        const pageOffers = [];
        
        offerElements.forEach(element => {
          const link = element.querySelector('a');
          
          if (link) {
            const href = link.getAttribute('href');
            const title = link.text.trim();
            
            if (href && title) {
              let fullUrl = href;
              if (!href.startsWith('http')) {
                fullUrl = href.startsWith('/') 
                  ? `https://www.tourmag.com${href}` 
                  : `https://www.tourmag.com/${href}`;
              }
              
              let date = '';
              const parentElement = element.parentNode;
              if (parentElement) {
                const dateElement = parentElement.querySelector('.date, .cel2, [class*="date"]');
                if (dateElement) {
                  date = dateElement.text.trim();
                }
              }
              
              pageOffers.push({
                title: title,
                link: fullUrl,
                description: '',
                pubDate: date || 'Non précisée'
              });
            }
          }
        });
        
        console.log(`✅ Page ${pageNum} : ${pageOffers.length} offres trouvées`);
        return pageOffers;
        
      } catch (error) {
        console.error(`❌ Erreur page ${pageNum}:`, error.message);
        return [];
      }
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Fusionner tous les résultats et dédupliquer
    results.forEach(pageOffers => {
      pageOffers.forEach(offer => {
        if (!allOffers.find(o => o.link === offer.link)) {
          allOffers.push(offer);
        }
      });
    });
    
    console.log(`\n📊 Total: ${allOffers.length} offres récupérées`);
    
    // Créer le répertoire data s'il n'existe pas
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Sauvegarder les données dans un fichier JSON
    const outputData = {
      success: true,
      total: allOffers.length,
      offers: allOffers,
      scrapedAt: new Date().toISOString()
    };
    
    const outputPath = path.join(dataDir, 'jobs.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Données sauvegardées dans ${outputPath}`);
    console.log(`⏰ Dernière mise à jour : ${new Date().toLocaleString('fr-FR')}`);
    
    return outputData;
    
  } catch (error) {
    console.error('❌ Erreur lors du scraping:', error);
    
    // En cas d'erreur, créer un fichier JSON avec erreur
    const errorData = {
      success: false,
      total: 0,
      offers: [],
      error: error.message,
      scrapedAt: new Date().toISOString()
    };
    
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const outputPath = path.join(dataDir, 'jobs.json');
    fs.writeFileSync(outputPath, JSON.stringify(errorData, null, 2));
    
    throw error;
  }
}

// Exécuter le scraper
scrapeJobs()
  .then(data => {
    console.log('\n🎉 Scraping terminé avec succès !');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Échec du scraping');
    process.exit(1);
  });
