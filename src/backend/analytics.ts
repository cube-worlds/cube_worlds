/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "#root/config";
import { logger } from "#root/logger";
import axios from "axios";
import crypto from "node:crypto";
import NodeRSA from "node-rsa";
import { Buffer } from "node:buffer";

export interface EventUserDetails {
  username?: string;
  firstName?: string;
  lastName?: string;
  isPremium?: boolean;
  writeAccess?: boolean;
}

export interface EventDetails {
  startParameter: string;
  path: string;
  params: { [key: string]: any };
}

export interface BaseEvent {
  eventType: string;
  userDetails: EventUserDetails;
  app: string;
  eventDetails: EventDetails;
  telegramID: string;
  language: string;
  device: string;
  referrerType: string | "N/A";
  referrer: string | "0";
  timestamp: string;
  isAutocapture: boolean;
  wallet: string | undefined;
  sessionIdentifier?: string;
  eventSource: string;
}

async function getEncryptionKeys(projectId: string, apiKey: string) {
  const url = `https://config.ton.solutions/v1/client/config?project=${projectId}`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.data;
  } catch (error) {
    logger.error("Error fetching encryption keys:", error);
  }
}

// Function to encrypt data using RSA public key
function rsaEncrypt(publicKeyString: string, message: Buffer) {
  const key = new NodeRSA(publicKeyString);
  return key.encrypt(message, "base64");
}

// Function to generate a random AES key and IV
function generateAESKeyIV() {
  const key = crypto.randomBytes(16); // AES key size (128 bits)
  const iv = crypto.randomBytes(16); // AES block size (128 bits)
  return { key, iv };
}

// Function to encrypt data using AES
function aesEncrypt(
  key: Buffer | crypto.CipherKey,
  iv: Buffer | crypto.BinaryLike | null,
  message: string,
) {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  let encrypted = cipher.update(message, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

// Main function to process and send an event
async function processEvent(
  event: object,
  publicKey: string,
  apiGateway: string,
  apiKey: string,
) {
  try {
    // Generate AES key and IV
    const { key, iv } = generateAESKeyIV();

    // Encrypt AES key and IV using RSA
    const encryptedKey = rsaEncrypt(publicKey, key);
    const encryptedIV = rsaEncrypt(publicKey, iv);

    // Encrypt event data using AES
    const encryptedBody = aesEncrypt(key, iv, JSON.stringify(event));

    // Prepare the payload with encrypted data
    const payload = {
      key: encryptedKey,
      iv: encryptedIV,
      body: encryptedBody,
    };

    // Send a POST request with the encrypted payload
    const response = await axios.post(apiGateway, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
    });

    return response.data;
  } catch (error) {
    logger.error(error);
  }
}

const analyticsHandler = (fastify: any, _options: any, done: () => void) => {
  fastify.get("/config", async (_request: any, _reply: any) => {
    return getEncryptionKeys(
      config.TELEMETREE_PROJECT_ID,
      config.TELEMETREE_API_KEY,
    );
  });

  fastify.post("/send", async (_request: any, _reply: any) => {
    // Example usage
    const publicKey = "your_rsa_public_key"; // Replace with the actual RSA public key
    const apiKey = "your_telemetree_key"; // Replace with your actual Telemetree API key
    const apiGateway = "api-analytics.ton.solutions/events"; // Replace with your actual API endpoint
    const eventData = { event: "click" }; // change

    await processEvent(eventData, publicKey, apiGateway, apiKey)
      .then((response) => logger.info(response))
      .catch((error) => logger.error(error));
  });

  done();
};

export default analyticsHandler;
