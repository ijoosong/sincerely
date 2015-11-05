var server = {
	latency: false,
	users: [],
	net: [],

	init: function() {
		$("iframe").each(function(i, iframe) {
			var user = {};
			user.id = i;
			user.name = iframe.name;
			user.target = iframe;
			user.window = iframe.contentWindow;

			server.users.push(user);
			server.net.push(new Array());
		});

		this.ready = this.users.length;
	},

	getSessionID: function(userName) {
		var result;

		for (var i = 0; i < this.users.length; i++) {
			var user = this.users[i];

			if (userName == user.name) {
				user.client = user.window.client;
				result = user.id;

				this.ready--;

				break;
			}
		}

		return result;
	},

	send: function(recipients, sender, data) {
		if (this.ready > 0) {
			setTimeout(function(recipients, sender, data) {
				server.send(recipients, sender, data);
			}, 20, recipients, sender, data);

			return;
		}

		recipients.forEach(function(recipient) {
			var callback = (function(recipient, sender, data) {
				return function() {
					server.users[recipient].client.receive(sender, data);
				}
			})(recipient, sender, data);

			this.late(recipient, callback);
		}, this);
	},

	late: function(recipient, callback) {
		var queue = this.net[recipient];
		if (callback) this.net[recipient].push(callback);

		if (!queue.locked) {
			var timeout = this.latency?Math.randomInt(50, 100):0;

			if (timeout == 0)
				queue.shift().call(server);
			else {
				queue.locked = true;

				setTimeout(function(queue, recipient) {
					queue.shift().call(server);
					queue.locked = false;
					if (queue.length > 0) server.late(recipient);
				}, timeout, queue, recipient);
			}
		}
	},

	receive: function(sender, data, compose) {
		var recipients = [];

		this.users.forEach(function(user) {
			if (!compose || user.id != sender)
				recipients.push(user.id);
		}, this);

		this.send(recipients, sender, data);
	},

	clear: function() {
		this.users.forEach(function(user) {
			this.late(user.id, function() {
				user.window.WILL.clearCanvas();
			});
		}, this);
	}
};

$(document).ready(function() {
	server.init();
});