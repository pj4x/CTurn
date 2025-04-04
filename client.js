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

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const myPublicKey = publicKey.export({ type: "pkcs1", format: "pem" });
const myPrivateKey = privateKey.export({ type: "pkcs1", format: "pem" });

const publicKeys = new Map(); // username -> public key

function encryptMessageForUser(publicPem, content) {
  const pubKey = crypto.createPublicKey(publicPem);
  return crypto.publicEncrypt(pubKey, Buffer.from(content)).toString("base64");
}

function decryptMessage(encryptedBase64) {
  try {
    const buffer = Buffer.from(encryptedBase64, "base64");
    const privKey = crypto.createPrivateKey({
      key: myPrivateKey,
      format: "pem",
    });
    return crypto.privateDecrypt(privKey, buffer).toString("utf8");
  } catch (e) {
    return "[Decryption failed]";
  }
}

// Ask for username
rl.question("Choose a username: ", (username) => {
  const message = JSON.stringify({
    type: "username",
    body: {
      content: username,
      pubkey: myPublicKey,
    },
  });
  client.write(message + "\n");

  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", (input) => {
    let type = "message";
    let content = input;

    if (input.startsWith("/")) {
      const parts = input.slice(1).split(" ");
      type = parts[0];
      content = parts.slice(1).join(" ");
      if (type === "leave") content = "";
    }

    if (type === "message" && publicKeys.size > 0) {
      publicKeys.forEach((pubKey, username) => {
        const encrypted = encryptMessageForUser(pubKey, content);
        const msg = JSON.stringify({
          type: "message",
          body: {
            content: encrypted,
            encrypted: true,
            to: username,
          },
        });
        client.write(msg + "\n");
      });
    } else {
      const msg = JSON.stringify({
        type,
        body: { content },
      });
      client.write(msg + "\n");
    }

    rl.prompt();
  });
});

client.on("data", (data) => {
  const messages = data.toString().split("\n");
  messages.forEach((msg) => {
    if (!msg.trim()) return;
    try {
      const parsed = JSON.parse(msg);
      switch (parsed.type) {
        case "message":
          const decrypted = parsed.body.encrypted
            ? decryptMessage(parsed.body.content)
            : parsed.body.content;
          console.log(`${parsed.sender}: ${decrypted}`);
          break;
        case "system":
          console.log(`[System] ${parsed.body.content}`);
          break;
        case "welcome":
          console.log(`[Server] ${parsed.body.content}`);
          break;
        case "error":
          console.log(`[Error] ${parsed.body.content}`);
          break;
        case "pubkey":
          publicKeys.set(parsed.sender, parsed.body.content);
          console.log(`[Key] Received public key from ${parsed.sender}`);
          break;
      }
    } catch (e) {
      console.log("Invalid message from server:", msg.trim());
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
