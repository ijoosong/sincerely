var WILL = {
	backgroundColor: Module.color.WHITE,
	color: Module.color.from(204, 204, 204),

	strokes: new Array(),

	init: function(width, height) {
		this.initInkEngine(width, height);
		this.initEvents();
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(width, height);
		this.strokesLayer = this.canvas.createLayer();

		this.clear();

		this.brush = new Module.SolidColorBrush();

		this.pathBuilder = new Module.SpeedPathBuilder();
		this.pathBuilder.setNormalizationConfig(5, 210);
		this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 1, 3.2, NaN, NaN, Module.PropertyFunction.Sigmoid, 0.6, true);

		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

		this.strokeRenderer = new Module.StrokeRenderer(this.canvas);
		this.strokeRenderer.configure({brush: this.brush, color: this.color});
	},

	initEvents: function() {
		var self = this;
		$(Module.canvas).on("mousedown", function(e) {self.beginStroke(e);});
		$(Module.canvas).on("mousemove", function(e) {self.moveStroke(e);});
		$(document).on("mouseup", function(e) {self.endStroke(e);});
	},

	beginStroke: function(e) {
		if (e.button != 0) return;

		this.inputPhase = Module.InputPhase.Begin;

		this.buildPath({x: e.clientX, y: e.clientY});

		this.strokeRenderer.draw(this.pathPart, false);
		this.strokeRenderer.blendUpdatedArea();
	},

	moveStroke: function(e) {
		if (!this.inputPhase) return;

		var self = this;
		this.pointerPos = {x: e.clientX, y: e.clientY};

		this.inputPhase = Module.InputPhase.Move;
		if (this.intervalID) return;

		var lastPointerPos = this.pointerPos;
		this.drawPoint();

		this.intervalID = setInterval(function() {
			if (self.inputPhase && lastPointerPos != self.pointerPos) {
				self.drawPoint();
				lastPointerPos = self.pointerPos;
			}
		}, 16);
	},

	drawPoint: function() {
		this.buildPath(this.pointerPos);

		this.strokeRenderer.draw(this.pathPart, false);
		this.strokeRenderer.drawPreliminary(this.preliminaryPathPart);

		this.canvas.clearArea(this.strokeRenderer.updatedArea, this.backgroundColor);
		this.canvas.blendWithRect(this.strokesLayer, this.strokeRenderer.updatedArea, Module.BlendMode.NORMAL);

		this.strokeRenderer.blendUpdatedArea();
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;
		clearInterval(this.intervalID);
		delete this.intervalID;

		this.buildPath({x: e.clientX, y: e.clientY});

		this.strokeRenderer.draw(this.pathPart, true);
		this.strokeRenderer.blendStroke(this.strokesLayer, Module.BlendMode.NORMAL);

		this.canvas.clearArea(this.strokeRenderer.updatedArea, this.backgroundColor);
		this.canvas.blendWithRect(this.strokesLayer, this.strokeRenderer.updatedArea, Module.BlendMode.NORMAL);

		var stroke = new Module.Stroke(this.brush, this.path, NaN, this.color, 0, 1);
		this.strokes.push(stroke);

		delete this.inputPhase;
	},

	buildPath: function(pos) {
		if (this.inputPhase == Module.InputPhase.Begin)
			this.smoothener.reset();

		var pathPart = this.pathBuilder.addPoint(this.inputPhase, pos, Date.now()/1000);
		var smoothedPathPart = this.smoothener.smooth(pathPart, this.inputPhase == Module.InputPhase.End);
		var pathContext = this.pathBuilder.addPathPart(smoothedPathPart);

		this.pathPart = pathContext.getPathPart();
		this.path = pathContext.getPath();

		var preliminaryPathPart = this.pathBuilder.createPreliminaryPath();
		var preliminarySmoothedPathPart = this.smoothener.smooth(preliminaryPathPart, true);

		this.preliminaryPathPart = this.pathBuilder.finishPreliminaryPath(preliminarySmoothedPathPart);
	},

	clear: function() {
		this.strokes = new Array();

		this.strokesLayer.clear(this.backgroundColor);
		this.canvas.clear(this.backgroundColor);
	}
};

Module.addPostScript(function() {
	WILL.init(1600, 600);
});