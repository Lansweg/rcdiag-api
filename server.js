const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Connexion à MongoDB
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connexion à MongoDB réussie'))
  .catch((error) => console.error('❌ Erreur de connexion à MongoDB:', error));

// Exemple de route
app.get('/', (req, res) => {
  res.send('✅ API RC Diag Auto opérationnelle');
});

app.listen(port, () => {
  console.log(`🚀 Serveur API lancé sur le port ${port}`);
});
