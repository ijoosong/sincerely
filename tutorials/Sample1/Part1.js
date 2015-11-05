var WILL = {
	backgroundColor: Module.color.WHITE,
	color: Module.color.from(204, 204, 204),

	init: function(width, height) {
		this.canvas = new Module.InkCanvas(width, height);
		this.canvas.clear(this.backgroundColor);

		this.brush = new Module.DirectBrush();

		this.pathBuilder = new Module.SpeedPathBuilder();
		this.pathBuilder.setNormalizationConfig(182, 3547);
		this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 2.05, 34.53, 0.72, NaN, Module.PropertyFunction.Power, 1.19, false);

		this.strokeRenderer = new Module.StrokeRenderer(this.canvas, this.canvas);
		this.strokeRenderer.configure({brush: this.brush, color: this.color});
	},

	draw: function() {
		var points = [0,300,10, 100,100,20, 400,100,40, 500,300,50];
		var path = this.pathBuilder.createPath(points);

		this.strokeRenderer.draw(path, true);
	}
};

Module.addPostScript(function() {
	WILL.init(1600, 600);
	WILL.draw();
});
