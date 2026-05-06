const mongoose = require("mongoose");
const { getEnv } = require("../config/env");

let connectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    const env = getEnv();

    connectionPromise = mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
    });
  }

  await connectionPromise;
  return mongoose.connection;
}

module.exports = {
  connectToDatabase,
};
