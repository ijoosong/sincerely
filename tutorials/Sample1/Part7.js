var WILL = {
	backgroundColor: Module.color.WHITE,
	color: Module.color.from(204, 204, 204),

	init: function(width, height) {
		Module.canvas.width = width;
		Module.canvas.height = height;

		Module.canvas.style.backgroundColor = Module.color.toHex(this.backgroundColor);

		this.context = Module.canvas.getContext("2d");

		this.bezierPath = new Module.BezierPath();
	},

	draw: function() {
		var points = [0,300,10, 100,100,20, 400,100,40, 500,300,50];
		var path = Module.PathBuilder.createPath(points, 3);
		var strokeData = {path: path, color: this.color};

		this.bezierPath.setStroke(strokeData);

		this.context.drawBezierPath(this.bezierPath);
	}
};

Module.addPostScript(function() {
	WILL.init(1600, 600);
	WILL.draw();
});