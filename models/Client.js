// models/Client.js
const mongoose = require('mongoose');

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
      plate: String
    }
  ]
});

module.exports = mongoose.model('Client', clientSchema);
