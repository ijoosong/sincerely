var WILL = {
	backgroundColor: Module.color.WHITE,

	strokes: new Array(),

	init: function(width, height) {
		this.initInkEngine(width, height);
		this.initEvents();
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(width, height);
		this.strokesLayer = this.canvas.createLayer();

		this.clear();

		this.brush = new Module.DirectBrush();

		this.pathBuilder = new Module.SpeedPathBuilder();
		this.pathBuilder.setNormalizationConfig(720, 3900);
		this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 8, 112, 4, 4, Module.PropertyFunction.Power, 1, false);

		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);
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
		this.erase({x: e.clientX, y: e.clientY});
	},

	moveStroke: function(e) {
		if (!this.inputPhase) return;

		var self = this;
		this.pointerPos = {x: e.clientX, y: e.clientY};

		this.inputPhase = Module.InputPhase.Move;
		if (this.intervalID) return;

		var lastPointerPos = this.pointerPos;
		this.erase(this.pointerPos);

		this.intervalID = setInterval(function() {
			if (self.inputPhase && lastPointerPos != self.pointerPos) {
				self.erase(self.pointerPos);
				lastPointerPos = self.pointerPos;
			}
		}, 16);
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;
		clearInterval(this.intervalID);
		delete this.intervalID;

		this.erase({x: e.clientX, y: e.clientY});

		delete this.inputPhase;
	},

	buildPath: function(pos) {
		if (this.inputPhase == Module.InputPhase.Begin)
			this.smoothener.reset();

		var pathPart = this.pathBuilder.addPoint(this.inputPhase, pos, Date.now()/1000);
		var smoothedPathPart = this.smoothener.smooth(pathPart, this.inputPhase == Module.InputPhase.End);
		var pathContext = this.pathBuilder.addPathPart(smoothedPathPart);

		this.pathPart = pathContext.getPathPart();
	},

	erase: function(pointerPos) {
		this.buildPath(pointerPos);

		var intersector = new Module.Intersector();
		intersector.setTargetAsStroke(this.pathPart, NaN);

		var dirtyArea = null;
		var strokesToRemove = new Array();

		this.strokes.forEach(function(stroke) {
			if (intersector.isIntersectingTarget(stroke)) {
				dirtyArea = RectTools.union(dirtyArea, stroke.bounds);
				strokesToRemove.push(stroke);
			}
		}, this);

		strokesToRemove.forEach(function(stroke) {
			this.strokes.remove(stroke);
		}, this);

		if (dirtyArea)
			this.redraw(dirtyArea);

		intersector.delete();
	},

	redraw: function(dirtyArea) {
		if (!dirtyArea) dirtyArea = this.canvas.bounds;
		dirtyArea = RectTools.ceil(dirtyArea);

		this.strokesLayer.clearArea(dirtyArea, this.backgroundColor);

		this.strokes.forEach(function(stroke) {
			var affectedArea = RectTools.intersect(stroke.bounds, dirtyArea);
			if (affectedArea) WILL.strokesLayer.draw(stroke);
		}, this);

		this.refresh(dirtyArea);
	},

	refresh: function(dirtyArea) {
		if (dirtyArea)
			this.canvas.blendWithRect(this.strokesLayer, RectTools.ceil(dirtyArea), Module.BlendMode.NONE);
		else
			this.canvas.blendWithMode(this.strokesLayer, Module.BlendMode.NONE);
	},

	clear: function() {
		this.strokes = new Array();

		this.strokesLayer.clear(this.backgroundColor);
		this.canvas.clear(this.backgroundColor);
	},

	restore: function(fileBuffer) {
		var fileDecoder = new Module.WILLDecoder(fileBuffer);
		fileDecoder.decode();

		var strokes = Module.InkDecoder.decode(fileDecoder.ink);
		this.strokes.pushArray(strokes);
		this.redraw(strokes.dirtyArea);
	}
};

Module.addPostScript(function() {
	Module.InkDecoder.getStrokeBrush = function(paint) {
		return WILL.brush;
	}

	WILL.init(1600, 600);

	var url = location.toString();
	url = url.substring(0, url.lastIndexOf("/")) + "/ship.will";

	var request = new XMLHttpRequest();

	request.onreadystatechange = function() {
		 if (this.readyState == this.DONE) {
			WILL.restore(this.response);
		}
	};

	request.open("GET", url, true);
	request.responseType = "arraybuffer";
	request.send();
});