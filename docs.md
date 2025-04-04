# 📡 CTurn Server Interface Documentation

This document describes the TCP-based protocol for communicating with the chat server. The server supports multi-room chat functionality, user identity management, and message broadcasting. It assumes all communication uses **UTF-8 encoded JSON messages over TCP**.

---

## 📍 Server Info

- **Protocol**: Raw TCP sockets
- **Encoding**: `UTF-8`
- **Transport Format**: `JSON`, newline (`\n`) delimited per message

---

## 🔐 End-to-End Encryption

- The server **does not decrypt or inspect message content**
- All messages sent to the server should already be **encrypted client-side**
- The server only relays messages between connected sockets

### **How the Encryption Works**

The server supports **End-to-End encryption** using the **RSA (Rivest-Shamir-Adleman)** public-key cryptosystem. The main goal is to ensure that **only the intended recipient(s)** can read the message, and the server only relays the encrypted data without ever being able to decrypt it.

#### Key Generation and Sharing
- **RSA Keypair**: Each client generates a unique **2048-bit RSA keypair** (public and private keys) when starting up.
- **Public Key Exchange**: When a client joins a room, their **public key** is shared with other clients in that room. The **private key** is kept secret and used only by the client to decrypt messages.

#### Encryption Process
- **Sender's Side**: When a user sends a message, the **content is encrypted** using the **recipient's public key**. This ensures that only the recipient's private key can decrypt the message.
- **Recipient's Side**: When the recipient receives the message, it can be decrypted using their own **private key**. Only the client with the corresponding private key can decrypt the message.
- **The Server**: The server simply relays the encrypted message to all recipients in the room. It **cannot decrypt** any messages because it does not have access to the clients' private keys.

---

## 📤 Client-to-Server Messages

All client requests must follow this structure:

```json
{
  "type": "<command_type>",
  "body": {
    "content": "<string payload or encrypted blob>"
  }
}
```

> ⚠️ All messages must end with a newline (`\n`) character.

---

### 🧾 Supported Message Types

| Type       | Description                                 | Requires `body.content` |
|------------|---------------------------------------------|--------------------------|
| `username` | Sets the client's username (once only)      | ✅                       |
| `create`   | Creates and joins a new room                | ✅ (room name)           |
| `join`     | Joins an existing room                      | ✅ (room name)           |
| `leave`    | Leaves the current room                     | ❌                       |
| `message`  | Sends an encrypted message to current room  | ✅ (encrypted string)    |

---

### 🔐 Example: Set Username

```json
{
  "type": "username",
  "body": {
    "content": "alice"
  }
}
```

---

### 📦 Example: Create a Room

```json
{
  "type": "create",
  "body": {
    "content": "cool-room"
  }
}
```

---

### ➕ Example: Join a Room

```json
{
  "type": "join",
  "body": {
    "content": "cool-room"
  }
}
```

---

### ❌ Example: Leave Room

```json
{
  "type": "leave",
  "body": {}
}
```

---

### ✉️ Example: Encrypted Message

```json
{
  "type": "message",
  "body": {
    "content": "ENCRYPTED_MESSAGE_BLOB"
  }
}
```

> The `content` is encrypted by the client per recipient using RSA.

---

## 📥 Server-to-Client Messages

All server responses are JSON messages, newline-delimited, and follow this structure:

```json
{
  "type": "<response_type>",
  "body": {
    "content": "<message content>"
  }
}
```

---

### 🔧 Message Types

| Type     | Description                                      |
|----------|--------------------------------------------------|
| `welcome`| System acknowledgements (e.g. join/create success)|
| `system` | Room-wide system messages (joins, leaves, etc.) |
| `message`| Encrypted message from another user              |
| `error`  | Error message from server                        |

---

### ✅ Example: Welcome Message

```json
{
  "type": "welcome",
  "body": {
    "content": "Joined room: cool-room"
  }
}
```

---

### 🚨 Example: Error Message

```json
{
  "type": "error",
  "body": {
    "content": "Room does not exist"
  }
}
```

---

### 📢 Example: System Broadcast

```json
{
  "type": "system",
  "body": {
    "content": "bob joined the room"
  }
}
```

---

### 🔐 Example: Incoming Encrypted Message

```json
{
  "type": "message",
  "sender": "bob",
  "body": {
    "content": "ENCRYPTED_TEXT_BLOB"
  }
}
```

> The `sender` field helps clients identify who sent the encrypted message.

---

## 🔁 Connection Lifecycle

- Client connects → Sets `username`
- Client creates or joins a room
- Client sends encrypted messages
- Client can leave, or disconnect (auto-leaves room)
- If a room becomes empty, it is deleted server-side

---

## 🧹 Disconnection Handling

- On `end` or `error`, client is automatically:
  - Removed from current room (if any)
  - Removed from memory
  - Room is deleted if empty

---

## 💡 Protocol Constraints

- Clients **must set a username** before issuing other commands
- Clients can only be in **one room at a time**
- Messages are only broadcast to other clients in the same room
- Server **never modifies** or inspects content of message-type packets


---

