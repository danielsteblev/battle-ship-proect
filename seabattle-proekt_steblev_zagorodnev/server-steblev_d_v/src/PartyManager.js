const Player = require("./Player"); // Класс всех партий
const Party = require("./Party");
const Ship = require("./Ship");
const { getRandomString } = require("./additional");

const RECONNECTION_TIMER = 5000;

module.exports = class PartyManager {
	players = []; // Хранилище socket-соединений(ключей сессии)
	parties = [];

	waitingRandom = [];
	waitingChallenge = new Map();

	reconnections = new Map();

	connection(socket) {
		const sessionId = socket.request.sessionID;
		let player = this.players.find((player) => player.sessionId === sessionId);

		if (player) {
			player.socket.emit("doubleConnection");
			player.socket.disconnect();
			player.socket = socket;

			if (this.reconnections.has(player)) {
				clearTimeout(this.reconnections.get(player));
				this.reconnections.delete(player);

				if (player.party) {
					player.party.reconnection(player);
				}
			}
		} else {
			player = new Player(socket, sessionId);
			this.players.push(player);
		}

		const isFree = () => {
			if (this.waitingRandom.includes(player)) {
				return false;
			}

			const values = Array.from(this.waitingChallenge.values());

			if (values.includes(player)) {
				return false;
			}

			if (player.party) {
				return false;
			}

			return true;
		};

		socket.on("shipSet", (ships) => { // Метод расстановки кораблей (связь клиента и сервера);
			if (!isFree()) {
				return;
			}

			player.battlefield.clear();
			for (const { size, direction, x, y } of ships) {
				const ship = new Ship(size, direction);
				player.battlefield.addShip(ship, x, y);
			}
		});

		socket.on("findRandomOpponent", () => {
			if (!isFree()) {
				return;
			}

			this.waitingRandom.push(player);
			player.emit("statusChange", "randomFinding"); // Cмена статуса на "ожидающий"

			if (this.waitingRandom.length >= 2) { // Если ожидающих >2;
				const [player1, player2] = this.waitingRandom.splice(0, 2); 
				const party = new Party(player1, player2); // Cоздаём для них партию;
				this.parties.push(party); // Добавляем партию в массив партий;

				const unsubcribe = party.subscribe(() => {
					this.removeParty(party); // Удаляем партию из всех партий
					unsubcribe();
				});
			}
		});

		socket.on("challengeOpponent", (key = "") => {
			if (!isFree()) {
				return;
			}

			if (this.waitingChallenge.has(key)) {
				const opponent = this.waitingChallenge.get(key);
				this.waitingChallenge.delete(key);

				const party = new Party(opponent, player);
				this.parties.push(party);
			} else {
				key = getRandomString(20);
				socket.emit("challengeOpponent", key);
				socket.emit("statusChange", "waiting");

				this.waitingChallenge.set(key, player);
			}
		});

		socket.on("gaveup", () => {
			if (player.party) {
				player.party.gaveup(player);
			}

			if (this.waitingRandom.includes(player)) {
				const index = this.waitingRandom.indexOf(player);
				this.waitingRandom.splice(index, 1);
			}

			const values = Array.from(this.waitingChallenge.values());
			if (values.includes(player)) {
				const index = values.indexOf(player);
				const keys = Array.from(this.waitingChallenge.keys());
				const key = keys[index];
				this.waitingChallenge.delete(key);
			}
		});

		socket.on("addShot", (x, y) => {
			if (player.party) {
				player.party.addShot(player, x, y);
			}
		});

		socket.on("message", (message) => {
			if (player.party) { // Если игрок в партии
				player.party.sendMessage(message); // Выводим сообщение всем
			}
		});
	}

	disconnect(socket) {
		const player = this.players.find((player) => player.socket === socket);

		if (!player) {
			return;
		}

		if (player.party) {
			const flag = setTimeout(() => {
				this.reconnections.delete(player);

				if (player.party) {
					player.party.gaveup(player);
				}

				this.removePlayer(player);
			}, RECONNECTION_TIMER);

			this.reconnections.set(player, flag);
		}

		if (this.waitingRandom.includes(player)) {
			const index = this.waitingRandom.indexOf(player);
			this.waitingRandom.splice(index, 1);
		}

		const values = Array.from(this.waitingChallenge.values());
		if (values.includes(player)) {
			const index = values.indexOf(player);
			const keys = Array.from(this.waitingChallenge.keys());
			const key = keys[index];
			this.waitingChallenge.delete(key);
		}
	}

	addPlayer(player) {
		if (this.players.includes(player)) {
			return false; // Если такой игрок уже есть - возвращаем false;
		}

		this.players.push(player);

		return true;
	}

	removePlayer(player) {
		if (!this.players.includes(player)) {
			return false;
		}

		const index = this.players.indexOf(player);
		this.players.splice(index, 1);

		if (this.waitingRandom.includes(player)) {
			const index = this.waitingRandom.indexOf(player);
			this.waitingRandom.splice(index, 1);
		}

		return true;
	}

	removeAllPlayers() {
		const players = this.players.slice(); // Создание копии массива игроков

		for (const player of players) {
			this.removePlayer(player);
		}

		return players.length;
	}

	addParty(party) {
		if (this.parties.includes(party)) {
			return false;
		}

		this.parties.push(party);

		return true;
	}

	removeParty(party) {
		if (!this.parties.includes(party)) {
			return false;
		}

		const index = this.parties.indexOf(party);
		this.parties.splice(index, 1);

		return true;
	}

	removeAllparties() {
		const parties = this.parties.slice(); // Копия массива партий

		for (const party of parties) {
			this.removeParty(party);
		}

		return parties.length;
	}

	playRandom(player) {
		if (this.waitingRandom.includes(player)) {
			return false;
		}

		this.waitingRandom.push(player);

		if (this.waitingRandom.length >= 2) { // Если игры ждут >2 игроков, создаём партию и "соединяем" их;
			const [player1, player2] = this.waitingRandom.splice(0, 2);
			const party = new Party(player1, player2);
			this.addParty(party);
		}

		return true;
	}
};
