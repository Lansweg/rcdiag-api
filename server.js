const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Modèles MongoDB
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

// Création des modèles
const Client = mongoose.model('Client', ClientSchema);
const Quote = mongoose.model('Quote', QuoteSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Connecté à MongoDB Atlas");
})
.catch((error) => {
  console.error("❌ Erreur de connexion à MongoDB:", error);
  process.exit(1);
});

// Routes API

// Charger toutes les données
app.get("/api/data", async (req, res) => {
  try {
    console.log("📥 Requête de chargement des données");
    
    const clients = await Client.find().sort({ id: 1 });
    const quotes = await Quote.find().sort({ id: 1 });
    const invoices = await Invoice.find().sort({ id: 1 });

    const data = {
      clients: clients || [],
      quotes: quotes || [],
      invoices: invoices || []
    };

    console.log("📊 Données chargées:", {
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

// Sauvegarder toutes les données (synchronisation complète)
app.post("/api/data", async (req, res) => {
  try {
    const { clients, quotes, invoices } = req.body;

    console.log("💾 Début de la synchronisation:", {
      clients: clients?.length || 0,
      quotes: quotes?.length || 0,
      invoices: invoices?.length || 0
    });

    // Validation des données
    if (!Array.isArray(clients) || !Array.isArray(quotes) || !Array.isArray(invoices)) {
      return res.status(400).json({
        error: "Format de données invalide"
      });
    }

    // Utilisation de transactions pour garantir la cohérence
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Supprimer toutes les données existantes
      await Client.deleteMany({}, { session });
      await Quote.deleteMany({}, { session });
      await Invoice.deleteMany({}, { session });

      // Insérer les nouvelles données
      if (clients.length > 0) {
        await Client.insertMany(clients, { session });
      }
      if (quotes.length > 0) {
        await Quote.insertMany(quotes, { session });
      }
      if (invoices.length > 0) {
        await Invoice.insertMany(invoices, { session });
      }

      // Valider la transaction
      await session.commitTransaction();
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

    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation:", error);
    res.status(500).json({
      error: "Erreur lors de la synchronisation",
      details: error.message
    });
  }
});

// Routes individuelles pour optimiser les performances

// Créer/modifier un client
app.post("/api/clients", async (req, res) => {
  try {
    const clientData = req.body;
    
    if (clientData.id) {
      // Modification
      const updatedClient = await Client.findOneAndUpdate(
        { id: clientData.id },
        clientData,
        { new: true, upsert: true }
      );
      console.log("📝 Client modifié:", updatedClient.id);
      res.json(updatedClient);
    } else {
      // Création
      const newClient = new Client(clientData);
      await newClient.save();
      console.log("➕ Nouveau client créé:", newClient.id);
      res.json(newClient);
    }
  } catch (error) {
    console.error("❌ Erreur client:", error);
    res.status(500).json({ error: error.message });
  }
});

// Créer/modifier un devis
app.post("/api/quotes", async (req, res) => {
  try {
    const quoteData = req.body;
    
    if (quoteData.id && await Quote.findOne({ id: quoteData.id })) {
      // Modification
      const updatedQuote = await Quote.findOneAndUpdate(
        { id: quoteData.id },
        quoteData,
        { new: true }
      );
      console.log("📝 Devis modifié:", updatedQuote.number);
      res.json(updatedQuote);
    } else {
      // Création
      const newQuote = new Quote(quoteData);
      await newQuote.save();
      console.log("➕ Nouveau devis créé:", newQuote.number);
      res.json(newQuote);
    }
  } catch (error) {
    console.error("❌ Erreur devis:", error);
    res.status(500).json({ error: error.message });
  }
});

// Créer/modifier une facture
app.post("/api/invoices", async (req, res) => {
  try {
    const invoiceData = req.body;
    
    if (invoiceData.id && await Invoice.findOne({ id: invoiceData.id })) {
      // Modification
      const updatedInvoice = await Invoice.findOneAndUpdate(
        { id: invoiceData.id },
        invoiceData,
        { new: true }
      );
      console.log("📝 Facture modifiée:", updatedInvoice.number);
      res.json(updatedInvoice);
    } else {
      // Création
      const newInvoice = new Invoice(invoiceData);
      await newInvoice.save();
      console.log("➕ Nouvelle facture créée:", newInvoice.number);
      res.json(newInvoice);
    }
  } catch (error) {
    console.error("❌ Erreur facture:", error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un client
app.delete("/api/clients/:id", async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    await Client.deleteOne({ id: clientId });
    console.log("🗑️ Client supprimé:", clientId);
    res.json({ success: true, message: "Client supprimé" });
  } catch (error) {
    console.error("❌ Erreur suppression client:", error);
    res.status(500).json({ error: error.message });
  }
});

// Route de santé pour vérifier que l'API fonctionne
app.get("/health", async (req, res) => {
  try {
    // Test de connexion à MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? "Connecté" : "Déconnecté";
    
    const clientCount = await Client.countDocuments();
    const quoteCount = await Quote.countDocuments();
    const invoiceCount = await Invoice.countDocuments();

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      mongodb: mongoStatus,
      data: {
        clients: clientCount,
        quotes: quoteCount,
        invoices: invoiceCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      error: error.message
    });
  }
});

// Route pour migrer les données depuis data.json (à utiliser une seule fois)
app.post("/api/migrate", async (req, res) => {
  try {
    const { clients, quotes, invoices } = req.body;
    
    console.log("🔄 Début de la migration depuis data.json");
    
    // Insérer les données en évitant les doublons
    const clientResults = await Promise.allSettled(
      clients.map(client => new Client(client).save())
    );
    
    const quoteResults = await Promise.allSettled(
      quotes.map(quote => new Quote(quote).save())
    );
    
    const invoiceResults = await Promise.allSettled(
      invoices.map(invoice => new Invoice(invoice).save())
    );

    const migration = {
      clients: {
        success: clientResults.filter(r => r.status === 'fulfilled').length,
        errors: clientResults.filter(r => r.status === 'rejected').length
      },
      quotes: {
        success: quoteResults.filter(r => r.status === 'fulfilled').length,
        errors: quoteResults.filter(r => r.status === 'rejected').length
      },
      invoices: {
        success: invoiceResults.filter(r => r.status === 'fulfilled').length,
        errors: invoiceResults.filter(r => r.status === 'rejected').length
      }
    };

    console.log("✅ Migration terminée:", migration);
    res.json({
      success: true,
      message: "Migration terminée",
      results: migration
    });

  } catch (error) {
    console.error("❌ Erreur de migration:", error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware de gestion d'erreur globale
app.use((error, req, res, next) => {
  console.error("❌ Erreur serveur:", error);
  res.status(500).json({
    error: "Erreur serveur interne",
    details: error.message
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur API démarré sur le port ${PORT}`);
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