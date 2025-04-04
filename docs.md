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

## 💡 Tips

- Clients **must set a username** before issuing other commands
- Clients can only be in **one room at a time**
- Messages are only broadcast to other clients in the same room
- Server **never modifies** or inspects `message.body.content`

---

## 📫 Questions?

Reach out to the project owner for API extensions or commercial integrations.
