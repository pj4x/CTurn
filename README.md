# 🔐 **CTurn** Encrypted TCP Chat

A simple command-line chat app built using Node.js and TCP sockets with **end-to-end RSA encryption** between clients. The server acts only as a relay and **cannot read any messages**.

---

## 🛠 Features

- 🗣️ Multi-room text chat via TCP
- 🔑 Each client generates an RSA keypair
- 📬 Messages are **encrypted per recipient** using their public key
- 📡 The server only relays encrypted messages
- 🛡️ No plaintext message is ever exposed to the server
- ⚙️ Commands to create/join/leave rooms

---

## 📦 Requirements

- Node.js (v16+ recommended)

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/pj4x/CTurn.git
cd CTurn
```

### 2. Start the Server

```bash
node server.js
```

The server will start on port `1337` by default.

### 3. Run Clients

Open **multiple terminals** to simulate multiple clients:

```bash
node client.js
```

You’ll be prompted to enter a username and then interact via command-line.

---

## 💬 Chat Commands

Type these into the client prompt:

| Command           | Description                          |
|-------------------|--------------------------------------|
| `/create [name]`  | Create a new chat room               |
| `/join [name]`    | Join an existing chat room           |
| `/leave`          | Leave the current room               |
| `[text]`          | Send a message to all room members   |

---

## 🔐 Encryption Details

- **Key Generation**: Each client generates a 2048-bit RSA keypair on startup
- **Public Key Sharing**: When a user joins a room, their public key is broadcasted to others
- **Encryption**: Messages are encrypted using each recipient's public key
- **Decryption**: Recipients decrypt messages with their private key
- **The Server**: Does not store or see decrypted messages

---

## 📁 Project Structure

```
.
├── server.js    # TCP server relays encrypted messages
└── client.js    # Client CLI with encryption/decryption logic
```

---

## ✅ Example Session

```bash
> /create chillzone
[Server] Created and joined room: chillzone
[System] Alice created the room

> hey there everyone!
Bob: hey back at you!   # (decrypted from encrypted message)
```

---

## 📜 License
This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0) License.
Commercial use is prohibited without prior written permission from the author.

Author: Junus Safsouf
Contact: 

---

## 🤝 Contributions

Pull requests welcome! Start a discussion if you have ideas for improvement 🔧
