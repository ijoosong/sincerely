var WILL = {
	color: Module.color.from(0, 151, 212),
	backgroundColor: Module.color.from(190, 143, 1),

	strokeWidth: 1.25,

	init: function(width, height) {
		this.initInkEngine(width, height);
		this.initEvents();
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(width, height);
		this.canvas.clear(this.backgroundColor)

		this.maskLayer = this.canvas.createLayer();
		this.initImageLayer();

		this.brush = new Module.DirectBrush();
		this.pathBuilder = new Module.SpeedPathBuilder();
		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

		this.strokeRenderer = new Module.StrokeRenderer(this.canvas, this.canvas);
		this.strokeRenderer.configure({brush: this.brush, color: this.color, width: this.strokeWidth});
	},

	initImageLayer: function() {
		var url = location.toString();
		url = url.substring(0, url.lastIndexOf("/")) + "/image.png";

		GLTools.prepareTexture(
			Module.createTextureWithParams(GLctx.CLAMP_TO_EDGE, GLctx.LINEAR),
			url,
			function(texture) {
				this.imageLayer = this.canvas.createLayerFromGLTexture(texture.name, texture.image.width, texture.image.height, true);
				this.canvas.blendWithMode(this.imageLayer, Module.BlendMode.NONE);
			},
			this
		);
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
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;
		clearInterval(this.intervalID);
		delete this.intervalID;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.strokeRenderer.draw(this.pathPart, false);

		this.select();

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
	},

	select: function() {
		this.maskLayer.clear(Module.color.from(0, 0, 0));
		this.maskLayer.fillPath(this.path, Module.color.from(255, 255, 255), true);

		this.clear();
		this.canvas.blendWithMode(this.maskLayer, Module.BlendMode.MULTIPLY_NO_ALPHA);
	},

	clear: function() {
		this.canvas.clear(this.backgroundColor)
		this.canvas.blendWithMode(this.imageLayer, Module.BlendMode.NONE);
	}
};

Module.addPostScript(function() {
	WILL.init(1600, 600);
});