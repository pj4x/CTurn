const net = require("net");
const readline = require("readline");

const client = net.createConnection({ port: 1337 }, () => {
  console.log("Connected to server");
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Username setup flow
rl.question("Choose a username: ", (username) => {
  // Send username packet
  const message = JSON.stringify({
    type: "username",
    body: { content: username },
  });
  client.write(message + "\n");

  // Set up regular input handling
  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", (input) => {
    let type = "message";
    let content = input;

    if (input.startsWith("/")) {
      const parts = input.slice(1).split(" ");
      type = parts[0];
      content = parts.slice(1).join(" ");

      // Special case for leave command
      if (type === "leave") {
        content = ""; // Send empty content
      }
    }

    const message = JSON.stringify({
      type: type,
      body: { content: content },
    });

    client.write(message + "\n");
    rl.prompt();
  });
});

// Message handling
client.on("data", (data) => {
  const messages = data.toString().split("\n");
  messages.forEach((msg) => {
    if (msg.trim()) {
      try {
        const parsed = JSON.parse(msg);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log("Received:", msg.trim());
      }
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

// Handle CTRL+C gracefully
rl.on("SIGINT", () => {
  client.end();
  rl.close();
});
