var WILL = {
	color: Module.color.from(0, 151, 212),
	backgroundColor: Module.color.WHITE,

	strokes: new Array(),
	strokeWidth: 1.25,

	selection: {
		strokes: new Array(),

		show: function() {
			var dirtyArea = null;

			this.strokes.forEach(function(stroke) {
				stroke.color = Module.color.RED;
				dirtyArea = RectTools.union(dirtyArea, stroke.bounds);
			});

			WILL.redraw(dirtyArea);
		}
	},

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
		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

		this.strokeRenderer = new Module.StrokeRenderer(this.canvas, this.canvas);
		this.strokeRenderer.configure({brush: this.brush, color: this.color, width: this.strokeWidth});
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
		this.strokeRenderer.draw(this.pathPart, true);

		this.refresh();
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
		this.selection.strokes = new Array();

		var strokesToRemove = new Array();

		var intersector = new Module.Intersector();
		intersector.setTargetAsClosedPath(this.path);

		this.strokes.forEach(function(stroke) {
			var intersect = false;
			var intervals = intersector.intersectWithTarget(stroke);
			var subStrokes = new Array();

			for (var i = 0; i < intervals.size(); i++) {
				var interval = intervals.get(i);
				var subStroke = stroke.subStroke(interval.fromIndex, interval.toIndex, interval.fromTValue, interval.toTValue);

				if (interval.inside) {
					intersect = true;
					WILL.selection.strokes.push(subStroke);
				}

				subStrokes.push(subStroke);
			}

			if (intersect)
				strokesToRemove.push({stroke: stroke, replaceWith: subStrokes});
		}, this);

		intersector.delete();

		strokesToRemove.forEach(function(strokeToRemove) {
			this.strokes.replace(strokeToRemove.stroke, strokeToRemove.replaceWith);
		}, this);

		if (this.selection.strokes.length > 0)
			this.selection.show();
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