const Observer = require("./Observer"); // Класс партии;
const Shot = require("./Shot");

class Party extends Observer {
	player1 = null;
	player2 = null;

	turnPlayer = null;
	play = true;

	get nextPlayer() { // Ссылка на игрока со следующим ходом
		return this.turnPlayer === this.player1 ? this.player2 : this.player1;
	}

	constructor(player1, player2) {
		super();

		Object.assign(this, { player1, player2 }); // Запоминаем игроков;
		this.turnPlayer = player1;

		for (const player of [player1, player2]) {
			player.party = this; // Присвоим партию игрокам
			player.emit("statusChange", "play"); // Смена статуса игроков на "играющих";
		}

		this.turnUpdate();
	}

	turnUpdate() { // Обновление информации о ходе игрока;
		this.player1.emit("turnUpdate", this.player1 === this.turnPlayer);
		this.player2.emit("turnUpdate", this.player2 === this.turnPlayer);
	}

	stop() {
		if (!this.play) {
			return;
		}

		this.play = false;
		this.dispatch();

		this.player1.party = null;
		this.player2.party = null;

		this.player1 = null;
		this.player2 = null;
	}

	gaveup(player) { // Метод чтобы сдаться
		const { player1, player2 } = this;

		player1.emit("statusChange", player1 === player ? "loser" : "winner");
		player2.emit("statusChange", player2 === player ? "loser" : "winner");

		this.stop();
	}

	addShot(player, x, y) {
		if (this.turnPlayer !== player || !this.play) { // Если ход не текущего игрока - return;
			return;
		}

		const { player1, player2 } = this;
		const shot = new Shot(x, y);
		const result = this.nextPlayer.battlefield.addShot(shot);

		if (result) { // Если успешный выстрел
			const player1Shots = player1.battlefield.shots.map((shot) => ({
				x: shot.x,
				y: shot.y,
				variant: shot.variant,
			}));

			const player2Shots = player2.battlefield.shots.map((shot) => ({
				x: shot.x,
				y: shot.y,
				variant: shot.variant,
			}));

			player1.emit("setShots", player1Shots, player2Shots);
			player2.emit("setShots", player2Shots, player1Shots);

			if (shot.variant === "miss") { // Если промах
				this.turnPlayer = this.nextPlayer; // Меняем ход игрока на следующего
				this.turnUpdate(); // Обновляем ход
			}
		}

		if (player1.battlefield.loser || player2.battlefield.loser) {
			this.stop(); // Остановка партии

			player1.emit(
				"statusChange",
				player1.battlefield.loser ? "loser" : "winner"
			);

			player2.emit(
				"statusChange",
				player2.battlefield.loser ? "loser" : "winner"
			);
		}
	}

	sendMessage(message) { // Метод отправления сообщения всем
		const { player1, player2 } = this;

		player1.emit("message", message);
		player2.emit("message", message);
		

	}

	reconnection(player) { // Отправление информации заново после реконнекта
		player.emit(
			"reconnection",
			player.battlefield.ships.map((ship) => ({
				size: ship.size,
				direction: ship.direction,
				x: ship.x,
				y: ship.y,
			}))
		);

		const player1Shots = this.player1.battlefield.shots.map((shot) => ({
			x: shot.x,
			y: shot.y,
			variant: shot.variant,
		}));

		const player2Shots = this.player2.battlefield.shots.map((shot) => ({
			x: shot.x,
			y: shot.y,
			variant: shot.variant,
		}));

		if (player === this.player1) {
			player.emit("setShots", player1Shots, player2Shots);
		} else {
			player.emit("setShots", player2Shots, player1Shots);
		}

		player.emit("statusChange", "play");
		player.emit("turnUpdate", this.turnPlayer === player);

		if (!this.play) {
			player.emit(
				"statusChange",
				player.battlefield.loser ? "loser" : "winner"
			);
		}
	}
}

module.exports = Party;
