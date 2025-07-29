const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const memoryData = { clients: [], quotes: [], invoices: [] };

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Vérification des variables d'environnement
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI manquante dans les variables d'environnement");
  process.exit(1);
}

console.log("🔍 MONGODB_URI trouvée:", process.env.MONGODB_URI.substring(0, 20) + "...");

// Modèles MongoDB (simplifié)
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
}, { collection: 'clients' });

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
}, { collection: 'quotes' });

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
}, { collection: 'invoices' });

// Création des modèles
const Client = mongoose.model('Client', ClientSchema);
const Quote = mongoose.model('Quote', QuoteSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);

// Connexion à MongoDB avec gestion d'erreur améliorée
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Connecté à MongoDB Atlas avec succès");
})
.catch((error) => {
  console.error("❌ Erreur de connexion à MongoDB:", error.message);
  console.error("🔍 Vérifiez votre URL MongoDB et vos paramètres Atlas");
});

// Routes API

// Route de santé
app.get("/health", async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? "Connecté" : "Déconnecté";
    
    let counts = { clients: 0, quotes: 0, invoices: 0 };
    
    if (mongoose.connection.readyState === 1) {
      try {
        counts.clients = await Client.countDocuments();
        counts.quotes = await Quote.countDocuments();
        counts.invoices = await Invoice.countDocuments();
      } catch (countError) {
        console.log("⚠️ Erreur comptage documents:", countError.message);
      }
    }

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      mongodb: mongoStatus,
      data: counts
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
    
    const clients = await Client.find().sort({ id: 1 }) || [];
    const quotes = await Quote.find().sort({ id: 1 }) || [];
    const invoices = await Invoice.find().sort({ id: 1 }) || [];

    const data = {
      clients: clients,
      quotes: quotes,
      invoices: invoices
    };

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

    // Synchronisation avec MongoDB
    await Client.deleteMany({});
    await Quote.deleteMany({});
    await Invoice.deleteMany({});

    if (clients.length > 0) {
      await Client.insertMany(clients);
    }
    if (quotes.length > 0) {
      await Quote.insertMany(quotes);
    }
    if (invoices.length > 0) {
      await Invoice.insertMany(invoices);
    }

    console.log("✅ Synchronisation réussie");

    res.json({
      success: true,
      message: "Données synchronisées avec succès",
      timestamp: new Date().toISOString(),
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

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Test de santé: http://localhost:${PORT}/health`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('🔄 Fermeture propre du serveur...');
  await mongoose.connection.close();
  console.log('✅ Connexion MongoDB fermée');
  process.exit(0);
});
