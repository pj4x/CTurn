const net = require("net");
const readline = require("readline");
const crypto = require("crypto");

const client = net.createConnection({ port: 1337 }, () => {
  console.log("Connected to server");
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let username = null;
let currentRoom = null;
const userKeys = new Map(); // username -> publicKey

// Handle username setup
rl.question("Choose a username: ", (name) => {
  username = name.trim();
  const message = JSON.stringify({
    type: "username",
    body: {
      content: username,
      publicKey: publicKey,
    },
  });
  client.write(message + "\n");

  setupCommandInterface();
});

function setupCommandInterface() {
  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", (input) => {
    input = input.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    let type = "message";
    let content = input;

    if (input.startsWith("/")) {
      const parts = input.slice(1).split(" ");
      type = parts[0];
      content = parts.slice(1).join(" ");

      if (type === "leave") {
        content = "";
      }
    } else if (currentRoom) {
      // Encrypt message for room members
      const encrypted = encryptMessage(content, userKeys);
      content = encrypted;
    }

    const message = JSON.stringify({
      type: type,
      body: { content: content },
    });

    client.write(message + "\n");
    rl.prompt();
  });
}

function encryptMessage(content, recipients) {
  // Generate random AES key and IV
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

  let encrypted = cipher.update(content, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  // Encrypt AES key for each recipient
  const encryptedKeys = {};
  recipients.forEach((pubKey, user) => {
    encryptedKeys[user] = crypto
      .publicEncrypt(
        { key: pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
        aesKey,
      )
      .toString("base64");
  });

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    content: encrypted,
    keys: encryptedKeys,
  };
}

// Update the decryptMessage function:
function decryptMessage(encryptedMessage) {
  try {
    // Get our username from the global variable
    if (!username) {
      console.log("Username not set yet");
      return null;
    }

    // Find our encrypted key in the message
    const userEncryptedKey = encryptedMessage.keys[username];
    if (!userEncryptedKey) {
      console.log(`No key found for user ${username}`);
      return null;
    }

    // Decrypt AES key with our private key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(userEncryptedKey, "base64"),
    );

    // Decrypt message content
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      aesKey,
      Buffer.from(encryptedMessage.iv, "base64"),
    );

    decipher.setAuthTag(Buffer.from(encryptedMessage.tag, "base64"));

    let decrypted = decipher.update(encryptedMessage.content, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err.message);
    return null;
  }
}

// Update the message handler:
client.on("data", (data) => {
  const messages = data.toString().split("\n");
  messages.forEach((msg) => {
    if (!msg.trim()) return;

    try {
      const message = JSON.parse(msg);

      switch (message.type) {
        case "welcome":
          console.log(`[Server] ${message.body.content}`);
          // Check if this is the welcome message after joining a room
          if (message.body.content.includes("Joined room")) {
            currentRoom = message.body.content.split(": ")[1];
          }
          break;

        case "key_update":
          if (message.body.username !== username) {
            // Don't store our own key
            userKeys.set(message.body.username, message.body.publicKey);
            console.log(
              `[Key Update] Received key for ${message.body.username}`,
            );
          }
          break;

        case "encrypted_message":
          if (message.sender !== username) {
            // Don't try to decrypt our own messages
            const decrypted = decryptMessage(message);
            if (decrypted) {
              console.log(`${message.sender}: ${decrypted}`);
            }
          }
          break;

        case "system":
          console.log(`[System] ${message.body.content}`);
          break;

        case "error":
          console.error(`[Error] ${message.body.content}`);
          break;

        default:
          console.log("Unknown message:", message);
      }
    } catch (err) {
      console.log("Raw message:", msg);
    }
  });
});

client.on("end", () => {
  console.log("\nDisconnected from server");
  process.exit();
});

client.on("error", (err) => {
  console.error("\nConnection error:", err.message);
  process.exit(1);
});

rl.on("SIGINT", () => {
  client.end();
  rl.close();
});
