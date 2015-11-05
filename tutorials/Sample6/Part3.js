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

		this.brush = new Module.SolidColorBrush();

		this.pathBuilder = new Module.SpeedPathBuilder();
		this.pathBuilder.setNormalizationConfig(182, 3547);
		this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 2.05, 34.53, 0.72, NaN, Module.PropertyFunction.Power, 1.19, false);

		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

		this.viewArea = this.strokesLayer.bounds;

		client.init();

		this.writer = new Writer(client.id);
		client.writers[client.id] = this.writer;

		this.clearCanvas();
	},

	initEvents: function() {
		var self = this;
		$(Module.canvas).on("mousedown", function(e) {self.beginStroke(e);});
		$(Module.canvas).on("mousemove", function(e) {self.moveStroke(e);});
		$(document).on("mouseup", function(e) {self.endStroke(e);});
	},

	beginStroke: function(e) {
		if (["mousedown", "mouseup"].contains(e.type) && e.button != 0) return;

		this.inputPhase = Module.InputPhase.Begin;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.erase();
	},

	moveStroke: function(e) {
		if (!this.inputPhase) return;

		var self = this;
		this.pointerPos = {x: e.clientX, y: e.clientY};

		this.inputPhase = Module.InputPhase.Move;
		if (this.intervalID) return;

		var lastPointerPos = this.pointerPos;
		this.buildPath(this.pointerPos);
		this.erase();

		this.intervalID = setInterval(function() {
			if (self.inputPhase && lastPointerPos != self.pointerPos) {
				self.buildPath(self.pointerPos);
				self.erase();

				lastPointerPos = self.pointerPos;
			}
		}, 16);
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;
		clearInterval(this.intervalID);
		delete this.intervalID;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.erase();

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

	erase: function() {
		var result = new Array;

		var intersector = new Module.Intersector();
		intersector.setTargetAsStroke(this.pathPart, NaN);

		this.strokes.forEach(function(stroke) {
			var intervals = intersector.intersectWithTarget(stroke);
			var split = stroke.split(intervals, intersector.targetType);

			if (split.intersect) {
				split.id = this.strokes.indexOf(stroke);
				result.push(split);
			}
		}, this);

		if (result.length > 0) {
			client.encoder.encodeSplit(result);
			client.send();
		}
	},

	redraw: function(dirtyArea) {
		if (!dirtyArea) dirtyArea = this.canvas.bounds;
		dirtyArea = RectTools.ceil(dirtyArea);

		this.strokesLayer.clearArea(dirtyArea, Module.color.TRANSPERENT);

		this.strokes.forEach(function(stroke) {
			var affectedArea = RectTools.intersect(stroke.bounds, dirtyArea);

			if (affectedArea) {
				this.writer.strokeRenderer.draw(stroke);
				this.writer.strokeRenderer.blendStroke(this.strokesLayer, stroke.blendMode);
			}
		}, this);

		this.refresh(dirtyArea);
	},

	refresh: function(dirtyArea) {
		if (!dirtyArea) dirtyArea = this.canvas.bounds;
		dirtyArea = RectTools.ceil(dirtyArea);

		if (this.inputPhase && this.inputPhase == Module.InputPhase.Move) {
			this.writer.strokeRenderer.drawPreliminary(this.preliminaryPathPart);

			this.canvas.clearArea(dirtyArea, this.backgroundColor);
			this.canvas.blendWithRect(this.strokesLayer, dirtyArea, Module.BlendMode.NORMAL);
		}

		this.canvas.clearArea(dirtyArea, this.backgroundColor);
		this.canvas.blendWithRect(this.strokesLayer, dirtyArea, Module.BlendMode.NORMAL);
	},

	clear: function() {
		parent.server.clear();
	},

	clearCanvas: function() {
		this.strokes = new Array();

		this.strokesLayer.clear(this.backgroundColor);
		this.canvas.clear(this.backgroundColor);
	},

	restore: function(fileBuffer) {
		var fileDecoder = new Module.WILLDecoder(fileBuffer);
		fileDecoder.decode();

		var strokes = Module.InkDecoder.decode(fileDecoder.ink);

		client.encoder.encodeAdd(strokes);
		client.send();
	}
};

function Writer(id) {
	this.id = id;

	this.strokeRenderer = new Module.StrokeRenderer(WILL.canvas);
	this.strokeRenderer.configure({brush: WILL.brush, color: Module.color.BLACK});
}

var client = {
	name: window.name,
	writers: [],

	init: function() {
		this.id = parent.server.getSessionID(this.name);

		this.encoder = new Module.PathOperationEncoder();
		this.decoder = new Module.PathOperationDecoder(Module.PathOperationDecoder.getPathOperationDecoderCallbacksHandler(this.callbacksHandlerImplementation));
	},

	send: function(compose) {
		parent.server.receive(this.id, Module.readBytes(this.encoder.getBytes()), compose);
		this.encoder.reset();
	},

	receive: function(sender, data) {
		var writer = this.writers[sender];

		if (!writer) {
			writer = new Writer(sender);
			this.writers[sender] = writer;
		}

		Module.writeBytes(data, function(int64Ptr) {
			this.decoder.decode(writer, int64Ptr);
		}, this);
	},

	callbacksHandlerImplementation: {
		onComposeStyle: function(writer, style) {},

		onComposePathPart: function(writer, path, endStroke) {},

		onComposeAbort: function(writer) {},

		onAdd: function(writer, strokes) {
			WILL.strokes.pushArray(strokes);
			WILL.redraw(strokes.dirtyArea);
		},

		onRemove: function(writer, group) {},

		onUpdateColor: function(writer, group, color) {},

		onUpdateBlendMode: function(writer, group, blendMode) {},

		onSplit: function(writer, splits) {
			var strokesToRemove = new Array();

			splits.forEach(function(split) {
				var stroke = WILL.strokes[split.id];
				var replaceWith = new Array();

				split.intervals.forEach(function(interval) {
					var subStroke = stroke.subStroke(interval.fromIndex, interval.toIndex, interval.fromTValue, interval.toTValue);
					replaceWith.push(subStroke);
				}, this);

				strokesToRemove.push({stroke: stroke, replaceWith: replaceWith});
			}, this);

			strokesToRemove.forEach(function(strokeToRemove) {
				WILL.strokes.replace(strokeToRemove.stroke, strokeToRemove.replaceWith);
			}, this);

			if (strokesToRemove.length > 0)
				WILL.redraw(splits.affectedArea);
		},

		onTransform: function(writer, group, mat) {}
	}
};

var env = {
	width: top.document.getElementById(window.name).scrollWidth,
	height: top.document.getElementById(window.name).scrollHeight
};

Module.addPostScript(function() {
	Module.InkDecoder.getStrokeBrush = function(paint, writer) {
		return WILL.brush;
	}

	WILL.init(env.width, env.height);

	if (client.id == 0) {
		var url = location.toString();
		url = url.substring(0, url.lastIndexOf("/")) + "/ship.will";

		var request = new XMLHttpRequest();

		request.onreadystatechange = function() {
			 if (this.readyState == this.DONE)
				WILL.restore(this.response);
		};

		request.open("GET", url, true);
		request.responseType = "arraybuffer";
		request.send();
	}
});