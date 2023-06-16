// Зависимости
const session = require("express-session");
const express = require("express"); // Создание приложения
const fs = require("fs");
const path = require("path");

const PartyManager = require("./src/PartyManager");
const pm = new PartyManager();

// Создание приложения ExpressJS
const app = express();
const http = require("http").createServer(app);

// Регистраци Socket приложения
const io = require("socket.io")(http);
const port = 3000; // Слушаем порт 3000 

// Настройка сессий
const sessionMiddleware = session({
	secret: "s3Cur3",
	name: "sessionId",
});

app.set("trust proxy", 1); // trust first proxy
app.use(sessionMiddleware);

// Настройка статики: чтобы видеть фронтенд на своём сервере
app.use(express.static("./../client-zagorodnev_g/"));

// По умолчанию вернём файл index.html
app.use("*", (req, res) => {
	res.type("html");
	res.send(fs.readFileSync(path.join(__dirname, "./../client-zagorodnev_g/index.html")));
});

// Поднятие сервера
http.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});

io.use((socket, next) => {
	sessionMiddleware(socket.request, {}, next);
});

// Прослушивание socket соединений
io.on("connection", (socket) => {
	pm.connection(socket); // Передаём в PartyManager новое подключение
	io.emit("playerCount", io.engine.clientsCount); // Отправка всем пользователям количества онлайна на сайте

	// Отключение коннекта
	socket.on("disconnect", () => {
		pm.disconnect(socket);
		io.emit("playerCount", io.engine.clientsCount); // Отправка всем пользователям количества онлайна на сайте
	});

	// // Поиск случайного соперника
	// socket.on("findRandomOpponent", () => {
	// 	socket.emit("statusChange", "randomFinding");

	// 	pm.playRandom(socket);
	// });
});