# 🔐 Client-Side End-to-End Encryption (E2EE) in the TCP Chat

This section explains **how encryption works in the client**, specifically how RSA keys are generated, exchanged, and used to encrypt and decrypt chat messages in a secure, end-to-end encrypted environment.

---

## 🧰 What Is End-to-End Encryption?

End-to-End Encryption (E2EE) ensures that:

- Only the sender and intended recipients can **read the message**.
- The server acts only as a **relay** and never has access to the plaintext.
- Even if the server is compromised, messages remain secure.

---

## 📦 Technologies Used

- **RSA** (2048-bit) asymmetric encryption (from Node's `crypto` module).
- **Base64 representation** to safely send encrypted binary data over the network.
- **JSON messaging** for client-server communication.

> **Note:** Base64 is *not* an encryption method — it's a way to represent binary data (like an encrypted message) as safe text for transport.

---

## 🔑 Key Concepts

### Public/Private Key Pair

- Each client generates a **public/private RSA key pair** when it starts.
- **Public Key**: Shared with the server and other clients.
- **Private Key**: Stays secret and is used to decrypt messages.

---

## 🔁 Lifecycle of Encrypted Communication

### 1. 🔐 Key Generation

Upon client startup:

```js
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});
```

- `publicKey` is sent to the server when joining a room.
- `privateKey` is kept locally and used to decrypt incoming messages.

---

### 2. 📡 Public Key Distribution

- When a client joins a room, their **public key is shared** with all other clients.
- The server stores each client's public key and forwards them to new members when joining a room.

> Example server message to a client:
```json
{
  "type": "public_key",
  "sender": "alice",
  "body": {
    "content": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----"
  }
}
```

---

### 3. ✉️ Sending an Encrypted Message

To send a message securely:

```js
const recipientKey = storedPublicKeys["bob"]; // PEM format
const encrypted = crypto.publicEncrypt(
  recipientKey,
  Buffer.from("Hello Bob")
).toString("base64"); // Represent encrypted data safely as a string
```

> ⚠️ **Note:** `.toString("base64")` only converts the encrypted binary buffer into text form. The actual encryption happens via `crypto.publicEncrypt()` using the recipient's public key.

- This encrypted string is included in a `message` payload:
```json
{
  "type": "message",
  "body": {
    "content": "BASE64_ENCRYPTED_TEXT"
  }
}
```

- Sent over the socket, just like normal.

> ⚠️ If multiple users are in the room, the client must encrypt the message **once per recipient** using each public key.

---

### 4. 📥 Receiving and Decrypting a Message

When a message is received from the server:

```js
const encryptedBase64 = message.body.content;
const decrypted = crypto.privateDecrypt(
  privateKey,
  Buffer.from(encryptedBase64, "base64") // Convert Base64 text back to binary
).toString();
```

> ⚠️ **Note:** `.from(..., "base64")` decodes the Base64 string back into binary before decryption. The encryption itself happened earlier using the sender's public key.

- Only the client with the correct private key can decrypt this content.
- The decrypted string is then shown in the UI (i.e. terminal output).

---

### 5. 🗂 Keyring Management

Each client maintains a **keyring** — a dictionary mapping usernames to their public keys:

```js
const keyring = {
  alice: "-----BEGIN PUBLIC KEY-----\n...",
  bob:   "-----BEGIN PUBLIC KEY-----\n..."
};
```

- When a user joins the room, the server sends their username and public key.
- The client adds it to the keyring so it can encrypt messages for them.

---

## 🔐 Why RSA?

RSA is used here because:
- It works well in a **client-to-client context** without needing an external key exchange.
- It’s relatively easy to implement in Node.js without external libraries.
- It avoids symmetric key sharing via the server.

> That said, RSA isn't ideal for large payloads. In a production app, you'd use **RSA to encrypt a shared AES key**, then encrypt the message using AES.

---

## 🚫 What the Server Sees

The server **does not see**:
- The plaintext of any chat message.
- Any private key material.

The server only sees:
- Encrypted blobs (usually long base64 strings).
- Public key exchange messages.
- Metadata like who sent it and the room name.

---

## 🧪 Example: Full Encryption Round Trip

1. Alice joins the room and shares her public key.
2. Bob joins and shares his.
3. Alice wants to message Bob:
   - Encrypts `Hello` with Bob's public key.
   - Encodes the result in Base64 for transmission.
   - Sends it via `message`.
4. Bob receives the encrypted Base64 string.
   - Decodes it from Base64.
   - Decrypts it with his private key.
   - Reads `Hello`.

---

## ✅ Summary

| Step                     | Action                                   |
|--------------------------|------------------------------------------|
| Startup                  | Generate RSA key pair                    |
| Room Join                | Send public key to server                |
| Room Update              | Receive others' public keys              |
| Send Message             | Encrypt for each recipient and Base64-encode it |
| Receive Message          | Base64-decode, then decrypt with private key |
| Server's Role            | Relay messages only (no decryption)      |

> 💡 **Base64 is only a transport format** — the actual security comes from RSA encryption using each recipient's public key.
