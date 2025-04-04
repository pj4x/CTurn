const net = require("net");
const port = 1337;

const clients = new Map(); // socket -> { currentRoom, username, pubkey }
const rooms = new Map(); // roomName -> Set<socket>

const server = net.createServer((socket) => {
  console.log("Client connected");

  clients.set(socket, {
    currentRoom: null,
    username: null,
    pubkey: null,
  });

  socket.setEncoding("utf8");

  socket.on("data", (data) => {
    try {
      const messages = data.trim().split("\n");
      messages.forEach((chunk) => {
        if (chunk.trim()) {
          const message = JSON.parse(chunk);
          handleMessage(socket, message);
        }
      });
    } catch (err) {
      sendError(socket, "Invalid JSON format");
    }
  });

  socket.on("end", () => handleDisconnect(socket));
  socket.on("error", () => handleDisconnect(socket));
});

function handleMessage(socket, message) {
  const clientState = clients.get(socket);

  if (!message.type || !message.body) {
    return sendError(socket, "Invalid message format");
  }

  if (message.type !== "leave" && !message.body.content) {
    return sendError(socket, "Invalid message content");
  }

  if (!clientState.username && message.type !== "username") {
    return sendError(socket, "You must set a username first");
  }

  switch (message.type) {
    case "username":
      handleSetUsername(socket, message.body.content, message.body.pubkey);
      break;
    case "create":
      handleCreateRoom(socket, message.body.content);
      break;
    case "join":
      handleJoinRoom(socket, message.body.content);
      break;
    case "message":
      if (!clientState.currentRoom) {
        return sendError(socket, "You must join a room first");
      }
      broadcastRoomMessage(socket, clientState.currentRoom, message.body);
      break;
    case "leave":
      handleLeaveRoom(socket);
      break;
    default:
      sendError(socket, "Invalid message type");
  }
}

function handleSetUsername(socket, username, pubkey) {
  const clientState = clients.get(socket);
  if (clientState.username) {
    return sendError(socket, "Username already set");
  }

  username = username.trim();
  if (!username) {
    return sendError(socket, "Username cannot be empty");
  }

  clientState.username = username;
  clientState.pubkey = pubkey;

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
  sendSystemMessage(roomName, `${clientState.username} created the room`);
  sendPublicKeysToRoom(roomName);
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
  sendSystemMessage(
    roomName,
    `${clientState.username} joined the room`,
    socket,
  );
  sendPublicKeysToRoom(roomName);
}

function handleLeaveRoom(socket) {
  const clientState = clients.get(socket);

  if (!clientState.currentRoom) {
    return sendError(socket, "Not in any room");
  }

  const roomName = clientState.currentRoom;
  const room = rooms.get(roomName);
  const username = clientState.username;

  if (room) {
    room.delete(socket);
    sendSystemMessage(roomName, `${username} left the room`);
    if (room.size === 0) {
      rooms.delete(roomName);
    }
  }

  clientState.currentRoom = null;
  sendMessage(socket, "welcome", `Left room: ${roomName}`);
}

function broadcastRoomMessage(sender, roomName, body) {
  const room = rooms.get(roomName);
  if (!room) return;

  const senderState = clients.get(sender);

  const message = JSON.stringify({
    type: "message",
    sender: senderState.username,
    body: {
      content: body.content,
      encrypted: body.encrypted,
      to: body.to,
    },
  });

  room.forEach((client) => {
    if (clients.get(client).username === body.to) {
      client.write(message + "\n");
    }
  });
}

function handleDisconnect(socket) {
  const clientState = clients.get(socket);
  const username = clientState.username;

  if (clientState.currentRoom) {
    const roomName = clientState.currentRoom;
    const room = rooms.get(roomName);

    if (room) {
      room.delete(socket);
      if (room.size > 0) {
        sendSystemMessage(roomName, `${username} disconnected`);
      }
      if (room.size === 0) {
        rooms.delete(roomName);
      }
    }
  }

  clients.delete(socket);
  console.log("Client disconnected");
}

function sendSystemMessage(roomName, content, excludeSocket = null) {
  const room = rooms.get(roomName);
  if (!room) return;

  const message = JSON.stringify({
    type: "system",
    body: { content },
  });

  room.forEach((client) => {
    if (client !== excludeSocket) {
      client.write(message + "\n");
    }
  });
}

function sendMessage(socket, type, content) {
  const message = JSON.stringify({
    type,
    body: { content },
  });
  socket.write(message + "\n");
}

function sendError(socket, errorMessage) {
  sendMessage(socket, "error", errorMessage);
}

function sendPublicKeysToRoom(roomName) {
  const room = rooms.get(roomName);
  if (!room) return;

  room.forEach((sender) => {
    const state = clients.get(sender);
    if (!state?.pubkey) return;

    const msg = JSON.stringify({
      type: "pubkey",
      sender: state.username,
      body: { content: state.pubkey },
    });

    room.forEach((receiver) => {
      if (receiver !== sender) {
        receiver.write(msg + "\n");
      }
    });
  });
}

server.listen(port, () => {
  console.log(`TCP server listening on port ${port}`);
});

server.on("error", (err) => {
  console.error(`Server error: ${err.message}`);
});
