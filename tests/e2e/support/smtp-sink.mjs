// Minimal local SMTP server for tests: accepts any login and every message,
// and writes each one to a .eml file. Nothing leaves this machine.
import fs from "node:fs";
import net from "node:net";

const port = Number(process.argv[2] ?? 2526);
const dir = process.argv[3] ?? "./mail";
fs.mkdirSync(dir, { recursive: true });
let count = 0;

net
  .createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    let inData = false;
    let authStep = 0;
    let message = "";
    let recipients = [];
    const reply = (line) => socket.write(`${line}\r\n`);
    reply("220 sink ESMTP ready");

    socket.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            count += 1;
            // The folder may be emptied between runs while the sink keeps
            // running, so create it for every message.
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(
              `${dir}/${Date.now()}-${String(count).padStart(4, "0")}.eml`,
              `X-Sink-Recipients: ${recipients.join(", ")}\r\n${message}`,
            );
            message = "";
            recipients = [];
            reply("250 2.0.0 queued");
          } else {
            message += `${line.startsWith("..") ? line.slice(1) : line}\r\n`;
          }
          continue;
        }
        if (authStep === 1) {
          authStep = 2;
          reply("334 UGFzc3dvcmQ6");
          continue;
        }
        if (authStep === 2) {
          authStep = 0;
          reply("235 2.7.0 accepted");
          continue;
        }
        if (authStep === 3) {
          authStep = 0;
          reply("235 2.7.0 accepted");
          continue;
        }
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO"))
          socket.write(
            "250-sink\r\n250-AUTH PLAIN LOGIN\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n",
          );
        else if (upper.startsWith("HELO")) reply("250 sink");
        else if (upper.startsWith("AUTH PLAIN ")) reply("235 2.7.0 accepted");
        else if (upper === "AUTH PLAIN") {
          authStep = 3;
          reply("334 ");
        } else if (upper.startsWith("AUTH LOGIN")) {
          authStep = 1;
          reply("334 VXNlcm5hbWU6");
        } else if (upper.startsWith("MAIL FROM")) reply("250 2.1.0 ok");
        else if (upper.startsWith("RCPT TO")) {
          recipients.push(line.slice(8).trim());
          reply("250 2.1.5 ok");
        } else if (upper === "DATA") {
          inData = true;
          reply("354 end with .");
        } else if (upper === "RSET") {
          message = "";
          recipients = [];
          reply("250 ok");
        } else if (upper === "NOOP") reply("250 ok");
        else if (upper === "QUIT") {
          reply("221 bye");
          socket.end();
        } else reply("250 ok");
      }
    });
    socket.on("error", () => {});
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`SMTP sink on ${port}, writing to ${dir}`),
  );
