require("dotenv").config();
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Debug pour voir si l'URI est bien lue
if (!MONGO_URI) {
  console.error("❌ MONGO_URI est undefined. Vérifie ton fichier .env.");
  process.exit(1);
}

// Connexion à MongoDB
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connecté à MongoDB"))
  .catch((err) => {
    console.error("❌ Erreur de connexion à MongoDB:", err);
    process.exit(1);
  });

// Schémas Mongoose
const clientSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  address: String,
  vehicles: [
    {
      brand: String,
      model: String,
      year: String,
      plate: String,
    },
  ],
});

const quoteSchema = new mongoose.Schema({
  clientId: String,
  items: Array,
  total: Number,
  date: String,
});

const invoiceSchema = new mongoose.Schema({
  clientId: String,
  quoteId: String,
  items: Array,
  total: Number,
  date: String,
  paid: Boolean,
});

const Client = mongoose.model("Client", clientSchema);
const Quote = mongoose.model("Quote", quoteSchema);
const Invoice = mongoose.model("Invoice", invoiceSchema);

// Routes API
app.get("/", (req, res) => {
  res.send("✅ API RC Diag Auto est en ligne");
});

app.get("/clients", async (req, res) => {
  const clients = await Client.find();
  res.json(clients);
});

app.post("/clients", async (req, res) => {
  const client = new Client(req.body);
  await client.save();
  res.status(201).json(client);
});

app.get("/quotes", async (req, res) => {
  const quotes = await Quote.find();
  res.json(quotes);
});

app.post("/quotes", async (req, res) => {
  const quote = new Quote(req.body);
  await quote.save();
  res.status(201).json(quote);
});

app.get("/invoices", async (req, res) => {
  const invoices = await Invoice.find();
  res.json(invoices);
});

app.post("/invoices", async (req, res) => {
  const invoice = new Invoice(req.body);
  await invoice.save();
  res.status(201).json(invoice);
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur API lancé sur le port ${PORT}`);
});
