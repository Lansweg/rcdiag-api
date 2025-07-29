const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, "data.json");

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Fonction pour initialiser le fichier data.json
const initializeDataFile = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      clients: [],
      quotes: [],
      invoices: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log("📄 Fichier data.json initialisé");
  }
};

// Variable pour suivre l'état de MongoDB
let mongoConnected = false;
let mongoError = null;

// Tentative de connexion MongoDB (non-bloquante)
if (process.env.MONGODB_URI) {
  console.log("🔄 Tentative de connexion MongoDB...");
  
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // 5 secondes max
    connectTimeoutMS: 5000,
  })
  .then(() => {
    console.log("✅ MongoDB connecté !");
    mongoConnected = true;
  })
  .catch((error) => {
    console.log("⚠️ MongoDB non disponible, utilisation fichiers locaux");
    console.log("🔍 Erreur MongoDB:", error.message);
    mongoConnected = false;
    mongoError = error.message;
  });
} else {
  console.log("⚠️ MONGODB_URI non définie, utilisation fichiers locaux");
}

// Modèles MongoDB (si connecté)
let Client, Quote, Invoice;

if (process.env.MONGODB_URI) {
  const ClientSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    vehicles: [{
      id: { type: Number, required: true },
      brand: { type: String, required: true },
      model: { type: String, required: true },
      year: { type: String, required: true },
      plate: { type: String, required: true },
      vin: { type: String, required: true }
    }],
    createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] }
  });

  const QuoteSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    number: { type: String, required: true },
    clientId: { type: Number, required: true },
    vehicleId: { type: Number, required: true },
    services: [{
      serviceId: { type: Number, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }
    }],
    interventionDate: { type: String, required: true },
    notes: { type: String, default: "" },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'converted', 'rejected'], default: 'pending' },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
  });

  const InvoiceSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    number: { type: String, required: true },
    clientId: { type: Number, required: true },
    vehicleId: { type: Number, required: true },
    services: [{
      serviceId: { type: Number, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }
    }],
    interventionDate: { type: String, required: true },
    notes: { type: String, default: "" },
    total: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
  });

  Client = mongoose.model('Client', ClientSchema);
  Quote = mongoose.model('Quote', QuoteSchema);
  Invoice = mongoose.model('Invoice', InvoiceSchema);
}

// Fonctions de données hybrides
const loadData = async () => {
  // Essayer MongoDB d'abord (avec timeout rapide)
  if (mongoConnected && Client) {
    try {
      console.log("📥 Tentative chargement MongoDB...");
      
      const clientsPromise = Client.find().maxTimeMS(3000);
      const quotesPromise = Quote.find().maxTimeMS(3000);
      const invoicesPromise = Invoice.find().maxTimeMS(3000);
      
      const [clients, quotes, invoices] = await Promise.all([
        clientsPromise, quotesPromise, invoicesPromise
      ]);
      
      console.log("✅ Données chargées depuis MongoDB");
      return { clients, quotes, invoices };
      
    } catch (mongoError) {
      console.log("⚠️ MongoDB timeout, utilisation fichier local");
    }
  }
  
  // Fallback sur fichier local
  try {
    initializeDataFile();
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(rawData);
    console.log("📁 Données chargées depuis fichier local");
    return data;
  } catch (fileError) {
    console.log("📁 Fichier local non trouvé, données vides");
    return { clients: [], quotes: [], invoices: [] };
  }
};

const saveData = async (data) => {
  const results = { file: false, mongo: false };
  
  // Sauvegarder dans fichier local (toujours)
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    results.file = true;
    console.log("💾 Sauvegardé dans fichier local");
  } catch (fileError) {
    console.error("❌ Erreur sauvegarde fichier:", fileError.message);
  }
  
  // Sauvegarder dans MongoDB (si disponible)
  if (mongoConnected && Client) {
    try {
      await Client.deleteMany({}).maxTimeMS(3000);
      await Quote.deleteMany({}).maxTimeMS(3000);
      await Invoice.deleteMany({}).maxTimeMS(3000);
      
      if (data.clients.length > 0) {
        await Client.insertMany(data.clients).maxTimeMS(3000);
      }
      if (data.quotes.length > 0) {
        await Quote.insertMany(data.quotes).maxTimeMS(3000);
      }
      if (data.invoices.length > 0) {
        await Invoice.insertMany(data.invoices).maxTimeMS(3000);
      }
      
      results.mongo = true;
      console.log("💾 Sauvegardé dans MongoDB");
    } catch (mongoError) {
      console.log("⚠️ Erreur sauvegarde MongoDB:", mongoError.message);
    }
  }
  
  return results;
};

// Routes API

// Route de santé
app.get("/health", async (req, res) => {
  try {
    const data = await loadData();
    
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      storage: {
        mongodb: mongoConnected ? "Connecté" : "Déconnecté",
        mongoError: mongoError,
        file: fs.existsSync(DATA_FILE) ? "Disponible" : "Non trouvé"
      },
      data: {
        clients: data.clients.length,
        quotes: data.quotes.length,
        invoices: data.invoices.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      error: error.message
    });
  }
});

// Charger toutes les données
app.get("/data", async (req, res) => {
  try {
    console.log("📥 Requête de chargement des données");
    
    const data = await loadData();
    
    console.log("📊 Données envoyées:", {
      clients: data.clients.length,
      quotes: data.quotes.length,
      invoices: data.invoices.length
    });

    res.json(data);
  } catch (error) {
    console.error("❌ Erreur lors du chargement:", error);
    res.status(500).json({
      error: "Erreur lors du chargement des données",
      details: error.message
    });
  }
});

// Sauvegarder toutes les données
app.post("/data", async (req, res) => {
  try {
    const { clients, quotes, invoices } = req.body;

    console.log("💾 Début de la synchronisation:", {
      clients: clients?.length || 0,
      quotes: quotes?.length || 0,
      invoices: invoices?.length || 0
    });

    // Validation
    if (!Array.isArray(clients) || !Array.isArray(quotes) || !Array.isArray(invoices)) {
      return res.status(400).json({
        error: "Format de données invalide"
      });
    }

    const dataToSave = {
      clients: clients || [],
      quotes: quotes || [],
      invoices: invoices || []
    };

    const results = await saveData(dataToSave);

    console.log("✅ Synchronisation terminée");

    res.json({
      success: true,
      message: "Données synchronisées avec succès",
      timestamp: new Date().toISOString(),
      storage: results,
      saved: {
        clients: clients.length,
        quotes: quotes.length,
        invoices: invoices.length
      }
    });

  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation:", error);
    res.status(500).json({
      error: "Erreur lors de la synchronisation",
      details: error.message
    });
  }
});

// Gestion d'erreur globale
app.use((error, req, res, next) => {
  console.error("❌ Erreur serveur:", error);
  res.status(500).json({
    error: "Erreur serveur interne",
    details: error.message
  });
});

// Initialisation
initializeDataFile();

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Test de santé: http://localhost:${PORT}/health`);
  console.log(`💾 Mode: ${mongoConnected ? 'MongoDB + Fichier' : 'Fichier uniquement'}`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('🔄 Fermeture propre du serveur...');
  if (mongoConnected) {
    await mongoose.connection.close();
    console.log('✅ Connexion MongoDB fermée');
  }
  process.exit(0);
});
