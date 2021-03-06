var WILL = {
	color: Module.color.from(0, 151, 212),
	backgroundColor: Module.color.WHITE,

	strokes: new Array(),
	strokeWidth: 1.25,

	selection: {
		strokes: new Array(),

		show: function(color) {
			var dirtyArea = null;

			this.strokes.forEach(function(stroke) {
				stroke.color = color;
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

		this.brush = new Module.SolidColorBrush();
		this.pathBuilder = new Module.SpeedPathBuilder();
		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

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
		this.writer.strokeRenderer.draw(this.pathPart, false);
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
		this.writer.strokeRenderer.draw(this.pathPart, false);

		if (this.writer.strokeRenderer.updatedArea)
			this.refresh(this.writer.strokeRenderer.updatedArea);
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;
		clearInterval(this.intervalID);
		delete this.intervalID;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.writer.strokeRenderer.draw(this.pathPart, true);

		this.refresh(this.writer.strokeRenderer.strokeBounds);
		this.select();

		delete this.inputPhase;
	},

	select: function() {
		var group = new Module.VectorUnsignedInt();

		var intersector = new Module.Intersector();
		intersector.setTargetAsClosedPath(this.path);

		this.strokes.forEach(function(stroke) {
			if (intersector.isIntersectingTarget(stroke))
				group.push(this.strokes.indexOf(stroke));
		}, this);

		if (group.length > 0) {
			client.encoder.encodeUpdateColor(group, this.writer.color);
			client.send();
		}

		group.delete();
		intersector.delete();
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

			this.writer.strokeRenderer.blendUpdatedArea();
		}
		else {
			this.canvas.clearArea(dirtyArea, this.backgroundColor);
			this.canvas.blendWithRect(this.strokesLayer, dirtyArea, Module.BlendMode.NORMAL);
		}
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
	this.color = (id == 0)?Module.color.RED:Module.color.GREEN;

	this.strokeRenderer = new Module.StrokeRenderer(WILL.canvas);
	this.strokeRenderer.configure({brush: WILL.brush, color: WILL.color, width: WILL.strokeWidth});
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

		onUpdateColor: function(writer, group, color) {
			WILL.selection.strokes = new Array();

			group.forEach(function(strokeIDX) {
				var stroke = WILL.strokes[strokeIDX];
				WILL.selection.strokes.push(stroke);
			});

			WILL.selection.show(color);
		},

		onUpdateBlendMode: function(writer, group, blendMode) {},

		onSplit: function(writer, splits) {},

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