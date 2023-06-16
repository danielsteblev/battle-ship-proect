module.exports = class Observer { // Класс который позволяет реагировать на изменения
	watchers = new Set();

	subscribe(watcher) {
		this.watchers.add(watcher);

		return () => this.watchers.delete(watcher);
	}

	dispatch(...args) {
		for (const watcher of this.watchers) {
			watcher(...args);
		}
	}
};
