const net = require("net");
const crypto = require("crypto");
const port = 1337;

const clients = new Map(); // socket -> { currentRoom: string | null, username: string, publicKey: string }
const rooms = new Map(); // roomName -> Set<socket>

const server = net.createServer((socket) => {
  console.log("Client connected");

  clients.set(socket, {
    currentRoom: null,
    username: null,
    publicKey: null,
  });
  socket.setEncoding("utf8");

  socket.on("data", (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(socket, message);
    } catch (err) {
      sendError(socket, "Invalid JSON format");
    }
  });

  socket.on("end", () => handleDisconnect(socket));
  socket.on("error", (err) => handleDisconnect(socket));
});

function handleMessage(socket, message) {
  const clientState = clients.get(socket);

  if (!message.type || !message.body) {
    return sendError(socket, "Invalid message format");
  }

  switch (message.type) {
    case "username":
      if (!message.body.content || !message.body.publicKey) {
        return sendError(socket, "Username and public key required");
      }
      handleSetUsername(socket, message.body.content, message.body.publicKey);
      break;
    case "create":
      if (!clientState.username) return sendError(socket, "Set username first");
      if (!message.body.content) return sendError(socket, "Room name required");
      handleCreateRoom(socket, message.body.content);
      break;
    case "join":
      if (!clientState.username) return sendError(socket, "Set username first");
      if (!message.body.content) return sendError(socket, "Room name required");
      handleJoinRoom(socket, message.body.content);
      break;
    case "message":
      if (!clientState.currentRoom)
        return sendError(socket, "Join a room first");
      if (!message.body.content)
        return sendError(socket, "Message content required");
      handleEncryptedMessage(socket, message.body.content);
      break;
    case "leave":
      handleLeaveRoom(socket);
      break;
    default:
      sendError(socket, "Invalid message type");
  }
}

function handleSetUsername(socket, username, publicKey) {
  const clientState = clients.get(socket);
  if (clientState.username) {
    return sendError(socket, "Username already set");
  }

  username = username.trim();
  if (!username) {
    return sendError(socket, "Username cannot be empty");
  }

  clientState.username = username;
  clientState.publicKey = publicKey;
  sendMessage(socket, "welcome", `Username set to: ${username}`);
}

function handleCreateRoom(socket, roomName) {
  const clientState = clients.get(socket);
  if (clientState.currentRoom) {
    return sendError(socket, "Leave current room first");
  }

  if (rooms.has(roomName)) {
    return sendError(socket, "Room already exists");
  }

  rooms.set(roomName, new Set([socket]));
  clientState.currentRoom = roomName;
  sendMessage(socket, "welcome", `Created and joined room: ${roomName}`);
  sendKeyUpdate(roomName, clientState.username, clientState.publicKey);
}

function handleJoinRoom(socket, roomName) {
  const clientState = clients.get(socket);
  if (clientState.currentRoom) {
    return sendError(socket, "Leave current room first");
  }

  if (!rooms.has(roomName)) {
    return sendError(socket, "Room does not exist");
  }

  const room = rooms.get(roomName);
  room.add(socket);
  clientState.currentRoom = roomName;
  sendMessage(socket, "welcome", `Joined room: ${roomName}`);

  // Send new user's key to all room members
  sendKeyUpdate(roomName, clientState.username, clientState.publicKey);

  // Send all existing keys to new user
  room.forEach((client) => {
    if (client !== socket) {
      const memberState = clients.get(client);
      sendKeyUpdate(
        roomName,
        memberState.username,
        memberState.publicKey,
        socket,
      );
    }
  });
}

function handleEncryptedMessage(sender, encryptedData) {
  const senderState = clients.get(sender);
  const room = rooms.get(senderState.currentRoom);
  if (!room) return;

  const message = JSON.stringify({
    type: "encrypted_message",
    sender: senderState.username,
    iv: encryptedData.iv,
    tag: encryptedData.tag,
    content: encryptedData.content,
    keys: encryptedData.keys,
  });

  room.forEach((client) => {
    if (client !== sender) {
      client.write(message + "\n");
    }
  });
}

function handleLeaveRoom(socket) {
  const clientState = clients.get(socket);
  if (!clientState.currentRoom) {
    return sendError(socket, "Not in any room");
  }

  const roomName = clientState.currentRoom;
  const room = rooms.get(roomName);
  if (room) {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(roomName);
    } else {
      sendSystemMessage(roomName, `${clientState.username} left the room`);
    }
  }

  clientState.currentRoom = null;
  sendMessage(socket, "welcome", `Left room: ${roomName}`);
}

function handleDisconnect(socket) {
  const clientState = clients.get(socket);
  if (!clientState) return;

  if (clientState.currentRoom) {
    const roomName = clientState.currentRoom;
    const room = rooms.get(roomName);
    if (room) {
      room.delete(socket);
      if (room.size > 0) {
        sendSystemMessage(roomName, `${clientState.username} disconnected`);
      }
      if (room.size === 0) {
        rooms.delete(roomName);
      }
    }
  }

  clients.delete(socket);
  console.log("Client disconnected");
}

function sendKeyUpdate(roomName, username, publicKey, targetSocket = null) {
  const room = rooms.get(roomName);
  if (!room) return;

  const message = JSON.stringify({
    type: "key_update",
    body: {
      username: username,
      publicKey: publicKey,
    },
  });

  if (targetSocket) {
    targetSocket.write(message + "\n");
  } else {
    room.forEach((client) => {
      client.write(message + "\n");
    });
  }
}

function sendSystemMessage(roomName, content) {
  const room = rooms.get(roomName);
  if (!room) return;

  const message = JSON.stringify({
    type: "system",
    body: { content: content },
  });

  room.forEach((client) => {
    client.write(message + "\n");
  });
}

function sendMessage(socket, type, content) {
  const message = JSON.stringify({
    type: type,
    body: { content: content },
  });
  socket.write(message + "\n");
}

function sendError(socket, errorMessage) {
  sendMessage(socket, "error", errorMessage);
}

server.listen(port, () => {
  console.log(`Secure chat server listening on port ${port}`);
});
