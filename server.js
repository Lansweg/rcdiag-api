const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_FILE = path.join("/tmp", "data.json");

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Fonction pour initialiser le fichier data.json s'il n'existe pas
const initializeDataFile = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      clients: [],
      quotes: [],
      invoices: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log("📄 Fichier data.json initialisé");
  }
};

// Route d'accueil (évite l'erreur 403)
app.get("/", (req, res) => {
  res.send("👋 Bienvenue sur l'API RC Diag Auto !");
});

// Charger les données
app.get("/data", (req, res) => {
  try {
    initializeDataFile();

    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(rawData);

    console.log("📥 Données chargées:", {
      clients: data.clients?.length || 0,
      quotes: data.quotes?.length || 0,
      invoices: data.invoices?.length || 0,
    });

    res.json(data);
  } catch (error) {
    console.error("❌ Erreur lors du chargement des données:", error.message);
    res.status(500).json({
      error: "Erreur lors du chargement des données",
      details: error.message,
    });
  }
});

// Enregistrer les données
app.post("/data", (req, res) => {
  try {
    const { clients, quotes, invoices } = req.body;

    if (
      !Array.isArray(clients) ||
      !Array.isArray(quotes) ||
      !Array.isArray(invoices)
    ) {
      return res.status(400).json({
        error: "Format de données invalide",
      });
    }

    const dataToSave = {
      clients: clients || [],
      quotes: quotes || [],
      invoices: invoices || [],
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));

    console.log("💾 Données sauvegardées:", {
      clients: dataToSave.clients.length,
      quotes: dataToSave.quotes.length,
      invoices: dataToSave.invoices.length,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Données sauvegardées avec succès.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la sauvegarde:", error.message);
    res.status(500).json({
      error: "Erreur lors de la sauvegarde",
      details: error.message,
    });
  }
});

// Route de santé
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    dataFile: fs.existsSync(DATA_FILE) ? "Existe" : "N'existe pas",
  });
});

// Middleware d'erreur
app.use((error, req, res, next) => {
  console.error("❌ Erreur serveur:", error);
  res.status(500).json({
    error: "Erreur serveur interne",
    details: error.message,
  });
});

// Initialisation au démarrage
initializeDataFile();

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur API démarré sur http://localhost:${PORT}`);
  console.log(`📁 Fichier de données: ${DATA_FILE}`);
  console.log(`🔍 Test de santé: http://localhost:${PORT}/health`);
});
